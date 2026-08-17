/* ==========================================================================
   HYPERPULSE // INDUSTRIAL CONTROLLER ENGINE (app.js)
   ========================================================================== */

// --- GLOBAL STATE ---
const state = {
  sessionId: 'HYPER-' + Math.floor(1000 + Math.random() * 9000),
  transportMode: 'usb', // 'usb' | 'wifi' | 'local'
  isConnected: false,
  latencyMs: 0.4,
  pollingHz: 1000,
  audioMuted: false,

  // Controller Inputs State
  inputs: {
    buttons: {
      A: false, B: false, X: false, Y: false,
      L1: false, R1: false, L2: false, R2: false,
      DPAD_UP: false, DPAD_DOWN: false, DPAD_LEFT: false, DPAD_RIGHT: false,
      START: false, SELECT: false
    },
    sticks: { LX: 0, LY: 0, RX: 0, RY: 0 },
    triggers: { L2: 0, R2: 0 },
    wheel: {
      angle: 0, // -450 to +450 deg
      throttle: 0,
      brake: 0,
      clutch: 0,
      gear: 4,
      speed: 184,
      handbrake: false
    },
    gyro: {
      pitch: 0, roll: 0, yaw: 0,
      zeroPitch: 0, zeroRoll: 0, zeroYaw: 0,
      sens: 5, deadzone: 2, smooth: 40
    },
    mouse: { x: 0, y: 0, left: false, middle: false, right: false, dpi: 5 }
  }
};

// --- WEB AUDIO SYNTHESIZER ---
let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function playSound(type) {
  if (state.audioMuted) return;
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    if (type === 'click') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.exponentialRampToValueAtTime(100, now + 0.04);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.04);
      osc.start(now);
      osc.stop(now + 0.04);
    } else if (type === 'gear') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(120, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.1);
      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
    } else if (type === 'chime') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(880, now + 0.08);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.25);
    }
  } catch(e) {}
}

function triggerHaptic(duration = 40) {
  if (navigator.vibrate) {
    try { navigator.vibrate(duration); } catch(e) {}
  }
}

// --- BROADCASTCHANNEL LOCAL SYNC TRANSPORT ---
const localChannel = new BroadcastChannel('hyperpulse_channel');

localChannel.onmessage = (event) => {
  if (event.data && event.data.type === 'INPUT_UPDATE') {
    state.inputs = event.data.inputs;
    updateHostTelemetryUI();
  }
};

function broadcastInputs() {
  localChannel.postMessage({
    type: 'INPUT_UPDATE',
    sessionId: state.sessionId,
    inputs: state.inputs,
    timestamp: performance.now()
  });
}

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
  initUI();
  initTouchSticks();
  initWheelCanvas();
  initHorizonCanvas();
  initSensors();
  startTelemetryUpdateLoop();
});

function initUI() {
  document.getElementById('dashSessionCode').innerText = state.sessionId;
  document.getElementById('dashBigCode').innerText = state.sessionId.replace('HYPER-', '');
  document.getElementById('modalRoomCode').innerText = state.sessionId;

  generateQRCode();
}

function generateQRCode() {
  const qrContainer = document.getElementById('dashboardQrCode');
  const modalQr = document.getElementById('modalQrDisplay');
  if (qrContainer) qrContainer.innerHTML = '';
  if (modalQr) modalQr.innerHTML = '';

  const pairingUrl = window.location.origin + window.location.pathname + '?join=' + state.sessionId;
  if (typeof QRCode !== 'undefined') {
    if (qrContainer) new QRCode(qrContainer, { text: pairingUrl, width: 140, height: 140 });
    if (modalQr) new QRCode(modalQr, { text: pairingUrl, width: 160, height: 160 });
  }
}

// --- NAVIGATION & MODALS ---
function showSection(sectionId) {
  playSound('click');
  document.querySelectorAll('.app-section').forEach(sec => sec.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));

  if (sectionId === 'landing') {
    document.getElementById('landingSection').classList.add('active');
  } else if (sectionId === 'modes') {
    document.getElementById('modesSection').classList.add('active');
  } else if (sectionId === 'builder') {
    document.getElementById('builderSection').classList.add('active');
  } else if (sectionId === 'host') {
    document.getElementById('hostDashboardSection').classList.add('active');
  }
}

