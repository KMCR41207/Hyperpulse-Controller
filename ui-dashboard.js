/* ==========================================================================
   HYPERPULSE // AUTHENTICATED DASHBOARD (ui-dashboard.js)
   Main user dashboard centered around connected devices + profiles + quick actions
   ========================================================================== */

(function () {

  const MODE_ICONS = {
    gamepad: '🎮',
    racing: '🏎',
    gyro: '🔭',
    mouse: '🖱',
    keyboard: '⌨',
    custom: '🛠'
  };

  function esc(s) {
    return String(s || '').replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function escAttr(s) {
    return String(s || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* ── Inject Dashboard HTML ──────────────────────────────── */
  function inject() {
    document.body.insertAdjacentHTML('beforeend', `

<section id="dashboardSection" class="app-section">
  <!-- Dashboard Container -->
  <div class="dashboard-layout">

    <!-- TOP STATUS BAR -->
    <div class="dashboard-top-bar">
      <div class="top-bar-left">
        <span class="dashboard-title">📊 CONTROL DASHBOARD</span>
      </div>
      <div class="top-bar-right">
        <span id="dashConnStatus" class="status-indicator disconnected">● DISCONNECTED</span>
        <span id="dashDeviceName" class="device-badge">No Device</span>
      </div>
    </div>

    <!-- MAIN CONTENT GRID -->
    <div class="dashboard-main">

      <!-- CONNECTED DEVICE CARD (LEFT SIDE - LARGE) -->
      <div class="dashboard-device-card">
        <div class="device-card-header">
          <span class="device-title">📱 CONNECTED DEVICE</span>
          <button class="device-action-btn" onclick="HPDashboard.refreshDeviceStatus()" title="Refresh">🔄</button>
        </div>

        <div id="deviceStatusContent">
          <!-- Renders dynamically -->
        </div>
      </div>

      <!-- CONTROLLER MODES (RIGHT SIDE) -->
      <div class="dashboard-modes-section">
        <div class="modes-header">
          <span class="modes-title">⚡ CONTROLLER MODES</span>
        </div>

        <div class="modes-grid" id="modesGrid">
          <!-- Renders dynamically -->
        </div>

        <!-- QUICK ACTIONS -->
        <div class="quick-actions-section">
          <div class="qa-header">QUICK ACTIONS</div>
          <div class="qa-buttons">
            <button class="cyber-button sm primary" onclick="HPDashboard.connectDevice()">
              🔌 CONNECT
            </button>
            <button class="cyber-button sm secondary" onclick="HPProfiles && HPProfiles.open()">
              ⬡ PROFILE
            </button>
            <button class="cyber-button sm secondary" onclick="HPDashboard.testController()">
              ✓ TEST
            </button>
            <button class="cyber-button sm secondary" onclick="HPSettings && HPSettingsUI.open()">
              ⚙ SETTINGS
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- RECENT ACTIVITY SECTION (FULL WIDTH BOTTOM) -->
    <div class="dashboard-activity-section">
      <div class="activity-header">📋 RECENT ACTIVITY</div>
      <div class="activity-grid" id="activityGrid">
        <!-- Renders dynamically -->
      </div>
    </div>

  </div>
</section>

    `);
  }

  /* ── Render device status card ────────────────────────── */
  function renderDeviceCard() {
    const content = document.getElementById('deviceStatusContent');
    if (!content) return;

    const devices = HP.getDevices();
    const user = HP.getUser();

    if (!user) {
      content.innerHTML = `
        <div class="device-empty-state">
          <div style="font-size:2.4rem; margin-bottom:12px;">🔐</div>
          <div class="empty-title">NOT SIGNED IN</div>
          <p style="font-size:0.8rem; color:var(--text-muted-dark); margin:12px 0;">Sign in to connect devices and save your profiles.</p>
          <button class="cyber-button sm primary" onclick="HPAuth && HPAuth.open()">SIGN IN</button>
        </div>
      `;
      return;
    }

    if (devices.length === 0) {
      content.innerHTML = `
        <div class="device-empty-state">
          <div style="font-size:2.4rem; margin-bottom:12px;">📱</div>
          <div class="empty-title">NO DEVICE CONNECTED</div>
          <p style="font-size:0.8rem; color:var(--text-muted-dark); margin:12px 0;">Pair a smartphone to get started.</p>
          <button class="cyber-button sm primary" onclick="HPDashboard.connectDevice()">PAIR DEVICE</button>
        </div>
      `;
      return;
    }

    // Show the first connected or most recent device
    const device = devices.find(d => d.is_connected) || devices[0];
    if (!device) return;

    const statusColor = device.is_connected ? '#39ff14' : '#ff6b6b';
    const statusText = device.is_connected ? 'CONNECTED' : 'DISCONNECTED';
    const signalIcon = {
      'Excellent': '📶',
      'Good': '📶',
      'Fair': '📡',
      'Poor': '⚠️'
    }[device.signal_strength] || '❓';

    const lastConnected = device.last_connected_at
      ? new Date(device.last_connected_at).toLocaleDateString()
      : 'Never';

    content.innerHTML = `
      <div class="device-status-grid">
        <div class="device-stat">
          <span class="stat-label">STATUS</span>
          <span class="stat-value" style="color:${statusColor};">● ${statusText}</span>
        </div>
        <div class="device-stat">
          <span class="stat-label">DEVICE NAME</span>
          <span class="stat-value">${esc(device.device_name)}</span>
        </div>
        <div class="device-stat">
          <span class="stat-label">OS</span>
          <span class="stat-value">${esc(device.os_type)} ${esc(device.os_version)}</span>
        </div>
        <div class="device-stat">
          <span class="stat-label">CONNECTION</span>
          <span class="stat-value">${esc(device.connection_type)}</span>
        </div>
        <div class="device-stat">
          <span class="stat-label">LATENCY</span>
          <span class="stat-value">${device.latency_ms} ms</span>
        </div>
        <div class="device-stat">
          <span class="stat-label">SIGNAL</span>
          <span class="stat-value">${signalIcon} ${esc(device.signal_strength)}</span>
        </div>
        <div class="device-stat">
          <span class="stat-label">BATTERY</span>
          <span class="stat-value">${device.battery_level}%</span>
        </div>
        <div class="device-stat">
          <span class="stat-label">LAST SEEN</span>
          <span class="stat-value">${lastConnected}</span>
        </div>
      </div>

      <div class="device-actions">
        <button class="cyber-button sm secondary" onclick="HPDashboard.disconnectDevice('${escAttr(device.device_id)}')">
          ⏹ DISCONNECT
        </button>
        <button class="cyber-button sm primary" onclick="showSection('modes')">
          ▶ USE DEVICE
        </button>
      </div>
    `;

    // Update header status indicator
    const statusEl = document.getElementById('dashConnStatus');
    const nameEl = document.getElementById('dashDeviceName');
    if (statusEl) {
      statusEl.textContent = `● ${statusText}`;
      statusEl.classList.toggle('connected', device.is_connected);
      statusEl.classList.toggle('disconnected', !device.is_connected);
    }
    if (nameEl) nameEl.textContent = esc(device.device_name);
  }

  /* ── Render controller modes grid ───────────────────── */
  function renderModesGrid() {
    const grid = document.getElementById('modesGrid');
    if (!grid) return;

    const modes = [
      { key: 'gamepad',  icon: MODE_ICONS.gamepad,  label: 'GAMEPAD', desc: 'Dual sticks, buttons, triggers' },
      { key: 'racing',   icon: MODE_ICONS.racing,   label: 'RACING',  desc: '900° steering wheel' },
      { key: 'gyro',     icon: MODE_ICONS.gyro,     label: 'GYRO',    desc: '3-axis motion aim' },
      { key: 'mouse',    icon: MODE_ICONS.mouse,    label: 'MOUSE',   desc: 'Trackpad + clicks' },
      { key: 'keyboard', icon: MODE_ICONS.keyboard, label: 'KEYBOARD', desc: 'Full key mapping' }
    ];

    grid.innerHTML = modes.map(m => `
      <button class="dashboard-mode-card" onclick="HPDashboard.launchMode('${m.key}')">
        <div class="mode-icon">${m.icon}</div>
        <div class="mode-label">${m.label}</div>
        <div class="mode-desc">${m.desc}</div>
      </button>
    `).join('');
  }

  /* ── Render recent activity ───────────────────────── */
  function renderActivity() {
    const grid = document.getElementById('activityGrid');
    if (!grid) return;

    const user = HP.getUser();
    if (!user) {
      grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted-dark); font-family: var(--font-mono); font-size: 0.8rem;">Sign in to view activity</div>';
      return;
    }

    const profiles = HP.getControllerProfiles();
    const devices = HP.getDevices();
    const games = HP.getGameProfiles();

    let activity = [];

    if (profiles.length > 0) {
      const recent = profiles[profiles.length - 1];
      activity.push({
        type: 'profile',
        icon: MODE_ICONS[recent.controller_type] || '🎮',
        title: 'Profile: ' + esc(recent.profile_name),
        subtitle: recent.controller_type.toUpperCase(),
        date: new Date(recent.updated_at).toLocaleDateString()
      });
    }

    if (devices.length > 0) {
      const recent = devices.find(d => d.is_connected) || devices[0];
      activity.push({
        type: 'device',
        icon: '📱',
        title: esc(recent.device_name),
        subtitle: recent.os_type,
        date: new Date(recent.last_connected_at).toLocaleDateString()
      });
    }

    if (games.length > 0) {
      const recent = games[games.length - 1];
      activity.push({
        type: 'game',
        icon: '🎮',
        title: 'Game: ' + esc(recent.game_name),
        subtitle: recent.recommended_controller_type.toUpperCase(),
        date: new Date(recent.updated_at).toLocaleDateString()
      });
    }

    if (activity.length === 0) {
      grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted-dark); font-family: var(--font-mono); font-size: 0.8rem;">No recent activity</div>';
      return;
    }

    grid.innerHTML = activity.map(a => `
      <div class="activity-card">
        <div class="activity-icon">${a.icon}</div>
        <div class="activity-info">
          <div class="activity-title">${a.title}</div>
          <div class="activity-subtitle">${a.subtitle}</div>
          <div class="activity-date">${a.date}</div>
        </div>
      </div>
    `).join('');
  }

  /* ── Public API ──────────────────────────────────────── */
  window.HPDashboard = {

    init() {
      inject();
      this.render();
    },

    open() {
      if (typeof showSection === 'function') showSection('dashboard');
      this.render();
    },

    render() {
      renderDeviceCard();
      renderModesGrid();
      renderActivity();
    },

    refreshDeviceStatus() {
      playSound('click');
      renderDeviceCard();
      if (typeof showToast === 'function') showToast('Device status refreshed');
    },

    connectDevice() {
      if (!HP.isLoggedIn()) {
        if (typeof showToast === 'function') showToast('Sign in first');
        if (window.HPAuth) HPAuth.open();
        return;
      }
      const device = HP.registerDevice('New Device', 'USB');
      if (typeof showToast === 'function') showToast('✓ Device registered: ' + device.device_name);
      renderDeviceCard();
    },

    disconnectDevice(deviceId) {
      HP.disconnectDevice(deviceId);
      if (typeof showToast === 'function') showToast('Device disconnected');
      renderDeviceCard();
    },

    launchMode(modeKey) {
      playSound('click');
      if (typeof openModeDirect === 'function') openModeDirect(modeKey);
    },

    testController() {
      playSound('chime');
      const devices = HP.getDevices();
      if (devices.filter(d => d.is_connected).length === 0) {
        if (typeof showToast === 'function') showToast('No device connected');
        return;
      }
      if (typeof openModeDirect === 'function') openModeDirect('gamepad');
      if (typeof showToast === 'function') showToast('Test mode launched');
    }
  };

})();
