/**
 * AegisHarness Attack Controller & Operator Workbench
 * Manages attack presets, custom workbench prompts, repetitions, manual kill switch,
 * execution trace visualization, scorecard results panels, and ledger forensic inspection.
 */

class AttackController {
  constructor() {
    this.attacks = [];
    this.selectedAttack = null;
    this.lastSessionId = null;
    this.runHistory = [];
    this.workbenchMode = "business";
    this.chatSessionId = `chat-${Date.now()}`;
    this.chatAssistantMode = "company";
    this.testMetrics = {
      attempted: 0,
      modelRefusals: 0,
      pepDenials: 0,
      confirmedBreaches: 0,
      runtimeBlocked: 0,
      quarantines: 0,
    };
    this.executionRecords = {};
    window.attackController = this;
    this.init();
  }

  async init() {
    this.setupFetchInterceptor();
    this.initNetworkSpikeMonitor();
    this.initMotionGraph();
    this.initTabs();
    this.initLandingPageFlow();
    await this.fetchAttacks();
    await this.fetchSystemStatus();
    await this.fetchAgentStatus();
    await this.loadOverviewDashboard();
    await this.loadCompanyZone();
    await this.loadCompanyApiLogs();
    await this.loadLedgerTable();
    await this.loadSOCDashboard();
    await this.loadSOCAnalytics();
    await this.loadSOCIncidents();
    this.checkActiveCampaign();
    this.bindUI();
  }


  async fetchAttacks() {
    try {
      const res = await fetch("/api/attacks");
      if (res.ok) {
        this.attacks = await res.json();
        this.populateDropdown();
      }
    } catch (e) {
      console.error("Failed to load attack arsenal", e);
    }
  }

  populateDropdown() {
    const select = document.getElementById("attack-select");
    if (!select) return;
    select.innerHTML = '<option value="">-- Choose Task / Exploit Template or Enter Custom Below --</option>';

    const filtered = this.attacks.filter((atk) => {
      if (this.workbenchMode === "business") {
        return !atk.is_adversarial;
      } else if (this.workbenchMode === "security") {
        return atk.is_adversarial;
      }
      return true;
    });

    const listToRender = filtered.length > 0 ? filtered : this.attacks;

    listToRender.forEach((atk) => {
      const opt = document.createElement("option");
      opt.value = atk.id;
      const prefix = atk.is_adversarial ? "[ADVERSARIAL]" : "[BUSINESS]";
      opt.innerText = `${prefix} ${atk.name}`;
      select.appendChild(opt);
    });

    if (listToRender.length > 0) {
      select.selectedIndex = 1;
      this.onAttackSelected(listToRender[0].id);
    }
  }

  setWorkbenchMode(mode) {
    this.workbenchMode = mode;
    const busBtn = document.getElementById("mode-business-btn");
    const secBtn = document.getElementById("mode-security-btn");
    if (busBtn && secBtn) {
      if (mode === "business") {
        busBtn.className = "btn btn-sm btn-primary";
        secBtn.className = "btn btn-sm btn-secondary";
      } else {
        busBtn.className = "btn btn-sm btn-secondary";
        secBtn.className = "btn btn-sm btn-primary";
      }
    }
    this.populateDropdown();
  }

