/* ==========================================================================
   HYPERPULSE // SETTINGS UI (ui-settings.js)
   Settings entity (1:1 User) + capability/transport status panel.
   ========================================================================== */

(function () {

  function inject() {
    document.body.insertAdjacentHTML('beforeend', `

<div class="hp-side-panel" id="settingsPanel" style="width:480px;">
  <div class="hp-panel-header">
    <span class="hp-panel-title">⚙ SETTINGS</span>
    <button class="close-btn" onclick="HPSettingsUI.close()" style="color:#fff;">✕</button>
  </div>

  <div class="hp-panel-tabs">
    <button class="hp-panel-tab active" id="setTabInput"    onclick="HPSettingsUI.switchTab('input')">INPUT</button>
    <button class="hp-panel-tab"        id="setTabDisplay"  onclick="HPSettingsUI.switchTab('display')">DISPLAY</button>
    <button class="hp-panel-tab"        id="setTabConnect"  onclick="HPSettingsUI.switchTab('connect')">TRANSPORT</button>
  </div>

  <!-- INPUT SETTINGS -->
  <div class="hp-panel-body" id="setBodyInput">
    <div class="hp-settings-group">
      <div class="hp-settings-label">BUTTON SENSITIVITY</div>
      <div class="hp-slider-row">
        <input type="range" class="hp-slider" id="setBtnSens" min="1" max="10" step="1"
               oninput="HPSettingsUI.updateLabel('setBtnSensVal', this.value); HPSettingsUI.save()">
        <span class="hp-slider-val" id="setBtnSensVal">5</span>
      </div>
    </div>

    <div class="hp-settings-group">
      <div class="hp-settings-label">JOYSTICK SENSITIVITY</div>
      <div class="hp-slider-row">
        <input type="range" class="hp-slider" id="setJoySens" min="1" max="10" step="1"
               oninput="HPSettingsUI.updateLabel('setJoySensVal', this.value); HPSettingsUI.save()">
        <span class="hp-slider-val" id="setJoySensVal">5</span>
      </div>
    </div>

    <div class="hp-settings-group">
      <div class="hp-settings-label">DEAD ZONE (0–30%)</div>
      <div class="hp-slider-row">
        <input type="range" class="hp-slider" id="setDeadZone" min="0" max="30" step="1"
               oninput="HPSettingsUI.updateLabel('setDeadZoneVal', this.value + '%'); HPSettingsUI.save()">
        <span class="hp-slider-val" id="setDeadZoneVal">5%</span>
      </div>
    </div>

    <div class="hp-settings-group">
      <div class="hp-settings-label">GYRO SENSITIVITY</div>
      <div class="hp-slider-row">
        <input type="range" class="hp-slider" id="setGyroSens" min="1" max="10" step="1"
               oninput="HPSettingsUI.updateLabel('setGyroSensVal', this.value); HPSettingsUI.save()">
        <span class="hp-slider-val" id="setGyroSensVal">5</span>
      </div>
    </div>

    <div class="hp-settings-group">
      <div class="hp-settings-row">
        <span class="hp-settings-label">HAPTIC FEEDBACK</span>
        <button class="hp-toggle-btn" id="setHaptic" onclick="HPSettingsUI.toggleHaptic()">ON</button>
      </div>
    </div>

    <div class="hp-settings-group">
      <div class="hp-settings-row">
        <span class="hp-settings-label">AUTO-RECONNECT</span>
        <button class="hp-toggle-btn" id="setAutoReconnect" onclick="HPSettingsUI.toggleAutoReconnect()">ON</button>
      </div>
    </div>
  </div>

  <!-- DISPLAY SETTINGS -->
  <div class="hp-panel-body" id="setBodyDisplay" style="display:none;">
    <div class="hp-settings-group">
      <div class="hp-settings-label">THEME</div>
      <div style="display:flex; gap:8px; flex-wrap:wrap;">
        <button class="hp-chip active" data-theme="dark"   onclick="HPSettingsUI.setTheme(this,'dark')">DARK</button>
        <button class="hp-chip"        data-theme="light"  onclick="HPSettingsUI.setTheme(this,'light')">LIGHT</button>
        <button class="hp-chip"        data-theme="amoled" onclick="HPSettingsUI.setTheme(this,'amoled')">AMOLED</button>
      </div>
    </div>

    <div class="hp-settings-group">
      <div class="hp-settings-label">ACCENT COLOR</div>
      <div style="display:flex; gap:10px; align-items:center;">
        <input type="color" id="setAccentColor" value="#cc1111"
               style="width:48px; height:36px; border:2px solid var(--ink-black); cursor:pointer; background:none;"
               oninput="HPSettingsUI.setAccent(this.value)">
        <span id="setAccentHex" style="font-family:var(--font-mono); font-size:0.85rem;">#cc1111</span>
        <button class="cyber-button sm secondary" onclick="HPSettingsUI.resetAccent()">RESET</button>
      </div>
    </div>
  </div>

  <!-- TRANSPORT / CAPABILITY SETTINGS -->
  <div class="hp-panel-body" id="setBodyConnect" style="display:none;">
    <div style="font-family:var(--font-mono); font-size:0.7rem; color:var(--text-muted-dark); margin-bottom:16px; line-height:1.6;">
      Transport capabilities detected for this browser/device.
      Items marked NEEDS APP require a native companion.
    </div>
    <div id="capabilityList"></div>
  </div>
</div>

    `);
  }

  /* ── Load stored settings into UI ───────────────────────── */
  function loadIntoUI() {
    const s = HP.getSettings();

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
    const setText = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
    const setToggle = (id, on) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.textContent = on ? 'ON' : 'OFF';
      el.classList.toggle('off', !on);
    };

    set('setBtnSens',    s.button_sensitivity);
    set('setJoySens',    s.joystick_sensitivity);
    set('setDeadZone',   s.dead_zone_percent);
    set('setGyroSens',   s.gyro_sensitivity);
    set('setAccentColor', s.accent_color);

    setText('setBtnSensVal',  s.button_sensitivity);
    setText('setJoySensVal',  s.joystick_sensitivity);
    setText('setDeadZoneVal', s.dead_zone_percent + '%');
    setText('setGyroSensVal', s.gyro_sensitivity);
    setText('setAccentHex',   s.accent_color);

    setToggle('setHaptic',        s.haptic_enabled);
    setToggle('setAutoReconnect', s.auto_reconnect);

    // Theme chips
    document.querySelectorAll('[data-theme]').forEach(b => {
      b.classList.toggle('active', b.dataset.theme === s.theme);
    });

    // Apply accent color
    document.documentElement.style.setProperty('--accent-red', s.accent_color);
  }

  /* ── Render capability list ──────────────────────────────── */
  function renderCapabilities() {
    const list = document.getElementById('capabilityList');
    if (!list || !window.HPTransport) return;
    const caps = HPTransport.getCapabilityReport();
    list.innerHTML = caps.map(c => `
      <div class="hp-cap-row">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
          <span style="font-family:var(--font-mono); font-size:0.78rem; font-weight:700;">${c.name}</span>
          <span class="hp-cap-badge hp-cap-${c.available ? 'ok' : 'no'}">${c.status}</span>
        </div>
        <p style="font-family:var(--font-mono); font-size:0.65rem; color:var(--text-muted-dark); line-height:1.5;">${c.note}</p>
      </div>
    `).join('');
  }

  /* ── Public API ──────────────────────────────────────────── */
  window.HPSettingsUI = {

    init() { inject(); },

    open() {
      loadIntoUI();
      document.getElementById('settingsPanel').classList.add('active');
      this.switchTab('input');
    },

    close() {
      document.getElementById('settingsPanel').classList.remove('active');
    },

    switchTab(tab) {
      ['input','display','connect'].forEach(t => {
        document.getElementById('setTab' + t.charAt(0).toUpperCase() + t.slice(1)).classList.toggle('active', t === tab);
        document.getElementById('setBody' + t.charAt(0).toUpperCase() + t.slice(1)).style.display = t === tab ? 'block' : 'none';
      });
      if (tab === 'connect') renderCapabilities();
    },

    updateLabel(id, val) {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    },

    save() {
      HP.updateSettings({
        button_sensitivity:   parseInt(document.getElementById('setBtnSens').value),
        joystick_sensitivity: parseInt(document.getElementById('setJoySens').value),
        dead_zone_percent:    parseInt(document.getElementById('setDeadZone').value),
        gyro_sensitivity:     parseInt(document.getElementById('setGyroSens').value)
      });
    },

    toggleHaptic() {
      const s = HP.getSettings();
      HP.updateSettings({ haptic_enabled: !s.haptic_enabled });
      document.getElementById('setHaptic').textContent = !s.haptic_enabled ? 'ON' : 'OFF';
      document.getElementById('setHaptic').classList.toggle('off', s.haptic_enabled);
    },

    toggleAutoReconnect() {
      const s = HP.getSettings();
      HP.updateSettings({ auto_reconnect: !s.auto_reconnect });
      document.getElementById('setAutoReconnect').textContent = !s.auto_reconnect ? 'ON' : 'OFF';
      document.getElementById('setAutoReconnect').classList.toggle('off', s.auto_reconnect);
    },

    setTheme(btn, theme) {
      document.querySelectorAll('[data-theme]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      HP.updateSettings({ theme });
      // Visual switch
      if (theme === 'amoled') {
        document.documentElement.style.setProperty('--bg-paper', '#000000');
        document.documentElement.style.setProperty('--bg-paper-dark', '#0a0a0a');
        document.documentElement.style.setProperty('--ink-black', '#ffffff');
      } else if (theme === 'light') {
        document.documentElement.style.setProperty('--bg-paper', '#f2ede4');
        document.documentElement.style.setProperty('--bg-paper-dark', '#e6e0d4');
        document.documentElement.style.setProperty('--ink-black', '#0a0a0a');
      } else {
        // dark — restore defaults
        document.documentElement.style.setProperty('--bg-paper', '#f2ede4');
        document.documentElement.style.setProperty('--bg-paper-dark', '#e6e0d4');
        document.documentElement.style.setProperty('--ink-black', '#0a0a0a');
      }
      if (typeof showToast === 'function') showToast('Theme: ' + theme.toUpperCase());
    },

    setAccent(hex) {
      document.documentElement.style.setProperty('--accent-red', hex);
      document.documentElement.style.setProperty('--accent-orange', hex);
      const hexEl = document.getElementById('setAccentHex');
      if (hexEl) hexEl.textContent = hex;
      HP.updateSettings({ accent_color: hex });
    },

    resetAccent() {
      this.setAccent('#cc1111');
      const el = document.getElementById('setAccentColor');
      if (el) el.value = '#cc1111';
    }
  };

})();