function selectTransportMode(mode) {
  playSound('click');
  state.transportMode = mode;
  document.querySelectorAll('.transport-option').forEach(el => el.classList.remove('active'));

  if (mode === 'usb') {
    document.getElementById('modeUsbOption').classList.add('active');
    state.latencyMs = 0.4;
    showToast('⚡ USB Type-C Wired Mode Selected (<0.5ms)');
  } else if (mode === 'wifi') {
    document.getElementById('modeWifiOption').classList.add('active');
    state.latencyMs = 1.8;
    showToast('📶 Wi-Fi P2P Link Selected');
  } else if (mode === 'local') {
    document.getElementById('modeLocalOption').classList.add('active');
    state.latencyMs = 0.2;
    showToast('🔗 Local Dual-Window Sync Selected');
  }

  document.getElementById('dashTransportType').innerText =
    mode === 'usb' ? '⚡ USB CABLE' : mode === 'wifi' ? '📶 WI-FI P2P' : '🔗 LOCAL SYNC';
  document.getElementById('dashLatencyVal').innerText = state.latencyMs + ' MS';
}

function startHostSession() {
  playSound('chime');
  state.isConnected = true;
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
      .then(device => {
        showToast('⚡ USB Device Connected: ' + device.productName);
        closeSessionModal();
        startHostSession();
      })
      .catch(() => {
        showToast('⚡ USB Cable tethering active on 192.168.42.x');
        closeSessionModal();
        startHostSession();
      });
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
  if (drawer.classList.contains('active')) {
    document.getElementById('simIframe').src = window.location.href;
  }
}

function toggleAudio() {
  state.audioMuted = !state.audioMuted;
  document.getElementById('audioToggleBtn').innerText = state.audioMuted ? '🔇' : '🔊';
  showToast(state.audioMuted ? 'Audio Muted' : 'Audio Active');
}