  onAttackSelected(attackId) {
    this.selectedAttack = this.attacks.find((a) => a.id === attackId) || null;
    if (!this.selectedAttack) return;

    const catSpan = document.getElementById("payload-category");
    const mitreSpan = document.getElementById("payload-mitre");
    const sevSpan = document.getElementById("payload-sev");
    const descP = document.getElementById("payload-desc");
    const promptInput = document.getElementById("prompt-input");
    const cmdInput = document.getElementById("command-input");
    const objectiveInput = document.getElementById("test-objective");
    const outcomeSelect = document.getElementById("expected-outcome");

    if (catSpan) catSpan.innerText = this.selectedAttack.category;
    if (mitreSpan) mitreSpan.innerText = this.selectedAttack.mitre_atlas_tag || "NONE";
    if (sevSpan) {
      sevSpan.innerText = this.selectedAttack.severity_level;
      sevSpan.className = this.selectedAttack.is_adversarial ? "detail-value text-red" : "detail-value text-emerald";
    }
    if (descP) descP.innerText = this.selectedAttack.description;
    if (promptInput) promptInput.value = this.selectedAttack.prompt;
    if (cmdInput) cmdInput.value = this.selectedAttack.target_tool_command;
    if (objectiveInput) objectiveInput.value = `Verify ${this.selectedAttack.category} boundary isolation`;
    if (outcomeSelect) {
      outcomeSelect.value = this.selectedAttack.is_adversarial ? "RUNTIME_BLOCKED" : "SUCCESS_PERMITTED";
    }
  }

  async fetchSystemStatus() {
    try {
      const [statusRes, modelsRes, hwRes] = await Promise.all([
        fetch("/api/status"),
        fetch("/api/models"),
        fetch("/api/system/hardware"),
      ]);

      if (statusRes.ok) {
        const data = await statusRes.json();
        const topHw = document.getElementById("top-hardware-badge");
        if (topHw) {
          topHw.innerText = data.gpu_hardware || "CPU Mode";
        }
        const ovModel = document.getElementById("overview-model-name");
        if (ovModel) ovModel.innerText = data.model_name;
        const ovHw = document.getElementById("overview-hardware-val");
        if (ovHw) ovHw.innerText = data.gpu_hardware || "CPU Mode";
        const topModelBadge = document.getElementById("model-status-badge");
        if (topModelBadge) {
          topModelBadge.innerText = `${data.model_name} (${data.model_online ? 'Online' : 'Offline'})`;
        }
      }

      if (modelsRes.ok) {
        const mdata = await modelsRes.json();
        const selector = document.getElementById("global-model-selector");
        if (selector && mdata.models && mdata.models.length > 0) {
          selector.innerHTML = "";
          mdata.models.forEach((m) => {
            const opt = document.createElement("option");
            opt.value = m.name;
            opt.innerText = `${m.name} (${m.parameter_size || ''} ${m.quantization || ''})`.trim();
            if (m.name === mdata.active_model) opt.selected = true;
            selector.appendChild(opt);
          });
          this.updateModelIndicators(mdata.active_model || mdata.models[0].name);
        }
      }
    } catch (e) {
      console.warn("Could not fetch system status / models", e);
    }
  }

  setupFetchInterceptor() {
    if (window._aegisFetchIntercepted) return;
    window._aegisFetchIntercepted = true;
    const originalFetch = window.fetch;
    const self = this;
    window.fetch = async function(...args) {
      const start = Date.now();
      const url = typeof args[0] === "string" ? args[0] : (args[0] && args[0].url) || "";
      const method = (args[1] && args[1].method) ? args[1].method.toUpperCase() : "GET";
      
      try {
        const response = await originalFetch.apply(this, args);
        const latency = Date.now() - start;
        // ONLY pulse spike when a Red Zone attack is executed through the APIs
        const isRedZoneAttack = 
          method === "POST" && (
            url.includes("/api/chat") ||
            url.includes("/api/jailbreaks/execute") ||
            url.includes("/api/attacks/execute") ||
            url.includes("/api/techniques/run") ||
            url.includes("/api/campaign/run") ||
            url.includes("/api/pep/test") ||
            url.includes("/api/simulation/breach") ||
            url.includes("/api/mock-attacker/exfil")
          );
        if (isRedZoneAttack) {
          self.pulseNetworkSpike(method, url, latency, response.status);
        }
        return response;
      } catch (err) {
        const latency = Date.now() - start;
        const isRedZoneAttack = 
          method === "POST" && (
            url.includes("/api/chat") ||
            url.includes("/api/jailbreaks/execute") ||
            url.includes("/api/attacks/execute") ||
            url.includes("/api/techniques/run") ||
            url.includes("/api/campaign/run") ||
            url.includes("/api/pep/test") ||
            url.includes("/api/simulation/breach") ||
            url.includes("/api/mock-attacker/exfil")
          );
        if (isRedZoneAttack) {
          self.pulseNetworkSpike(method, url, latency, 500);
        }
        throw err;
      }
    };
  }

