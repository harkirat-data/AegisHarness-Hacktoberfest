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
    
    const offset = { val: 0 };
    const animate = () => {
      ctx.fillStyle = "#FAF8F5";
      ctx.fillRect(0, 0, width, height);
      
      ctx.strokeStyle = "rgba(226, 221, 213, 0.9)";
      ctx.lineWidth = 1;
      for (let y = 15; y < height; y += 20) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
      for (let x = 0; x < width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      
      const midY = height / 2;
      let activeSpike = 0;
      if (this.netSpikeAmplitudes && this.netSpikeAmplitudes.length > 0) {
        activeSpike = this.netSpikeAmplitudes[this.netSpikeAmplitudes.length - 1];
        this.netSpikeAmplitudes[this.netSpikeAmplitudes.length - 1] *= 0.90;
        if (this.netSpikeAmplitudes[this.netSpikeAmplitudes.length - 1] < 1) {
          this.netSpikeAmplitudes.pop();
        }
      }
      
      // Color waveform deep editorial maroon during attack spike, subtle slate when quiet
      ctx.strokeStyle = activeSpike > 0 ? "#B23A22" : "#96938E";
      ctx.lineWidth = activeSpike > 0 ? 2.4 : 1.4;
      ctx.beginPath();
      
      for (let x = 0; x < width; x += 3) {
        const baseSine = Math.sin((x + offset.val) * 0.04) * (activeSpike > 0 ? 4 : 1.2);
        let spike = 0;
        if (activeSpike > 0 && x > width * 0.45 && x < width * 0.85) {
          const spikeCenter = width * 0.65;
          const dist = Math.abs(x - spikeCenter);
          spike = Math.max(0, (1 - dist / 70)) * activeSpike * Math.sin(x * 0.25);
        }
        const y = midY + baseSine + spike;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      
      offset.val += 1.5;
      requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }

  initMotionGraph() {
    this.motionEvents = [];
    const refreshBtn = document.getElementById("btn-refresh-motion-graph");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", () => this.renderMotionGraph());
    }
  }

  addMotionEvent(eventData) {
    this.motionEvents.push({
      id: eventData.id || `EVT-${Date.now().toString(36).toUpperCase()}`,
      time: eventData.time || new Date().toLocaleTimeString(),
      category: eventData.category || "Corporate Resource Jailbreak",
      llmReaction: eventData.llmReaction || "Refusal / Benign",
      enforcement: eventData.enforcement || "PEP_DEFENSE_BLOCKED",
      severity: eventData.severity || "MEDIUM",
      status: eventData.status || "BLOCKED",
      isBreach: !!eventData.isBreach
    });
    const cnt = document.getElementById("motion-node-count");
    if (cnt) cnt.innerText = `${this.motionEvents.length} Incident Nodes`;
    this.renderMotionGraph();
  }

  renderMotionGraph() {
    const svg = document.getElementById("blue-motion-svg");
    const emptyNotice = document.getElementById("motion-graph-empty");
    if (!svg) return;
    
    if (!this.motionEvents || this.motionEvents.length === 0) {
      if (emptyNotice) emptyNotice.style.display = "block";
      svg.innerHTML = "";
      return;
    }
    if (emptyNotice) emptyNotice.style.display = "none";
    
    const cardWidth = 175;
    const cardGap = 40;
    const svgWidth = Math.max(760, this.motionEvents.length * (cardWidth + cardGap) + 40);
    svg.setAttribute("viewBox", `0 0 ${svgWidth} 150`);
    svg.style.width = `${svgWidth}px`;
    
    let html = `
      <defs>
        <marker id="motion-arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 1 L 8 5 L 0 9 z" fill="#96938E" />
        </marker>
        <filter id="card-shadow" x="-10%" y="-10%" width="125%" height="125%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#1A1A1A" flood-opacity="0.08" />
        </filter>
      </defs>
    `;
    
    this.motionEvents.forEach((evt, idx) => {
      const x = 25 + idx * (cardWidth + cardGap);
      const isBreach = evt.isBreach || (evt.enforcement && evt.enforcement.includes("BREACH")) || evt.severity === "CRITICAL";
      const isDrill = !!evt.isSimulatedDrill;
      const color = isDrill ? "#B45309" : (isBreach ? "#B23A22" : "#1E653A");
      const headerBg = isDrill ? "#FDF6E2" : (isBreach ? "#FBEBE8" : "#EBF5EE");
      const catLabel = (evt.category || "Adversarial Attack").replace(/_/g, " ").substring(0, 19);
      const enfLabel = isDrill ? "⚡ DRILL SLAUGHTER" : (isBreach ? "🚨 BREACH SLAUGHTER" : "🛡️ PEP BLOCKED");
      const llmSummary = (evt.llmReaction || "Refused exploit").substring(0, 22);

      // Connecting arrow between consecutive incident cards
      if (idx > 0) {
        const prevX = 25 + (idx - 1) * (cardWidth + cardGap) + cardWidth;
        html += `<line x1="${prevX + 4}" y1="72" x2="${x - 6}" y2="72" stroke="#96938E" stroke-width="2" stroke-dasharray="3,3" marker-end="url(#motion-arrow)" />`;
      }
      
      html += `
        <g class="motion-card-node" data-idx="${idx}" style="cursor: pointer;" filter="url(#card-shadow)">
          <title>Click to inspect forensic trace #${idx + 1}: ${evt.category} (${evt.time})</title>
          <!-- Card Body Background (Editorial Paper) -->
          <rect x="${x}" y="15" width="${cardWidth}" height="115" rx="6" fill="#FAF8F5" stroke="${color}" stroke-width="1.5" />
          
          <!-- Card Header Bar -->
          <path d="M ${x} 21 A 6 6 0 0 1 ${x + 6} 15 L ${x + cardWidth - 6} 15 A 6 6 0 0 1 ${x + cardWidth} 21 L ${x + cardWidth} 42 L ${x} 42 Z" fill="${headerBg}" />
          <line x1="${x}" y1="42" x2="${x + cardWidth}" y2="42" stroke="${color}" stroke-width="0.8" opacity="0.4" />
          
          <!-- Incident ID & Time -->
          <text x="${x + 10}" y="33" fill="#1A1A1A" font-size="11" font-weight="700" font-family="'Inter', sans-serif">#${idx + 1} Incident</text>
          <text x="${x + cardWidth - 10}" y="33" fill="#6E6B66" font-size="10" font-weight="600" font-family="'Fira Code', monospace" text-anchor="end">${evt.time}</text>
          
          <!-- Attack Category Label (Editorial Ink) -->
          <text x="${x + 10}" y="62" fill="#1A1A1A" font-size="11" font-weight="700" font-family="'Inter', sans-serif">${catLabel}</text>
          
          <!-- LLM Reaction Snippet -->
          <text x="${x + 10}" y="78" fill="#6E6B66" font-size="9.5" font-family="'Fira Code', monospace">${llmSummary}</text>
          
          <!-- Verdict Enforcement Pill -->
          <rect x="${x + 8}" y="92" width="${cardWidth - 16}" height="22" rx="4" fill="${color}15" stroke="${color}" stroke-width="1" />
          <text x="${x + (cardWidth / 2)}" y="107" fill="${color}" font-size="9.5" font-weight="700" font-family="'Inter', sans-serif" text-anchor="middle">${enfLabel}</text>
        </g>
      `;
    });
    
    svg.innerHTML = html;

    // Attach click listeners to cards for interactive forensic inspection
    svg.querySelectorAll(".motion-card-node").forEach((card) => {
      card.addEventListener("click", () => {
        const idx = parseInt(card.getAttribute("data-idx"), 10);
        this.inspectMotionEvent(idx);
      });
    });
  }

  inspectMotionEvent(idx) {
    const evt = this.motionEvents[idx];
    if (!evt) return;
    const isBreach = evt.isBreach || (evt.enforcement && evt.enforcement.includes("BREACH"));
    const statusText = isBreach ? "SLAUGHTERED (CONTAINED)" : "BLOCKED BY POLICY ENGINE";
    alert(
      `INCIDENT FORENSIC TRACE #${idx + 1}\n` +
      `────────────────────────────────────────\n` +
      `• Timestamp: ${evt.time}\n` +
      `• Category: ${evt.category || "Unknown"}\n` +
      `• LLM Reaction: ${evt.llmReaction || "Refusal recorded"}\n` +
      `• PEP Enforcement: ${evt.enforcement || "PEP_DEFENSE_BLOCKED"}\n` +
      `• Severity: ${evt.severity || "HIGH"}\n` +
      `• Containment: ${statusText}\n` +
      `• Proof: Recorded in Cryptographic WORM Audit Ledger`
    );
  }

  logBlueSecurityEvent(evt) {
    const stream = document.getElementById("blue-events-stream");
    if (!stream) return;
    
    const emptyNotice = stream.querySelector(".text-muted");
    if (emptyNotice && emptyNotice.innerText.includes("Listening")) {
      stream.innerHTML = "";
    }
    
    const now = new Date();
    const timeStr = now.toTimeString().split(" ")[0];
    const isDenial = evt.pepDecision === "PEP_DENIED" || evt.pepDecision === "DENIED" || evt.status === "DENIED";
    const isBreach = evt.isBreach || evt.outcome === "EXFILTRATION_CONFIRMED" || (evt.severity && evt.severity.includes("CRITICAL"));
    
    const el = document.createElement("div");
    el.style.cssText = "margin-bottom: 8px; padding: 6px 8px; background: rgba(15,23,42,0.85); border: 1px solid #1e293b; border-radius: 4px; font-size: 0.73rem; border-left: 3px solid " + (isBreach ? "#ef4444" : (isDenial ? "#f59e0b" : "#10b981")) + ";";
    el.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px;">
        <span style="color: #64748b; font-family: monospace;">[${timeStr}]</span>
        <strong style="color: ${isBreach ? '#ef4444' : (isDenial ? '#38bdf8' : '#34d399')}; text-transform: uppercase;">
          ${evt.category || 'ADVERSARIAL_ATTACK'}
        </strong>
        <span class="badge ${isBreach ? 'badge-blocked' : (isDenial ? 'badge-blocked' : 'badge-permitted')}" style="font-size: 0.65rem;">
          ${isBreach ? 'QUARANTINE_SLAUGHTER' : (isDenial ? 'PEP_DENIED' : 'PEP_AUTHORIZED')}
        </span>
      </div>
      <div style="color: #cbd5e1; margin-bottom: 2px;">
        <strong>Target:</strong> <code style="color:#38bdf8;">${evt.target || 'company_assets'}</code> | <strong>Model:</strong> ${evt.model || this.activeModel || 'qwen2.5:3b'}
      </div>
      <div style="color: #94a3b8; font-size: 0.7rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
        <strong>Prompt:</strong> "${(evt.prompt || '').substring(0, 80)}..."
      </div>
      <div style="display: flex; justify-content: space-between; margin-top: 3px; font-size: 0.68rem; color: #64748b;">
        <span>Tool: <code style="color:#f59e0b;">${evt.tool || 'none'}</code></span>
        <span>Audit Block: <strong style="color:#38bdf8;">#${evt.auditBlock || '--'}</strong></span>
      </div>
    `;
    stream.insertBefore(el, stream.firstChild);
    while (stream.children.length > 30) {
      stream.removeChild(stream.lastChild);
    }
  }

  updateModelIndicators(modelName, confirmed = true) {
    if (!modelName) return;
    this.activeModel = modelName;
    
    // 1. Selector value
    const selector = document.getElementById("global-model-selector");
    if (selector && selector.value !== modelName) selector.value = modelName;

    // 2. Chat mode model indicator
    const chatInd = document.getElementById("chat-model-indicator");
    if (chatInd) chatInd.innerText = modelName;

    // 3. Technical evidence active model
    const techInd = document.getElementById("tech-active-model");
    if (techInd) techInd.innerText = modelName;

    // 4. Target Zone overview model badge (Screenshot 5)
    const targetViewModel = document.getElementById("target-view-model");
    if (targetViewModel) targetViewModel.innerText = modelName;

    // 5. Overview Zone active model card
    const ovModel = document.getElementById("overview-active-model");
    if (ovModel) ovModel.innerText = modelName;

    // 6. Target Zone architecture visualizer model node (Screenshot 4)
    const archSub = document.querySelector("#arch-node-inference .arch-node-sub");
    if (archSub) archSub.innerText = `${modelName} (RO)`;

    // 7. Generic active model displays across all screens
    document.querySelectorAll(".active-model-display").forEach((el) => {
      el.innerText = modelName;
    });

    // 8. Top status badge with verified status
    const topBadge = document.getElementById("model-status-badge");
    if (topBadge) {
      topBadge.innerText = confirmed ? `${modelName} (Confirmed Active)` : `${modelName} (Verifying...)`;
      topBadge.className = confirmed ? "badge badge-permitted" : "badge badge-neutral";
    }
  }

  async selectTargetModel(modelName) {
    // Show intermediate verifying state
    this.updateModelIndicators(modelName, false);

    try {
      const res = await fetch("/api/models/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model_name: modelName }),
      });
      if (res.ok) {
        const data = await res.json();
        console.log(`Backend verified active model: ${data.active_model}`);
        this.updateModelIndicators(data.active_model, true);
      } else {
        console.warn(`Model switch rejected by backend: ${res.status}`);
        const topBadge = document.getElementById("model-status-badge");
        if (topBadge) topBadge.innerText = `${this.activeModel || "qwen2.5:3b"} (Switch Failed)`;
      }
    } catch (e) {
      console.error("Model selection error:", e);
      const topBadge = document.getElementById("model-status-badge");
      if (topBadge) topBadge.innerText = `${this.activeModel || "qwen2.5:3b"} (Error)`;
    }
  }

  initTabs() {
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
        document.querySelectorAll(".tab-pane").forEach((p) => p.classList.remove("active"));
        btn.classList.add("active");
        const target = document.getElementById(btn.dataset.tab);
        if (target) target.classList.add("active");
        try {
          if (btn.dataset.tab === "pane-overview") {
            this.loadOverviewDashboard();
          } else if (btn.dataset.tab === "pane-company") {
            this.loadCompanyZone();
            this.loadCompanyApiLogs();
          } else if (btn.dataset.tab === "pane-target") {
            this.fetchAgentStatus();
            if (typeof loadSandboxFiles === 'function') loadSandboxFiles();
          } else if (btn.dataset.tab === "pane-blue") {
            this.loadBlueEvents();
            if (typeof loadLedger === 'function') loadLedger();
            if (typeof refreshStats === 'function') refreshStats();
          } else if (btn.dataset.tab === "pane-ledger") {
            this.loadLedgerTable();
          } else if (btn.dataset.tab === "pane-red") {
            this.fetchAgentStatus();
            if (typeof refreshStats === 'function') refreshStats();
          }
        } catch (err) {
          console.warn("Tab lazy load error:", err);
        }
      });
    });
  }

  initLandingPageFlow() {
    const landingView = document.getElementById("landing-page-view");
    const dashboardView = document.getElementById("dashboard-view");
    const headerTopPills = document.getElementById("header-top-pills");
    const heroLaunchBtn = document.getElementById("btn-hero-launch-dashboard");
    const headerBackBtn = document.getElementById("btn-header-back-landing");
    const brandHomeBtn = document.getElementById("brand-home-link");

    const showDashboard = (tabId = "pane-company") => {
      if (landingView) landingView.style.display = "none";
      if (dashboardView) dashboardView.style.display = "block";
      if (headerTopPills) headerTopPills.style.display = "flex";
      if (headerBackBtn) headerBackBtn.style.display = "inline-flex";
      const targetTab = tabId.replace("pane-", "");
      const tabBtn = document.getElementById(`tab-${targetTab}`);
      if (tabBtn) tabBtn.click();
      window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const showLanding = () => {
      if (dashboardView) dashboardView.style.display = "none";
      if (landingView) landingView.style.display = "block";
      if (headerTopPills) headerTopPills.style.display = "none";
      if (headerBackBtn) headerBackBtn.style.display = "none";
      window.scrollTo({ top: 0, behavior: "smooth" });
    };

    if (heroLaunchBtn) heroLaunchBtn.addEventListener("click", () => showDashboard("pane-company"));
    if (headerBackBtn) headerBackBtn.addEventListener("click", () => showLanding());
    if (brandHomeBtn) {
      brandHomeBtn.addEventListener("click", (e) => {
        e.preventDefault();
        showLanding();
      });
    }

    // Scroll-triggered reveal motion observer for landing page chapters
    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
          }
        });
      }, { threshold: 0.12 });

      document.querySelectorAll(".motion-reveal").forEach((el) => observer.observe(el));
    } else {
      document.querySelectorAll(".motion-reveal").forEach((el) => el.classList.add("is-visible"));
    }
  }


  async fetchAgentStatus() {
    try {
      const res = await fetch("/api/agent/status");
      if (!res.ok) return;
      const data = await res.json();

      const modelEl = document.getElementById("target-view-model");
      if (modelEl) modelEl.innerText = data.target_model || "qwen2.5:3b";

      const ctrlEl = document.getElementById("target-controller-mode");
      if (ctrlEl) ctrlEl.innerText = `${data.status} (${data.assistant_mode === 'company' ? 'Company Mode' : 'General Mode'})`;

      const wsPathEl = document.getElementById("target-workspace-path");
      if (wsPathEl) wsPathEl.innerText = data.workspace_path || "data/demo_company/workspace/";

      const slaEl = document.getElementById("target-sla-target");
      if (slaEl) slaEl.innerText = `< ${data.quarantine_sla_target_ms || 50} ms`;

      if (data.tool_permissions && Array.isArray(data.tool_permissions)) {
        const tbody = document.getElementById("target-tools-table-body");
        if (tbody) {
          tbody.innerHTML = "";
          data.tool_permissions.forEach((t) => {
            const tr = document.createElement("tr");
            const compBadge = t.company_allowed
              ? `<span class="badge badge-permitted">PERMITTED</span>`
              : `<span class="badge badge-blocked">DISABLED</span>`;
            const genBadge = t.general_allowed
              ? `<span class="badge badge-permitted">PERMITTED</span>`
              : `<span class="badge badge-blocked">DISABLED</span>`;
            tr.innerHTML = `
              <td><code>${t.tool}</code></td>
              <td>${t.purpose}</td>
              <td>${compBadge}</td>
              <td>${genBadge}</td>
              <td>${t.rule}</td>
            `;
            tbody.appendChild(tr);
          });
        }
      }
    } catch (e) {
      console.warn("Failed to fetch agent status:", e);
    }
  }

  async loadOverviewDashboard() {
    try {
      // 1. Hardware info
      const hwRes = await fetch("/api/system/hardware");
      if (hwRes.ok) {
        const hw = await hwRes.json();
        const topHw = document.getElementById("top-hardware-badge");
        const ovHw = document.getElementById("overview-hardware");
        const hwText = `${hw.platform || 'Windows'} | ${hw.gpu_name || hw.gpu || 'DirectML / Integrated'} | ${hw.ram_gb || hw.total_memory_gb || '--'}GB RAM`;
        if (topHw) topHw.innerText = hwText;
        if (ovHw) ovHw.innerText = hwText;
      }

      // 2. Agent status
      const agRes = await fetch("/api/agent/status");
      if (agRes.ok) {
        const ag = await agRes.json();
        const ovModel = document.getElementById("overview-active-model");
        if (ovModel) ovModel.innerText = `${ag.target_model || ag.model || 'qwen2.5:3b'} (${ag.provider || 'Ollama'})`;
      }

      // 3. Update summary metrics in overview
      const ovAtt = document.getElementById("ov-count-attempted");
      if (ovAtt) ovAtt.innerText = this.testMetrics.attempted;
      const ovRef = document.getElementById("ov-count-refusals");
      if (ovRef) ovRef.innerText = this.testMetrics.modelRefusals;
      const ovPep = document.getElementById("ov-count-pep");
      if (ovPep) ovPep.innerText = this.testMetrics.pepDenials;
      const ovBre = document.getElementById("ov-count-breaches");
      if (ovBre) ovBre.innerText = this.testMetrics.confirmedBreaches;
      const ovDef = document.getElementById("ov-defense-rate");
      const ovDefNote = document.getElementById("ov-defense-note");
      const denom = this.testMetrics.pepDenials + this.testMetrics.confirmedBreaches;
      if (ovDef) {
        if (denom === 0) {
          ovDef.innerText = "NOT AVAILABLE";
          if (ovDefNote) ovDefNote.innerText = "Awaiting live tests";
        } else {
          const rate = Math.round((this.testMetrics.pepDenials / denom) * 100);
          ovDef.innerText = `${rate}%`;
          if (ovDefNote) ovDefNote.innerText = `${this.testMetrics.pepDenials} / ${denom} evaluated checks`;
        }
      }

      // 4. Ledger records for recent executions
      const ledRes = await fetch("/api/ledger?limit=10");
      if (ledRes.ok) {
        const records = await ledRes.json();
        const tbody = document.getElementById("overview-recent-tests-tbody");
        if (tbody && records && records.length > 0) {
          tbody.innerHTML = "";
          records.forEach((r) => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
              <td class="font-mono text-blue">${r.session_id ? r.session_id.substring(0, 16) + '...' : '--'}</td>
              <td>${r.timestamp ? new Date(r.timestamp).toLocaleTimeString() : '--'}</td>
              <td>${r.event_type}</td>
              <td><span class="badge badge-neutral">${r.source_zone}</span></td>
              <td><span class="badge ${r.severity.includes('CRITICAL') || r.severity.includes('HIGH') ? 'badge-blocked' : 'badge-permitted'}">${r.severity}</span></td>
              <td><strong>Block #${r.index}</strong></td>
              <td class="font-mono text-cyan" title="${r.current_hash}">${r.current_hash ? r.current_hash.substring(0, 14) + '...' : '--'}</td>
            `;
            tbody.appendChild(tr);
          });
        }
      }
    } catch (e) {
      console.warn("Failed to load overview dashboard:", e);
    }
  }

  async loadCompanyZone() {
    try {
      const res = await fetch("/api/company/overview-profile");
      if (!res.ok) return;
      const data = await res.json();

      // Documents
      const pubContainer = document.getElementById("company-docs-public");
      const intContainer = document.getElementById("company-docs-internal");
      const restContainer = document.getElementById("company-docs-restricted");

      if (pubContainer && data.documents && data.documents.public) {
        pubContainer.innerHTML = "";
        data.documents.public.forEach((doc) => {
          const el = document.createElement("div");
          el.className = "file-item";
          el.style.cssText = "padding: 4px 8px; border: 1px solid #e2e8f0; border-radius: 4px; font-size: 0.75rem; display: flex; justify-content: space-between; cursor: pointer;";
          el.innerHTML = `<span class="text-blue font-mono">${doc.name}</span><span class="text-muted">${doc.size_formatted}</span>`;
          el.addEventListener("click", () => this.inspectCompanyFile(`documents/${doc.name}`, doc.name, doc.classification, doc.size_formatted));
          pubContainer.appendChild(el);
        });
        const pubCnt = document.getElementById("doc-count-public");
        if (pubCnt) pubCnt.innerText = `${data.documents.public.length} files`;
      }

      if (intContainer && data.documents && data.documents.internal) {
        intContainer.innerHTML = "";
        data.documents.internal.forEach((doc) => {
          const el = document.createElement("div");
          el.className = "file-item";
          el.style.cssText = "padding: 4px 8px; border: 1px solid #e2e8f0; border-radius: 4px; font-size: 0.75rem; display: flex; justify-content: space-between; cursor: pointer;";
          el.innerHTML = `<span class="text-main font-mono">${doc.name}</span><span class="text-muted">${doc.size_formatted}</span>`;
          el.addEventListener("click", () => this.inspectCompanyFile(`documents/${doc.name}`, doc.name, doc.classification, doc.size_formatted));
          intContainer.appendChild(el);
        });
        const intCnt = document.getElementById("doc-count-internal");
        if (intCnt) intCnt.innerText = `${data.documents.internal.length} files`;
      }

      if (restContainer && data.documents && data.documents.restricted) {
        restContainer.innerHTML = "";
        data.documents.restricted.forEach((doc) => {
          const el = document.createElement("div");
          el.className = "file-item";
          el.style.cssText = "padding: 4px 8px; border: 1px solid #fecaca; background: #fff5f5; border-radius: 4px; font-size: 0.75rem; display: flex; justify-content: space-between; cursor: pointer;";
          el.innerHTML = `<span class="text-red font-mono">${doc.name}</span><span class="badge badge-blocked">${doc.permission}</span>`;
          el.addEventListener("click", () => this.inspectCompanyFile(`restricted/${doc.name}`, doc.name, doc.classification, doc.size_formatted));
          restContainer.appendChild(el);
        });
        const restCnt = document.getElementById("doc-count-restricted");
        if (restCnt) restCnt.innerText = `${data.documents.restricted.length} files`;
      }

      // SQLite Database Tables
      const dbTbody = document.getElementById("company-db-tables-tbody");
      if (dbTbody && data.database && data.database.tables) {
        dbTbody.innerHTML = "";
        data.database.tables.forEach((t) => {
          const tr = document.createElement("tr");
          const isRest = t.permission === "RESTRICTED";
          tr.innerHTML = `
            <td><code>${t.name}</code></td>
            <td>${t.classification}</td>
            <td><span class="badge ${isRest ? 'badge-blocked' : 'badge-permitted'}">${t.permission}</span></td>
            <td><strong class="${isRest ? 'text-red' : 'text-blue'}">${t.record_count} rows</strong></td>
          `;
          dbTbody.appendChild(tr);
        });
      }

      // Structured Datasets
      const dataTbody = document.getElementById("company-datasets-tbody");
      if (dataTbody && data.structured_datasets) {
        dataTbody.innerHTML = "";
        data.structured_datasets.forEach((ds) => {
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td><code>${ds.filename}</code></td>
            <td>${ds.records} rows</td>
            <td><span class="badge ${ds.classification.includes('Tier 1') ? 'badge-blocked' : 'badge-permitted'}">${ds.classification}</span></td>
            <td class="font-mono" style="font-size:0.7rem;">${ds.columns.join(', ')}</td>
          `;
          dataTbody.appendChild(tr);
        });
      }
    } catch (e) {
      console.warn("Failed to load company zone data:", e);
    }
  }

  async inspectCompanyFile(relPath, filename, classification, sizeFormatted) {
    try {
      const res = await fetch(`/api/demo/file-content?path=${encodeURIComponent(relPath)}`);
      const nameEl = document.getElementById("company-inspector-name");
      const sizeEl = document.getElementById("company-inspector-size");
      const badgeEl = document.getElementById("company-inspector-badge");
      const contentEl = document.getElementById("company-inspector-content");

      if (res.ok) {
        const data = await res.json();
        if (nameEl) nameEl.innerText = `${data.filename || filename} (${data.path || relPath})`;
        if (sizeEl) sizeEl.innerText = `${data.size_bytes} bytes`;
        if (badgeEl) {
          badgeEl.innerText = data.classification || classification;
          badgeEl.className = (data.classification || classification).includes("RESTRICTED") ? "badge badge-blocked" : "badge badge-permitted";
          badgeEl.classList.remove("hidden");
        }
        if (contentEl) contentEl.innerText = data.content;
      } else {
        if (nameEl) nameEl.innerText = `${filename} (${relPath})`;
        if (sizeEl) sizeEl.innerText = sizeFormatted;
        if (badgeEl) {
          badgeEl.innerText = classification;
          badgeEl.className = "badge badge-blocked";
          badgeEl.classList.remove("hidden");
        }
        if (contentEl) contentEl.innerText = `[ZERO-TRUST POLICY PREVIEW]\nAccess to raw file '${filename}' is restricted. To inspect, run direct security evaluation.`;
      }
    } catch (e) {
      console.error("Inspect error:", e);
    }
  }

  async loadCompanyApiLogs() {
    try {
      const res = await fetch("/api/company/api-logs?limit=30");
      if (!res.ok) return;
      const data = await res.json();
      const tbody = document.getElementById("company-api-logs-tbody");
      if (!tbody) return;

      if (!data.logs || data.logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-muted" style="text-align: center; padding: 1.5rem;">No API requests recorded yet. Click "Probe Endpoint" above to test an endpoint.</td></tr>';
        return;
      }

      tbody.innerHTML = "";
      data.logs.forEach((log) => {
        const tr = document.createElement("tr");
        const is200 = log.status_code === 200;
        const timeStr = log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : "--";
        tr.innerHTML = `
          <td class="text-muted font-mono" style="font-size:0.7rem;">${timeStr}</td>
          <td><span class="badge badge-neutral">${log.method}</span></td>
          <td><code style="font-size:0.75rem;">${log.endpoint}</code></td>
          <td style="font-size:0.75rem;">${log.destination}</td>
          <td><span class="badge ${is200 ? 'badge-permitted' : 'badge-blocked'}">${log.status_code}</span></td>
          <td><span class="badge ${log.policy_decision === 'AUTHORIZED' ? 'badge-permitted' : 'badge-blocked'}">${log.policy_decision}</span></td>
          <td style="font-size:0.73rem; color: var(--text-muted); max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${log.reason}">${log.reason}</td>
          <td><span class="badge badge-neutral" style="font-size:0.65rem;">${log.source}</span></td>
        `;
        tbody.appendChild(tr);
      });
    } catch (e) {
      console.warn("Failed to load API request logs:", e);
    }
  }

  async probeMockApi(endpoint) {
    try {
      const res = await fetch(endpoint);
      const isOk = res.ok;
      const body = await res.json().catch(() => ({}));
      await this.loadCompanyApiLogs();
      const statusMsg = isOk ? `[HTTP 200 OK] Access Authorized:\n${JSON.stringify(body, null, 2)}` : `[HTTP ${res.status} FORBIDDEN] Policy Intercepted:\n${JSON.stringify(body, null, 2)}`;
      alert(`Endpoint Probe: ${endpoint}\n\n${statusMsg}`);
    } catch (e) {
      alert(`Network Error probing ${endpoint}: ${e.message}`);
    }
  }

  async loadCompanyFiles() {

    try {
      const res = await fetch("/api/demo/files");
      if (!res.ok) return;
      const data = await res.json();

      const docsList = document.getElementById("company-docs-list");
      if (docsList) {
        docsList.innerHTML = "";
        (data.documents || []).forEach((doc) => {
          const item = document.createElement("div");
          item.className = "file-item";
          item.style.padding = "4px 8px";
          item.style.cursor = "pointer";
          item.style.border = "1px solid #e2e8f0";
          item.style.borderRadius = "4px";
          item.style.fontSize = "0.75rem";
          item.style.display = "flex";
          item.style.justifyContent = "space-between";
          item.innerHTML = `<span>${doc.name}</span><span class="text-muted">${doc.size_bytes}B</span>`;
          item.addEventListener("click", () => this.inspectFile(doc.path));
          docsList.appendChild(item);
        });
        const cnt = document.getElementById("approved-docs-count");
        if (cnt) cnt.innerText = `${data.documents ? data.documents.length : 0} files`;
      }

      const restList = document.getElementById("company-restricted-list");
      if (restList) {
        restList.innerHTML = "";
        (data.restricted || []).forEach((doc) => {
          const item = document.createElement("div");
          item.className = "file-item";
          item.style.padding = "4px 8px";
          item.style.cursor = "pointer";
          item.style.border = "1px solid #fecaca";
          item.style.background = "#fff5f5";
          item.style.borderRadius = "4px";
          item.style.fontSize = "0.75rem";
          item.style.display = "flex";
          item.style.justifyContent = "space-between";
          item.innerHTML = `<span class="text-red font-mono">${doc.name}</span><span class="text-red" style="font-size:0.7rem;">[LOCKED]</span>`;
          item.addEventListener("click", () => this.inspectFile(doc.path));
          restList.appendChild(item);
        });
        const cnt = document.getElementById("restricted-docs-count");
        if (cnt) cnt.innerText = `${data.restricted ? data.restricted.length : 0} files`;
      }

      const dbList = document.getElementById("company-db-list");
      if (dbList) {
        dbList.innerHTML = "";
        (data.database_tables || []).forEach((tbl) => {
          const item = document.createElement("div");
          item.className = "file-item";
          item.style.padding = "4px 8px";
          item.style.border = "1px solid #e2e8f0";
          item.style.borderRadius = "4px";
          item.style.fontSize = "0.75rem";
          item.style.display = "flex";
          item.style.justifyContent = "space-between";
          const isRest = tbl.permission === "RESTRICTED";
          item.innerHTML = `<span class="${isRest ? 'text-red font-mono' : 'text-blue font-mono'}">table: ${tbl.name}</span><span class="badge ${isRest ? 'badge-blocked' : 'badge-permitted'}">${tbl.permission}</span>`;
          dbList.appendChild(item);
        });
        (data.structured || []).forEach((csv) => {
          const item = document.createElement("div");
          item.className = "file-item";
          item.style.padding = "4px 8px";
          item.style.cursor = "pointer";
          item.style.border = "1px solid #e2e8f0";
          item.style.borderRadius = "4px";
          item.style.fontSize = "0.75rem";
          item.style.display = "flex";
          item.style.justifyContent = "space-between";
          item.innerHTML = `<span>${csv.name}</span><span class="text-muted">${csv.size_bytes}B</span>`;
          item.addEventListener("click", () => this.inspectFile(csv.path));
          dbList.appendChild(item);
        });
      }
    } catch (e) {
      console.warn("Failed to load demo files", e);
    }
  }

  async inspectFile(path) {
    try {
      const res = await fetch(`/api/demo/file-content?path=${encodeURIComponent(path)}`);
      if (res.ok) {
        const data = await res.json();
        const nameEl = document.getElementById("inspector-file-name");
        const sizeEl = document.getElementById("inspector-file-size");
        const badgeEl = document.getElementById("inspector-badge");
        const contentEl = document.getElementById("inspector-content");

        if (nameEl) nameEl.innerText = `${data.filename} (${data.path})`;
        if (sizeEl) sizeEl.innerText = `${data.size_bytes} bytes`;
        if (badgeEl) {
          badgeEl.innerText = data.classification;
          badgeEl.className = data.classification.includes("RESTRICTED") ? "badge badge-blocked" : "badge badge-permitted";
          badgeEl.classList.remove("hidden");
        }
        if (contentEl) contentEl.innerText = data.content;
      }
    } catch (e) {
      console.error("Failed to inspect file", e);
    }
  }

  async loadBlueEvents() {
    try {
      const res = await fetch("/api/ledger?limit=40");
      if (res.ok) {
        const records = await res.json();
        const stream = document.getElementById("blue-events-stream");
        if (stream) {
          if (!records || records.length === 0) {
            stream.innerHTML = '<div class="text-muted">No security events recorded in audit ledger yet.</div>';
            return;
          }
          stream.innerHTML = "";
          records.reverse().forEach((r) => {
            const timeStr = r.timestamp ? new Date(r.timestamp).toLocaleTimeString() : "00:00:00";
            const details = r.details || {};
            const isCrit = r.severity.includes("CRITICAL") || r.event_type.includes("BREACH");
            const isDenial = r.severity.includes("HIGH") || r.event_type.includes("DENIED") || (details.pep_decision && details.pep_decision.includes("DENIED"));
            const cat = details.attack_category || r.event_type.replace(/_/g, " ");
            const target = details.target || details.expected_outcome || details.tool || "Company Resource";
            const model = details.target_model || this.activeModel || "qwen2.5:3b";
            const tool = details.tool || (details.proposed_tool ? (details.proposed_tool.tool || "tool") : "NONE");
            const prompt = details.prompt || details.response_preview || "";

            const el = document.createElement("div");
            el.style.cssText = "margin-bottom: 8px; padding: 6px 8px; background: rgba(15,23,42,0.85); border: 1px solid #1e293b; border-radius: 4px; font-size: 0.73rem; border-left: 3px solid " + (isCrit ? "#ef4444" : (isDenial ? "#f59e0b" : "#10b981")) + ";";
            el.innerHTML = `
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px;">
                <span style="color: #64748b; font-family: monospace;">[${timeStr}]</span>
                <strong style="color: ${isCrit ? '#ef4444' : (isDenial ? '#38bdf8' : '#34d399')}; text-transform: uppercase;">
                  ${cat}
                </strong>
                <span class="badge ${isCrit ? 'badge-blocked' : (isDenial ? 'badge-blocked' : 'badge-permitted')}" style="font-size: 0.65rem;">
                  ${isCrit ? 'QUARANTINE_SLAUGHTER' : (isDenial ? 'PEP_DENIED' : 'PEP_AUTHORIZED')}
                </span>
              </div>
              <div style="color: #cbd5e1; margin-bottom: 2px;">
                <strong>Target:</strong> <code style="color:#38bdf8;">${target}</code> | <strong>Model:</strong> ${model}
              </div>
              ${prompt ? `<div style="color: #94a3b8; font-size: 0.7rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"><strong>Prompt:</strong> "${prompt.substring(0, 80)}..."</div>` : ''}
              <div style="display: flex; justify-content: space-between; margin-top: 3px; font-size: 0.68rem; color: #64748b;">
                <span>Tool: <code style="color:#f59e0b;">${tool}</code></span>
                <span>Audit Block: <strong style="color:#38bdf8;">#${r.index}</strong></span>
              </div>
            `;
            stream.appendChild(el);
          });
        }

        // Initialize motion graph with historical events if empty
        if (this.motionEvents.length === 0 && records && records.length > 0) {
          records.slice(-6).forEach(r => {
            const isCrit = r.severity && (r.severity.includes("CRITICAL") || r.severity.includes("HIGH"));
            this.motionEvents.push({
              id: `BLK-${r.index}`,
              time: r.timestamp ? r.timestamp.substring(11, 19) : "00:00:00",
              category: r.event_type || "Adversarial Probe",
              llmReaction: isCrit ? "Exploit / Escalation Vector" : "Policy Monitored",
              enforcement: isCrit ? "SLAUGHTER_CONTAINED" : "AUDIT_RECORDED",
              severity: r.severity || "MEDIUM",
              remediation: isCrit ? "Process quarantine confirmed and logged to WORM ledger." : "Zero-trust verification passed.",
              status: isCrit ? "QUARANTINED" : "LOGGED",
              isBreach: isCrit
            });
          });
          this.renderMotionGraph();
        }
      }
    } catch (e) {
      console.warn("Could not load blue telemetry events", e);
    }
  }

  async resetDemoEnvironment() {
    try {
      const res = await fetch("/api/demo/reset", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        if (window.aegisDashboard) {
          window.aegisDashboard.refreshLedgerStatus();
        }
        await this.loadCompanyFiles();
        await this.loadLedgerTable();
        alert("Demo company environment reset successfully.\n• Documents: 15 files in data/demo_company/documents/\n• Restricted: 5 files in data/demo_company/restricted/\n• Structured: 4 CSVs in data/demo_company/structured/\n• Database: company.db with customers, complaints, employees, budgets\n• Workspace: Cleared");
      }
    } catch (e) {
      alert("Reset failed: " + e.message);
    }
  }

  async clearAuditLedger() {
    if (!confirm("Are you sure you want to reset the audit ledger to a clean initial state?")) return;
    try {
      const res = await fetch("/api/ledger/clear", { method: "POST" });
      if (res.ok) {
        await this.loadLedgerTable();
        if (window.aegisDashboard) {
          window.aegisDashboard.refreshLedgerStatus();
        }
        alert("Audit ledger reset to clean initial state.");
      }
    } catch (e) {
      alert("Clear ledger failed: " + e.message);
    }
  }

  async triggerSimulatedBreachDrill() {
    if (!confirm("Execute Operator Simulated Breach Drill?\n\nThis explicitly tests containment slaughter on an isolated synthetic canary fixture. It does NOT grant permissions to the agent or bypass the PEP.")) return;
    
    try {
      const res = await fetch("/api/simulation/breach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operator_id: "secops-operator",
          drill_notes: "Operator containment verification drill"
        })
      });
      if (res.ok) {
        const data = await res.json();
        
        // Add to Motion Graph as simulated drill
        this.addMotionEvent({
          id: data.drill_id,
          time: new Date().toLocaleTimeString(),
          category: "SIMULATED_BREACH_DRILL",
          llmReaction: "ISOLATED_CANARY_FIXTURE (No LLM Access)",
          enforcement: `CONTAINMENT_SLAUGHTER (${data.slaughter_latency_ms}ms)`,
          severity: "SEV-1_CRITICAL (DRILL)",
          remediation: `OPERATOR DRILL COMPLETE: Process killed in ${data.slaughter_latency_ms}ms. Committed to WORM Block #${data.audit_record_index}. Note: Real zero-trust PEP remains 100% defended.`,
          status: "SIMULATED_BREACH_CONTAINED",
          isBreach: false,
          isSimulatedDrill: true
        });

        // Add to Blue Stream
        const stream = document.getElementById("blue-events-stream");
        if (stream) {
          const line = document.createElement("div");
          line.style.cssText = "margin-bottom: 4px; padding-bottom: 4px; border-bottom: 1px solid #1e293b; background: rgba(245, 158, 11, 0.1); padding: 4px 6px; border-radius: 3px;";
          line.innerHTML = `
            <span class="text-muted">[${new Date().toLocaleTimeString()}]</span>
            <strong class="text-amber">[OPERATOR DRILL]</strong>
            <span class="text-amber font-bold">SIMULATED BREACH EXECUTED</span>
            <span class="badge badge-blocked" style="font-size:0.65rem;">CONTAINED (${data.slaughter_latency_ms}ms)</span>
            <span style="color:#94a3b8; font-size:0.7rem;">(WORM Block #${data.audit_record_index})</span>
            <div style="font-size:0.68rem; color:#fef3c7; margin-top:2px;">Target: ${data.target_fixture} &bull; Canary snippet: <code>${data.canary_data_snippet.substring(0, 40)}...</code></div>
          `;
          stream.insertBefore(line, stream.firstChild);
        }

        alert(`SIMULATED BREACH DRILL COMPLETED\n\n• Target Fixture: ${data.target_fixture}\n• Slaughter Latency: ${data.slaughter_latency_ms} ms\n• WORM Ledger Block: #${data.audit_record_index}\n• Real PEP Invariant: 100% INTACT (Zero real breaches)`);
        await this.loadBlueEvents();
        await this.loadSOCDashboard();
        await this.loadSOCIncidents();
      } else {
        alert("Simulated breach drill failed: " + res.statusText);
      }
    } catch (e) {
      alert("Simulated breach drill error: " + e.message);
    }
  }

  bindUI() {
    const select = document.getElementById("attack-select");
    if (select) {
      select.addEventListener("change", (e) => this.onAttackSelected(e.target.value));
    }

    const busBtn = document.getElementById("mode-business-btn");
    if (busBtn) {
      busBtn.addEventListener("click", () => this.setWorkbenchMode("business"));
    }

    const secBtn = document.getElementById("mode-security-btn");
    if (secBtn) {
      secBtn.addEventListener("click", () => this.setWorkbenchMode("security"));
    }

    const fireBtn = document.getElementById("btn-fire-attack");
    if (fireBtn) {
      fireBtn.addEventListener("click", () => this.launchSingleAttack());
    }

    const campBtn = document.getElementById("btn-run-campaign") || document.getElementById("btn-run-techniques");
    if (campBtn) {
      campBtn.addEventListener("click", () => this.start20Campaign());
    }

    const cancelCampBtn = document.getElementById("btn-cancel-campaign");
    if (cancelCampBtn) {
      cancelCampBtn.addEventListener("click", () => this.cancelActiveCampaign());
    }

    const jbBtn = document.getElementById("btn-open-jailbreaks");
    if (jbBtn) {
      jbBtn.addEventListener("click", () => this.openJailbreakLibrary());
    }

    const closeJbBtn = document.getElementById("btn-close-jailbreak-modal");
    if (closeJbBtn) {
      closeJbBtn.addEventListener("click", () => {
        const m = document.getElementById("jailbreak-modal");
        if (m) m.classList.add("hidden");
      });
    }

    const loadJbBtn = document.getElementById("btn-load-jailbreak-to-chat");
    if (loadJbBtn) {
      loadJbBtn.addEventListener("click", () => this.loadSelectedJailbreakIntoChat());
    }

    const runJbBtn = document.getElementById("btn-run-jailbreak-scenario");
    if (runJbBtn) {
      runJbBtn.addEventListener("click", () => this.runSelectedJailbreakScenario());
    }

    const scrollChatBtn = document.getElementById("btn-scroll-chat");
    if (scrollChatBtn) {
      scrollChatBtn.addEventListener("click", () => {
        const inp = document.getElementById("chat-input");
        if (inp) {
          inp.focus();
          inp.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      });
    }

    const refreshIncBtn = document.getElementById("btn-refresh-incidents");
    if (refreshIncBtn) {
      refreshIncBtn.addEventListener("click", () => this.loadSOCIncidents());
    }

    const closeIncBtn = document.getElementById("btn-close-incident-modal");
    if (closeIncBtn) {
      closeIncBtn.addEventListener("click", () => {
        const m = document.getElementById("incident-detail-modal");
        if (m) m.classList.add("hidden");
      });
    }

    const suiteBtn = document.getElementById("btn-run-suite");
    if (suiteBtn) {
      suiteBtn.addEventListener("click", () => this.runFullTestSuite(true));
    }

    const sentryBtn = document.getElementById("btn-run-sentry-suite");
    if (sentryBtn) {
      sentryBtn.addEventListener("click", () => this.runFullTestSuite(false));
    }

    const scenariosBtn = document.getElementById("btn-run-scenarios");
    if (scenariosBtn) {
      scenariosBtn.addEventListener("click", () => this.runAdversarialScenarios());
    }

    const manualKillBtn = document.getElementById("btn-manual-quarantine");
    if (manualKillBtn) {
      manualKillBtn.addEventListener("click", () => this.triggerManualKill());
    }

    const resetBtn1 = document.getElementById("btn-reset-demo");
    if (resetBtn1) {
      resetBtn1.addEventListener("click", () => this.resetDemoEnvironment());
    }

    const resetBtn2 = document.getElementById("btn-overview-reset");
    if (resetBtn2) {
      resetBtn2.addEventListener("click", () => this.resetDemoEnvironment());
    }

    const historyBtn = document.getElementById("btn-view-history");
    if (historyBtn) {
      historyBtn.addEventListener("click", () => this.openHistoryModal());
    }

    const closeHistoryBtn = document.getElementById("btn-close-history");
    if (closeHistoryBtn) {
      closeHistoryBtn.addEventListener("click", () => {
        const modal = document.getElementById("history-modal");
        if (modal) modal.classList.add("hidden");
      });
    }

    const closeScBtn = document.getElementById("btn-close-scorecard");
    if (closeScBtn) {
      closeScBtn.addEventListener("click", () => {
        const modal = document.getElementById("scorecard-modal");
        if (modal) modal.classList.add("hidden");
      });
    }

    const verifyBtn = document.getElementById("btn-verify-ledger");
    if (verifyBtn) {
      verifyBtn.addEventListener("click", () => this.openForensicModal());
    }

    const closeBtn = document.getElementById("btn-close-modal");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        const modal = document.getElementById("forensic-modal");
        if (modal) modal.classList.add("hidden");
      });
    }

    // Model Selector
    const modelSel = document.getElementById("global-model-selector");
    if (modelSel) {
      modelSel.addEventListener("change", (e) => this.selectTargetModel(e.target.value));
    }

    // Red Team Custom Dispatcher & Presets
    const redPreset = document.getElementById("red-preset-select");
    if (redPreset) {
      redPreset.addEventListener("change", (e) => {
        const chatInput = document.getElementById("chat-input");
        if (chatInput && e.target.value) {
          chatInput.value = e.target.value;
          chatInput.focus();
        }
      });
    }

    // Direct PEP Testing Controls
    const directPreset = document.getElementById("direct-pep-preset");
    if (directPreset) {
      directPreset.addEventListener("change", (e) => {
        const val = e.target.value;
        if (!val) return;
        const parts = val.split(":");
        const type = parts[0];
        const arg = parts[1];
        const mode = parts[2] || "company";

        const toolSel = document.getElementById("direct-pep-tool");
        const argInp = document.getElementById("direct-pep-arg");
        const modeSel = document.getElementById("direct-pep-mode");

        if (type === "doc" && toolSel) toolSel.value = "read_document";
        if (type === "db" && toolSel) toolSel.value = "query_database";
        if (type === "api" && toolSel) toolSel.value = "call_internal_api";

        if (argInp) argInp.value = arg;
        if (modeSel) modeSel.value = mode;
      });
    }

    const btnDirectPep = document.getElementById("btn-direct-pep-test");
    if (btnDirectPep) {
      btnDirectPep.addEventListener("click", () => this.executeDirectPEPTest());
    }

    const clearTestsBtn = document.getElementById("btn-clear-tests");
    if (clearTestsBtn) {
      clearTestsBtn.addEventListener("click", () => {
        const tbody = document.getElementById("security-tests-tbody");
        if (tbody) {
          tbody.innerHTML = '<tr><td colspan="7" class="text-muted" style="text-align: center; padding: 1.5rem;">0 tests recorded in this session. Submit an inquiry in the chat or click "Evaluate Direct PEP" to begin.</td></tr>';
        }
        this.testMetrics = { attempted: 0, modelRefusals: 0, pepDenials: 0, confirmedBreaches: 0, runtimeBlocked: 0, quarantines: 0 };
        const att = document.getElementById("test-count-attempted");
        if (att) att.innerText = "0";
        const ref = document.getElementById("test-count-refusals");
        if (ref) ref.innerText = "0";
        const den = document.getElementById("test-count-pep-denials");
        if (den) den.innerText = "0";
        const bre = document.getElementById("test-count-breaches");
        if (bre) bre.innerText = "0";
        const runBlk = document.getElementById("test-count-runtime-blocked");
        if (runBlk) runBlk.innerText = "0";
        const quar = document.getElementById("test-count-quarantines");
        if (quar) quar.innerText = "0";
        const rate = document.getElementById("test-pep-defense-rate");
        if (rate) {
          rate.innerText = "INSUFFICIENT DATA";
          rate.className = "metric-tile-val text-blue";
        }
        const note = document.getElementById("test-pep-defense-note");
        if (note) note.innerText = "0 evaluated checks";
        const activeRun = document.getElementById("active-test-run-id");
        if (activeRun) activeRun.innerText = "NONE";
      });
    }

    // Company Environment Explorer buttons
    const refCompBtn = document.getElementById("btn-refresh-company");
    if (refCompBtn) {
      refCompBtn.addEventListener("click", () => {
        this.loadCompanyZone();
        this.loadCompanyApiLogs();
      });
    }

    const refLogsBtn = document.getElementById("btn-refresh-api-logs");
    if (refLogsBtn) {
      refLogsBtn.addEventListener("click", () => this.loadCompanyApiLogs());
    }

    const resetCompBtn = document.getElementById("btn-reset-company");
    if (resetCompBtn) {
      resetCompBtn.addEventListener("click", () => this.resetDemoEnvironment());
    }


    // Blue Team Operations
    const blueKillBtn = document.getElementById("btn-blue-kill");
    if (blueKillBtn) {
      blueKillBtn.addEventListener("click", () => this.triggerManualKill());
    }

    const blueRefBtn = document.getElementById("btn-blue-refresh");
    if (blueRefBtn) {
      blueRefBtn.addEventListener("click", () => this.loadBlueEvents());
    }

    const clearStreamBtn = document.getElementById("btn-clear-blue-stream");
    if (clearStreamBtn) {
      clearStreamBtn.addEventListener("click", () => {
        const stream = document.getElementById("blue-events-stream");
        if (stream) stream.innerHTML = '<div class="text-muted">[BLUE-SOC] Stream feed cleared. Listening for incoming events...</div>';
      });
    }

    const simBreachBtn = document.getElementById("btn-operator-sim-breach");
    if (simBreachBtn) {
      simBreachBtn.addEventListener("click", () => this.triggerSimulatedBreachDrill());
    }

    // Clear Audit Ledger
    const clearLedgerBtn = document.getElementById("btn-clear-ledger");
    if (clearLedgerBtn) {
      clearLedgerBtn.addEventListener("click", () => this.clearAuditLedger());
    }

    const togglePepBtn = document.getElementById("btn-toggle-strict-pep");
    if (togglePepBtn) {
      togglePepBtn.addEventListener("click", () => this.toggleStrictPEP());
    }

    // AI Workbench Chat Interface Bindings
    const btnCompany = document.getElementById("btn-mode-company");
    if (btnCompany) {
      btnCompany.addEventListener("click", () => this.setAssistantMode("company"));
    }

    const btnGeneral = document.getElementById("btn-mode-general");
    if (btnGeneral) {
      btnGeneral.addEventListener("click", () => this.setAssistantMode("general"));
    }

    const modeSelect = document.getElementById("chat-assistant-mode-select");
    if (modeSelect) {
      modeSelect.addEventListener("change", (e) => this.setAssistantMode(e.target.value));
    }

    const btnNewChat = document.getElementById("btn-new-chat") || document.getElementById("btn-chat-reset");
    if (btnNewChat) {
      btnNewChat.addEventListener("click", () => this.resetChat());
    }

    const btnToggleTech = document.getElementById("btn-toggle-tech-panel");
    if (btnToggleTech) {
      btnToggleTech.addEventListener("click", () => {
        const panel = document.getElementById("workbench-tech-panel");
        if (panel) {
          panel.classList.toggle("hidden");
          btnToggleTech.innerText = panel.classList.contains("hidden") ? "Show Technical Observation Panel" : "Hide Technical Panel";
        }
      });
    }

    const btnSendChat = document.getElementById("btn-send-chat") || document.getElementById("btn-chat-send");
    if (btnSendChat) {
      btnSendChat.addEventListener("click", () => this.sendChatMessage());
    }


}
