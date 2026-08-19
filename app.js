/* ==========================================================================
   HYPERPULSE // INDUSTRIAL CONTROLLER ENGINE (app.js)
   ========================================================================== */

// --- GLOBAL STATE ---
const state = {
  sessionId: 'HYPER-' + Math.floor(1000 + Math.random() * 9000),
  transportMode: 'usb',
  isConnected: false,
  latencyMs: 0.4,
  pollingHz: 1000,
  audioMuted: false,

  // Which top-level section is visible
  activeSection: 'landing',
  // Which controller tab is visible inside modesSection
  activeControllerTab: 'gamepad',

  inputs: {
    buttons: {
      A: false, B: false, X: false, Y: false,
      L1: false, R1: false, L2: false, R2: false,
      DPAD_UP: false, DPAD_DOWN: false, DPAD_LEFT: false, DPAD_RIGHT: false,
      START: false, SELECT: false
    },
    sticks:   { LX: 0, LY: 0, RX: 0, RY: 0 },
    triggers: { L2: 0, R2: 0 },
    wheel: {
      angle: 0, throttle: 0, brake: 0, clutch: 0,
      gear: 4, speed: 184, handbrake: false
    },
    gyro: {
      pitch: 0, roll: 0, yaw: 0,
      zeroPitch: 0, zeroRoll: 0, zeroYaw: 0,
      sens: 5, deadzone: 2, smooth: 40
    },
    mouse: { x: 0, y: 0, left: false, middle: false, right: false, dpi: 5 }
  }
};

/* ==========================================================================
   PAGE-VISIBILITY GATE
   All heavy loops check this before doing any work.
   ========================================================================== */
let _pageVisible = !document.hidden;
document.addEventListener('visibilitychange', () => {
  _pageVisible = !document.hidden;
});

/* Helpers: is a given section/tab currently the active visible one? */
function isSectionActive(sectionId)  { return _pageVisible && state.activeSection === sectionId; }
function isControllerTabActive(tab)  { return isSectionActive('modes') && state.activeControllerTab === tab; }

/* ==========================================================================
   WEB AUDIO SYNTHESIZER
   ========================================================================== */
let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function playSound(type) {
  if (state.audioMuted) return;
  try {
    const ctx  = getAudioContext();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    const t = ctx.currentTime;
    if (type === 'click') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(400, t);
      osc.frequency.exponentialRampToValueAtTime(100, t + 0.04);
      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.04);
      osc.start(t); osc.stop(t + 0.04);
    } else if (type === 'gear') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(120, t);
      osc.frequency.exponentialRampToValueAtTime(30, t + 0.1);
      gain.gain.setValueAtTime(0.4, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
      osc.start(t); osc.stop(t + 0.1);
    } else if (type === 'chime') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, t);
      osc.frequency.setValueAtTime(880, t + 0.08);
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.25);
      osc.start(t); osc.stop(t + 0.25);
    }
  } catch(e) {}
}

function triggerHaptic(duration = 40) {
  if (navigator.vibrate) { try { navigator.vibrate(duration); } catch(e) {} }
}

/* ==========================================================================
   TRANSPORT — BroadcastChannel + ERD integration
   ========================================================================== */
const localChannel = new BroadcastChannel('hyperpulse_channel');

localChannel.onmessage = (event) => {
  if (event.data && event.data.type === 'INPUT_UPDATE') {
    state.inputs = event.data.inputs;
    // Only update DOM if the host dashboard is actually visible
    if (isSectionActive('host')) updateHostTelemetryUI();
  }
};

/* Debounce token for input logging — don't hit localStorage on every keypress */
let _logDebounceId = null;

function broadcastInputs() {
  if (window.HPTransport) {
    HPTransport.send(state.inputs);
  } else {
    localChannel.postMessage({
      type: 'INPUT_UPDATE',
      sessionId: state.sessionId,
      inputs: state.inputs,
      timestamp: performance.now()
    });
  }

  // Debounce ERD input logging — max 10 Hz, never on the critical path
  if (window.HP && !_logDebounceId) {
    _logDebounceId = setTimeout(() => {
      _logDebounceId = null;
      const session = HP.getActiveSession();
      HP.logInput(
        'browser-device',
        session ? session.session_id : null,
        'mixed',
        { sticks: state.inputs.sticks, buttons: state.inputs.buttons },
        state.latencyMs
      );
    }, 100);
  }
}