  initNetworkSpikeMonitor() {
    this.netCanvas = document.getElementById("net-spike-canvas");
    this.netTotalPackets = 0;
    this.netSpikeAmplitudes = [];
    if (this.netCanvas) {
      this.renderNetworkWaveform();
    }
  }

  pulseNetworkSpike(method, endpoint, latencyMs = 25, status = 200) {
    this.netTotalPackets += 1;
    const now = new Date();
    const timeStr = now.toTimeString().split(" ")[0] + "." + String(now.getMilliseconds()).padStart(3, "0");
    
    const totEl = document.getElementById("net-total-packets");
    if (totEl) totEl.innerText = `${this.netTotalPackets} Red Attacks Tracked`;
    const lastEp = document.getElementById("net-last-endpoint");
    if (lastEp) lastEp.innerText = endpoint.length > 36 ? endpoint.substring(0, 36) + "..." : endpoint;
    const lastLat = document.getElementById("net-last-latency");
    if (lastLat) lastLat.innerText = `${latencyMs}ms`;
    
    // Highlight route badge in red during attack
    let badgeId = null;
    if (endpoint.includes("/agent/chat") || endpoint.includes("/chat")) badgeId = "route-badge-chat";
    else if (endpoint.includes("/attacks") || endpoint.includes("/jailbreaks")) badgeId = "route-badge-eval";
    else if (endpoint.includes("/system/status") || endpoint.includes("/status")) badgeId = "route-badge-status";
    else if (endpoint.includes("/incidents") || endpoint.includes("/soc")) badgeId = "route-badge-incidents";
    else if (endpoint.includes("/containment") || endpoint.includes("/quarantine") || endpoint.includes("/simulation/breach")) badgeId = "route-badge-slaughter";
    
    if (badgeId) {
      const badge = document.getElementById(badgeId);
      if (badge) {
        badge.style.boxShadow = "0 0 14px #ef4444";
        badge.style.borderColor = "#ef4444";
        setTimeout(() => {
          badge.style.boxShadow = "";
          badge.style.borderColor = "";
        }, 1200);
      }
    }
    
    // Sharp spike amplitude on actual attacks
    const amplitude = Math.min(65, Math.max(30, latencyMs / 8));
    this.netSpikeAmplitudes.push(amplitude);
    
    const stream = document.getElementById("net-api-recent-stream");
    if (stream) {
      const statusColor = status < 300 ? "#ef4444" : (status === 403 ? "#f59e0b" : "#ef4444");
      const item = document.createElement("div");
      item.className = "net-log-item";
      item.innerHTML = `
        <span><span style="color:#64748b;">[${timeStr}]</span> <strong style="color:${statusColor}">${method} [RED ATTACK]</strong> ${endpoint}</span>
        <span style="color:${statusColor}; font-weight:600;">${status} &bull; ${latencyMs}ms</span>
      `;
      stream.insertBefore(item, stream.firstChild);
      while (stream.children.length > 25) {
        stream.removeChild(stream.lastChild);
      }
      const cnt = document.getElementById("net-stream-count");
      if (cnt) cnt.innerText = `${this.netTotalPackets} calls recorded`;
    }
  }

  renderNetworkWaveform() {
    if (!this.netCanvas) return;
    const ctx = this.netCanvas.getContext("2d");
    if (!ctx) return;
    
    const width = this.netCanvas.width = this.netCanvas.offsetWidth || 800;
    const height = this.netCanvas.height = 90;
    

}
