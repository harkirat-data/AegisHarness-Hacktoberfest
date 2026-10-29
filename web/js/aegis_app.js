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
    'TOOL_REQUEST_EVALUATED': 'stage-warn',
    'QUARANTINE_ACTION': 'stage-quarantine',
    'SYSCALL_TRAPPED': 'stage-denied',
    'CONNECTION_ESTABLISHED': 'stage-info',
  }[type] || 'stage-info';

  return { type, zone, data, stageClass, ts: new Date().toLocaleTimeString() };
}

function appendExecEvent(ev) {
  const log = document.getElementById('exec-log');
  if (!log) return;
  const empty = log.querySelector('.exec-empty');
  if (empty) empty.remove();

  const row = document.createElement('div');
  row.className = `exec-event ${ev.stageClass}`;
  const desc = execEventDesc(ev.type, ev.data);
  row.innerHTML = `
    <span class="exec-stage">${ev.type}</span>
    <span class="exec-desc">${desc}</span>
    <span class="exec-ts">${ev.ts}</span>
  `;
  log.appendChild(row);
  log.scrollTop = log.scrollHeight;
}

function execEventDesc(type, data) {
  const esc = s => String(s || '').replace(/</g, '&lt;');
  switch (type) {
    case 'ATTACK_RECEIVED': return `Attack dispatched: <strong>${esc(data.attack_name)}</strong> [${esc(data.severity)}]`;
    case 'AGENT_INFERENCE_STARTING': return `Model <em>${esc(data.model)}</em> processing prompt...`;
    case 'AGENT_RESPONSE_RECEIVED': return `Model responded. Refused: <strong>${data.refused}</strong>. Outcome: ${esc(data.outcome)}`;
    case 'TOOL_REQUEST_EVALUATED': return `Tool <code>${esc(data.tool)}</code> &rarr; Policy: <strong>${data.policy_approved ? 'APPROVED' : 'DENIED'}</strong>`;
    case 'QUARANTINE_ACTION': return `[QUARANTINE] <strong>QUARANTINE</strong>: PID ${data.workload_pid} terminated in ${data.slaughter_latency_ms?.toFixed(1) || 0}ms`;
    case 'SYSCALL_TRAPPED': return `Syscall intercepted: <code>${esc(data.syscall_name)}</code> &mdash; ${esc(data.reason)}`;
    case 'SANDBOX_STATUS': return `Sandbox state &rarr; ${esc(data.state)}`;
    default: return esc(JSON.stringify(data).slice(0, 100));
  }
}

function setWsStatus(connected) {
  const dot = document.getElementById('ws-dot');
  const lbl = document.getElementById('ws-label');
  if (dot) dot.className = `dot ${connected ? 'dot-pulse' : 'dot-gray'}`;
  if (lbl) lbl.textContent = connected ? 'Live' : 'Reconnecting...';
}

// ===== CHAT =====
function handleChatKey(evt) {
  if (evt.key === 'Enter' && !evt.shiftKey) {
    evt.preventDefault();
    sendChat();
  }
}

async function sendChat() {
  const input = document.getElementById('chat-input');
  if (!input) return;
  const msg = input.value.trim();
  if (!msg) return;

  if (state.isQuarantined) {
    appendChatMsg('system', 'Workload is quarantined and terminated. Click "+ New Sandbox" above to launch a clean environment.', 'denied');
    return;
  }

  input.value = '';
  const btn = document.getElementById('send-btn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Sending...';
  }

  // Append user message
  appendChatMsg('user', msg);

  // Show thinking
  const thinkingId = appendThinking();

  // Always sync active model from global selector if available
  const globalSel = document.getElementById('global-model-selector') || document.getElementById('model-select');
  const activeModel = globalSel ? globalSel.value : (state.activeModel || 'qwen2.5:3b');
  state.activeModel = activeModel;

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: msg,
        session_id: state.sessionId,
        target_model: activeModel,
        assistant_mode: state.activeMode,
      }),
    });

    removeThinking(thinkingId);

    if (!res.ok) {

});
