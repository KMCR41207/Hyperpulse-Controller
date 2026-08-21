/* ==========================================================================
   HYPERPULSE // SETTINGS UI  (ui-settings.js)
   Settings entity — 1:1 with User.
   Persists for authenticated user; anonymous users get session-only prefs.
   ========================================================================== */

(function () {

  /* ── CSS variable maps for each theme ──────────────────────────────────── */
  // The original design is industrial dark (black app sections, cream editorial header).
  // "dark"  = restore original design variables — DO NOT touch bg-paper (cream header)
  // "light" = invert app section backgrounds to light tones
  // "amoled" = true black backgrounds for OLED screens
  const THEMES = {
    dark: {
      '--bg-dark':            '#0d0d0d',
      '--bg-charcoal':        '#161616',
      '--bg-panel':           '#1f1f1f',
      '--dark-border':        '#2a2a2a',
      '--text-main-dark':     '#f0ede6',
      '--text-muted-dark':    '#8c8983',
      // Restore editorial paper colours (header, landing)
      '--bg-paper':           '#f2ede4',
      '--bg-paper-dark':      '#e6e0d4',
      '--ink-black':          '#0a0a0a',
      '--text-main-light':    '#0a0a0a',
      '--text-muted-light':   '#66635c',
      '--silver-border':      '#d2ccbf',
    },
    light: {
      '--bg-dark':            '#e8e2d9',
      '--bg-charcoal':        '#d4cec6',
      '--bg-panel':           '#c8c2ba',
      '--dark-border':        '#b0aaa2',
      '--text-main-dark':     '#0a0a0a',
      '--text-muted-dark':    '#555248',
      '--bg-paper':           '#f2ede4',
      '--bg-paper-dark':      '#e6e0d4',
      '--ink-black':          '#0a0a0a',
      '--text-main-light':    '#0a0a0a',
      '--text-muted-light':   '#555248',
      '--silver-border':      '#b0aaa2',
    },
    amoled: {
      '--bg-dark':            '#000000',
      '--bg-charcoal':        '#000000',
      '--bg-panel':           '#0a0a0a',
      '--dark-border':        '#1a1a1a',
      '--text-main-dark':     '#ffffff',
      '--text-muted-dark':    '#888888',
      '--bg-paper':           '#f2ede4',
      '--bg-paper-dark':      '#e6e0d4',
      '--ink-black':          '#0a0a0a',
      '--text-main-light':    '#ffffff',
      '--text-muted-light':   '#888888',
      '--silver-border':      '#1a1a1a',
    }
  };

  /* ── Apply theme to document root ──────────────────────────────────────── */
  function applyTheme(theme) {
    const vars = THEMES[theme] || THEMES.dark;
    const root = document.documentElement;
    Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
  }

  /* ── Apply accent colour ────────────────────────────────────────────────── */
  function applyAccent(hex) {
    document.documentElement.style.setProperty('--accent-red', hex);
    document.documentElement.style.setProperty('--accent-orange', hex);
  }

  /* ── Apply settings on page load ───────────────────────────────────────── */
  function applyPersistedSettings() {
    const s = HP.getSettings();
    // Only apply theme vars; accent is safe to always apply
    applyTheme(s.theme || 'dark');
    applyAccent(s.accent_color || '#cc1111');
  }

  /* ── Inject panel HTML ──────────────────────────────────────────────────── */
  function inject() {
    document.body.insertAdjacentHTML('beforeend', `
<div class="hp-side-panel" id="settingsPanel" style="width:500px;" role="complementary" aria-label="Settings">
  <div class="hp-panel-header">
    <span class="hp-panel-title">⚙ SETTINGS</span>
    <button class="close-btn" onclick="HPSettingsUI.close()" style="color:#fff;" aria-label="Close settings">✕</button>
  </div>

  <div class="hp-panel-tabs">
    <button class="hp-panel-tab active" id="setTabInput"   onclick="HPSettingsUI.switchTab('input')">INPUT</button>
    <button class="hp-panel-tab"        id="setTabDisplay" onclick="HPSettingsUI.switchTab('display')">DISPLAY</button>
    <button class="hp-panel-tab"        id="setTabConnect" onclick="HPSettingsUI.switchTab('connect')">TRANSPORT</button>
  </div>

  <!-- ── INPUT SETTINGS ──────────────────────────────────── -->
  <div class="hp-panel-body" id="setBodyInput">

    <div class="hp-settings-group">
      <div class="hp-settings-label">BUTTON SENSITIVITY</div>
      <div style="font-family:var(--font-mono); font-size:0.65rem; color:var(--text-muted-dark); margin-bottom:8px;">
        How quickly buttons register a press (1 = soft, 10 = instant)
      </div>
      <div class="hp-slider-row">
        <input type="range" class="hp-slider" id="setBtnSens" min="1" max="10" step="1"
          aria-label="Button sensitivity"
          oninput="HPSettingsUI._liveUpdate('setBtnSensVal', this.value)">
        <span class="hp-slider-val" id="setBtnSensVal">5</span>
      </div>
    </div>

    <div class="hp-settings-group">
      <div class="hp-settings-label">JOYSTICK SENSITIVITY</div>
      <div style="font-family:var(--font-mono); font-size:0.65rem; color:var(--text-muted-dark); margin-bottom:8px;">
        Analog stick response speed (1 = slow, 10 = hyper-fast)
      </div>
      <div class="hp-slider-row">
        <input type="range" class="hp-slider" id="setJoySens" min="1" max="10" step="1"
          aria-label="Joystick sensitivity"
          oninput="HPSettingsUI._liveUpdate('setJoySensVal', this.value)">
        <span class="hp-slider-val" id="setJoySensVal">5</span>
      </div>
    </div>

    <div class="hp-settings-group">
      <div class="hp-settings-label">DEAD ZONE</div>
      <div style="font-family:var(--font-mono); font-size:0.65rem; color:var(--text-muted-dark); margin-bottom:8px;">
        Ignore stick movement within this radius (prevents drift)
      </div>
      <div class="hp-slider-row">
        <input type="range" class="hp-slider" id="setDeadZone" min="0" max="30" step="1"
          aria-label="Dead zone percent"
          oninput="HPSettingsUI._liveUpdate('setDeadZoneVal', this.value + '%')">
        <span class="hp-slider-val" id="setDeadZoneVal">5%</span>
      </div>
    </div>

    <div class="hp-settings-group">
      <div class="hp-settings-label">GYRO SENSITIVITY</div>
      <div style="font-family:var(--font-mono); font-size:0.65rem; color:var(--text-muted-dark); margin-bottom:8px;">
        Motion-aim responsiveness (1 = gentle, 10 = maximum)
      </div>
      <div class="hp-slider-row">
        <input type="range" class="hp-slider" id="setGyroSens" min="1" max="10" step="1"
          aria-label="Gyro sensitivity"
          oninput="HPSettingsUI._liveUpdate('setGyroSensVal', this.value)">
        <span class="hp-slider-val" id="setGyroSensVal">5</span>
      </div>
    </div>

    <div class="hp-settings-group">
      <div class="hp-settings-row" style="display:flex; justify-content:space-between; align-items:center;">
        <div>
          <div class="hp-settings-label">HAPTIC FEEDBACK</div>
          <div style="font-family:var(--font-mono); font-size:0.65rem; color:var(--text-muted-dark); margin-top:2px;">
            Vibration on button press (requires device support)
          </div>
        </div>
        <button class="hp-toggle-btn" id="setHaptic" onclick="HPSettingsUI.toggleHaptic()"
          aria-pressed="true">ON</button>
      </div>
    </div>

    <div class="hp-settings-group">
      <div class="hp-settings-row" style="display:flex; justify-content:space-between; align-items:center;">
        <div>
          <div class="hp-settings-label">AUTO-RECONNECT</div>
          <div style="font-family:var(--font-mono); font-size:0.65rem; color:var(--text-muted-dark); margin-top:2px;">
            Automatically reconnect device on signal drop
          </div>
        </div>
        <button class="hp-toggle-btn" id="setAutoReconnect" onclick="HPSettingsUI.toggleAutoReconnect()"
          aria-pressed="true">ON</button>
      </div>
    </div>

    <div style="margin-top:20px; padding-top:16px; border-top:1px solid var(--dark-border);">
      <button class="cyber-button sm secondary" onclick="HPSettingsUI.resetDefaults()" style="width:100%;">
        RESET TO DEFAULTS
      </button>
    </div>
  </div>

  <!-- ── DISPLAY SETTINGS ────────────────────────────────── -->
  <div class="hp-panel-body" id="setBodyDisplay" style="display:none;">

    <div class="hp-settings-group">
      <div class="hp-settings-label" style="margin-bottom:10px;">THEME</div>
      <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:8px;">
        <button class="hp-theme-card" data-theme="dark" onclick="HPSettingsUI.setTheme(this,'dark')"
          aria-pressed="true">
          <div class="hp-theme-preview" style="background:#0d0d0d; border:2px solid #cc1111;">
            <div style="height:6px; background:#161616; margin-bottom:4px;"></div>
            <div style="height:4px; background:#cc1111; width:60%;"></div>
          </div>
          <span>DARK</span>
        </button>
        <button class="hp-theme-card" data-theme="light" onclick="HPSettingsUI.setTheme(this,'light')"
          aria-pressed="false">
          <div class="hp-theme-preview" style="background:#f2ede4; border:2px solid #333;">
            <div style="height:6px; background:#e6e0d4; margin-bottom:4px;"></div>
            <div style="height:4px; background:#cc1111; width:60%;"></div>
          </div>
          <span>LIGHT</span>
        </button>
        <button class="hp-theme-card" data-theme="amoled" onclick="HPSettingsUI.setTheme(this,'amoled')"
          aria-pressed="false">
          <div class="hp-theme-preview" style="background:#000; border:2px solid #fff;">
            <div style="height:6px; background:#0a0a0a; margin-bottom:4px;"></div>
            <div style="height:4px; background:#cc1111; width:60%;"></div>
          </div>
          <span>AMOLED</span>
        </button>
      </div>
    </div>

    <div class="hp-settings-group">
      <div class="hp-settings-label" style="margin-bottom:10px;">ACCENT COLOR</div>
      <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
        <input type="color" id="setAccentColor" value="#cc1111"
          style="width:52px; height:40px; border:2px solid var(--dark-border); cursor:pointer; background:none; padding:2px;"
          aria-label="Accent colour picker"
          oninput="HPSettingsUI.setAccent(this.value)">
        <span id="setAccentHex" style="font-family:var(--font-mono); font-size:0.9rem; font-weight:700;">#cc1111</span>
        <button class="cyber-button sm secondary" onclick="HPSettingsUI.resetAccent()">RESET</button>
      </div>
      <!-- Preset swatches -->
      <div style="display:flex; gap:8px; margin-top:12px; flex-wrap:wrap;">
        ${['#cc1111','#ff5500','#e6b800','#00ccff','#aa00ff','#00cc66','#ff0066','#ffffff'].map(c =>
          `<button onclick="HPSettingsUI.setAccentSwatch('${c}')"
            style="width:28px; height:28px; background:${c}; border:2px solid transparent;
                   border-radius:50%; cursor:pointer; transition:transform 0.1s;"
            title="${c}" aria-label="Set accent to ${c}"
            onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'"></button>`
        ).join('')}
      </div>
    </div>

    <div style="margin-top:16px; padding:12px; background:var(--bg-charcoal); border:1px solid var(--dark-border);">
      <div style="font-family:var(--font-mono); font-size:0.7rem; color:var(--text-muted-dark); margin-bottom:6px;">PREVIEW</div>
      <div style="display:flex; gap:8px; flex-wrap:wrap;">
        <button class="cyber-button sm primary">PRIMARY BTN</button>
        <button class="cyber-button sm secondary">SECONDARY BTN</button>
        <span style="font-family:var(--font-mono); font-size:0.75rem; color:var(--accent-red); margin-left:4px;">ACCENT TEXT</span>
      </div>
    </div>
  </div>

  <!-- ── TRANSPORT / CAPABILITIES ────────────────────────── -->
  <div class="hp-panel-body" id="setBodyConnect" style="display:none;">
    <div style="font-family:var(--font-mono); font-size:0.7rem; color:var(--text-muted-dark); margin-bottom:16px; line-height:1.7;">
      Browser &amp; device transport capabilities detected at runtime.
      Items labelled NEEDS APP require a native companion.
    </div>
    <div id="capabilityList"></div>

    <div style="margin-top:20px; padding:12px; background:var(--bg-charcoal); border:1px solid var(--dark-border);">
      <div style="font-family:var(--font-mono); font-size:0.7rem; color:var(--text-muted-dark); margin-bottom:8px;">ACCOUNT</div>
      <div id="setAccountInfo" style="font-family:var(--font-mono); font-size:0.8rem;"></div>
    </div>
  </div>
</div>`);
  }

  /* ── Populate account info block ────────────────────────────────────────── */
  function renderAccountInfo() {
    const el = document.getElementById('setAccountInfo');
    if (!el) return;
    const user = HP.getUser();
    if (user) {
      el.innerHTML = `
        <div style="margin-bottom:6px;">Signed in as <strong>${user.name || user.email}</strong></div>
        <div style="color:var(--text-muted-dark); font-size:0.7rem; margin-bottom:10px;">${user.email}</div>
        <button class="cyber-button sm danger" onclick="HPAuth&&HPAuth.logout(); HPSettingsUI.close()">SIGN OUT</button>`;
    } else {
      el.innerHTML = `
        <div style="color:var(--text-muted-dark); margin-bottom:10px;">Not signed in. Settings are session-only.</div>
        <button class="cyber-button sm primary" onclick="HPAuth&&HPAuth.open(); HPSettingsUI.close()">SIGN IN</button>`;
    }
  }

  /* ── Load stored settings into UI controls ──────────────────────────────── */
  function loadIntoUI() {
    const s = HP.getSettings();

    const setEl = (id, val) => { const e = document.getElementById(id); if (e) e.value = val; };
    const setTxt = (id, v)  => { const e = document.getElementById(id); if (e) e.textContent = v; };

    setEl('setBtnSens',    s.button_sensitivity);
    setEl('setJoySens',    s.joystick_sensitivity);
    setEl('setDeadZone',   s.dead_zone_percent);
    setEl('setGyroSens',   s.gyro_sensitivity);
    setEl('setAccentColor', s.accent_color || '#cc1111');

    setTxt('setBtnSensVal',  s.button_sensitivity);
    setTxt('setJoySensVal',  s.joystick_sensitivity);
    setTxt('setDeadZoneVal', s.dead_zone_percent + '%');
    setTxt('setGyroSensVal', s.gyro_sensitivity);
    setTxt('setAccentHex',   s.accent_color || '#cc1111');

    // Toggle buttons
    _setToggle('setHaptic',        s.haptic_enabled !== false);
    _setToggle('setAutoReconnect', s.auto_reconnect !== false);

    // Theme cards
    document.querySelectorAll('[data-theme]').forEach(b => {
      const active = b.dataset.theme === (s.theme || 'dark');
      b.classList.toggle('active', active);
      b.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function _setToggle(id, on) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = on ? 'ON' : 'OFF';
    el.classList.toggle('off', !on);
    el.setAttribute('aria-pressed', on ? 'true' : 'false');
  }

  /* ── Render capability list ──────────────────────────────────────────────── */
  function renderCapabilities() {
    const list = document.getElementById('capabilityList');
    if (!list) return;
    const caps = window.HPTransport ? HPTransport.getCapabilityReport() : _fallbackCaps();
    list.innerHTML = caps.map(c => `
      <div style="padding:10px 0; border-bottom:1px solid var(--dark-border);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:3px;">
          <span style="font-family:var(--font-mono); font-size:0.78rem; font-weight:700;">${c.name}</span>
          <span style="font-family:var(--font-mono); font-size:0.65rem; padding:2px 7px;
            background:${c.available ? '#0d2b0d' : '#1a0a0a'};
            color:${c.available ? '#22cc44' : '#cc4444'};
            border:1px solid ${c.available ? '#22cc44' : '#cc4444'};">${c.status}</span>
        </div>
        <div style="font-family:var(--font-mono); font-size:0.65rem; color:var(--text-muted-dark); line-height:1.5;">${c.note}</div>
      </div>`).join('');
    renderAccountInfo();
  }

  function _fallbackCaps() {
    return [
      { name:'BroadcastChannel', available:!!window.BroadcastChannel,    status: window.BroadcastChannel    ? 'READY'     : 'UNSUPPORTED', note:'Local multi-tab sync.' },
      { name:'Gamepad API',      available:!!navigator.getGamepads,       status: navigator.getGamepads       ? 'READY'     : 'UNSUPPORTED', note:'USB/Bluetooth gamepad detection.' },
      { name:'WebSocket',        available:!!window.WebSocket,            status: window.WebSocket            ? 'READY'     : 'UNSUPPORTED', note:'Real-time server communication.' },
      { name:'WebRTC',           available:!!(window.RTCPeerConnection),  status: window.RTCPeerConnection    ? 'READY'     : 'UNSUPPORTED', note:'Peer-to-peer connection.' },
      { name:'Vibration',        available:!!navigator.vibrate,           status: navigator.vibrate           ? 'READY'     : 'NEEDS APP',   note:'Haptic feedback.' },
      { name:'Motion Sensors',   available:!!window.DeviceOrientationEvent, status: window.DeviceOrientationEvent ? 'AVAILABLE':'UNAVAILABLE', note:'Gyroscope / accelerometer.' },
      { name:'USB (WebUSB)',      available:!!navigator.usb,              status: navigator.usb               ? 'READY'     : 'NEEDS HTTPS', note:'Direct USB tethering.' },
    ];
  }

  /* ── Debounced save ──────────────────────────────────────────────────────── */
  let _saveTimer = null;
  function _debounceSave() {
    clearTimeout(_saveTimer);
    _saveTimer = setTimeout(_doSave, 400);
  }

  function _doSave() {
    HP.updateSettings({
      button_sensitivity:   parseInt(document.getElementById('setBtnSens')?.value   || 5),
      joystick_sensitivity: parseInt(document.getElementById('setJoySens')?.value   || 5),
      dead_zone_percent:    parseInt(document.getElementById('setDeadZone')?.value  || 5),
      gyro_sensitivity:     parseInt(document.getElementById('setGyroSens')?.value  || 5),
    });
  }

  /* ── Public API ──────────────────────────────────────────────────────────── */
  window.HPSettingsUI = {

    init() {
      inject();
      applyPersistedSettings();
    },

    /* Called by HPAuth after login/logout to re-apply the user's settings */
    applyUserSettings() {
      applyPersistedSettings();
      loadIntoUI();
    },

    open() {
      loadIntoUI();
      document.getElementById('settingsPanel').classList.add('active');
      this.switchTab('input');
    },

    close() {
      _doSave(); // flush any pending changes
      document.getElementById('settingsPanel').classList.remove('active');
    },

    switchTab(tab) {
      ['input','display','connect'].forEach(t => {
        const capT = t.charAt(0).toUpperCase() + t.slice(1);
        document.getElementById('setTab'  + capT)?.classList.toggle('active', t === tab);
        const body = document.getElementById('setBody' + capT);
        if (body) body.style.display = t === tab ? 'block' : 'none';
      });
      if (tab === 'connect') renderCapabilities();
    },

    _liveUpdate(labelId, val) {
      const el = document.getElementById(labelId);
      if (el) el.textContent = val;
      _debounceSave();
    },

    toggleHaptic() {
      const s = HP.getSettings();
      const next = !s.haptic_enabled;
      HP.updateSettings({ haptic_enabled: next });
      _setToggle('setHaptic', next);
      if (typeof showToast === 'function') showToast('Haptic: ' + (next ? 'ON' : 'OFF'));
    },

    toggleAutoReconnect() {
      const s = HP.getSettings();
      const next = !s.auto_reconnect;
      HP.updateSettings({ auto_reconnect: next });
      _setToggle('setAutoReconnect', next);
      if (typeof showToast === 'function') showToast('Auto-reconnect: ' + (next ? 'ON' : 'OFF'));
    },

    setTheme(btn, theme) {
      document.querySelectorAll('[data-theme]').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
      HP.updateSettings({ theme });
      applyTheme(theme);
      if (typeof showToast === 'function') showToast('Theme: ' + theme.toUpperCase());
    },

    setAccent(hex) {
      applyAccent(hex);
      const hexEl = document.getElementById('setAccentHex');
      if (hexEl) hexEl.textContent = hex;
      HP.updateSettings({ accent_color: hex });
    },

    setAccentSwatch(hex) {
      this.setAccent(hex);
      const picker = document.getElementById('setAccentColor');
      if (picker) picker.value = hex;
    },

    resetAccent() {
      this.setAccentSwatch('#cc1111');
    },

    resetDefaults() {
      if (!confirm('Reset all input settings to defaults?')) return;
      HP.updateSettings({
        button_sensitivity:   5,
        joystick_sensitivity: 5,
        dead_zone_percent:    5,
        gyro_sensitivity:     5,
        haptic_enabled:       true,
        auto_reconnect:       true,
      });
      loadIntoUI();
      if (typeof showToast === 'function') showToast('Settings reset to defaults.');
    }
  };

})();