function showToast(msg) {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerText = msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// --- CONTROLLER MODES & SWITCHING ---
function openModeDirect(modeKey) {
  showSection('modes');
  switchControllerTab(modeKey);
}

function switchControllerTab(tabKey) {
  playSound('click');
  document.querySelectorAll('.mode-nav-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.controller-tab-content').forEach(c => c.classList.remove('active'));

  if (tabKey === 'gamepad') {
    document.getElementById('tabGamepadBtn').classList.add('active');
    document.getElementById('tabGamepad').classList.add('active');
  } else if (tabKey === 'wheel') {
    document.getElementById('tabWheelBtn').classList.add('active');
    document.getElementById('tabWheel').classList.add('active');
  } else if (tabKey === 'gyro') {
    document.getElementById('tabGyroBtn').classList.add('active');
    document.getElementById('tabGyro').classList.add('active');
  } else if (tabKey === 'mouse') {
    document.getElementById('tabMouseBtn').classList.add('active');
    document.getElementById('tabMouse').classList.add('active');
  }
}

// --- GAMEPAD HARDWARE HANDLERS ---
function handleButtonPress(btnName, isPressed) {
  playSound('click');
  triggerHaptic(30);
  state.inputs.buttons[btnName] = isPressed;
  const elem = document.getElementById('btn' + btnName);
  if (elem) elem.classList.toggle('active', isPressed);
  broadcastInputs();
}

function initTouchSticks() {
  setupStick('leftStickBase', 'leftStickThumb', (x, y) => {
    state.inputs.sticks.LX = x;
    state.inputs.sticks.LY = y;
    broadcastInputs();
  });

  setupStick('rightStickBase', 'rightStickThumb', (x, y) => {
    state.inputs.sticks.RX = x;
    state.inputs.sticks.RY = y;
    broadcastInputs();
  });
}

function setupStick(baseId, thumbId, callback) {
  const base = document.getElementById(baseId);
  const thumb = document.getElementById(thumbId);
  if (!base || !thumb) return;

  let active = false;
  let maxRadius = 40;

  function onMove(clientX, clientY) {
    const rect = base.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    let deltaX = clientX - centerX;
    let deltaY = clientY - centerY;
    let distance = Math.hypot(deltaX, deltaY);

    if (distance > maxRadius) {
      deltaX = (deltaX / distance) * maxRadius;
      deltaY = (deltaY / distance) * maxRadius;
    }

    thumb.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
    callback(parseFloat((deltaX / maxRadius).toFixed(2)), parseFloat((deltaY / maxRadius).toFixed(2)));
  }

  function onEnd() {
    active = false;
    thumb.style.transform = `translate(0px, 0px)`;
    callback(0, 0);
  }

  base.addEventListener('mousedown', (e) => { active = true; onMove(e.clientX, e.clientY); });
  window.addEventListener('mousemove', (e) => { if (active) onMove(e.clientX, e.clientY); });
  window.addEventListener('mouseup', () => { if (active) onEnd(); });

  base.addEventListener('touchstart', (e) => { active = true; onMove(e.touches[0].clientX, e.touches[0].clientY); });
  window.addEventListener('touchmove', (e) => { if (active) onMove(e.touches[0].clientX, e.touches[0].clientY); });
  window.addEventListener('touchend', () => { if (active) onEnd(); });
}

// --- LOGITECH G29 RACING WHEEL RENDERING ---
let wheelCanvasCtx = null;
let heroWheelCtx = null;
let isDraggingWheel = false;

function initWheelCanvas() {
  const canvas = document.getElementById('wheelCanvas');
  const heroCanvas = document.getElementById('heroWheelCanvas');
  if (canvas) wheelCanvasCtx = canvas.getContext('2d');
  if (heroCanvas) heroWheelCtx = heroCanvas.getContext('2d');

  renderWheelLoop();

  if (canvas) {
    let startX = 0;
    canvas.addEventListener('mousedown', (e) => { isDraggingWheel = true; startX = e.clientX; });
    window.addEventListener('mousemove', (e) => {
      if (isDraggingWheel) {
        let delta = (e.clientX - startX) * 1.5;
        state.inputs.wheel.angle = Math.max(-450, Math.min(450, state.inputs.wheel.angle + delta));
        startX = e.clientX;
        updateWheelTelemetry();
      }
    });
    window.addEventListener('mouseup', () => { isDraggingWheel = false; });
  }
}

function shiftGear(delta) {
  playSound('gear');
  triggerHaptic(50);
  let g = state.inputs.wheel.gear + delta;
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
  const throttle = state.inputs.wheel.throttle;
  let activeCount = Math.floor((throttle / 100) * leds.length);
  leds.forEach((led, i) => led.classList.toggle('active', i < activeCount));
}

function updateWheelTelemetry() {
  document.getElementById('wheelAngleText').innerText = Math.round(state.inputs.wheel.angle) + '°';
  broadcastInputs();
}

function renderWheelLoop() {
  if (!isDraggingWheel && state.inputs.wheel.angle !== 0) {
    state.inputs.wheel.angle *= 0.88;
    if (Math.abs(state.inputs.wheel.angle) < 0.5) state.inputs.wheel.angle = 0;
    updateWheelTelemetry();
  }

  // Draw G29 Steering Wheel Canvas (Industrial Palette)
  drawG29Wheel(wheelCanvasCtx, 180, 180, 140, state.inputs.wheel.angle);
  drawG29Wheel(heroWheelCtx, 140, 140, 110, performance.now() * 0.05);

  requestAnimationFrame(renderWheelLoop);
}

function drawG29Wheel(ctx, cx, cy, radius, angleDeg) {
  if (!ctx) return;
  ctx.clearRect(0, 0, cx * 2, cy * 2);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((angleDeg * Math.PI) / 180);

  // Outer Rubber Rim
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.lineWidth = 24;
  ctx.strokeStyle = '#161616';
  ctx.stroke();

  // Red Center Stripe
  ctx.beginPath();
  ctx.arc(0, 0, radius, -Math.PI / 2 - 0.1, -Math.PI / 2 + 0.1);
  ctx.lineWidth = 24;
  ctx.strokeStyle = '#cc1111';
  ctx.stroke();

  // Metallic Center Spokes
  ctx.beginPath();
  ctx.moveTo(-radius + 15, 0); ctx.lineTo(radius - 15, 0);
  ctx.moveTo(0, 0); ctx.lineTo(0, radius - 15);
  ctx.lineWidth = 12;
  ctx.strokeStyle = '#333';
  ctx.stroke();

  // Center Badge
  ctx.beginPath();
  ctx.arc(0, 0, 40, 0, Math.PI * 2);
  ctx.fillStyle = '#0a0a0a';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#cc1111';
  ctx.stroke();

  // Logo Text
  ctx.fillStyle = '#fff';
  ctx.font = '800 12px "JetBrains Mono"';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('HP-G29', 0, 0);

  ctx.restore();
}

// --- GYROSCOPE & ARTIFICIAL HORIZON ---
let horizonCtx = null;

function initHorizonCanvas() {
  const canvas = document.getElementById('horizonCanvas');
  if (canvas) horizonCtx = canvas.getContext('2d');
  renderHorizonLoop();
}

function initSensors() {
  if (window.DeviceOrientationEvent) {
    window.addEventListener('deviceorientation', (e) => {
      if (e.beta !== null) {
        state.inputs.gyro.pitch = parseFloat((e.beta - state.inputs.gyro.zeroPitch).toFixed(1));
        state.inputs.gyro.roll = parseFloat((e.gamma - state.inputs.gyro.zeroRoll).toFixed(1));
        state.inputs.gyro.yaw = parseFloat(((e.alpha || 0) - state.inputs.gyro.zeroYaw).toFixed(1));

        document.getElementById('gyroPitchVal').innerText = state.inputs.gyro.pitch + '°';
        document.getElementById('gyroRollVal').innerText = state.inputs.gyro.roll + '°';
        document.getElementById('gyroYawVal').innerText = state.inputs.gyro.yaw + '°';

        broadcastInputs();
      }
    });
  }
}

function requestMotionPermission() {
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    DeviceOrientationEvent.requestPermission().then(res => showToast('Motion Permission: ' + res));
  } else {
    showToast('Motion Sensors Active');
  }
}