function endHostSession() {
  playSound('click');
  state.isConnected = false;
  if (window.HP) HP.endSession();
  showSection('landing');
  showToast('Session ended.');
}

/* ==========================================================================
   INITIALIZATION
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
  initUI();
  initTouchSticks();
  initWheelCanvas();
  initHorizonCanvas();
  initSensors();
  startTelemetryUpdateLoop();

  if (window.HPAuth)       HPAuth.init();
  if (window.HPDashboard)  HPDashboard.init();
  if (window.HPProfiles)   HPProfiles.init();
  if (window.HPCommunity)  HPCommunity.init();
  if (window.HPSettingsUI) HPSettingsUI.init();

  if (window.HPTransport) {
    HPTransport.initLocal();
    HPTransport.on('input', (inputs) => {
      if (inputs.buttons) state.inputs.buttons = inputs.buttons;
      if (inputs.sticks)  state.inputs.sticks  = inputs.sticks;
      if (inputs.wheel)   state.inputs.wheel   = inputs.wheel;
      if (inputs.gyro)    state.inputs.gyro    = inputs.gyro;
      if (isSectionActive('host')) updateHostTelemetryUI();
    });
    // Latency simulator only runs when host dashboard is open
    HPTransport.startLatencySimulator((ms) => {
      if (!isSectionActive('host')) return;
      state.latencyMs = ms;
      const el = document.getElementById('dashLatencyVal');
      if (el) el.innerText = ms + ' MS';
    });
  }

  window.addEventListener('scroll', () => {
    const btn = document.getElementById('scrollTopBtn');
    if (btn) btn.classList.toggle('visible', window.scrollY > 400);
  }, { passive: true });
});

function initUI() {
  document.getElementById('dashSessionCode').innerText = state.sessionId;
  document.getElementById('dashBigCode').innerText     = state.sessionId.replace('HYPER-', '');
  document.getElementById('modalRoomCode').innerText   = state.sessionId;
  generateQRCode();
}

function generateQRCode() {
  const qrContainer = document.getElementById('dashboardQrCode');
  const modalQr     = document.getElementById('modalQrDisplay');
  if (qrContainer) qrContainer.innerHTML = '';
  if (modalQr)     modalQr.innerHTML     = '';
  const pairingUrl = window.location.origin + window.location.pathname + '?join=' + state.sessionId;
  if (typeof QRCode !== 'undefined') {
    if (qrContainer) new QRCode(qrContainer, { text: pairingUrl, width: 140, height: 140 });
    if (modalQr)     new QRCode(modalQr,     { text: pairingUrl, width: 160, height: 160 });
  }
}

/* ==========================================================================
   NAVIGATION
   Central place that sets state.activeSection so all loops know what's visible.
   ========================================================================== */
function showSection(sectionId) {
  playSound('click');
  document.querySelectorAll('.app-section').forEach(sec => sec.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));

  state.activeSection = sectionId;

  const map = {
    landing:   'landingSection',
    dashboard: 'dashboardSection',
    modes:     'modesSection',
    builder:   'builderSection',
    host:      'hostDashboardSection',
    community: 'communitySection'
  };
  const el = map[sectionId] ? document.getElementById(map[sectionId]) : null;
  if (el) el.classList.add('active');

  // Resume / pause Three.js model based on whether landing is showing
  if (window._heroModelCallbacks) {
    if (sectionId === 'landing') _heroModelCallbacks.resume();
    else                         _heroModelCallbacks.pause();
  }
}

/* ==========================================================================
   TRANSPORT MODE SELECT / SESSION
   ========================================================================== */
