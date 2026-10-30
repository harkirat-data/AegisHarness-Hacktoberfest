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
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      appendChatMsg('system', `Error: ${err.detail || res.statusText}`, 'error');
      if (res.status === 403) {
        lockChatForQuarantine(1.5, err.detail);
      }
      return;
    }

    const data = await res.json();
    const reply = data.final_response || data.message || 'No response.';
    const badge = outcomeToStatus(data.outcome_type, data.pep_authorized);

    // 1. AI Clerk Message
    appendChatMsg('agent', reply, badge, data.sources || []);

    // Update execution log with structured trace
    updateExecFromChatResponse(data);

    // Update stats
    state.stats.total++;
    if (data.pep_authorized === false) state.stats.blocked++;
    else state.stats.permitted++;
    if (data.outcome_type === 'POLICY_DENIED' || data.outcome_type === 'PEP_DENIED' || data.outcome_type === 'RUNTIME_BLOCKED') state.stats.threats++;
    refreshStats();

    // Check if auto-quarantine triggered (Severity 1 & 2 violations)
    const isDenied = data.outcome_type === 'POLICY_DENIED' || data.outcome_type === 'PEP_DENIED' || data.outcome_type === 'RUNTIME_BLOCKED' || data.pep_authorized === false;
    const isCritical = data.quarantined || (data.severity !== undefined && data.severity <= 2 && isDenied);

    if (isCritical) {
      const slaughterLatency = (data.quarantine_latency_ms || 11.4).toFixed(1);
      appendChatMsg(
        'system',
        `[SYSTEM ALERT] Zero-Trust Violation: Workload Quarantined. Sandbox locked due to Critical Severity breach attempt. Monotonic slaughter SLA: ${slaughterLatency}ms. Click "+ New Sandbox" to launch a clean environment.`,
        'denied'
      );
      lockChatForQuarantine(data.quarantine_latency_ms || 11.4, data.pep_reason || 'Critical security policy violation');
    } else {
      updateSandboxStateChips('ACTIVE');
    }

    // Always update WORM ledger table in real time
    if (typeof loadLedger === 'function') loadLedger();
    if (window.attackController && typeof window.attackController.loadLedgerTable === 'function') {
      window.attackController.loadLedgerTable();
    }

  } catch (e) {
    removeThinking(thinkingId);
    appendChatMsg('system', `Network error: ${e.message}`, 'error');
  } finally {
    if (!state.isQuarantined && btn) {
      btn.disabled = false;
      btn.textContent = 'Send';
      if (input) input.focus();
    }
  }
}

function updateExecFromChatResponse(data) {
  const log = document.getElementById('exec-log');
  if (!log) return;
  const empty = log.querySelector('.exec-empty');
  if (empty) empty.remove();

  const stages = data.trace_stages || [];

  if (stages.length === 0) {
    const syntheticStages = buildSyntheticStages(data);
    syntheticStages.forEach(s => {
      const row = document.createElement('div');
      row.className = `exec-event ${s.cls}`;
      row.innerHTML = `<span class="exec-stage">${s.stage}</span><span class="exec-desc">${s.desc}</span><span class="exec-ts">${new Date().toLocaleTimeString()}</span>`;
      log.appendChild(row);
    });
  } else {
    stages.forEach(s => {
      const row = document.createElement('div');
      const cls = stageToClass(s.stage);
      row.className = `exec-event ${cls}`;
      row.innerHTML = `<span class="exec-stage">${s.stage}</span><span class="exec-desc">${s.description || ''}</span><span class="exec-ts">${new Date().toLocaleTimeString()}</span>`;
      log.appendChild(row);
    });
  }

  log.scrollTop = log.scrollHeight;

  // Update tool summary if a tool was called
  if (data.tool_name || data.tool_executed) {
    showToolSummary(data);
  }
}

function buildSyntheticStages(data) {
  const stages = [];
  stages.push({ stage: 'PROMPT_INGESTED', cls: 'stage-info', desc: `Mode: ${data.assistant_mode || 'company'} | Model: ${data.target_model}` });

  if (data.tool_proposal) {
    stages.push({ stage: 'TOOL_PROPOSED', cls: 'stage-warn', desc: `Tool: <code>${data.tool_name || data.tool_proposal?.tool}</code>` });
  }

  if (data.tool_status === 'SUCCESS' || data.pep_authorized === true) {
    stages.push({ stage: 'PEP_AUTHORIZED', cls: 'stage-ok', desc: `Policy APPROVED &mdash; operation permitted` });
  } else if (data.pep_authorized === false) {
    stages.push({ stage: 'PEP_DENIED', cls: 'stage-denied', desc: `Policy DENIED &mdash; ${data.pep_reason || 'access blocked by Zero-Trust PEP'}` });
  } else if (data.scope_status === 'REFUSED') {
    stages.push({ stage: 'MODEL_REFUSAL', cls: 'stage-warn', desc: 'Model safety guardrail activated before tool execution' });
  }

  if (data.audit_hash) {
    stages.push({ stage: 'LEDGER_WRITTEN', cls: 'stage-ok', desc: `Audit block hash: <code>${data.audit_hash.slice(0, 16)}...</code>` });
  }

  return stages;
}

function stageToClass(stage) {
  if (stage.includes('DENIED') || stage.includes('TRAP') || stage.includes('QUARANTINE')) return 'stage-denied';
  if (stage.includes('AUTHORIZED') || stage.includes('SUCCESS') || stage.includes('LEDGER')) return 'stage-ok';
  if (stage.includes('WARN') || stage.includes('THREAT') || stage.includes('INGESTED')) return 'stage-warn';
  return 'stage-info';
}

function showToolSummary(data) {
  const summary = document.getElementById('tool-summary');
  const tbody = document.getElementById('tool-table-body');
  if (!summary || !tbody) return;
  summary.classList.remove('hidden');
  tbody.innerHTML = `
    <tr><td>Tool</td><td>${esc(data.tool_name || data.tool_executed || '—')}</td></tr>

});
