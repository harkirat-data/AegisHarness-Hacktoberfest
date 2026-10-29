/**
 * AegisHarness Frontend App
 * Connects Red Team, Target Sandbox, and Blue Team views to the real API.
 */

// ===== STATE =====
const state = {
  currentTab: 'red-team',
  activeMode: 'company',
  activeModel: 'qwen2.5:3b',
  sessionId: `ui-${Date.now()}`,
  chatHistory: [],
  allEvents: [],
  eventsFilter: 'all',
  stats: { total: 0, threats: 0, blocked: 0, permitted: 0, ledgerBlocks: 0, integrity: null },
  ws: null,
  wsRetries: 0,
  isQuarantined: false,
};

// ===== TAB NAVIGATION =====
function switchTab(tab, btn) {
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  const target = document.getElementById(`pane-${tab}`) || document.getElementById(`tab-${tab}`);
  if (target) target.classList.add('active');
  if (btn) btn.classList.add('active');
  state.currentTab = tab;

  if (tab === 'sandbox' || tab === 'target') {
    loadSandboxFiles();
  }
  if (tab === 'blue-team' || tab === 'blue') {
    loadLedger();
    refreshStats();
  }
}

// ===== AGENT MODE =====
function setMode(mode, btn) {
  state.activeMode = mode;
  document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const hint = document.getElementById('mode-hint');
  if (hint) {
    hint.textContent =
      mode === 'company' ? 'Company documents, policies, and records only' : 'General knowledge assistant mode';
  }
}

// ===== MODEL SELECT =====
document.addEventListener('DOMContentLoaded', () => {
  const sel = document.getElementById('model-select') || document.getElementById('global-model-selector');
  if (sel) {
    state.activeModel = sel.value || state.activeModel;
    sel.addEventListener('change', function () {
      state.activeModel = this.value;
      const lbl = document.getElementById('active-model-label');
      if (lbl) lbl.textContent = this.value;
      updateModelChip();
    });
  }
});

// ===== WEBSOCKET =====
function connectWS() {
  const wsUrl = `ws://${location.host}/ws/telemetry`;
  const ws = new WebSocket(wsUrl);
  state.ws = ws;

  ws.onopen = () => {
    state.wsRetries = 0;
    setWsStatus(true);
    ws.send('ping');
  };

  ws.onmessage = evt => {
    try {
      const msg = JSON.parse(evt.data);
      handleWsEvent(msg);
    } catch { /* ignore malformed */ }
  };

  ws.onclose = () => {
    setWsStatus(false);
    if (state.wsRetries < 6) {
      state.wsRetries++;
      setTimeout(connectWS, 2000 * state.wsRetries);
    }
  };

  ws.onerror = () => ws.close();

  // keepalive ping
  const ka = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) ws.send('ping');
    else clearInterval(ka);
  }, 15000);
}

function handleWsEvent(msg) {
  const type = msg.type || '';
  const zone = msg.zone || '';
  const data = msg.data || {};

  // Append to exec log in red team if active
  const execMsg = buildExecEvent(type, zone, data);
  if (execMsg) appendExecEvent(execMsg);

  // Quarantine banner
  if (type === 'QUARANTINE_ACTION') {
    showQuarantineBanner(`Workload PID ${data.workload_pid} slaughtered in ${data.slaughter_latency_ms?.toFixed(1) || 0}ms (${data.reason || 'Critical security violation'})`);
    updateSandboxStateChips('QUARANTINED');
    state.stats.threats++;
    if (data.session_id === state.sessionId) {
      lockChatForQuarantine(data.slaughter_latency_ms, data.reason);
    }
    if (typeof loadLedger === 'function') loadLedger();
    if (window.attackController && typeof window.attackController.loadLedgerTable === 'function') {
      window.attackController.loadLedgerTable();
    }
  }

  if (type === 'LEDGER_BLOCK' || type === 'SECURITY_EVENT') {
    if (typeof loadLedger === 'function') loadLedger();
    if (window.attackController && typeof window.attackController.loadLedgerTable === 'function') {
      window.attackController.loadLedgerTable();
    }
  }

  if (type === 'ATTACK_RECEIVED') {
    updateSandboxStateChips('EXECUTING');
  }

  if (type === 'AGENT_INFERENCE_STARTING') {
    updateSandboxStateChips('EXECUTING');
  }

  if (type === 'SANDBOX_STATUS') {
    updateSandboxStateChips(data.state || 'IDLE');
  }

  refreshStats();
}

function buildExecEvent(type, zone, data) {
  const stageClass = {
    'ATTACK_RECEIVED': 'stage-warn',
    'AGENT_INFERENCE_STARTING': 'stage-info',
    'AGENT_RESPONSE_RECEIVED': 'stage-info',

});