function selectTransportMode(mode) {
  playSound('click');
  state.transportMode = mode;
  document.querySelectorAll('.transport-option').forEach(el => el.classList.remove('active'));

  const labels = {
    usb:   { el: 'modeUsbOption',   ms: 0.4, label: '⚡ USB CABLE',   toast: 'USB Type-C Wired Mode Selected (<0.5ms)' },
    wifi:  { el: 'modeWifiOption',  ms: 1.8, label: '📶 WI-FI P2P',   toast: 'Wi-Fi P2P Link Selected' },
    local: { el: 'modeLocalOption', ms: 0.2, label: '🔗 LOCAL SYNC',  toast: 'Local Dual-Window Sync Selected' }
  };
  const cfg = labels[mode];
  if (!cfg) return;
  document.getElementById(cfg.el).classList.add('active');
  state.latencyMs = cfg.ms;
  document.getElementById('dashTransportType').innerText = cfg.label;
  document.getElementById('dashLatencyVal').innerText    = cfg.ms + ' MS';
  showToast(cfg.toast);
}

function startHostSession() {
  playSound('chime');
  state.isConnected = true;
  if (window.HP) {
    const session = HP.createSession(state.transportMode);
    state.sessionId = session.session_code;
    document.getElementById('dashSessionCode').innerText = session.session_code;
    document.getElementById('dashBigCode').innerText     = session.session_code.replace('HYPER-', '');
    document.getElementById('modalRoomCode').innerText   = session.session_code;
    generateQRCode();
  }
  showSection('host');
  showToast('⚡ HOST SESSION ACTIVATED: ' + state.sessionId);
}

function openSessionModal() {
  playSound('click');
  document.getElementById('sessionModal').classList.add('active');
}

function closeSessionModal() {
  playSound('click');
  document.getElementById('sessionModal').classList.remove('active');
}

// Alias used in HTML
function openJoinModal() { openSessionModal(); }

function switchModalTab(tabKey) {
  playSound('click');
  document.querySelectorAll('.modal-tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.modal-tab-content').forEach(c => c.classList.remove('active'));
  if (tabKey === 'usb') {
    document.getElementById('tabModUsb').classList.add('active');
    document.getElementById('modalUsbContent').classList.add('active');
  } else if (tabKey === 'wifi') {
    document.getElementById('tabModWifi').classList.add('active');
    document.getElementById('modalWifiContent').classList.add('active');
  }
}

function connectUsbDeviceHost() {
  playSound('chime');
  if (navigator.usb) {
    navigator.usb.requestDevice({ filters: [] })
      .then(device => { showToast('⚡ USB Device: ' + device.productName); closeSessionModal(); startHostSession(); })
      .catch(() => { showToast('⚡ USB Cable tethering active'); closeSessionModal(); startHostSession(); });
  } else {
    showToast('⚡ USB Direct Mode Active (<0.5ms)');
    closeSessionModal();
    startHostSession();
  }
}

function toggleMobileSimulator() {
  playSound('click');
  const drawer = document.getElementById('mobileSimulatorDrawer');
  drawer.classList.toggle('active');
  if (drawer.classList.contains('active')) document.getElementById('simIframe').src = window.location.href;
}

function toggleAudio() {
  state.audioMuted = !state.audioMuted;
  const btn = document.getElementById('audioToggleBtn');
  if (btn) { const icon = btn.querySelector('.icon'); if (icon) icon.textContent = state.audioMuted ? '🔇' : '🔈'; }
  showToast(state.audioMuted ? 'Audio Muted' : 'Audio Active');
}

function showToast(msg) {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className  = 'toast';
  toast.innerText  = msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function copySessionLink() {
  const url = window.location.origin + window.location.pathname + '?join=' + state.sessionId;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(url).then(() => showToast('Link copied!')).catch(() => showToast(url));
  } else {
    showToast(url);
  }
}

/* ==========================================================================
   CONTROLLER MODES — tab switching
   ========================================================================== */
function openModeDirect(modeKey) {
  showSection('modes');
  switchControllerTab(modeKey);
}

function switchControllerTab(tabKey) {
  playSound('click');
  document.querySelectorAll('.mode-nav-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.controller-tab-content').forEach(c => c.classList.remove('active'));

  state.activeControllerTab = tabKey;

  const tabMap = {
    gamepad: ['tabGamepadBtn', 'tabGamepad'],
    wheel:   ['tabWheelBtn',   'tabWheel'],
    gyro:    ['tabGyroBtn',    'tabGyro'],
    mouse:   ['tabMouseBtn',   'tabMouse']
  };
  const [btnId, contentId] = tabMap[tabKey] || [];
  if (btnId)     document.getElementById(btnId).classList.add('active');
  if (contentId) document.getElementById(contentId).classList.add('active');

  // Wheel canvas loop is self-gating via isControllerTabActive('wheel')
  // Horizon canvas loop is self-gating via isControllerTabActive('gyro')
}

