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

};
