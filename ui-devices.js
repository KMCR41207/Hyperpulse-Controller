/* ==========================================================================
   HYPERPULSE // DEVICE MANAGEMENT UI (ui-devices.js)
   Device registration, connection state, telemetry tracking, pairing UI.
   NOTE: No real transport connection is established — UI/state prototype only.
   ========================================================================== */

(function () {

  /* ── Connection state transitions (visual only, no real transport) ──────── */
  const CONN_STATES = { CONNECTED:'connected', DISCONNECTED:'disconnected', CONNECTING:'connecting', RECONNECTING:'reconnecting', FAILED:'failed' };
  // Per-device UI state (not persisted — resets on reload)
  const _uiState = {};

  function getUiState(deviceId) {
    if (!_uiState[deviceId]) {
      const dev = window.HP.getDevices().find(d => d.device_id === deviceId);
      _uiState[deviceId] = { connState: dev && dev.is_connected ? CONN_STATES.CONNECTED : CONN_STATES.DISCONNECTED };
    }
    return _uiState[deviceId];
  }

  function esc(s) {
    return String(s || '').replace(/[&<>"']/g, c =>
      ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }

  function formatTime(isoStr) {
    if (!isoStr) return 'Never';
    const d = new Date(isoStr);
    const diff = Date.now() - d;
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return mins + 'm ago';
    if (hours < 24) return hours + 'h ago';
    return d.toLocaleDateString();
  }

  function batteryColor(level) {
    if (level > 60) return '#22cc44';
    if (level > 25) return '#ff9900';
    return '#cc1111';
  }

  function signalPct(signal) {
    const map = { 'Excellent': 100, 'Good': 75, 'Fair': 50, 'Poor': 25 };
    return map[signal] || 0;
  }

  function renderBatteryBar(level) {
    const pct = Math.max(0, Math.min(100, level));
    const color = batteryColor(pct);
    return `
      <div style="display:flex; align-items:center; gap:6px;">
        <div style="flex:1; height:8px; background:#222; border:1px solid #444; border-radius:2px; overflow:hidden;">
          <div style="height:100%; width:${pct}%; background:${color}; transition:width 0.3s;"></div>
        </div>
        <span style="font-size:0.75rem; color:${color}; font-family:var(--font-mono); min-width:32px;">${pct}%</span>
      </div>`;
  }

  function renderSignalBar(signal) {
    const pct = signalPct(signal);
    const color = pct >= 75 ? '#22cc44' : pct >= 50 ? '#ff9900' : '#cc1111';
    return `
      <div style="display:flex; align-items:center; gap:6px;">
        <div style="flex:1; height:8px; background:#222; border:1px solid #444; border-radius:2px; overflow:hidden;">
          <div style="height:100%; width:${pct}%; background:${color}; transition:width 0.3s;"></div>
        </div>
        <span style="font-size:0.7rem; color:${color}; font-family:var(--font-mono); min-width:50px;">${signal}</span>
      </div>`;
  }

  function connStateBadge(state) {
    const cfg = {
      connected:    { color:'#22cc44', dot:'🟢', label:'CONNECTED' },
      disconnected: { color:'#888',    dot:'⚫', label:'DISCONNECTED' },
      connecting:   { color:'#ff9900', dot:'🟡', label:'CONNECTING…' },
      reconnecting: { color:'#ff5500', dot:'🟠', label:'RECONNECTING…' },
      failed:       { color:'#cc1111', dot:'🔴', label:'FAILED' }
    };
    const c = cfg[state] || cfg.disconnected;
    const pulse = (state === 'connecting' || state === 'reconnecting') ? ' class="pulse-dot"' : '';
    return `<span${pulse} style="color:${c.color}; font-family:var(--font-mono); font-size:0.75rem; font-weight:700;">${c.dot} ${c.label}</span>`;
  }

  function inject() {
    document.body.insertAdjacentHTML('beforeend', `
<section id="deviceManagementSection" class="app-section">
  <div class="section-container">

    <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:30px; flex-wrap:wrap; gap:16px;">
      <div>
        <h2 class="section-title">DEVICE MANAGEMENT</h2>
        <p class="section-sub">REGISTERED HARDWARE · CONNECTION STATUS · TELEMETRY</p>
      </div>
      <button class="cyber-button sm primary" onclick="HPDevices.openPairingFlow()">+ PAIR NEW DEVICE</button>
    </div>

    <div id="deviceListContainer"></div>

    <!-- Pairing Flow Modal -->
    <div class="hp-modal" id="pairingFlowModal" style="display:none;">
      <div class="hp-modal-content" style="max-width:480px;">
        <button class="hp-modal-close" onclick="HPDevices.closePairingFlow()" aria-label="Close">✕</button>
        <div class="hp-modal-header">
          <h3 style="font-family:var(--font-display); letter-spacing:2px;">PAIR NEW DEVICE</h3>
          <p style="color:var(--text-muted-dark); font-size:0.85rem;">Follow these steps to register a new device</p>
        </div>

        <!-- Step indicator -->
        <div id="pairingStepBar" style="display:flex; gap:6px; margin:12px 0 20px;">
          ${[1,2,3,4].map(i => `<div id="pairStepDot-${i}" style="flex:1; height:3px; background:#333; border-radius:2px; transition:background 0.3s;"></div>`).join('')}
        </div>

        <!-- Step 1: Connection Type -->
        <div id="pairingStep1" class="pairing-step">
          <h4 style="margin-bottom:16px; font-family:var(--font-mono); font-size:0.85rem; color:var(--text-muted-dark);">STEP 1 — SELECT CONNECTION TYPE</h4>
          <div class="pairing-options">
            <button class="pairing-option" onclick="HPDevices.selectConnectionType('USB')" aria-label="USB Wired">
              <div class="option-icon">⚡</div>
              <div class="option-title">USB WIRED</div>
              <div class="option-desc">&lt;0.5ms · Direct cable</div>
            </button>
            <button class="pairing-option" onclick="HPDevices.selectConnectionType('Bluetooth')" aria-label="Bluetooth">
              <div class="option-icon">🔵</div>
              <div class="option-title">BLUETOOTH</div>
              <div class="option-desc">20–50ms · Wireless</div>
            </button>
            <button class="pairing-option" onclick="HPDevices.selectConnectionType('WiFi')" aria-label="Wi-Fi">
              <div class="option-icon">📶</div>
              <div class="option-title">WI-FI P2P</div>
              <div class="option-desc">1–8ms · QR sync</div>
            </button>
          </div>
        </div>

        <!-- Step 2: Device Info -->
        <div id="pairingStep2" class="pairing-step" style="display:none;">
          <h4 style="margin-bottom:16px; font-family:var(--font-mono); font-size:0.85rem; color:var(--text-muted-dark);">STEP 2 — DEVICE INFORMATION</h4>
          <div class="hp-field">
            <label class="hp-label">DEVICE NAME</label>
            <input class="hp-input" id="pairingDeviceName" placeholder="e.g. Mani's Phone" autocomplete="off">
          </div>
          <div class="hp-field">
            <label class="hp-label">DETECTED OS</label>
            <div class="hp-info-box" id="pairingOsDetected" style="padding:8px; background:#111; border:1px solid var(--dark-border); font-family:var(--font-mono); font-size:0.8rem;">Detecting…</div>
          </div>
          <button class="cyber-button md primary" onclick="HPDevices.nextPairingStep()" style="margin-top:16px; width:100%;">NEXT →</button>
        </div>

        <!-- Step 3: QR / Code -->
        <div id="pairingStep3" class="pairing-step" style="display:none;">
          <h4 style="margin-bottom:16px; font-family:var(--font-mono); font-size:0.85rem; color:var(--text-muted-dark);">STEP 3 — ESTABLISH CONNECTION</h4>
          <p style="font-size:0.8rem; color:var(--text-muted-dark); margin-bottom:12px;">Scan this QR code with the mobile device, or enter the pairing code manually.</p>
          <div style="text-align:center; margin:16px 0;">
            <div id="pairingQrCode" style="display:inline-block; padding:12px; background:#fff; border-radius:4px;"></div>
          </div>
          <div style="text-align:center; margin:12px 0;">
            <span style="font-family:var(--font-mono); font-size:0.75rem; color:var(--text-muted-dark);">PAIRING CODE</span><br>
            <input class="hp-input" id="pairingManualCode" readonly style="text-align:center; font-size:1.1rem; letter-spacing:3px; max-width:300px; margin:6px auto 0; display:block;">
          </div>
          <p style="font-size:0.75rem; color:var(--text-muted-dark); margin-top:12px; padding:8px; background:#0a0a0a; border:1px solid #333;">
            ⚠ Note: This is a UI prototype. Real device connection requires the transport layer backend.
          </p>
          <button class="cyber-button md primary" onclick="HPDevices.finishPairing()" style="margin-top:16px; width:100%;">CONFIRM PAIRING ✓</button>
        </div>

        <!-- Step 4: Success -->
        <div id="pairingStep4" class="pairing-step" style="display:none;">
          <div style="text-align:center; padding:20px 0;">
            <div style="font-size:3rem; margin-bottom:12px;">✅</div>
            <h4 style="font-family:var(--font-display); font-size:1.4rem; letter-spacing:2px; color:#22cc44; margin-bottom:8px;">DEVICE REGISTERED</h4>
            <p id="pairingSuccessMsg" style="color:var(--text-muted-dark); font-size:0.85rem;">Device paired successfully!</p>
          </div>
          <button class="cyber-button md primary" onclick="HPDevices.closePairingFlow()" style="margin-top:16px; width:100%;">DONE</button>
        </div>
      </div>
    </div>

  </div>
</section>
    `);
  }

  function renderDeviceList() {
    const container = document.getElementById('deviceListContainer');
    if (!container) return;

    const devices = window.HP.getDevices();
    if (devices.length === 0) {
      container.innerHTML = `
        <div class="hp-empty-state" style="text-align:center; padding:60px 20px;">
          <div style="font-size:3rem; margin-bottom:12px;">📱</div>
          <div style="font-family:var(--font-display); font-size:1.2rem; letter-spacing:2px; margin-bottom:8px;">NO DEVICES REGISTERED</div>
          <div style="color:var(--text-muted-dark); font-size:0.85rem; margin-bottom:20px;">Pair your first mobile device to get started.</div>
          <button class="cyber-button sm primary" onclick="HPDevices.openPairingFlow()">+ PAIR DEVICE</button>
        </div>`;
      return;
    }

    container.innerHTML = `<div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(340px,1fr)); gap:20px;">
      ${devices.map(dev => renderDeviceCard(dev)).join('')}
    </div>`;
  }

  function renderDeviceCard(dev) {
    const ui = getUiState(dev.device_id);
    const id = esc(dev.device_id);
    return `
      <div class="device-card" id="devcard-${id}" style="background:var(--bg-panel); border:1px solid var(--dark-border); padding:20px; position:relative;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:14px;">
          <div>
            <div style="font-family:var(--font-display); font-size:1.1rem; letter-spacing:1px;">${esc(dev.device_name || 'Unknown')}</div>
            <div style="font-size:0.7rem; color:var(--text-muted-dark); font-family:var(--font-mono); margin-top:2px;">${esc(dev.os_type || 'Unknown')} ${esc(dev.os_version || '')}</div>
          </div>
          <div style="display:flex; gap:6px;">
            <button class="cyber-button sm secondary" title="Edit device" onclick="HPDevices.editDevice('${id}')" aria-label="Edit">✎</button>
            <button class="cyber-button sm danger" title="Remove device" onclick="HPDevices.forgetDevice('${id}')" aria-label="Remove">✕</button>
          </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:14px;">
          <div>
            <div style="font-family:var(--font-mono); font-size:0.65rem; color:var(--text-muted-dark); margin-bottom:4px;">CONNECTION</div>
            <div style="font-family:var(--font-mono); font-size:0.8rem;">${esc(dev.connection_type || 'Unknown')}</div>
          </div>
          <div>
            <div style="font-family:var(--font-mono); font-size:0.65rem; color:var(--text-muted-dark); margin-bottom:4px;">LATENCY</div>
            <div style="font-family:var(--font-mono); font-size:0.8rem;">${(dev.latency_ms || 0).toFixed(1)} ms</div>
          </div>
          <div>
            <div style="font-family:var(--font-mono); font-size:0.65rem; color:var(--text-muted-dark); margin-bottom:4px;">BATTERY</div>
            ${renderBatteryBar(dev.battery_level != null ? dev.battery_level : 100)}
          </div>
          <div>
            <div style="font-family:var(--font-mono); font-size:0.65rem; color:var(--text-muted-dark); margin-bottom:4px;">SIGNAL</div>
            ${renderSignalBar(dev.signal_strength || 'Excellent')}
          </div>
          <div>
            <div style="font-family:var(--font-mono); font-size:0.65rem; color:var(--text-muted-dark); margin-bottom:4px;">LAST SEEN</div>
            <div style="font-family:var(--font-mono); font-size:0.75rem;">${formatTime(dev.last_connected_at)}</div>
          </div>
          <div>
            <div style="font-family:var(--font-mono); font-size:0.65rem; color:var(--text-muted-dark); margin-bottom:4px;">PAIRED</div>
            <div style="font-family:var(--font-mono); font-size:0.75rem;">${formatTime(dev.paired_at)}</div>
          </div>
        </div>

        <div style="display:flex; align-items:center; gap:8px; padding:8px 0; border-top:1px solid var(--dark-border); border-bottom:1px solid var(--dark-border); margin-bottom:14px;">
          ${connStateBadge(ui.connState)}
        </div>

        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          ${ui.connState === CONN_STATES.CONNECTED
            ? `<button class="cyber-button sm secondary" onclick="HPDevices.disconnectDevice('${id}')">DISCONNECT</button>`
            : `<button class="cyber-button sm primary" onclick="HPDevices.reconnectDevice('${id}')">RECONNECT</button>`}
          <button class="cyber-button sm secondary" onclick="HPDevices.testDevice('${id}')">🧪 TEST</button>
        </div>
      </div>`;
  }

  let _pairingState = { step: 1, connectionType: null, deviceName: '' };

  function openPairingFlow() {
    if (typeof playSound === 'function') playSound('click');
    _pairingState = { step: 1, connectionType: null, deviceName: '' };
    document.getElementById('pairingFlowModal').style.display = 'flex';
    showPairingStep(1);
    detectDeviceOS();
    document.getElementById('pairingDeviceName').value = '';
    document.getElementById('pairingQrCode').innerHTML = '';
  }

  function closePairingFlow() {
    if (typeof playSound === 'function') playSound('click');
    document.getElementById('pairingFlowModal').style.display = 'none';
  }

  function selectConnectionType(type) {
    if (typeof playSound === 'function') playSound('click');
    _pairingState.connectionType = type;
    // Highlight selected option
    document.querySelectorAll('#pairingStep1 .pairing-option').forEach(btn => btn.classList.remove('active'));
    event && event.currentTarget && event.currentTarget.classList.add('active');
    showPairingStep(2);
  }

  function detectDeviceOS() {
    const ua = navigator.userAgent;
    let os = 'Web';
    if (/Android/i.test(ua)) os = 'Android';
    else if (/iPhone|iPad/i.test(ua)) os = 'iOS';
    const el = document.getElementById('pairingOsDetected');
    if (el) el.innerText = os;
  }

  function nextPairingStep() {
    const name = document.getElementById('pairingDeviceName').value.trim();
    if (!name) {
      if (typeof showToast === 'function') showToast('Please enter a device name.');
      return;
    }
    _pairingState.deviceName = name;
    showPairingStep(3);
    generatePairingQR();
  }

  function generatePairingQR() {
    const qrContainer = document.getElementById('pairingQrCode');
    const codeInput = document.getElementById('pairingManualCode');
    if (!qrContainer) return;
    qrContainer.innerHTML = '';

    const code = 'HP-' + Math.random().toString(36).slice(2, 6).toUpperCase() + '-' +
                          Math.random().toString(36).slice(2, 6).toUpperCase();
    const pairingUrl = window.location.origin + window.location.pathname + '?pair=' + code;

    if (typeof QRCode !== 'undefined') {
      new QRCode(qrContainer, { text: pairingUrl, width: 140, height: 140 });
    } else {
      qrContainer.style.cssText = 'width:140px;height:140px;background:#f0f0f0;display:flex;align-items:center;justify-content:center;font-size:0.75rem;color:#333;';
      qrContainer.innerText = 'QR Unavailable';
    }
    if (codeInput) codeInput.value = code;
  }

  function finishPairing() {
    if (typeof playSound === 'function') playSound('chime');
    if (typeof triggerHaptic === 'function') triggerHaptic(60);

    const device = window.HP.registerDevice(_pairingState.deviceName, _pairingState.connectionType);
    _uiState[device.device_id] = { connState: CONN_STATES.CONNECTED };

    showPairingStep(4);
    const msg = document.getElementById('pairingSuccessMsg');
    if (msg) msg.innerText = '"' + _pairingState.deviceName + '" has been registered and is ready.';

    setTimeout(renderDeviceList, 200);
  }

  function showPairingStep(step) {
    for (let i = 1; i <= 4; i++) {
      const el = document.getElementById('pairingStep' + i);
      if (el) el.style.display = i === step ? 'block' : 'none';
      const dot = document.getElementById('pairStepDot-' + i);
      if (dot) dot.style.background = i <= step ? '#cc1111' : '#333';
    }
    _pairingState.step = step;
  }

  function editDevice(deviceId) {
    if (typeof playSound === 'function') playSound('click');

    // Toggle existing edit form
    const existing = document.getElementById('devEditForm-' + deviceId);
    if (existing) { existing.remove(); return; }

    const device = window.HP.getDevices().find(d => d.device_id === deviceId);
    if (!device) return;
    const card = document.getElementById('devcard-' + deviceId);
    if (!card) return;

    const form = document.createElement('div');
    form.id = 'devEditForm-' + deviceId;
    form.style.cssText = 'margin-top:12px; padding-top:12px; border-top:1px solid var(--dark-border);';
    form.innerHTML = `
      <div class="hp-field">
        <label class="hp-label">DEVICE NAME</label>
        <input class="hp-input" id="devEditName-${esc(deviceId)}" value="${esc(device.device_name)}">
      </div>
      <div class="hp-field">
        <label class="hp-label">CONNECTION TYPE</label>
        <select class="hp-input" id="devEditConn-${esc(deviceId)}">
          <option value="USB" ${device.connection_type === 'USB' ? 'selected' : ''}>USB</option>
          <option value="Bluetooth" ${device.connection_type === 'Bluetooth' ? 'selected' : ''}>Bluetooth</option>
          <option value="WiFi" ${device.connection_type === 'WiFi' ? 'selected' : ''}>Wi-Fi</option>
        </select>
      </div>
      <div style="display:flex; gap:8px; margin-top:10px;">
        <button class="cyber-button sm primary" onclick="HPDevices.saveDeviceEdit('${esc(deviceId)}')">SAVE</button>
        <button class="cyber-button sm secondary" onclick="document.getElementById('devEditForm-${esc(deviceId)}').remove()">CANCEL</button>
      </div>`;
    card.appendChild(form);
  }

  function forgetDevice(deviceId) {
    if (!confirm('Remove this device from your registered list? This cannot be undone.')) return;
    if (typeof playSound === 'function') playSound('click');
    window.HP.deleteDevice(deviceId);
    delete _uiState[deviceId];
    if (typeof showToast === 'function') showToast('Device removed.');
    renderDeviceList();
  }

  function reconnectDevice(deviceId) {
    if (typeof playSound === 'function') playSound('click');
    const ui = getUiState(deviceId);
    ui.connState = CONN_STATES.CONNECTING;
    renderDeviceList();

    // Simulate connection attempt (visual only — real transport not implemented)
    setTimeout(() => {
      window.HP.connectDevice(deviceId);
      ui.connState = CONN_STATES.CONNECTED;
      renderDeviceList();
      if (typeof showToast === 'function') showToast('Device reconnected (prototype — no real transport).');
    }, 1500);
  }

  function disconnectDevice(deviceId) {
    if (typeof playSound === 'function') playSound('click');
    window.HP.disconnectDevice(deviceId);
    const ui = getUiState(deviceId);
    ui.connState = CONN_STATES.DISCONNECTED;
    renderDeviceList();
    if (typeof showToast === 'function') showToast('Device disconnected.');
  }

  function testDevice(deviceId) {
    if (typeof playSound === 'function') playSound('click');
    if (typeof showToast === 'function') showToast('Launching Testing Lab…');
    if (window.HPTestingLab) {
      window.HPTestingLab.open(deviceId);
    } else if (typeof showSection === 'function') {
      showSection('testingLab');
    }
  }

  /* ── Public API ─────────────────────────────────────── */
  window.HPDevices = {
    init() { inject(); renderDeviceList(); },
    open() {
      if (typeof showSection === 'function') showSection('deviceManagement');
      renderDeviceList();
    },
    render: renderDeviceList,
    openPairingFlow,
    closePairingFlow,
    selectConnectionType,
    nextPairingStep,
    finishPairing,
    editDevice,
    saveDeviceEdit(deviceId) {
      const nameEl = document.getElementById('devEditName-' + deviceId);
      const connEl = document.getElementById('devEditConn-' + deviceId);
      if (!nameEl) return;
      const name = nameEl.value.trim();
      if (!name) { if (typeof showToast === 'function') showToast('Device name is required.'); return; }
      window.HP.updateDevice(deviceId, {
        device_name: name,
        connection_type: connEl ? connEl.value : undefined
      });
      const form = document.getElementById('devEditForm-' + deviceId);
      if (form) form.remove();
      if (typeof showToast === 'function') showToast('✓ Device updated.');
      renderDeviceList();
    },
    forgetDevice,
    reconnectDevice,
    disconnectDevice,
    testDevice
  };

})();