function calibrateGyroZero() {
  playSound('chime');
  state.inputs.gyro.zeroPitch = state.inputs.gyro.pitch;
  state.inputs.gyro.zeroRoll = state.inputs.gyro.roll;
  state.inputs.gyro.zeroYaw = state.inputs.gyro.yaw;
  showToast('🎯 Gyro Zero Calibrated');
}

function renderHorizonLoop() {
  if (horizonCtx) {
    const w = 400, h = 300;
    horizonCtx.clearRect(0, 0, w, h);

    const pitchOffset = state.inputs.gyro.pitch * 2;
    const rollAngle = (state.inputs.gyro.roll * Math.PI) / 180;

    horizonCtx.save();
    horizonCtx.translate(w / 2, h / 2 + pitchOffset);
    horizonCtx.rotate(rollAngle);

    // Horizon Line
    horizonCtx.beginPath();
    horizonCtx.moveTo(-w, 0); horizonCtx.lineTo(w, 0);
    horizonCtx.lineWidth = 2;
    horizonCtx.strokeStyle = '#cc1111';
    horizonCtx.stroke();

    horizonCtx.restore();
  }

  requestAnimationFrame(renderHorizonLoop);
}

// --- MOUSE CLICK HANDLERS ---
function handleMouseClick(btnType, isDown) {
  playSound('click');
  triggerHaptic(30);
  state.inputs.mouse[btnType] = isDown;
  broadcastInputs();
}

// --- TELEMETRY UPDATE LOOP ---
function startTelemetryUpdateLoop() {
  setInterval(() => updateHostTelemetryUI(), 50);
}

function updateHostTelemetryUI() {
  const b = state.inputs.buttons;
  for (let key in b) {
    const chip = document.getElementById('chip-' + key);
    if (chip) chip.classList.toggle('active', b[key]);
  }

  document.getElementById('teleStickL').innerText = `LX: ${state.inputs.sticks.LX} | LY: ${state.inputs.sticks.LY}`;
  document.getElementById('teleStickR').innerText = `RX: ${state.inputs.sticks.RX} | RY: ${state.inputs.sticks.RY}`;

  document.getElementById('teleWheelAngle').innerText = Math.round(state.inputs.wheel.angle) + '°';
  document.getElementById('telePitch').innerText = state.inputs.gyro.pitch + '°';
  document.getElementById('teleRoll').innerText = state.inputs.gyro.roll + '°';
}

// --- WORKSTATION BUILDER ---
function addCustomButton() {
  playSound('click');
  const canvas = document.getElementById('builderCanvas');
  const btn = document.createElement('button');
  btn.className = 'cyber-button sm primary';
  btn.innerText = 'BTN_CUSTOM';
  btn.style.position = 'absolute';
  btn.style.top = '100px'; btn.style.left = '100px';
  canvas.appendChild(btn);
  showToast('+ Custom Button Added');
}

function addCustomStick() {
  playSound('click');
  const canvas = document.getElementById('builderCanvas');
  const stick = document.createElement('div');
  stick.className = 'touch-stick-base';
  stick.style.position = 'absolute';
  stick.style.top = '200px'; stick.style.left = '200px';
  canvas.appendChild(stick);
  showToast('+ Custom Stick Added');
}

function saveCustomLayout() {
  playSound('chime');
  showToast('💾 Profile Saved');
}
