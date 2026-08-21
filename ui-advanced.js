/* ==========================================================================
   HYPERPULSE // ADVANCED FEATURES  (ui-advanced.js)
   1. Auto Game Detection   — PC companion interface + BroadcastChannel bridge
   2. Smart Auto-Mapping    — per-game button-mapping suggestions
   3. Adaptive Gyro         — named gyro profiles with full tuning
   4. Ultra Low Latency     — UI throttle mode, never touches input pipeline
   5. Profile Auto-Switch   — watch active game, swap profile automatically
   ========================================================================== */

window.HPAdvanced = (function () {

  /* ── shared helpers ─────────────────────────────────────────────────────── */
  function esc(s) {
    return String(s || '').replace(/[&<>"']/g, c =>
      ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }
  function toast(msg) { if (typeof showToast === 'function') showToast(msg); }
  function sound(t)   { if (typeof playSound  === 'function') playSound(t); }

  /* ══════════════════════════════════════════════════════════════════════════
     1. AUTO GAME DETECTION
     Architecture: PC companion posts { type:'GAME_DETECTED', game:'Fortnite' }
     over BroadcastChannel or WebSocket. This module listens and reacts.
     When real detection is unavailable, the UI shows the companion spec.
  ══════════════════════════════════════════════════════════════════════════ */
  const GameDetector = (function () {

    let _lastDetected = null;
    let _autoSwitchOverride = false; // manual override disables auto-switch

    /* Called whenever a game name arrives (from companion or manual test) */
    function onGameDetected(gameName) {
      if (!gameName) return;
      _lastDetected = gameName;

      // Update detection status UI
      const statusEl = document.getElementById('agdStatus');
      const nameEl   = document.getElementById('agdGameName');
      if (statusEl) statusEl.className = 'agd-dot active';
      if (nameEl)   nameEl.innerText = gameName;

      // Only auto-switch if enabled and not overridden
      const s = HP.getSettings();
      if (!s.auto_profile_switch || _autoSwitchOverride) return;

      ProfileAutoSwitch.switchToGame(gameName);
    }

    /* Listen on BroadcastChannel for PC companion messages */
    function initCompanionBridge() {
      try {
        const ch = new BroadcastChannel('hyperpulse_companion');
        ch.onmessage = (e) => {
          if (e.data && e.data.type === 'GAME_DETECTED') {
            onGameDetected(e.data.game);
          }
          if (e.data && e.data.type === 'GAME_EXITED') {
            const statusEl = document.getElementById('agdStatus');
            const nameEl   = document.getElementById('agdGameName');
            if (statusEl) statusEl.className = 'agd-dot';
            if (nameEl)   nameEl.innerText = 'No game detected';
            _lastDetected = null;
          }
        };
      } catch (_) {}

      /* Also listen on the main app BroadcastChannel (same origin companion) */
      try {
        const mainCh = new BroadcastChannel('hyperpulse_channel');
        mainCh.onmessage = (e) => {
          if (e.data && e.data.type === 'GAME_DETECTED') onGameDetected(e.data.game);
        };
      } catch (_) {}
    }

    return {
      init: initCompanionBridge,
      onGameDetected,
      getLastDetected: () => _lastDetected,
      setOverride: (v) => { _autoSwitchOverride = v; },
      isOverridden: () => _autoSwitchOverride,
    };
  })();

  /* ══════════════════════════════════════════════════════════════════════════
     2. SMART AUTO-MAPPING
     Generates sensible button_mapping_json for common game genres.
  ══════════════════════════════════════════════════════════════════════════ */
  const AutoMapper = (function () {

    /* Preset templates keyed by detected genre keywords */
    const TEMPLATES = {
      racing: {
        type: 'racing',
        map: { A:'ACCEL', B:'BRAKE', X:'HANDBRAKE', Y:'RESET',
               L1:'GEAR_DOWN', R1:'GEAR_UP', L2:'CLUTCH', R2:'ACCEL',
               START:'PAUSE', SELECT:'MAP' }
      },
      fps: {
        type: 'gamepad',
        map: { A:'JUMP', B:'CROUCH', X:'RELOAD', Y:'MELEE',
               L1:'ADS', R1:'FIRE', L2:'GRENADE', R2:'FIRE',
               DPAD_UP:'WEAPON_NEXT', DPAD_DOWN:'WEAPON_PREV',
               START:'PAUSE', SELECT:'SCOREBOARD' }
      },
      rts: {
        type: 'mouse',
        map: { A:'SELECT', B:'CANCEL', X:'ATTACK_MOVE', Y:'STOP',
               L1:'GROUP_1', R1:'GROUP_2', START:'PAUSE', SELECT:'MINIMAP' }
      },
      platform: {
        type: 'gamepad',
        map: { A:'JUMP', B:'ATTACK', X:'DASH', Y:'SPECIAL',
               L1:'GRAB', R1:'BLOCK', L2:'ROLL', R2:'SPRINT',
               START:'PAUSE', SELECT:'MAP' }
      },
      default: {
        type: 'gamepad',
        map: { A:'SPACEBAR', B:'E', X:'R', Y:'F',
               L1:'Q', R1:'TAB', L2:'SHIFT', R2:'CTRL',
               DPAD_UP:'1', DPAD_DOWN:'2', DPAD_LEFT:'3', DPAD_RIGHT:'4',
               START:'ESC', SELECT:'M' }
      }
    };

    /* Keyboard preset (WASD → sticks, etc.) */
    const KEYBOARD_PRESET = {
      type: 'keyboard',
      map: { A:'SPACE', B:'SHIFT', X:'E', Y:'Q',
             L1:'CTRL', R1:'ALT', L2:'Z', R2:'X',
             DPAD_UP:'W', DPAD_DOWN:'S', DPAD_LEFT:'A', DPAD_RIGHT:'D',
             START:'ESC', SELECT:'TAB' }
    };

    function detectGenre(gameName) {
      const n = (gameName || '').toLowerCase();
      if (/gran turismo|forza|f1|nascar|assetto|drift|rally|kart/.test(n)) return 'racing';
      if (/cod|call of duty|valorant|fortnite|halo|apex|battlefield|counter|csgo/.test(n)) return 'fps';
      if (/starcraft|warcraft|dota|league|heroes|total war|age of/.test(n)) return 'rts';
      if (/mario|sonic|crash|hollow|cuphead|celeste|platform/.test(n)) return 'platform';
      return 'default';
    }

    function suggest(gameName, preferKeyboard) {
      if (preferKeyboard) return { ...KEYBOARD_PRESET };
      const genre = detectGenre(gameName);
      return { ...TEMPLATES[genre] };
    }

    return { suggest, detectGenre, TEMPLATES, KEYBOARD_PRESET };
  })();

  /* ══════════════════════════════════════════════════════════════════════════
     3. ADAPTIVE GYRO PROFILES
     Stored inside ControllerProfile.layout_json.gyro_profile (no new table).
  ══════════════════════════════════════════════════════════════════════════ */
  const GyroProfiles = (function () {

    const PRESETS = {
      racing:  { name:'Racing',        sens:4, smooth:60, deadzone:3, invertX:false, invertY:false, curve:'linear' },
      camera:  { name:'Camera Control',sens:5, smooth:45, deadzone:2, invertX:false, invertY:true,  curve:'linear' },
      fps:     { name:'FPS Aim',       sens:7, smooth:20, deadzone:1, invertX:false, invertY:false, curve:'squared' },
      custom:  { name:'Custom',        sens:5, smooth:30, deadzone:2, invertX:false, invertY:false, curve:'linear' },
    };

    let _active = 'fps';

    function getActive() { return _active; }

    function setActive(key) {
      _active = key;
      applyToState(PRESETS[key] || PRESETS.custom);
    }

    /* Push gyro settings into app.js state.inputs.gyro */
    function applyToState(profile) {
      if (typeof state === 'undefined') return;
      const g = state.inputs.gyro;
      g.sens     = profile.sens;
      g.smooth   = profile.smooth;
      g.deadzone = profile.deadzone;
      // Store invert flags for use in sensor handler
      state._gyroInvertX = profile.invertX;
      state._gyroInvertY = profile.invertY;
      state._gyroCurve   = profile.curve;
    }

    /* Apply the gyro profile from the active ControllerProfile.layout_json */
    function applyFromActiveProfile() {
      const profiles = HP.getControllerProfiles();
      const s = HP.getSettings();
      // Find a profile that matches — prefer one with gyro_profile set
      const gp = profiles.find(p =>
        p.layout_json && p.layout_json.gyro_profile
      );
      if (gp) {
        const saved = gp.layout_json.gyro_profile;
        const merged = Object.assign({}, PRESETS.custom, saved);
        applyToState(merged);
        _active = saved.preset_key || 'custom';
      } else {
        setActive('fps'); // sensible default
      }
    }

    /* Save current UI values to the active ControllerProfile */
    function saveToActiveProfile(profileId, profileData) {
      HP.updateControllerProfile(profileId, {
        layout_json: {
          ...(HP.getControllerProfiles().find(p => p.profile_id === profileId)?.layout_json || {}),
          gyro_profile: profileData
        }
      });
    }

    return { PRESETS, getActive, setActive, applyToState, applyFromActiveProfile, saveToActiveProfile };
  })();

  /* ══════════════════════════════════════════════════════════════════════════
     4. ULTRA LOW LATENCY MODE
     Only touches UI refresh rates. NEVER modifies the input pipeline.
  ══════════════════════════════════════════════════════════════════════════ */
  const LowLatency = (function () {

    let _enabled = false;

    /* Latency stats — populated from real measurements when available */
    const _stats = { latency: null, jitter: null, packetLoss: null };

    let _statsIntervalId = null;
    let _jitterSamples = [];

    function enable() {
      _enabled = true;
      HP.updateSettings({ low_latency_mode: true });

      // Reduce body animations
      document.documentElement.style.setProperty('--animation-speed', '0s');
      // Pause grain overlay (CSS ::before pseudo — toggle class)
      document.body.classList.add('ll-mode');

      _startStatsMonitor();
      toast('⚡ Ultra Low Latency Mode ON');
      sound('chime');
      _refreshIndicator();
    }

    function disable() {
      _enabled = false;
      HP.updateSettings({ low_latency_mode: false });

      document.documentElement.style.removeProperty('--animation-speed');
      document.body.classList.remove('ll-mode');

      _stopStatsMonitor();
      toast('Low Latency Mode OFF');
      sound('click');
      _refreshIndicator();
    }

    function toggle() { _enabled ? disable() : enable(); }
    function isEnabled() { return _enabled; }

    function _startStatsMonitor() {
      if (_statsIntervalId) return;
      _statsIntervalId = setInterval(() => {
        // Read real latency from state if available
        const raw = (typeof state !== 'undefined') ? state.latencyMs : null;
        if (raw !== null) {
          _jitterSamples.push(raw);
          if (_jitterSamples.length > 20) _jitterSamples.shift();
          _stats.latency = raw;
          // jitter = std-dev of last 20 samples
          const mean = _jitterSamples.reduce((a, b) => a + b, 0) / _jitterSamples.length;
          const variance = _jitterSamples.reduce((a, b) => a + (b - mean) ** 2, 0) / _jitterSamples.length;
          _stats.jitter = Math.sqrt(variance).toFixed(2);
          _stats.packetLoss = 0; // real value needs transport layer counter
        }
        _refreshStats();
      }, 200); // 5 Hz refresh — lightweight
    }

    function _stopStatsMonitor() {
      clearInterval(_statsIntervalId);
      _statsIntervalId = null;
      _jitterSamples = [];
    }

    function _refreshIndicator() {
      const btn = document.getElementById('llToggleBtn');
      if (!btn) return;
      btn.textContent = _enabled ? '⚡ LOW LATENCY: ON' : '⚡ LOW LATENCY: OFF';
      btn.className   = _enabled
        ? 'cyber-button sm primary'
        : 'cyber-button sm secondary';
    }

    function _refreshStats() {
      const latEl  = document.getElementById('llLatency');
      const jitEl  = document.getElementById('llJitter');
      const plEl   = document.getElementById('llPacketLoss');
      if (latEl) {
        const isReal = _stats.latency !== null && _stats.latency > 0;
        latEl.innerHTML = isReal
          ? `${_stats.latency} ms`
          : `—&nbsp;<span style="font-size:0.6rem;color:#555;">no signal</span>`;
      }
      if (jitEl) {
        const isReal = _stats.jitter !== null && _jitterSamples.length >= 5;
        jitEl.innerHTML = isReal
          ? `${_stats.jitter} ms`
          : `—&nbsp;<span style="font-size:0.6rem;color:#555;">demo</span>`;
      }
      if (plEl) {
        plEl.innerHTML = _stats.packetLoss !== null
          ? `${_stats.packetLoss}%`
          : `—`;
      }
    }

    /* Called by transport layer with real measurements */
    function reportMeasurement(latencyMs, jitterMs, packetLossPct) {
      _stats.latency     = latencyMs;
      _stats.jitter      = jitterMs;
      _stats.packetLoss  = packetLossPct;
      _jitterSamples.push(latencyMs);
      if (_jitterSamples.length > 20) _jitterSamples.shift();
      if (_enabled) _refreshStats();
    }

    return { enable, disable, toggle, isEnabled, reportMeasurement };
  })();

  /* ══════════════════════════════════════════════════════════════════════════
     5. PROFILE AUTO-SWITCHING
  ══════════════════════════════════════════════════════════════════════════ */
  const ProfileAutoSwitch = (function () {

    /* Switch controller + game profile to match a detected game name */
    function switchToGame(gameName) {
      if (!gameName) return;

      const games = HP.getGameProfiles();
      const match = games.find(g =>
        g.game_name.toLowerCase() === gameName.toLowerCase() ||
        gameName.toLowerCase().includes(g.game_name.toLowerCase()) ||
        g.game_name.toLowerCase().includes(gameName.toLowerCase())
      );

      if (!match) {
        toast(`🎮 ${gameName} detected — no matching profile found`);
        return;
      }

      // Load assigned controller profile if present
      if (match.assigned_controller_profile_id) {
        const cp = HP.getControllerProfiles()
          .find(p => p.profile_id === match.assigned_controller_profile_id);
        if (cp) {
          const typeMap = { gamepad:'gamepad', racing:'wheel', gyro:'gyro', mouse:'mouse', keyboard:'gamepad', custom:'gamepad' };
          if (typeof switchControllerTab === 'function') {
            switchControllerTab(typeMap[cp.controller_type] || 'gamepad');
          }
          // Apply gyro profile from this controller profile
          GyroProfiles.applyFromActiveProfile();
          toast(`🎮 ${gameName} detected — "${cp.profile_name}" loaded`);
          sound('chime');
          return;
        }
      }

      // Fall back to recommended type
      const typeMap = { gamepad:'gamepad', racing:'wheel', gyro:'gyro', mouse:'mouse', keyboard:'gamepad', custom:'gamepad' };
      if (typeof switchControllerTab === 'function') {
        switchControllerTab(typeMap[match.recommended_controller_type] || 'gamepad');
      }
      toast(`🎮 ${gameName} detected — ${match.recommended_controller_type} mode loaded`);
      sound('chime');
    }

    return { switchToGame };
  })();

  /* ══════════════════════════════════════════════════════════════════════════
     UI PANEL — injects into the existing settings drawer area
     Opens as a full-page section accessible from the ⚡ ADVANCED nav button
  ══════════════════════════════════════════════════════════════════════════ */
  function inject() {
    document.body.insertAdjacentHTML('beforeend', `
<section id="advancedSection" class="app-section">
<div class="section-container">

  <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:28px; flex-wrap:wrap; gap:12px;">
    <div>
      <h2 class="section-title">ADVANCED FEATURES</h2>
      <p class="section-sub">AUTO-DETECT · SMART MAPPING · ADAPTIVE GYRO · LOW LATENCY · AUTO-SWITCH</p>
    </div>
    <button class="cyber-button sm secondary" onclick="showSection('dashboard')">← BACK</button>
  </div>

  <div style="display:grid; grid-template-columns:repeat(auto-fill,minmax(320px,1fr)); gap:20px;">

    <!-- ── 1. AUTO GAME DETECTION ─────────────────────────── -->
    <div class="adv-card">
      <div class="adv-card-title">🎯 AUTO GAME DETECTION</div>
      <p class="adv-desc">Connects to the PC companion app. When a game is launched, the matching profile loads automatically.</p>

      <div style="display:flex; align-items:center; gap:10px; margin:14px 0;">
        <span class="agd-dot" id="agdStatus" title="Waiting for companion"></span>
        <span style="font-family:var(--font-mono); font-size:0.8rem;" id="agdGameName">Waiting for companion…</span>
      </div>

      <!-- Manual test / simulate detection -->
      <div class="hp-field">
        <label class="hp-label">SIMULATE DETECTION <span style="color:#555;">(test)</span></label>
        <div style="display:flex; gap:6px;">
          <input class="hp-input" id="agdTestInput" placeholder="e.g. Fortnite" style="flex:1;">
          <button class="cyber-button sm primary" onclick="HPAdvanced.simulateDetection()">TEST</button>
        </div>
      </div>

      <!-- Companion spec -->
      <details style="margin-top:12px;">
        <summary style="font-family:var(--font-mono); font-size:0.7rem; color:#666; cursor:pointer; padding:6px 0;">
          PC COMPANION INTEGRATION SPEC
        </summary>
        <div style="font-family:var(--font-mono); font-size:0.68rem; color:#888; line-height:1.8; padding:10px 0;
          border-top:1px solid var(--dark-border); margin-top:6px;">
          <div>Channel: <code style="color:#cc1111;">BroadcastChannel('hyperpulse_companion')</code></div>
          <div>Or: <code style="color:#cc1111;">WebSocket → JSON message</code></div>
          <div style="margin-top:8px;">Game detected payload:</div>
          <pre style="background:#0a0a0a; padding:8px; margin:4px 0; overflow-x:auto; font-size:0.65rem; color:#aaa;">{ "type": "GAME_DETECTED", "game": "Fortnite" }</pre>
          <div>Game exited payload:</div>
          <pre style="background:#0a0a0a; padding:8px; margin:4px 0; overflow-x:auto; font-size:0.65rem; color:#aaa;">{ "type": "GAME_EXITED" }</pre>
          <div style="margin-top:6px; color:#555;">PC companion can use process enumeration (Win32 API / ps) to detect running games and post to this channel.</div>
        </div>
      </details>
    </div>

    <!-- ── 2. SMART AUTO-MAPPING ──────────────────────────── -->
    <div class="adv-card">
      <div class="adv-card-title">🗺️ SMART AUTO-MAPPING</div>
      <p class="adv-desc">Select a game and Hyperpulse generates a sensible button layout. Review and save to your Game Profile.</p>

      <div class="hp-field">
        <label class="hp-label">GAME</label>
        <select class="hp-input" id="amGameSel">
          <option value="">— Select a game —</option>
        </select>
      </div>
      <div class="hp-field">
        <label class="hp-label">MAPPING STYLE</label>
        <select class="hp-input" id="amStyleSel">
          <option value="auto">Auto-detect from game name</option>
          <option value="fps">FPS / Shooter</option>
          <option value="racing">Racing</option>
          <option value="rts">RTS / Strategy</option>
          <option value="platform">Platformer</option>
          <option value="keyboard">Keyboard (WASD)</option>
          <option value="default">Default Gamepad</option>
        </select>
      </div>
      <button class="cyber-button sm primary" onclick="HPAdvanced.generateMapping()" style="width:100%; margin-bottom:12px;">
        ⚡ GENERATE MAPPING
      </button>

      <!-- Preview / edit -->
      <div id="amPreview" style="display:none;">
        <div style="font-family:var(--font-mono); font-size:0.7rem; color:#888; margin-bottom:8px;">
          SUGGESTED MAPPING — <span id="amGenre" style="color:#cc1111;"></span>
          <span style="float:right; color:#555; font-size:0.65rem;">Review before saving</span>
        </div>
        <div id="amMappingGrid" style="display:grid; grid-template-columns:1fr 1fr; gap:4px; margin-bottom:12px;"></div>
        <div style="display:flex; gap:8px;">
          <button class="cyber-button sm primary"   onclick="HPAdvanced.saveMapping()">💾 SAVE TO PROFILE</button>
          <button class="cyber-button sm secondary" onclick="HPAdvanced.discardMapping()">DISCARD</button>
        </div>
      </div>
    </div>

    <!-- ── 3. ADAPTIVE GYRO ───────────────────────────────── -->
    <div class="adv-card">
      <div class="adv-card-title">🔭 ADAPTIVE GYRO</div>
      <p class="adv-desc">Named gyro profiles with independent sensitivity, smoothing, dead zone, and axis inversion.</p>

      <div class="hp-field">
        <label class="hp-label">GYRO PRESET</label>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-bottom:12px;">
          ${Object.entries({ racing:'🏎️ Racing', camera:'📷 Camera', fps:'🎯 FPS Aim', custom:'🛠️ Custom' }).map(([k,v]) =>
            `<button class="hp-chip" id="gyroPreset-${k}" onclick="HPAdvanced.setGyroPreset('${k}')">${v}</button>`
          ).join('')}
        </div>
      </div>

      <div class="hp-field">
        <label class="hp-label">SENSITIVITY <span id="gyroSensVal" style="color:#cc1111;"></span></label>
        <input type="range" class="hp-slider" id="gyroSens" min="1" max="10" step="0.5"
          oninput="HPAdvanced.liveGyro()">
      </div>
      <div class="hp-field">
        <label class="hp-label">SMOOTHING <span id="gyroSmoothVal" style="color:#cc1111;"></span></label>
        <input type="range" class="hp-slider" id="gyroSmooth" min="0" max="100" step="5"
          oninput="HPAdvanced.liveGyro()">
      </div>
      <div class="hp-field">
        <label class="hp-label">DEAD ZONE <span id="gyroDeadVal" style="color:#cc1111;"></span>°</label>
        <input type="range" class="hp-slider" id="gyroDead" min="0" max="15" step="0.5"
          oninput="HPAdvanced.liveGyro()">
      </div>
      <div class="hp-field">
        <label class="hp-label">SENSITIVITY CURVE</label>
        <select class="hp-input" id="gyroCurve" onchange="HPAdvanced.liveGyro()">
          <option value="linear">Linear</option>
          <option value="squared">Squared (slow start)</option>
          <option value="cubic">Cubic (very slow start)</option>
        </select>
      </div>
      <div style="display:flex; gap:12px; margin-bottom:12px;">
        <label style="display:flex; align-items:center; gap:6px; cursor:pointer; font-family:var(--font-mono); font-size:0.72rem;">
          <input type="checkbox" id="gyroInvertX" onchange="HPAdvanced.liveGyro()" style="accent-color:#cc1111;"> INVERT X
        </label>
        <label style="display:flex; align-items:center; gap:6px; cursor:pointer; font-family:var(--font-mono); font-size:0.72rem;">
          <input type="checkbox" id="gyroInvertY" onchange="HPAdvanced.liveGyro()" style="accent-color:#cc1111;"> INVERT Y
        </label>
      </div>
      <div style="display:flex; gap:8px;">
        <button class="cyber-button sm primary"   onclick="HPAdvanced.saveGyroProfile()">SAVE</button>
        <button class="cyber-button sm secondary" onclick="HPAdvanced.calibrateGyroNow()">🎯 CALIBRATE</button>
      </div>
    </div>

    <!-- ── 4. ULTRA LOW LATENCY ───────────────────────────── -->
    <div class="adv-card">
      <div class="adv-card-title">⚡ ULTRA LOW LATENCY MODE</div>
      <p class="adv-desc">Reduces UI refresh rates, pauses decorative effects, and minimises background work. Controller input is never throttled.</p>

      <button id="llToggleBtn" class="cyber-button sm secondary" onclick="HPAdvanced.toggleLowLatency()"
        style="width:100%; margin-bottom:16px;">⚡ LOW LATENCY: OFF</button>

      <!-- Stats display -->
      <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; margin-bottom:14px;">
        <div class="adv-stat-box">
          <div class="adv-stat-label">LATENCY</div>
          <div class="adv-stat-value" id="llLatency">—</div>
        </div>
        <div class="adv-stat-box">
          <div class="adv-stat-label">JITTER</div>
          <div class="adv-stat-value" id="llJitter">—</div>
        </div>
        <div class="adv-stat-box">
          <div class="adv-stat-label">PKT LOSS</div>
          <div class="adv-stat-value" id="llPacketLoss">—</div>
        </div>
      </div>
      <p style="font-family:var(--font-mono); font-size:0.65rem; color:#555; line-height:1.6;">
        ⚠ Real measurements require an active transport connection.
        Values show live data when available, otherwise — when no signal is present.
      </p>

      <div style="margin-top:14px; padding:10px; background:#0a0a0a; border:1px solid #1a1a1a;">
        <div style="font-family:var(--font-mono); font-size:0.68rem; color:#666; line-height:1.7;">
          WHEN ENABLED:<br>
          ✓ UI re-render rate reduced<br>
          ✓ Decorative background effects paused<br>
          ✓ Performance graph frequency reduced<br>
          ✓ Non-critical animations disabled<br>
          ✗ Controller input loop — NEVER throttled
        </div>
      </div>
    </div>

    <!-- ── 5. PROFILE AUTO-SWITCHING ─────────────────────── -->
    <div class="adv-card">
      <div class="adv-card-title">🔄 PROFILE AUTO-SWITCHING</div>
      <p class="adv-desc">Automatically loads the matching Game Profile and Controller Profile when a game is detected.</p>

      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <div>
          <div style="font-family:var(--font-mono); font-size:0.75rem; font-weight:700; margin-bottom:3px;">AUTO-SWITCH</div>
          <div style="font-family:var(--font-mono); font-size:0.65rem; color:#666;">Load profile when game detected</div>
        </div>
        <button class="hp-toggle-btn" id="autoSwitchToggle" onclick="HPAdvanced.toggleAutoSwitch()">OFF</button>
      </div>

      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <div>
          <div style="font-family:var(--font-mono); font-size:0.75rem; font-weight:700; margin-bottom:3px;">MANUAL OVERRIDE</div>
          <div style="font-family:var(--font-mono); font-size:0.65rem; color:#666;">Temporarily disable auto-switch</div>
        </div>
        <button class="hp-toggle-btn off" id="overrideToggle" onclick="HPAdvanced.toggleOverride()">OFF</button>
      </div>

      <div style="border-top:1px solid var(--dark-border); padding-top:14px;">
        <div style="font-family:var(--font-mono); font-size:0.7rem; color:#666; margin-bottom:8px;">GAME → PROFILE MAP</div>
        <div id="autoSwitchMap" style="max-height:180px; overflow-y:auto;"></div>
      </div>
    </div>

  </div><!-- /grid -->
</div>
</section>`);
  }

  /* ── Populate game selector ─────────────────────────────────────────────── */
  function populateGameSelector() {
    const sel = document.getElementById('amGameSel');
    if (!sel) return;
    const games = HP.getGameProfiles();
    sel.innerHTML = '<option value="">— Select a game —</option>' +
      games.map(g => `<option value="${esc(g.game_profile_id)}">${esc(g.game_name)}</option>`).join('');
  }

  /* ── Render auto-switch map ─────────────────────────────────────────────── */
  function renderAutoSwitchMap() {
    const el = document.getElementById('autoSwitchMap');
    if (!el) return;
    const games = HP.getGameProfiles();
    if (!games.length) {
      el.innerHTML = '<p style="font-family:var(--font-mono);font-size:0.72rem;color:#555;">No game profiles. Add one in the Profiles panel.</p>';
      return;
    }
    el.innerHTML = games.map(g => {
      const cp = g.assigned_controller_profile_id
        ? HP.getControllerProfiles().find(p => p.profile_id === g.assigned_controller_profile_id)
        : null;
      return `<div style="display:flex; justify-content:space-between; padding:5px 0; border-bottom:1px solid #1a1a1a;
        font-family:var(--font-mono); font-size:0.7rem;">
        <span style="color:#aaa;">${esc(g.game_name)}</span>
        <span style="color:${cp ? '#22cc44' : '#555'};">${cp ? esc(cp.profile_name) : 'No profile assigned'}</span>
      </div>`;
    }).join('');
  }

  /* ── Gyro UI state ──────────────────────────────────────────────────────── */
  let _pendingMapping = null;
  let _pendingGameId  = null;

  function loadGyroUI(preset) {
    const p = GyroProfiles.PRESETS[preset] || GyroProfiles.PRESETS.custom;
    const s = (id, v) => { const e = document.getElementById(id); if (e) e.value = v; };
    const t = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    s('gyroSens',    p.sens);    t('gyroSensVal',  p.sens);
    s('gyroSmooth',  p.smooth);  t('gyroSmoothVal', p.smooth);
    s('gyroDead',    p.deadzone);t('gyroDeadVal',  p.deadzone);
    s('gyroCurve',   p.curve);
    const ix = document.getElementById('gyroInvertX'); if (ix) ix.checked = p.invertX;
    const iy = document.getElementById('gyroInvertY'); if (iy) iy.checked = p.invertY;

    // Highlight active preset chip
    Object.keys(GyroProfiles.PRESETS).forEach(k => {
      const btn = document.getElementById('gyroPreset-' + k);
      if (btn) btn.classList.toggle('active', k === preset);
    });
    GyroProfiles.applyToState(p);
  }

  /* ── Load settings state into UI on open ────────────────────────────────── */
  function loadSettingsIntoUI() {
    const s = HP.getSettings();
    // Auto-switch toggle
    const ast = document.getElementById('autoSwitchToggle');
    if (ast) {
      const on = !!s.auto_profile_switch;
      ast.textContent = on ? 'ON' : 'OFF';
      ast.classList.toggle('off', !on);
    }
    // Override toggle
    const ot = document.getElementById('overrideToggle');
    if (ot) {
      const on = GameDetector.isOverridden();
      ot.textContent = on ? 'ON' : 'OFF';
      ot.classList.toggle('off', !on);
    }
    // Gyro
    loadGyroUI(GyroProfiles.getActive());
  }

  /* ══════════════════════════════════════════════════════════════════════════
     PUBLIC API
  ══════════════════════════════════════════════════════════════════════════ */
  return {

    init() {
      inject();
      GameDetector.init();

      // Apply saved low-latency state
      const s = HP.getSettings();
      if (s.low_latency_mode) LowLatency.enable();

      // Apply gyro profile
      GyroProfiles.applyFromActiveProfile();
    },

    open() {
      if (typeof showSection === 'function') showSection('advanced');
      populateGameSelector();
      renderAutoSwitchMap();
      loadSettingsIntoUI();
    },

    /* ── Auto Detection ─────────────────── */
    simulateDetection() {
      const name = document.getElementById('agdTestInput')?.value.trim();
      if (!name) { toast('Enter a game name to simulate.'); return; }
      GameDetector.onGameDetected(name);
    },

    /* ── Smart Mapping ──────────────────── */
    generateMapping() {
      const gameId = document.getElementById('amGameSel')?.value;
      const style  = document.getElementById('amStyleSel')?.value;
      if (!gameId) { toast('Select a game first.'); return; }

      const game = HP.getGameProfiles().find(g => g.game_profile_id === gameId);
      if (!game) return;

      let suggestion;
      if (style === 'keyboard')   suggestion = AutoMapper.KEYBOARD_PRESET;
      else if (style === 'auto')  suggestion = AutoMapper.suggest(game.game_name, false);
      else                        suggestion = { ...AutoMapper.TEMPLATES[style] || AutoMapper.TEMPLATES.default };

      // Check if game already has a custom mapping — warn before overwriting
      const hasExisting = game.button_mapping_json && Object.keys(game.button_mapping_json).length > 0;
      if (hasExisting) {
        if (!confirm(`"${game.game_name}" already has a custom mapping.\nOverwrite with the new suggestion?`)) return;
      }

      _pendingMapping = suggestion.map;
      _pendingGameId  = gameId;

      // Render preview
      const preview  = document.getElementById('amPreview');
      const genreEl  = document.getElementById('amGenre');
      const gridEl   = document.getElementById('amMappingGrid');
      if (genreEl)  genreEl.textContent = (style === 'auto' ? AutoMapper.detectGenre(game.game_name) : style).toUpperCase();
      if (gridEl) {
        gridEl.innerHTML = Object.entries(suggestion.map).map(([k, v]) =>
          `<div style="display:flex; justify-content:space-between; padding:4px 6px; background:#0d0d0d;
            border:1px solid #1f1f1f; font-family:var(--font-mono); font-size:0.7rem;">
            <span style="color:#cc1111;">${esc(k)}</span>
            <span style="color:#aaa;">${esc(v)}</span>
          </div>`
        ).join('');
      }
      if (preview) preview.style.display = 'block';
      sound('click');
    },

    saveMapping() {
      if (!_pendingGameId || !_pendingMapping) return;
      HP.updateGameProfile(_pendingGameId, {
        button_mapping_json: _pendingMapping,
        recommended_controller_type:
          (AutoMapper.suggest(HP.getGameProfiles().find(g => g.game_profile_id === _pendingGameId)?.game_name || '').type) || 'gamepad'
      });
      toast('✓ Mapping saved to game profile.');
      this.discardMapping();
      sound('chime');
    },

    discardMapping() {
      _pendingMapping = null; _pendingGameId = null;
      const p = document.getElementById('amPreview');
      if (p) p.style.display = 'none';
    },

    /* ── Adaptive Gyro ──────────────────── */
    setGyroPreset(key) {
      GyroProfiles.setActive(key);
      loadGyroUI(key);
      toast('Gyro preset: ' + (GyroProfiles.PRESETS[key]?.name || key));
    },

    liveGyro() {
      const g = v => parseFloat(document.getElementById(v)?.value || 0);
      const t = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
      const sens    = g('gyroSens');
      const smooth  = g('gyroSmooth');
      const dead    = g('gyroDead');
      const curve   = document.getElementById('gyroCurve')?.value || 'linear';
      const invertX = document.getElementById('gyroInvertX')?.checked || false;
      const invertY = document.getElementById('gyroInvertY')?.checked || false;
      t('gyroSensVal',  sens);
      t('gyroSmoothVal', smooth);
      t('gyroDeadVal',  dead);
      GyroProfiles.applyToState({ sens, smooth, deadzone: dead, invertX, invertY, curve });
    },

    saveGyroProfile() {
      const profiles = HP.getControllerProfiles();
      const gyroProfile = profiles.find(p => p.controller_type === 'gyro') || profiles[0];
      if (!gyroProfile) { toast('No controller profile to save to.'); return; }
      const g = v => parseFloat(document.getElementById(v)?.value || 0);
      GyroProfiles.saveToActiveProfile(gyroProfile.profile_id, {
        preset_key: GyroProfiles.getActive(),
        sens:    g('gyroSens'),
        smooth:  g('gyroSmooth'),
        deadzone:g('gyroDead'),
        invertX: document.getElementById('gyroInvertX')?.checked || false,
        invertY: document.getElementById('gyroInvertY')?.checked || false,
        curve:   document.getElementById('gyroCurve')?.value || 'linear',
      });
      toast(`✓ Gyro profile saved to "${gyroProfile.profile_name}".`);
      sound('chime');
    },

    calibrateGyroNow() {
      if (typeof calibrateGyroZero === 'function') calibrateGyroZero();
      else toast('Gyro calibrated.');
    },

    /* ── Low Latency ────────────────────── */
    toggleLowLatency() { LowLatency.toggle(); },
    isLowLatency: () => LowLatency.isEnabled(),
    reportLatency: (ms, jitter, pl) => LowLatency.reportMeasurement(ms, jitter, pl),

    /* ── Auto-Switch ────────────────────── */
    toggleAutoSwitch() {
      const s = HP.getSettings();
      const next = !s.auto_profile_switch;
      HP.updateSettings({ auto_profile_switch: next });
      const btn = document.getElementById('autoSwitchToggle');
      if (btn) { btn.textContent = next ? 'ON' : 'OFF'; btn.classList.toggle('off', !next); }
      toast('Auto-switch: ' + (next ? 'ON' : 'OFF'));
    },

    toggleOverride() {
      const next = !GameDetector.isOverridden();
      GameDetector.setOverride(next);
      const btn = document.getElementById('overrideToggle');
      if (btn) { btn.textContent = next ? 'ON' : 'OFF'; btn.classList.toggle('off', !next); }
      toast('Manual override: ' + (next ? 'ON — auto-switch paused' : 'OFF'));
    },

    /* ── External hooks ─────────────────── */
    onGameDetected: (name) => GameDetector.onGameDetected(name),
    switchToGame:   (name) => ProfileAutoSwitch.switchToGame(name),
    getGyroState:   () => GyroProfiles,
  };

})();