/* ==========================================================================
   GAMEPAD HARDWARE HANDLERS
   Input handling is never throttled — must stay low-latency.
   ========================================================================== */
function handleButtonPress(btnName, isPressed) {
  playSound('click');
  triggerHaptic(30);
  state.inputs.buttons[btnName] = isPressed;
  const elem = document.getElementById('btn' + btnName);
  if (elem) elem.classList.toggle('active', isPressed);
  broadcastInputs();
}

function initTouchSticks() {
  setupStick('leftStickBase',  'leftStickThumb', (x, y) => { state.inputs.sticks.LX = x; state.inputs.sticks.LY = y; broadcastInputs(); });
  setupStick('rightStickBase', 'rightStickThumb', (x, y) => { state.inputs.sticks.RX = x; state.inputs.sticks.RY = y; broadcastInputs(); });
}

function setupStick(baseId, thumbId, callback) {
  const base  = document.getElementById(baseId);
  const thumb = document.getElementById(thumbId);
  if (!base || !thumb) return;

  let active = false;
  const maxRadius = 40;

  function onMove(clientX, clientY) {
    const rect    = base.getBoundingClientRect();
    let deltaX    = clientX - (rect.left + rect.width  / 2);
    let deltaY    = clientY - (rect.top  + rect.height / 2);
    const dist    = Math.hypot(deltaX, deltaY);
    if (dist > maxRadius) { deltaX = deltaX / dist * maxRadius; deltaY = deltaY / dist * maxRadius; }
    // Use will-change via transform — GPU composited, zero layout cost
    thumb.style.transform = `translate(${deltaX}px,${deltaY}px)`;
    callback(parseFloat((deltaX / maxRadius).toFixed(2)), parseFloat((deltaY / maxRadius).toFixed(2)));
  }

  function onEnd() {
    active = false;
    thumb.style.transform = 'translate(0px,0px)';
    callback(0, 0);
  }

  base.addEventListener('mousedown',  (e) => { active = true; onMove(e.clientX, e.clientY); }, { passive: true });
  window.addEventListener('mousemove', (e) => { if (active) onMove(e.clientX, e.clientY); }, { passive: true });
  window.addEventListener('mouseup',   ()  => { if (active) onEnd(); });

  base.addEventListener('touchstart', (e) => { active = true; onMove(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
  window.addEventListener('touchmove', (e) => { if (active) onMove(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
  window.addEventListener('touchend',  ()  => { if (active) onEnd(); });
}

/* ==========================================================================
   G29 RACING WHEEL — Canvas
   Loop is gated: only draws when wheel tab is visible AND page is visible.
   When idle (no drag, angle ≈ 0) it sleeps instead of spinning at 60fps.
   ========================================================================== */
let wheelCanvasCtx  = null;
let isDraggingWheel = false;
let _wheelRafId     = null;
let _wheelSleeping  = false;

function initWheelCanvas() {
  const canvas = document.getElementById('wheelCanvas');
  if (canvas) {
    wheelCanvasCtx = canvas.getContext('2d');
    let startX = 0;
    canvas.addEventListener('mousedown', (e) => { isDraggingWheel = true; startX = e.clientX; wakeWheelLoop(); }, { passive: true });
    window.addEventListener('mousemove', (e) => {
      if (!isDraggingWheel) return;
      const delta = (e.clientX - startX) * 1.5;
      state.inputs.wheel.angle = Math.max(-450, Math.min(450, state.inputs.wheel.angle + delta));
      startX = e.clientX;
      updateWheelTelemetry();
    }, { passive: true });
    window.addEventListener('mouseup', () => { isDraggingWheel = false; });

    canvas.addEventListener('touchstart', (e) => { isDraggingWheel = true; startX = e.touches[0].clientX; wakeWheelLoop(); }, { passive: true });
    window.addEventListener('touchmove', (e) => {
      if (!isDraggingWheel) return;
      const delta = (e.touches[0].clientX - startX) * 1.5;
      state.inputs.wheel.angle = Math.max(-450, Math.min(450, state.inputs.wheel.angle + delta));
      startX = e.touches[0].clientX;
      updateWheelTelemetry();
    }, { passive: true });
    window.addEventListener('touchend', () => { isDraggingWheel = false; });
  }
  // Don't start the loop here — it starts when wheel tab becomes active
}

function wakeWheelLoop() {
  if (_wheelRafId) return; // already running
  _wheelSleeping = false;
  renderWheelLoop();
}

function renderWheelLoop() {
  _wheelRafId = null;

  // Gate: pause when tab is hidden, or wheel section not showing
  if (!isControllerTabActive('wheel') && !isDraggingWheel) {
    _wheelSleeping = true;
    return; // loop exits — will be restarted by switchControllerTab or drag start
  }

  // Return-to-zero spring
  if (!isDraggingWheel && Math.abs(state.inputs.wheel.angle) > 0.5) {
    state.inputs.wheel.angle *= 0.88;
    if (Math.abs(state.inputs.wheel.angle) < 0.5) state.inputs.wheel.angle = 0;
    updateWheelTelemetry();
  }

  drawG29Wheel(wheelCanvasCtx, 180, 180, 140, state.inputs.wheel.angle);

  // Sleep when stationary and no user drag — wake on next drag
  const needsAnimation = isDraggingWheel || Math.abs(state.inputs.wheel.angle) > 0.5;
  if (needsAnimation) {
    _wheelRafId = requestAnimationFrame(renderWheelLoop);
  } else {
    _wheelSleeping = true;
    // Draw one final frame at rest, then stop
    drawG29Wheel(wheelCanvasCtx, 180, 180, 140, 0);
  }
}

function drawG29Wheel(ctx, cx, cy, radius, angleDeg) {
  if (!ctx) return;
  ctx.clearRect(0, 0, cx * 2, cy * 2);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((angleDeg * Math.PI) / 180);

  ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.lineWidth = 24; ctx.strokeStyle = '#161616'; ctx.stroke();

  ctx.beginPath(); ctx.arc(0, 0, radius, -Math.PI / 2 - 0.1, -Math.PI / 2 + 0.1);
  ctx.lineWidth = 24; ctx.strokeStyle = '#cc1111'; ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(-radius + 15, 0); ctx.lineTo(radius - 15, 0);
  ctx.moveTo(0, 0); ctx.lineTo(0, radius - 15);
  ctx.lineWidth = 12; ctx.strokeStyle = '#333'; ctx.stroke();

  ctx.beginPath(); ctx.arc(0, 0, 40, 0, Math.PI * 2);
  ctx.fillStyle = '#0a0a0a'; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = '#cc1111'; ctx.stroke();

  ctx.fillStyle = '#fff'; ctx.font = '800 12px "JetBrains Mono"';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('HP-G29', 0, 0);
  ctx.restore();
}

function shiftGear(delta) {
  playSound('gear');
  triggerHaptic(50);
  const g = state.inputs.wheel.gear + delta;
  if (g >= -1 && g <= 6) {
    state.inputs.wheel.gear = g;
    document.getElementById('cockpitGear').innerText = g === -1 ? 'R' : g === 0 ? 'N' : g;
    updateRPMBar();
    broadcastInputs();
  }
}

function handlePedalInput(pedal, val) {
  state.inputs.wheel[pedal] = parseFloat(val);
  updateRPMBar();
  broadcastInputs();
}

function updateRPMBar() {
  const leds = document.querySelectorAll('#rpmBar .led');
  const activeCount = Math.floor((state.inputs.wheel.throttle / 100) * leds.length);
  leds.forEach((led, i) => led.classList.toggle('active', i < activeCount));
}

function updateWheelTelemetry() {
  const el = document.getElementById('wheelAngleText');
  if (el) el.innerText = Math.round(state.inputs.wheel.angle) + '°';
  if (_wheelSleeping) wakeWheelLoop(); // re-enter loop if it was sleeping
  broadcastInputs();
}

/* ==========================================================================
   GYROSCOPE — Artificial Horizon Canvas
   Loop is gated: only draws when gyro tab is visible.
   ========================================================================== */
let horizonCtx    = null;
let _horizonRafId = null;
let _lastGyroData = { pitch: null, roll: null }; // dirty-check to avoid redraws

function initHorizonCanvas() {
  const canvas = document.getElementById('horizonCanvas');
  if (canvas) horizonCtx = canvas.getContext('2d');
  // Loop starts only when gyro tab is activated
}

function wakeHorizonLoop() {
  if (_horizonRafId) return;
  renderHorizonLoop();
}

function renderHorizonLoop() {
  _horizonRafId = null;

  if (!isControllerTabActive('gyro')) return; // self-suspend

  const { pitch, roll } = state.inputs.gyro;

  // Dirty check — skip redraw if nothing changed
  if (pitch !== _lastGyroData.pitch || roll !== _lastGyroData.roll) {
    _lastGyroData.pitch = pitch;
    _lastGyroData.roll  = roll;

    if (horizonCtx) {
      const w = 400, h = 300;
      horizonCtx.clearRect(0, 0, w, h);
      horizonCtx.save();
      horizonCtx.translate(w / 2, h / 2 + pitch * 2);
      horizonCtx.rotate((roll * Math.PI) / 180);
      horizonCtx.beginPath();
      horizonCtx.moveTo(-w, 0); horizonCtx.lineTo(w, 0);
      horizonCtx.lineWidth = 2; horizonCtx.strokeStyle = '#cc1111'; horizonCtx.stroke();
      horizonCtx.restore();
    }
  }

  _horizonRafId = requestAnimationFrame(renderHorizonLoop);
}

function initSensors() {
  if (window.DeviceOrientationEvent) {
    window.addEventListener('deviceorientation', (e) => {
      if (e.beta === null) return;
      state.inputs.gyro.pitch = parseFloat((e.beta  - state.inputs.gyro.zeroPitch).toFixed(1));
      state.inputs.gyro.roll  = parseFloat((e.gamma - state.inputs.gyro.zeroRoll).toFixed(1));
      state.inputs.gyro.yaw   = parseFloat(((e.alpha || 0) - state.inputs.gyro.zeroYaw).toFixed(1));

      if (isControllerTabActive('gyro')) {
        document.getElementById('gyroPitchVal').innerText = state.inputs.gyro.pitch + '°';
        document.getElementById('gyroRollVal').innerText  = state.inputs.gyro.roll  + '°';
        document.getElementById('gyroYawVal').innerText   = state.inputs.gyro.yaw   + '°';
        wakeHorizonLoop();
      }
      broadcastInputs();
    }, { passive: true });
  }
}

function requestMotionPermission() {
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    DeviceOrientationEvent.requestPermission().then(res => showToast('Motion: ' + res));
  } else {
    showToast('Motion Sensors Active');
  }
}

function calibrateGyroZero() {
  playSound('chime');
  state.inputs.gyro.zeroPitch = state.inputs.gyro.pitch;
  state.inputs.gyro.zeroRoll  = state.inputs.gyro.roll;
  state.inputs.gyro.zeroYaw   = state.inputs.gyro.yaw;
  showToast('Gyro Zero Calibrated');
}

/* ==========================================================================
   MOUSE HANDLERS
   ========================================================================== */
function handleMouseClick(btnType, isDown) {
  playSound('click');
  triggerHaptic(30);
  state.inputs.mouse[btnType] = isDown;
  broadcastInputs();
}

/* ==========================================================================
   TELEMETRY UPDATE LOOP
   Throttled to 10 Hz (100ms). Only runs when host dashboard is active.
   ========================================================================== */
let _telemetryIntervalId = null;

function startTelemetryUpdateLoop() {
  if (_telemetryIntervalId) return;
  _telemetryIntervalId = setInterval(() => {
    if (!isSectionActive('host')) return; // skip entirely when not on host page
    updateHostTelemetryUI();
  }, 100); // 10 Hz is plenty for a visual dashboard
}

function updateHostTelemetryUI() {
  const b = state.inputs.buttons;
  for (const key in b) {
    const chip = document.getElementById('chip-' + key);
    if (chip) chip.classList.toggle('active', b[key]);
  }
  const sl = document.getElementById('teleStickL');
  const sr = document.getElementById('teleStickR');
  const wa = document.getElementById('teleWheelAngle');
  const tp = document.getElementById('telePitch');
  const tr = document.getElementById('teleRoll');
  if (sl) sl.innerText = `LX: ${state.inputs.sticks.LX} | LY: ${state.inputs.sticks.LY}`;
  if (sr) sr.innerText = `RX: ${state.inputs.sticks.RX} | RY: ${state.inputs.sticks.RY}`;
  if (wa) wa.innerText = Math.round(state.inputs.wheel.angle) + '°';
  if (tp) tp.innerText = state.inputs.gyro.pitch + '°';
  if (tr) tr.innerText = state.inputs.gyro.roll  + '°';
}

/* ==========================================================================
   CONTROLLER TAB ACTIVATION — wake dormant loops
   ========================================================================== */
const _origSwitchTab = window.switchControllerTab; // won't exist yet, that's fine
function switchControllerTab(tabKey) {
  playSound('click');
  document.querySelectorAll('.mode-nav-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.controller-tab-content').forEach(c => c.classList.remove('active'));

  state.activeControllerTab = tabKey;

  const tabMap = {
    gamepad: ['tabGamepadBtn', 'tabGamepad'],
    wheel:   ['tabWheelBtn',   'tabWheel'],
    gyro:    ['tabGyroBtn',    'tabGyro'],
    mouse:   ['tabMouseBtn',   'tabMouse']
  };
  const [btnId, contentId] = tabMap[tabKey] || [];
  if (btnId)     document.getElementById(btnId).classList.add('active');
  if (contentId) document.getElementById(contentId).classList.add('active');

  // Wake the right canvas loop now that its tab is visible
  if (tabKey === 'wheel') wakeWheelLoop();
  if (tabKey === 'gyro')  wakeHorizonLoop();
}

/* ==========================================================================
   WORKSTATION BUILDER
   ========================================================================== */
function addCustomButton() {
  playSound('click');
  const canvas = document.getElementById('builderCanvas');
  const btn    = document.createElement('button');
  btn.className  = 'cyber-button sm primary';
  btn.innerText   = 'BTN_CUSTOM';
  btn.style.cssText = 'position:absolute;top:100px;left:100px;';
  canvas.appendChild(btn);
  showToast('+ Custom Button Added');
}

function addCustomStick() {
  playSound('click');
  const canvas = document.getElementById('builderCanvas');
  const stick   = document.createElement('div');
  stick.className   = 'touch-stick-base';
  stick.style.cssText = 'position:absolute;top:200px;left:200px;';
  canvas.appendChild(stick);
  showToast('+ Custom Stick Added');
}

function saveCustomLayout() {
  playSound('chime');
  if (window.HP) HP.createControllerProfile('Custom Layout', 'custom', {});
  showToast('Profile Saved');
}

/* ==========================================================================
   HERO 3D CONTROLLER MODEL — Three.js / WebGL
   GPU-accelerated, but loop pauses when landing section is not visible
   and when the browser tab is hidden.
   ========================================================================== */
(function initHeroModel() {
  function tryInit() {
    if (typeof THREE === 'undefined' ||
        typeof THREE.GLTFLoader === 'undefined' ||
        typeof THREE.OrbitControls === 'undefined') {
      setTimeout(tryInit, 80);
      return;
    }

    const wrap    = document.getElementById('controllerModelWrap');
    const canvas  = document.getElementById('heroModelCanvas');
    const loading = document.getElementById('modelLoading');
    if (!wrap || !canvas) return;

    /* Renderer — GPU, minimal settings for performance */
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
      precision: 'mediump', // mediump is fine for a product showcase — saves GPU bandwidth
      stencil: false,
      depth: true
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // cap at 1.5x — saves ~30% fill rate vs 2x
    renderer.outputEncoding      = THREE.sRGBEncoding;
    renderer.toneMapping         = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.4;
    renderer.shadowMap.enabled   = false; // shadows OFF — big CPU/GPU saving

    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 100);
    camera.position.set(0, 0.2, 2.6);

    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const key  = new THREE.DirectionalLight(0xffffff, 1.8); key.position.set(1.5, 3, 4);  scene.add(key);
    const fill = new THREE.DirectionalLight(0xffd0c0, 0.4); fill.position.set(-3, 1, 2);  scene.add(fill);
    const rim  = new THREE.DirectionalLight(0x6688ff, 0.2); rim.position.set(0, -2, -4);   scene.add(rim);

    const controls = new THREE.OrbitControls(camera, canvas);
    controls.enableDamping   = true;
    controls.dampingFactor   = 0.05;
    controls.enablePan       = false;
    controls.minDistance     = 1.0;
    controls.maxDistance     = 5.5;
    controls.minPolarAngle   = Math.PI * 0.15;
    controls.maxPolarAngle   = Math.PI * 0.80;
    controls.autoRotate      = true;
    controls.autoRotateSpeed = 1.2;
    controls.target.set(0, 0, 0);
    controls.update();

    function resize() {
      const w = wrap.clientWidth  || 290;
      const h = wrap.clientHeight || 440;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    resize();
    new ResizeObserver(resize).observe(wrap);

    const dracoLoader = new THREE.DRACOLoader();
    dracoLoader.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.134.0/examples/js/libs/draco/');
    const loader = new THREE.GLTFLoader();
    loader.setDRACOLoader(dracoLoader);

    let modelLoaded = false;

    loader.load(
      'red_gear_pc_gaming_controller.glb',
      (gltf) => {
        const model  = gltf.scene;
        const box    = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size   = box.getSize(new THREE.Vector3());
        const scale  = 1.7 / Math.max(size.x, size.y, size.z);
        model.scale.setScalar(scale);
        model.position.copy(center.negate().multiplyScalar(scale));
        model.rotation.x = THREE.MathUtils.degToRad(-18);
        model.rotation.y = THREE.MathUtils.degToRad(180);
        model.position.y -= 0.05;
        scene.add(model);
        modelLoaded = true;
        if (loading) loading.classList.add('hidden');
        const hint = document.getElementById('modelDragHint');
        if (hint) setTimeout(() => hint.classList.add('hidden'), 3000);
        resize();
      },
      (xhr) => {
        if (xhr.total) {
          const bar = document.getElementById('modelProgressFill');
          if (bar) bar.style.width = (xhr.loaded / xhr.total * 100).toFixed(0) + '%';
        }
      },
      (err) => {
        console.warn('GLB load error:', err);
        if (loading) {
          const sp = loading.querySelector('.model-spinner');
          const lb = loading.querySelector('span');
          if (sp) sp.style.display = 'none';
          if (lb) lb.textContent   = 'MODEL UNAVAILABLE';
        }
      }
    );

    /* ── Demand-render loop ───────────────────────────────────
       Only renders a new frame when:
       1. Page is visible
       2. Landing section is active
       3. Controls are dirty (user is dragging) OR auto-rotating
       Idle render rate drops to ~0 fps when nobody is interacting.
    ─────────────────────────────────────────────────────────── */
    let _rafId    = null;
    let _paused   = false;
    let _lastTime = 0;
    const TARGET_MS = 1000 / 60; // 60 fps cap

    function loop(now) {
      _rafId = null;
      if (_paused || !_pageVisible || !modelLoaded) return;
      if (!isSectionActive('landing')) return; // stop when not on landing

      const delta = now - _lastTime;
      if (delta < TARGET_MS - 1) {
        // Too early for next frame — reschedule without rendering
        _rafId = requestAnimationFrame(loop);
        return;
      }
      _lastTime = now;

      controls.update();
      renderer.render(scene, camera);
      _rafId = requestAnimationFrame(loop);
    }

    function resume() {
      _paused = false;
      if (!_rafId) _rafId = requestAnimationFrame(loop);
    }

    function pause() {
      _paused = true;
      if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null; }
    }

    // Expose so showSection() can pause/resume
    window._heroModelCallbacks = { pause, resume };

    // Also gate on page visibility
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) pause(); else if (isSectionActive('landing')) resume();
    });

    // Detect interaction to ensure loop is running during drag
    canvas.addEventListener('pointerdown', () => { if (!_rafId) resume(); }, { passive: true });

    // Start loop
    resume();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryInit);
  } else {
    tryInit();
  }
})();
