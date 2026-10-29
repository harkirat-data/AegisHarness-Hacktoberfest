/**
 * AegisHarness Real-Time Telemetry & Visualizer Engine
 * Connects to WebSocket /ws/telemetry and renders live Tri-Workload events.
 * Strictly adheres to professional cybersecurity aesthetic with zero emojis.
 */

class AegisDashboard {
  constructor() {
    this.ws = null;
    this.slaughterCount = 0;
    this.audioCtx = null;
    this.initAudio();
    this.initWebSocket();
    this.bindEvents();
  }

  initAudio() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.audioCtx = new AudioContext();
      }
    } catch (e) {
      console.warn("Web Audio API not supported", e);
    }
  }

  playAlarmSound() {
    if (!this.audioCtx) return;
    try {
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, this.audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, this.audioCtx.currentTime + 0.25);
      gain.gain.setValueAtTime(0.08, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.25);
    } catch (e) {
      console.warn("Audio playback failed", e);
    }
  }

  initWebSocket() {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/telemetry`;
    const indicator = document.getElementById("socket-indicator");
    const statusText = document.getElementById("socket-status");

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        if (indicator) {
          indicator.style.backgroundColor = "var(--accent-emerald)";
          indicator.style.boxShadow = "none";
        }
        if (statusText) statusText.innerText = "STREAM ONLINE";
        this.appendTerminalLog("blue", "[BLUE_ZONE] Live telemetry WebSocket connected to Aegis Kernel Pipe.");
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleIncomingTelemetry(msg);
        } catch (e) {
          console.error("Malformed telemetry packet", e);
        }
      };

      this.ws.onclose = () => {
        if (indicator) {
          indicator.style.backgroundColor = "var(--accent-red)";
          indicator.style.boxShadow = "none";
        }
        if (statusText) statusText.innerText = "STREAM OFFLINE";
        setTimeout(() => this.initWebSocket(), 3000);
      };

      this.ws.onerror = (err) => {
        console.warn("WebSocket error:", err);
      };
    } catch (e) {
      console.error("Failed to initialize WebSocket:", e);
    }
  }

  handleIncomingTelemetry(msg) {
    const { type, zone, data } = msg;

    if (window.attackController && window.attackController.animateArchitectureStage) {
      if (type === "ATTACK_RECEIVED") window.attackController.animateArchitectureStage("INGRESS");
      else if (type === "AGENT_INFERENCE_STARTING") window.attackController.animateArchitectureStage("INFERENCE");
      else if (type === "AGENT_RESPONSE_RECEIVED" && data && data.proposed_tool) window.attackController.animateArchitectureStage("PARSER");
      else if (type === "SYSCALL_TRAPPED") window.attackController.animateArchitectureStage("PEP", "DENIED");
      else if (type === "QUARANTINE_ACTION") window.attackController.animateArchitectureStage("CONTAINMENT");
    }

    switch (type) {
      case "ATTACK_RECEIVED":
        this.onAttackReceived(data);
        break;
      case "AGENT_INFERENCE_STARTING":
        this.appendTerminalLog("target", `[LOCAL_LLM] Invoking local model (${data.model}) on NVIDIA RTX 3050...`, "text-cyan");
        this.updateSandboxStatus("INFERENCING", "status-executing");
        break;
      case "AGENT_RESPONSE_RECEIVED":
        const agentLog = `[AGENT_OUTPUT] Outcome: ${data.outcome} (Refused: ${data.refused})\n` +
          `Raw: "${data.raw_response.substring(0, 150)}..."` +
          (data.proposed_tool ? `\nProposed Tool: ${JSON.stringify(data.proposed_tool)}` : "");
        this.appendTerminalLog("target", agentLog, data.refused ? "text-amber" : "text-emerald");
        break;
      case "SYSCALL_TRAPPED":
        this.onSyscallTrapped(data);
        break;
      case "THREAT_ALERT":
        this.onThreatAlert(data);
        break;
      case "QUARANTINE_ACTION":
        this.onQuarantineAction(data);
        break;
      case "SANDBOX_STATUS":
        this.onSandboxStatus(data);
        break;
      default:
        break;
    }
  }

  onAttackReceived(data) {
    const log = `[RED_INGRESS] Attack Dispatched: ${data.attack_name} [${data.mitre_tag || "UNKNOWN"}]\nPrompt: "${data.prompt.substring(0, 90)}..."\nExecve target: ${data.target_command}`;
    this.appendTerminalLog("red", log, "text-red");
    this.updateSandboxStatus("EXECUTING", "status-executing");
    

};
