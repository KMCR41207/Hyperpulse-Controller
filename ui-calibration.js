/* ==========================================================================
   HYPERPULSE // CALIBRATION WIZARD  (ui-calibration.js)
   Guided calibration for Gyro, Accelerometer, Steering, Joystick,
   Touch Controls. Saves per-device in Device.calibration JSON.
   ========================================================================== */

window.HPCalibration = (function () {

  /* ── Calibration steps per type ──────────────────────────────────────────── */
  const WIZARDS = {
    gyro: [
      { title:'PLACE DEVICE FLAT',  icon:'📱', instruction:'Place your phone face-up on a completely flat, stable surface.',      action:'wait',    duration:2000 },
      { title:'KEEP STILL',          icon:'🔒', instruction:'Do not touch the device. Sampling gyroscope baseline values.',       action:'sample',  duration:3000 },
      { title:'CALIBRATING',         icon:'⚙️',  instruction:'Calculating zero offsets for Pitch, Roll, and Yaw axes.',           action:'calibrate',duration:1500 },
      { title:'TEST MOVEMENT',       icon:'🔄', instruction:'Tilt the device left, right, forward, and backward to test.',       action:'test',    duration:0 },
      { title:'SAVE CALIBRATION',    icon:'💾', instruction:'Calibration complete. Tap Save to apply to this device.',           action:'save',    duration:0 },
    ],
    accelerometer: [
      { title:'PLACE DEVICE FLAT',  icon:'📱', instruction:'Place phone flat on a surface. This sets the gravity baseline.',     action:'wait',    duration:2000 },
      { title:'SAMPLING GRAVITY',   icon:'⬇️',  instruction:'Measuring gravitational acceleration. Keep device still.',          action:'sample',  duration:3000 },
      { title:'CALIBRATING',        icon:'⚙️',  instruction:'Computing accelerometer offsets across X, Y, Z axes.',             action:'calibrate',duration:1500 },
      { title:'SAVE',               icon:'💾', instruction:'Accelerometer baseline saved.',                                     action:'save',    duration:0 },
    ],
    steering: [
      { title:'CENTRE POSITION',    icon:'🎯', instruction:'Hold the phone horizontally in your normal steering grip.',          action:'wait',    duration:2000 },
      { title:'LOCK CENTRE',        icon:'🔒', instruction:'Keep steady. Locking the neutral steering angle.',                   action:'sample',  duration:2000 },
      { title:'STEER LEFT',         icon:'↩️',  instruction:'Steer fully to the left and hold.',                                action:'steer_l', duration:2000 },
      { title:'STEER RIGHT',        icon:'↪️',  instruction:'Steer fully to the right and hold.',                               action:'steer_r', duration:2000 },
      { title:'SAVE',               icon:'💾', instruction:'Steering range calibrated. Save to apply.',                         action:'save',    duration:0 },
    ],
    joystick: [
      { title:'RELEASE STICKS',     icon:'🕹️',  instruction:'Release both joysticks. They should return to centre.',            action:'wait',    duration:2000 },
      { title:'SAMPLE CENTRE',      icon:'⚙️',  instruction:'Sampling joystick neutral position to correct drift.',             action:'sample',  duration:2000 },
      { title:'FULL ROTATION',      icon:'🔄', instruction:'Move each joystick in a full circle to set the range.',             action:'test',    duration:0 },
      { title:'SAVE',               icon:'💾', instruction:'Joystick dead zone and range calibrated.',                         action:'save',    duration:0 },
    ],
    touch: [
      { title:'TOUCH ZONE SIZE',    icon:'👆', instruction:'Tap each corner of the touch area to define the active region.',    action:'test',    duration:0 },
      { title:'TAP ACCURACY',       icon:'🎯', instruction:'Tap the targets as they appear to calibrate touch offset.',         action:'test',    duration:0 },
      { title:'SAVE',               icon:'💾', instruction:'Touch calibration complete. Tap Save.',                            action:'save',    duration:0 },
    ],
  };

  /* ── Internal state ──────────────────────────────────────────────────────── */
  let _type    = null;   // active wizard type
  let _step    = 0;
  let _samples = {};     // collected sensor values
  let _result  = {};     // computed calibration result
  let _timer   = null;
  let _sensorListener = null;

  function esc(s) {
    return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  /* ── Sensor sampling ─────────────────────────────────────────────────────── */
  function startSampling(action) {
    _samples.values = [];
    if (action === 'sample' || action === 'calibrate') {
      _sensorListener = (e) => {
        if (e.beta !== null) {
          _samples.values.push({ pitch: e.beta, roll: e.gamma, yaw: e.alpha || 0 });
          if (_samples.values.length > 60) _samples.values.shift();
        }
      };
      window.addEventListener('deviceorientation', _sensorListener, { passive: true });
    }
  }

  function stopSampling() {
    if (_sensorListener) {
      window.removeEventListener('deviceorientation', _sensorListener);
      _sensorListener = null;
    }
  }

  function computeCalibration() {
    const vals = _samples.values || [];
    if (!vals.length) return {};
    const avg = (key) => vals.reduce((s, v) => s + v[key], 0) / vals.length;
    return {
      type: _type,
      zeroPitch: avg('pitch'),
      zeroRoll:  avg('roll'),
      zeroYaw:   avg('yaw'),
      calibrated_at: new Date().toISOString(),
    };
  }

  /* ── Step runner ─────────────────────────────────────────────────────────── */
  function runStep() {
    const steps = WIZARDS[_type];
    if (!steps || _step >= steps.length) return;
    const s = steps[_step];

    // Update UI
    const numEl   = document.getElementById('calStepNum');
    const totalEl = document.getElementById('calStepTotal');
    const iconEl  = document.getElementById('calStepIcon');
    const titleEl = document.getElementById('calStepTitle');
    const instEl  = document.getElementById('calInstruction');
    const progEl  = document.getElementById('calProgressFill');

    if (numEl)   numEl.textContent   = _step + 1;
    if (totalEl) totalEl.textContent = steps.length;
    if (iconEl)  iconEl.textContent  = s.icon;
    if (titleEl) titleEl.textContent = s.title;
    if (instEl)  instEl.textContent  = s.instruction;
    if (progEl)  progEl.style.width  = ((_step / (steps.length - 1)) * 100) + '%';

    // Action buttons
    const nextBtn = document.getElementById('calNextBtn');
    const saveBtn = document.getElementById('calSaveBtn');
    if (nextBtn) nextBtn.style.display = s.action === 'save' ? 'none' : 'inline-block';
    if (saveBtn) saveBtn.style.display = s.action === 'save' ? 'inline-block' : 'none';

    // Start sensor sampling
    startSampling(s.action);

    // Auto-advance timed steps
    clearTimeout(_timer);
    if (s.duration > 0) {
      showCountdown(s.duration);
      _timer = setTimeout(() => { stopSampling(); advance(); }, s.duration);
    } else {
      clearCountdown();
      // Compute result on calibrate step
      if (s.action === 'calibrate') {
        _result = computeCalibration();
        showSensorReadout();
      }
    }
  }

  function advance() {
    stopSampling();
    _step++;
    if (_step < (WIZARDS[_type] || []).length) runStep();
  }

  let _countdownId = null;
  function showCountdown(ms) {
    const el = document.getElementById('calCountdown');
    if (!el) return;
    let remaining = ms;
    el.style.display = 'block';
    clearInterval(_countdownId);
    _countdownId = setInterval(() => {
      remaining -= 100;
      el.style.width = Math.max(0, (remaining / ms) * 100) + '%';
      if (remaining <= 0) { clearInterval(_countdownId); el.style.display = 'none'; }
    }, 100);
  }

  function clearCountdown() {
    clearInterval(_countdownId);
    const el = document.getElementById('calCountdown');
    if (el) el.style.display = 'none';
  }

  function showSensorReadout() {
    const el = document.getElementById('calSensorReadout');
    if (!el || !_result.zeroPitch) return;
    el.innerHTML = `
      <div style="font-family:var(--font-mono); font-size:0.72rem; color:#888; margin-top:10px; padding:10px; background:#0a0a0a; border:1px solid #1a1a1a;">
        <div>Zero Pitch: <span style="color:#22cc44;">${_result.zeroPitch.toFixed(2)}°</span></div>
        <div>Zero Roll:  <span style="color:#22cc44;">${_result.zeroRoll.toFixed(2)}°</span></div>
        <div>Zero Yaw:   <span style="color:#22cc44;">${_result.zeroYaw.toFixed(2)}°</span></div>
      </div>`;
  }

  /* ── Save to device ──────────────────────────────────────────────────────── */
  function saveCalibration() {
    const devices = HP.getDevices();
    const device  = devices.find(d => d.is_connected) || devices[0];
    if (!device) {
      if (typeof showToast === 'function') showToast('No device found to save calibration to.');
      return;
    }

    const existing = device.calibration || {};
    const updated  = { ...existing, [_type]: { ..._result, type: _type } };
    HP.updateDevice(device.device_id, { calibration: updated });

    // Also apply gyro zero to live state
    if (_type === 'gyro' && typeof state !== 'undefined' && _result.zeroPitch !== undefined) {
      state.inputs.gyro.zeroPitch = _result.zeroPitch;
      state.inputs.gyro.zeroRoll  = _result.zeroRoll;
      state.inputs.gyro.zeroYaw   = _result.zeroYaw;
    }

    if (typeof showToast === 'function') showToast(`✓ ${_type} calibration saved to "${device.device_name}".`);
    if (typeof playSound === 'function') playSound('chime');
    closeWizard();
  }

  /* ── Inject HTML ─────────────────────────────────────────────────────────── */
  function inject() {
    document.body.insertAdjacentHTML('beforeend', `
<section id="calibrationSection" class="app-section">
<div class="section-container">

  <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:24px; flex-wrap:wrap; gap:12px;">
    <div>
      <h2 class="section-title">CALIBRATION WIZARD</h2>
      <p class="section-sub">GYRO · ACCELEROMETER · STEERING · JOYSTICK · TOUCH</p>
    </div>
    <button class="cyber-button sm secondary" onclick="showSection('dashboard')">← BACK</button>
  </div>

  <!-- Type selector (shown when no wizard running) -->
  <div id="calTypeSelector">
    <div style="font-family:var(--font-mono); font-size:0.7rem; color:#666; letter-spacing:2px; margin-bottom:16px;">SELECT CALIBRATION TYPE</div>
    <div style="display:grid; grid-template-columns:repeat(auto-fill,minmax(160px,1fr)); gap:12px;">
      ${Object.keys(WIZARDS).map(t => {
        const icons = { gyro:'🔭', accelerometer:'📐', steering:'🎮', joystick:'🕹️', touch:'👆' };
        const labels = { gyro:'GYROSCOPE', accelerometer:'ACCELEROMETER', steering:'STEERING', joystick:'JOYSTICK', touch:'TOUCH CONTROLS' };
        return `<button class="cyber-button md secondary" onclick="HPCalibration.startWizard('${t}')"
          style="flex-direction:column; gap:8px; padding:20px 12px; height:auto;">
          <span style="font-size:1.8rem;">${icons[t]}</span>
          <span>${labels[t]}</span>
        </button>`;
      }).join('')}
    </div>

    <!-- Per-device calibration status -->
    <div style="margin-top:28px;">
      <div style="font-family:var(--font-mono); font-size:0.7rem; color:#666; letter-spacing:2px; margin-bottom:12px;">DEVICE CALIBRATION STATUS</div>
      <div id="calDeviceStatus"></div>
    </div>
  </div>

  <!-- Wizard panel (hidden until started) -->
  <div id="calWizardPanel" style="display:none; max-width:520px; margin:0 auto;">
    <!-- Progress bar -->
    <div style="background:#1a1a1a; height:4px; border-radius:2px; margin-bottom:24px; overflow:hidden;">
      <div id="calProgressFill" style="height:100%; background:#cc1111; width:0%; transition:width 0.4s;"></div>
    </div>

    <!-- Step indicator -->
    <div style="font-family:var(--font-mono); font-size:0.7rem; color:#555; margin-bottom:16px; text-align:center;">
      STEP <span id="calStepNum">1</span> / <span id="calStepTotal">5</span>
    </div>

    <!-- Step content -->
    <div style="text-align:center; padding:32px 20px; background:var(--bg-panel); border:1px solid var(--dark-border);">
      <div id="calStepIcon" style="font-size:3rem; margin-bottom:16px;">📱</div>
      <div id="calStepTitle" style="font-family:var(--font-display); font-size:1.4rem; letter-spacing:2px; margin-bottom:12px;"></div>
      <p id="calInstruction" style="font-family:var(--font-mono); font-size:0.82rem; color:#aaa; line-height:1.7; max-width:360px; margin:0 auto;"></p>

      <!-- Countdown bar -->
      <div style="margin-top:16px; background:#111; height:4px; border-radius:2px; overflow:hidden;">
        <div id="calCountdown" style="height:100%; background:#e6b800; width:100%; display:none; transition:width 0.1s linear;"></div>
      </div>

      <!-- Sensor readout -->
      <div id="calSensorReadout"></div>
    </div>

    <!-- Controls -->
    <div style="display:flex; gap:10px; margin-top:16px; justify-content:center;">
      <button class="cyber-button sm secondary" onclick="HPCalibration.cancelWizard()">CANCEL</button>
      <button class="cyber-button sm primary" id="calNextBtn" onclick="HPCalibration.next()">NEXT →</button>
      <button class="cyber-button sm primary" id="calSaveBtn" style="display:none;" onclick="HPCalibration.save()">💾 SAVE CALIBRATION</button>
    </div>
  </div>

</div>
</section>`);
  }

  /* ── Device status render ────────────────────────────────────────────────── */
  function renderDeviceStatus() {
    const el = document.getElementById('calDeviceStatus');
    if (!el) return;
    const devices = HP.getDevices();
    if (!devices.length) {
      el.innerHTML = '<p style="font-family:var(--font-mono);font-size:0.75rem;color:#555;">No devices registered.</p>';
      return;
    }
    el.innerHTML = devices.map(d => {
      const cal = d.calibration || {};
      const types = Object.keys(WIZARDS);
      return `<div style="padding:12px; background:var(--bg-panel); border:1px solid var(--dark-border); margin-bottom:8px;">
        <div style="font-family:var(--font-mono); font-size:0.8rem; font-weight:700; margin-bottom:8px;">${esc(d.device_name)}</div>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          ${types.map(t => {
            const done = !!cal[t];
            return `<span style="font-family:var(--font-mono); font-size:0.65rem; padding:3px 8px;
              background:${done?'#0d2b0d':'#1a1a1a'}; color:${done?'#22cc44':'#555'};
              border:1px solid ${done?'#22cc44':'#333'};">${t.toUpperCase()} ${done?'✓':'—'}</span>`;
          }).join('')}
        </div>
      </div>`;
    }).join('');
  }

  function closeWizard() {
    stopSampling(); clearTimeout(_timer); clearCountdown();
    document.getElementById('calWizardPanel').style.display = 'none';
    document.getElementById('calTypeSelector').style.display = 'block';
    renderDeviceStatus();
    _type = null; _step = 0; _samples = {}; _result = {};
    const ro = document.getElementById('calSensorReadout'); if (ro) ro.innerHTML = '';
  }

  /* ── Public API ──────────────────────────────────────────────────────────── */
  return {
    init() { inject(); },

    open() {
      if (typeof showSection === 'function') showSection('calibration');
      renderDeviceStatus();
    },

    startWizard(type) {
      if (!WIZARDS[type]) return;
      _type = type; _step = 0; _samples = {}; _result = {};
      document.getElementById('calTypeSelector').style.display = 'none';
      document.getElementById('calWizardPanel').style.display  = 'block';
      const ro = document.getElementById('calSensorReadout'); if (ro) ro.innerHTML = '';
      runStep();
      if (typeof playSound === 'function') playSound('click');
    },

    next()   { advance(); },
    save()   { saveCalibration(); },
    cancelWizard() { closeWizard(); },

    /* Returns calibration for active device by type */
    getCalibration(type) {
      const d = HP.getDevices().find(dev => dev.is_connected) || HP.getDevices()[0];
      return d && d.calibration ? (d.calibration[type] || null) : null;
    },
  };
})();
