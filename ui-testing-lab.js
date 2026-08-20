/* ==========================================================================
   HYPERPULSE // CONTROLLER TESTING LAB (ui-testing-lab.js)
   Interactive tester: Buttons, D-Pad, Sticks, Triggers, Gyro/Accel,
   Mouse, Keyboard, and Telemetry. Live input values from app.js state.
   ========================================================================== */

(function () {

  let _deviceId = null;
  let _log = [];          // circular buffer, max 100
  let _pressCount = 0;
  let _dpadCount  = 0;
  let _maxL2 = 0, _maxR2 = 0;
  let _gyroZero = { pitch: 0, roll: 0, yaw: 0 };
  let _keyStates = {};    // keyboard key states for visual
  let _mousePos  = { x: 0, y: 0 };
  let _mouseDown = { left: false, middle: false, right: false };
  let _rafId = null;

  // --- Keyboard layout -------------------------------------------------------
  const KB_ROWS = [
    ['Esc','F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11','F12'],
    ['`','1','2','3','4','5','6','7','8','9','0','-','=','Backspace'],
    ['Tab','Q','W','E','R','T','Y','U','I','O','P','[',']','\\'],
    ['CapsLock','A','S','D','F','G','H','J','K','L',';',"'",'Enter'],
    ['Shift','Z','X','C','V','B','N','M',',','.','/','Shift↑'],
    ['Ctrl','Alt','Space','Alt','Ctrl']
  ];

  function esc(s) {
    return String(s || '').replace(/[&<>"']/g, c =>
      ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }

  // --------------------------------------------------------------------------
  // HTML injection
  // --------------------------------------------------------------------------
  function inject() {
    document.body.insertAdjacentHTML('beforeend', `
<section id="testingLabSection" class="app-section">
<div class="section-container">

  <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:28px; flex-wrap:wrap; gap:12px;">
    <div>
      <h2 class="section-title">CONTROLLER TESTING LAB</h2>
      <p class="section-sub">REAL-TIME INPUT VISUALIZATION &amp; DEBUG TOOLS</p>
    </div>
    <button class="cyber-button sm secondary" onclick="HPTestingLab.close()">← BACK</button>
  </div>

  <!-- Tab navigation -->
  <div class="test-tab-nav" role="tablist" style="flex-wrap:wrap; gap:4px;">
    <button class="test-tab-btn active" role="tab" aria-selected="true"  onclick="HPTestingLab.switchTestTab('buttons')">🔘 BUTTONS</button>
    <button class="test-tab-btn"        role="tab" aria-selected="false" onclick="HPTestingLab.switchTestTab('sticks')">🕹 STICKS</button>
    <button class="test-tab-btn"        role="tab" aria-selected="false" onclick="HPTestingLab.switchTestTab('dpad')">⬇ D-PAD</button>
    <button class="test-tab-btn"        role="tab" aria-selected="false" onclick="HPTestingLab.switchTestTab('triggers')">💠 TRIGGERS</button>
    <button class="test-tab-btn"        role="tab" aria-selected="false" onclick="HPTestingLab.switchTestTab('gyro')">🔭 GYRO/ACCEL</button>
    <button class="test-tab-btn"        role="tab" aria-selected="false" onclick="HPTestingLab.switchTestTab('mouse')">🖱 MOUSE</button>
    <button class="test-tab-btn"        role="tab" aria-selected="false" onclick="HPTestingLab.switchTestTab('keyboard')">⌨ KEYBOARD</button>
    <button class="test-tab-btn"        role="tab" aria-selected="false" onclick="HPTestingLab.switchTestTab('telemetry')">📊 TELEMETRY</button>
  </div>

  <!-- ── TAB: BUTTONS ─────────────────────────────────────────────────── -->
  <div id="testButtonsTab" class="test-tab-content active" role="tabpanel">
    <h3 style="margin-bottom:6px;">BUTTON STATE MONITOR</h3>
    <p class="test-desc">Press any controller button to see live state.</p>
    <div class="button-test-grid" style="margin:20px 0;">
      ${['A','B','X','Y','L1','R1','L2','R2','START','SELECT'].map(b => `
        <div class="button-test-item" id="tBtn-${b}" aria-label="${b} button">
          <span class="btn-label">${b}</span>
          <span class="btn-state">RELEASED</span>
        </div>`).join('')}
    </div>
    <div class="test-stats">
      <div class="stat-item"><span class="stat-label">TOTAL PRESSES</span><span class="stat-value" id="btnPressCount">0</span></div>
      <div class="stat-item"><span class="stat-label">LAST BUTTON</span><span class="stat-value" id="btnLastPressed">—</span></div>
    </div>
  </div>

  <!-- ── TAB: STICKS ──────────────────────────────────────────────────── -->
  <div id="testSticksTab" class="test-tab-content" style="display:none;" role="tabpanel">
    <h3 style="margin-bottom:6px;">ANALOG STICK POSITIONS</h3>
    <p class="test-desc">Move sticks to visualize X/Y position and dead zone ring.</p>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:32px; margin:24px 0; flex-wrap:wrap;">
      ${['left','right'].map(s => {
        const u = s === 'left' ? 'L' : 'R';
        return `<div style="text-align:center;">
          <h4 style="margin-bottom:10px;">${s.toUpperCase()} STICK</h4>
          <svg id="${s}StickSvg" width="180" height="180" viewBox="-100 -100 200 200" style="display:block;margin:0 auto;overflow:visible;">
            <circle cx="0" cy="0" r="98" fill="none" stroke="#2a2a2a" stroke-width="2"/>
            <circle cx="0" cy="0" r="12" fill="none" stroke="#555" stroke-width="1" stroke-dasharray="3,2"/>
            <line x1="-98" y1="0" x2="98" y2="0" stroke="#222" stroke-width="1"/>
            <line x1="0" y1="-98" x2="0" y2="98" stroke="#222" stroke-width="1"/>
            <circle id="${s}StickDot" cx="0" cy="0" r="9" fill="#cc1111"/>
          </svg>
          <div class="stick-values" style="margin-top:10px; font-family:var(--font-mono); font-size:0.8rem; display:grid; grid-template-columns:1fr 1fr 1fr; gap:6px;">
            <div>X: <span id="${u}X">0.00</span></div>
            <div>Y: <span id="${u}Y">0.00</span></div>
            <div>∥: <span id="${u}D">0.00</span></div>
          </div>
        </div>`;
      }).join('')}
    </div>
  </div>

  <!-- ── TAB: D-PAD ───────────────────────────────────────────────────── -->
  <div id="testDpadTab" class="test-tab-content" style="display:none;" role="tabpanel">
    <h3 style="margin-bottom:6px;">D-PAD DIRECTIONAL INPUT</h3>
    <p class="test-desc">Press D-Pad to test individual directions and combinations.</p>
    <div class="dpad-test-container" style="display:flex; justify-content:center; margin:30px 0;">
      <div style="display:grid; grid-template-columns:60px 60px 60px; grid-template-rows:60px 60px 60px; gap:4px;">
        <div></div>
        <div class="dpad-btn" id="dpad-UP"   style="display:flex;align-items:center;justify-content:center;background:#1a1a1a;border:1px solid #333;font-family:var(--font-mono);font-size:0.75rem;cursor:default;">▲</div>
        <div></div>
        <div class="dpad-btn" id="dpad-LEFT"  style="display:flex;align-items:center;justify-content:center;background:#1a1a1a;border:1px solid #333;font-family:var(--font-mono);font-size:0.75rem;cursor:default;">◄</div>
        <div style="background:#111;border:1px solid #222;display:flex;align-items:center;justify-content:center;"><div style="width:12px;height:12px;background:#333;border-radius:50%;"></div></div>
        <div class="dpad-btn" id="dpad-RIGHT" style="display:flex;align-items:center;justify-content:center;background:#1a1a1a;border:1px solid #333;font-family:var(--font-mono);font-size:0.75rem;cursor:default;">►</div>
        <div></div>
        <div class="dpad-btn" id="dpad-DOWN"  style="display:flex;align-items:center;justify-content:center;background:#1a1a1a;border:1px solid #333;font-family:var(--font-mono);font-size:0.75rem;cursor:default;">▼</div>
        <div></div>
      </div>
    </div>
    <div class="test-stats">
      <div class="stat-item"><span class="stat-label">TOTAL PRESSES</span><span class="stat-value" id="dpadPressCount">0</span></div>
      <div class="stat-item"><span class="stat-label">DIRECTION</span><span class="stat-value" id="dpadCurrent">—</span></div>
      <div class="stat-item"><span class="stat-label">COMBINATION</span><span class="stat-value" id="dpadCombo">NONE</span></div>
    </div>
  </div>

  <!-- ── TAB: TRIGGERS ────────────────────────────────────────────────── -->
  <div id="testTriggersTab" class="test-tab-content" style="display:none;" role="tabpanel">
    <h3 style="margin-bottom:6px;">ANALOG TRIGGER PRESSURE</h3>
    <p class="test-desc">Pull triggers — see pressure value 0–100%.</p>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:40px; margin:28px 0;">
      ${['L2','R2'].map(t => `
        <div>
          <h4 style="margin-bottom:14px;">${t} TRIGGER</h4>
          <div style="display:flex; align-items:stretch; gap:12px; height:180px;">
            <div style="width:32px; background:#111; border:1px solid #333; border-radius:4px; overflow:hidden; position:relative; flex-shrink:0;">
              <div id="trBar-${t}" style="position:absolute; bottom:0; width:100%; background:#cc1111; transition:height 0.05s;"></div>
            </div>
            <div style="display:flex; flex-direction:column; justify-content:space-between; font-family:var(--font-mono); font-size:0.75rem; color:#666;">
              <span>100%</span><span>75%</span><span>50%</span><span>25%</span><span>0%</span>
            </div>
          </div>
          <div style="margin-top:10px; font-family:var(--font-mono);">
            <div>CURRENT: <span id="trVal-${t}" style="color:#cc1111; font-size:1.1rem;">0%</span></div>
            <div style="margin-top:4px; font-size:0.75rem; color:#666;">PEAK: <span id="trMax-${t}">0%</span></div>
          </div>
        </div>`).join('')}
    </div>
  </div>

  <!-- ── TAB: GYRO / ACCELEROMETER ────────────────────────────────────── -->
  <div id="testGyroTab" class="test-tab-content" style="display:none;" role="tabpanel">
    <h3 style="margin-bottom:6px;">GYROSCOPE &amp; ACCELEROMETER</h3>
    <p class="test-desc">Tilt / rotate your device to see live orientation data.</p>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:32px; margin:24px 0; flex-wrap:wrap;">
      <div>
        <h4 style="margin-bottom:12px;">ORIENTATION (°)</h4>
        <div style="font-family:var(--font-mono); display:flex; flex-direction:column; gap:10px;">
          ${['Pitch','Roll','Yaw'].map(axis => `
            <div>
              <div style="font-size:0.7rem; color:#666; margin-bottom:4px;">${axis.toUpperCase()}</div>
              <div style="display:flex; align-items:center; gap:10px;">
                <div style="flex:1; height:6px; background:#1a1a1a; border-radius:3px; overflow:hidden;">
                  <div id="gyroBar-${axis}" style="height:100%; width:50%; background:#cc1111; transition:width 0.1s;"></div>
                </div>
                <span id="gyro${axis}" style="min-width:55px; text-align:right;">0.0°</span>
              </div>
            </div>`).join('')}
        </div>
        <h4 style="margin-top:20px; margin-bottom:12px;">ACCELEROMETER (m/s²)</h4>
        <div style="font-family:var(--font-mono); display:flex; flex-direction:column; gap:8px;">
          ${['X','Y','Z'].map(a => `
            <div style="display:flex; justify-content:space-between; font-size:0.8rem;">
              <span style="color:#666;">ACCEL-${a}:</span>
              <span id="accel${a}">0.00</span>
            </div>`).join('')}
        </div>
        <button class="cyber-button sm secondary" onclick="HPTestingLab.calibrateGyro()" style="margin-top:16px; width:100%;">CALIBRATE ZERO</button>
      </div>
      <div style="text-align:center;">
        <h4 style="margin-bottom:10px;">ARTIFICIAL HORIZON</h4>
        <canvas id="horizonTestCanvas" width="220" height="180"
          style="border:1px solid var(--dark-border); display:block; margin:0 auto; background:#080808; border-radius:4px;"></canvas>
        <div style="margin-top:8px; font-family:var(--font-mono); font-size:0.7rem; color:#555;">Roll · Pitch visualization</div>
      </div>
    </div>
  </div>

  <!-- ── TAB: MOUSE ───────────────────────────────────────────────────── -->
  <div id="testMouseTab" class="test-tab-content" style="display:none;" role="tabpanel">
    <h3 style="margin-bottom:6px;">MOUSE / TRACKPAD</h3>
    <p class="test-desc">Move, click, and scroll to see live mouse state.</p>
    <div style="display:grid; grid-template-columns:1fr auto; gap:28px; margin:20px 0; align-items:start; flex-wrap:wrap;">
      <!-- Tracking area -->
      <div>
        <div style="font-family:var(--font-mono); font-size:0.7rem; color:#666; margin-bottom:6px;">TRACKING AREA — move cursor here</div>
        <div id="mouseTrackArea"
          style="width:100%; height:240px; background:#0d0d0d; border:2px solid #222; border-radius:4px; position:relative; cursor:crosshair; overflow:hidden;"
          onmousemove="HPTestingLab._onMouseMove(event)"
          onmousedown="HPTestingLab._onMouseDown(event)"
          onmouseup="HPTestingLab._onMouseUp(event)"
          onmouseleave="HPTestingLab._onMouseLeave(event)"
          ontouchstart="HPTestingLab._onMouseDown(event)"
          ontouchmove="HPTestingLab._onMouseMove(event)"
          ontouchend="HPTestingLab._onMouseUp(event)">
          <div id="mouseDot" style="position:absolute; width:12px; height:12px; background:#cc1111; border-radius:50%; transform:translate(-50%,-50%); pointer-events:none; left:50%; top:50%; transition:left 0.02s, top 0.02s;"></div>
          <div id="mouseTrail" style="position:absolute; inset:0; pointer-events:none;"></div>
          <div style="position:absolute; bottom:6px; right:10px; font-family:var(--font-mono); font-size:0.65rem; color:#333;">HYPERPULSE MOUSE TESTER</div>
        </div>
        <div style="display:flex; gap:8px; margin-top:10px;">
          <button class="cyber-button sm secondary" id="mouseTestL" onmousedown="HPTestingLab._onMouseBtnDown('left')" onmouseup="HPTestingLab._onMouseBtnUp('left')">LEFT CLICK</button>
          <button class="cyber-button sm secondary" id="mouseTestM" onmousedown="HPTestingLab._onMouseBtnDown('middle')" onmouseup="HPTestingLab._onMouseBtnUp('middle')">MIDDLE</button>
          <button class="cyber-button sm secondary" id="mouseTestR" onmousedown="HPTestingLab._onMouseBtnDown('right')" onmouseup="HPTestingLab._onMouseBtnUp('right')" oncontextmenu="return false;">RIGHT CLICK</button>
        </div>
      </div>
      <!-- Stats -->
      <div style="min-width:160px;">
        <div style="font-family:var(--font-mono); font-size:0.7rem; color:#666; margin-bottom:10px;">MOUSE STATE</div>
        <div style="display:flex; flex-direction:column; gap:8px; font-family:var(--font-mono); font-size:0.8rem;">
          <div>X: <span id="mouseX" style="color:#cc1111;">0</span></div>
          <div>Y: <span id="mouseY" style="color:#cc1111;">0</span></div>
          <div>ΔX: <span id="mouseDX">0</span></div>
          <div>ΔY: <span id="mouseDY">0</span></div>
          <div style="margin-top:4px; display:flex; flex-direction:column; gap:6px;">
            ${['left','middle','right'].map(b => `
              <div style="display:flex; align-items:center; gap:8px;">
                <div id="mouseBtnDot-${b}" style="width:10px;height:10px;border-radius:50%;background:#222;border:1px solid #444;flex-shrink:0;"></div>
                <span style="text-transform:uppercase; font-size:0.7rem;">${b}</span>
              </div>`).join('')}
          </div>
          <div style="margin-top:8px; font-size:0.7rem; color:#666;">CLICK COUNT: <span id="mouseClickCount">0</span></div>
        </div>
      </div>
    </div>
  </div>

  <!-- ── TAB: KEYBOARD ────────────────────────────────────────────────── -->
  <div id="testKeyboardTab" class="test-tab-content" style="display:none;" role="tabpanel">
    <h3 style="margin-bottom:6px;">KEYBOARD INPUT</h3>
    <p class="test-desc">Focus this page and press any key to see live state. Keys light up on press.</p>
    <div id="kbContainer" style="margin:20px 0; overflow-x:auto;"></div>
    <div style="display:flex; gap:20px; flex-wrap:wrap; margin-top:14px;">
      <div class="test-stats" style="flex:1;">
        <div class="stat-item"><span class="stat-label">LAST KEY</span><span class="stat-value" id="kbLastKey">—</span></div>
        <div class="stat-item"><span class="stat-label">KEY CODE</span><span class="stat-value" id="kbLastCode">—</span></div>
        <div class="stat-item"><span class="stat-label">TOTAL PRESSES</span><span class="stat-value" id="kbPressCount">0</span></div>
        <div class="stat-item"><span class="stat-label">KEYS HELD</span><span class="stat-value" id="kbHeldCount">0</span></div>
      </div>
    </div>
    <button class="cyber-button sm secondary" onclick="HPTestingLab._clearKeyboard()" style="margin-top:10px;">CLEAR ALL</button>
  </div>

  <!-- ── TAB: TELEMETRY ───────────────────────────────────────────────── -->
  <div id="testTelemetryTab" class="test-tab-content" style="display:none;" role="tabpanel">
    <h3 style="margin-bottom:6px;">INPUT TELEMETRY &amp; STATISTICS</h3>
    <p class="test-desc">Real-time event log and performance metrics.</p>
    <div class="telemetry-grid" style="margin:16px 0;">
      <div class="telemetry-stat"><span class="stat-label">POLLING RATE</span><span class="stat-value" id="tPollingRate">0 Hz</span></div>
      <div class="telemetry-stat"><span class="stat-label">AVG LATENCY</span><span class="stat-value" id="tLatency">0 ms</span></div>
      <div class="telemetry-stat"><span class="stat-label">TOTAL EVENTS</span><span class="stat-value" id="tEventCount">0</span></div>
      <div class="telemetry-stat"><span class="stat-label">EVENTS / SEC</span><span class="stat-value" id="tEventsPerSec">0</span></div>
    </div>
    <h4 style="margin-bottom:8px;">INPUT LOG (last 50 events)</h4>
    <div style="height:300px; overflow-y:auto; background:#0a0a0a; border:1px solid #222; padding:8px;">
      <div id="tLogList" style="font-family:var(--font-mono); font-size:0.72rem;"></div>
    </div>
    <div style="display:flex; gap:8px; margin-top:12px; flex-wrap:wrap;">
      <button class="cyber-button sm secondary" onclick="HPTestingLab.clearTelemetry()">CLEAR LOG</button>
      <button class="cyber-button sm secondary" onclick="HPTestingLab.exportTelemetry()">EXPORT CSV</button>
    </div>
  </div>

</div>
</section>`);

    buildKeyboard();
    bindKeyboardListeners();
  }

  // --------------------------------------------------------------------------
  // Keyboard visual builder
  // --------------------------------------------------------------------------
  function buildKeyboard() {
    const container = document.getElementById('kbContainer');
    if (!container) return;
    container.innerHTML = KB_ROWS.map(row => `
      <div style="display:flex; gap:3px; margin-bottom:3px; flex-wrap:nowrap;">
        ${row.map(key => {
          const w = key === 'Space' ? '200px' : key === 'Backspace' ? '80px' : key === 'Enter' ? '72px' :
                    key === 'Shift' || key === 'Shift↑' ? '90px' : key === 'CapsLock' || key === 'Tab' || key === 'Ctrl' || key === 'Alt' ? '64px' : '38px';
          const id = 'kbKey-' + key.replace(/[^a-zA-Z0-9]/g, '_');
          return `<div id="${id}" data-key="${esc(key)}"
            style="min-width:${w}; height:34px; background:#131313; border:1px solid #2a2a2a; border-radius:3px;
                   display:flex; align-items:center; justify-content:center; padding:0 4px;
                   font-family:var(--font-mono); font-size:0.6rem; color:#555; white-space:nowrap;
                   transition:background 0.06s, color 0.06s; user-select:none;">${esc(key)}</div>`;
        }).join('')}
      </div>`).join('');
  }

  function bindKeyboardListeners() {
    let _kbPressCount = 0;
    document.addEventListener('keydown', (e) => {
      if (!_isTabVisible('keyboard')) return;
      const key = e.key;
      if (_keyStates[key]) return; // already held
      _keyStates[key] = true;
      _kbPressCount++;
      highlightKey(key, true);
      document.getElementById('kbLastKey') && (document.getElementById('kbLastKey').innerText = key === ' ' ? 'Space' : key);
      document.getElementById('kbLastCode') && (document.getElementById('kbLastCode').innerText = e.code);
      document.getElementById('kbPressCount') && (document.getElementById('kbPressCount').innerText = _kbPressCount);
      document.getElementById('kbHeldCount') && (document.getElementById('kbHeldCount').innerText = Object.keys(_keyStates).length);
      logEvent('keyboard', key, 'keydown');
    }, { passive: true });

    document.addEventListener('keyup', (e) => {
      const key = e.key;
      delete _keyStates[key];
      highlightKey(key, false);
      document.getElementById('kbHeldCount') && (document.getElementById('kbHeldCount').innerText = Object.keys(_keyStates).length);
      logEvent('keyboard', key, 'keyup');
    }, { passive: true });
  }

  function highlightKey(key, active) {
    // map special keys to our layout labels
    const keyMap = { ' ': 'Space', 'Control': 'Ctrl', 'Shift': 'Shift', 'Alt': 'Alt', 'Backspace': 'Backspace',
                     'Enter': 'Enter', 'Tab': 'Tab', 'Escape': 'Esc', 'CapsLock': 'CapsLock' };
    const label = keyMap[key] || key.toUpperCase();
    const id = 'kbKey-' + label.replace(/[^a-zA-Z0-9]/g, '_');
    const el = document.getElementById(id);
    if (el) {
      el.style.background = active ? '#cc1111' : '#131313';
      el.style.color       = active ? '#fff'    : '#555';
      el.style.borderColor = active ? '#ff3333' : '#2a2a2a';
    }
  }

  // --------------------------------------------------------------------------
  // Tab switching
  // --------------------------------------------------------------------------
  const TAB_MAP = {
    buttons:'testButtonsTab', sticks:'testSticksTab', dpad:'testDpadTab',
    triggers:'testTriggersTab', gyro:'testGyroTab', mouse:'testMouseTab',
    keyboard:'testKeyboardTab', telemetry:'testTelemetryTab'
  };
  let _activeTab = 'buttons';

  function switchTestTab(tabName) {
    if (typeof playSound === 'function') playSound('click');
    _activeTab = tabName;
    document.querySelectorAll('.test-tab-btn').forEach((b, i) => {
      const keys = Object.keys(TAB_MAP);
      b.classList.toggle('active', keys[i] === tabName);
      b.setAttribute('aria-selected', keys[i] === tabName ? 'true' : 'false');
    });
    document.querySelectorAll('.test-tab-content').forEach(c => c.style.display = 'none');
    const el = document.getElementById(TAB_MAP[tabName]);
    if (el) el.style.display = 'block';
    // Start/stop horizon loop
    if (tabName === 'gyro') startHorizonLoop(); else stopHorizonLoop();
  }

  function _isTabVisible(tabName) {
    return _activeTab === tabName && (typeof isSectionActive !== 'function' || isSectionActive('testingLab'));
  }

  // --------------------------------------------------------------------------
  // Live display updaters (called from app.js _syncTestingLab)
  // --------------------------------------------------------------------------
  let _prevBtnStates = {};

  function updateButtonDisplay(name, pressed) {
    const el = document.getElementById('tBtn-' + name);
    if (!el) return;
    if (_prevBtnStates[name] === pressed) return; // skip unchanged
    _prevBtnStates[name] = pressed;
    el.classList.toggle('active', pressed);
    const s = el.querySelector('.btn-state');
    if (s) s.innerText = pressed ? 'PRESSED' : 'RELEASED';
    if (pressed) {
      _pressCount++;
      const cnt = document.getElementById('btnPressCount');
      const last = document.getElementById('btnLastPressed');
      if (cnt) cnt.innerText = _pressCount;
      if (last) last.innerText = name;
      logEvent('button', name, 'pressed');
    }
  }

  function updateStickDisplay(side, x, y) {
    const u = side === 'left' ? 'L' : 'R';
    const xEl = document.getElementById(u + 'X');
    const yEl = document.getElementById(u + 'Y');
    const dEl = document.getElementById(u + 'D');
    if (xEl) xEl.innerText = x.toFixed(2);
    if (yEl) yEl.innerText = y.toFixed(2);
    const dist = Math.hypot(x, y);
    if (dEl) dEl.innerText = dist.toFixed(2);
    // SVG dot — scale from [-1,1] to [-85,85] (within 98r boundary)
    const dot = document.getElementById(side + 'StickDot');
    if (dot) {
      dot.setAttribute('cx', (x * 85).toFixed(1));
      dot.setAttribute('cy', (y * 85).toFixed(1));
    }
  }

  function updateDpadDisplay(dir, pressed) {
    const el = document.getElementById('dpad-' + dir);
    if (!el) return;
    el.style.background = pressed ? '#cc1111' : '#1a1a1a';
    el.style.color       = pressed ? '#fff'    : '#aaa';
    if (pressed) {
      _dpadCount++;
      const cnt = document.getElementById('dpadPressCount');
      if (cnt) cnt.innerText = _dpadCount;
      const cur = document.getElementById('dpadCurrent');
      if (cur) cur.innerText = dir;
      logEvent('dpad', dir, 'pressed');
    }
    // Combination
    const held = ['UP','DOWN','LEFT','RIGHT'].filter(d => {
      const e = document.getElementById('dpad-' + d);
      return e && e.style.background.includes('cc1111');
    });
    const combo = document.getElementById('dpadCombo');
    if (combo) combo.innerText = held.length > 1 ? held.join('+') : 'NONE';
  }

  function updateTriggerDisplay(trigger, pct) {
    pct = Math.max(0, Math.min(100, Math.round(pct)));
    const bar = document.getElementById('trBar-' + trigger);
    const val = document.getElementById('trVal-' + trigger);
    const max = document.getElementById('trMax-' + trigger);
    if (bar) bar.style.height = pct + '%';
    if (val) val.innerText = pct + '%';
    if (max) {
      const prev = parseInt(max.innerText) || 0;
      if (pct > prev) max.innerText = pct + '%';
    }
    if (trigger === 'L2') { if (pct > _maxL2) _maxL2 = pct; }
    else                  { if (pct > _maxR2) _maxR2 = pct; }
  }

  // Gyro / Accelerometer
  let _horizonRaf = null;
  let _gyroState  = { pitch: 0, roll: 0, yaw: 0 };

  function updateGyroDisplay(pitch, roll, yaw) {
    pitch -= _gyroZero.pitch; roll -= _gyroZero.roll; yaw -= _gyroZero.yaw;
    _gyroState = { pitch, roll, yaw };
    const gp = document.getElementById('gyroPitch'); if (gp) gp.innerText = pitch.toFixed(1) + '°';
    const gr = document.getElementById('gyroRoll');  if (gr) gr.innerText = roll.toFixed(1)  + '°';
    const gy = document.getElementById('gyroYaw');   if (gy) gy.innerText = yaw.toFixed(1)   + '°';
    // Bars: map -90..90 → 0..100
    const toBar = v => Math.max(0, Math.min(100, (v + 90) / 180 * 100));
    const bp = document.getElementById('gyroBar-Pitch'); if (bp) bp.style.width = toBar(pitch) + '%';
    const br = document.getElementById('gyroBar-Roll');  if (br) br.style.width = toBar(roll)  + '%';
    const by = document.getElementById('gyroBar-Yaw');   if (by) by.style.width = toBar(yaw)   + '%';
  }

  function updateAccelDisplay(ax, ay, az) {
    const ex = document.getElementById('accelX'); if (ex) ex.innerText = ax.toFixed(2);
    const ey = document.getElementById('accelY'); if (ey) ey.innerText = ay.toFixed(2);
    const ez = document.getElementById('accelZ'); if (ez) ez.innerText = az.toFixed(2);
  }

  function drawHorizon() {
    const canvas = document.getElementById('horizonTestCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    const { pitch, roll } = _gyroState;

    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate((roll * Math.PI) / 180);

    // Sky / ground split
    const pitchOffset = pitch * 1.5;
    const grad = ctx.createLinearGradient(0, -h, 0, h);
    grad.addColorStop(0, '#001133'); grad.addColorStop(0.5, '#002266'); grad.addColorStop(1, '#111');
    ctx.fillStyle = grad;
    ctx.fillRect(-w, -h + pitchOffset, w * 2, h);

    const grad2 = ctx.createLinearGradient(0, pitchOffset, 0, h);
    grad2.addColorStop(0, '#2a1500'); grad2.addColorStop(1, '#0a0500');
    ctx.fillStyle = grad2;
    ctx.fillRect(-w, pitchOffset, w * 2, h);

    // Horizon line
    ctx.beginPath(); ctx.moveTo(-w, pitchOffset); ctx.lineTo(w, pitchOffset);
    ctx.lineWidth = 2; ctx.strokeStyle = '#cc1111'; ctx.stroke();

    // Tick marks
    for (let i = -2; i <= 2; i++) {
      if (i === 0) continue;
      const y = pitchOffset + i * 20;
      ctx.beginPath(); ctx.moveTo(-20, y); ctx.lineTo(20, y);
      ctx.lineWidth = 1; ctx.strokeStyle = '#cc111166'; ctx.stroke();
    }

    ctx.restore();

    // Center reticle (fixed, not rotated)
    ctx.strokeStyle = '#ffffff88'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(w/2 - 30, h/2); ctx.lineTo(w/2 - 10, h/2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(w/2 + 10, h/2); ctx.lineTo(w/2 + 30, h/2); ctx.stroke();
    ctx.beginPath(); ctx.arc(w/2, h/2, 3, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
  }

  function startHorizonLoop() {
    if (_horizonRaf) return;
    function loop() {
      if (!_isTabVisible('gyro')) { _horizonRaf = null; return; }
      drawHorizon();
      _horizonRaf = requestAnimationFrame(loop);
    }
    loop();
  }

  function stopHorizonLoop() {
    if (_horizonRaf) { cancelAnimationFrame(_horizonRaf); _horizonRaf = null; }
  }

  // --------------------------------------------------------------------------
  // Mouse tester
  // --------------------------------------------------------------------------
  let _lastMouseX = null, _lastMouseY = null;
  let _mouseClicks = 0;

  function _getRelativePos(event, area) {
    const rect = area.getBoundingClientRect();
    let cx, cy;
    if (event.touches && event.touches[0]) {
      cx = event.touches[0].clientX; cy = event.touches[0].clientY;
    } else {
      cx = event.clientX; cy = event.clientY;
    }
    return { x: Math.max(0, Math.min(rect.width,  cx - rect.left)),
             y: Math.max(0, Math.min(rect.height, cy - rect.top)) };
  }

  function _onMouseMove(event) {
    const area = document.getElementById('mouseTrackArea');
    if (!area) return;
    const pos = _getRelativePos(event, area);
    const dx = _lastMouseX != null ? (pos.x - _lastMouseX) : 0;
    const dy = _lastMouseY != null ? (pos.y - _lastMouseY) : 0;
    _lastMouseX = pos.x; _lastMouseY = pos.y;

    const dot = document.getElementById('mouseDot');
    if (dot) { dot.style.left = pos.x + 'px'; dot.style.top = pos.y + 'px'; }

    const xEl = document.getElementById('mouseX'); if (xEl) xEl.innerText = Math.round(pos.x);
    const yEl = document.getElementById('mouseY'); if (yEl) yEl.innerText = Math.round(pos.y);
    const dxEl = document.getElementById('mouseDX'); if (dxEl) dxEl.innerText = dx.toFixed(1);
    const dyEl = document.getElementById('mouseDY'); if (dyEl) dyEl.innerText = dy.toFixed(1);
    logEvent('mouse', 'move', `(${Math.round(pos.x)},${Math.round(pos.y)})`);
  }

  function _onMouseDown(event) {
    const btn = event.button === 2 ? 'right' : event.button === 1 ? 'middle' : 'left';
    _onMouseBtnDown(btn);
    _onMouseMove(event);
  }

  function _onMouseUp(event) {
    const btn = event.button === 2 ? 'right' : event.button === 1 ? 'middle' : 'left';
    _onMouseBtnUp(btn);
  }

  function _onMouseLeave() {
    _lastMouseX = null; _lastMouseY = null;
    ['left','middle','right'].forEach(b => _onMouseBtnUp(b));
  }

  function _onMouseBtnDown(btn) {
    _mouseDown[btn] = true;
    _mouseClicks++;
    const dot = document.getElementById('mouseBtnDot-' + btn);
    if (dot) { dot.style.background = '#cc1111'; dot.style.borderColor = '#ff3333'; }
    const cnt = document.getElementById('mouseClickCount'); if (cnt) cnt.innerText = _mouseClicks;
    const bEl = document.getElementById('mouseTest' + btn.charAt(0).toUpperCase() + btn.slice(1));
    if (bEl) bEl.classList.add('active');
    logEvent('mouse', btn, 'click');
  }

  function _onMouseBtnUp(btn) {
    _mouseDown[btn] = false;
    const dot = document.getElementById('mouseBtnDot-' + btn);
    if (dot) { dot.style.background = '#222'; dot.style.borderColor = '#444'; }
    const bEl = document.getElementById('mouseTest' + btn.charAt(0).toUpperCase() + btn.slice(1));
    if (bEl) bEl.classList.remove('active');
  }

  // --------------------------------------------------------------------------
  // Telemetry / log
  // --------------------------------------------------------------------------
  let _telRaf = null;
  let _lastSecTime = performance.now();
  let _secCount = 0, _epsDisplay = 0;

  function logEvent(type, target, state) {
    _log.push({ type, target, state, t: performance.now() });
    if (_log.length > 100) _log.shift();
    _secCount++;
  }

  function updateTelemetry() {
    if (!_isTabVisible('telemetry')) return;
    const now = performance.now();
    if (now - _lastSecTime >= 1000) {
      _epsDisplay = _secCount;
      _secCount = 0;
      _lastSecTime = now;
    }
    const cnt = document.getElementById('tEventCount');    if (cnt) cnt.innerText = _log.length;
    const eps = document.getElementById('tEventsPerSec'); if (eps) eps.innerText = _epsDisplay;
    // Polling rate from global state
    const pr = document.getElementById('tPollingRate');
    if (pr) pr.innerText = (typeof state !== 'undefined' && state.pollingHz) ? state.pollingHz + ' Hz' : '—';
    const lat = document.getElementById('tLatency');
    if (lat) lat.innerText = (typeof state !== 'undefined') ? state.latencyMs + ' ms' : '—';

    // Render log
    const logEl = document.getElementById('tLogList');
    if (logEl) {
      logEl.innerHTML = _log.slice(-50).reverse().map(e => {
        const ts = (e.t / 1000).toFixed(3);
        return `<div style="padding:2px 0; border-bottom:1px solid #111; display:flex; gap:12px;">
          <span style="color:#555;">${ts}s</span>
          <span style="color:#cc1111; min-width:60px;">${e.type.toUpperCase()}</span>
          <span style="color:#aaa; min-width:60px;">${esc(String(e.target))}</span>
          <span style="color:#666;">${esc(String(e.state))}</span>
        </div>`;
      }).join('');
    }
  }

  function startTelemetryLoop() {
    if (_telRaf) return;
    function loop() {
      if (!_isTabVisible('telemetry')) { _telRaf = null; return; }
      updateTelemetry();
      _telRaf = requestAnimationFrame(loop);
    }
    loop();
  }

  // --------------------------------------------------------------------------
  // Public API
  // --------------------------------------------------------------------------
  window.HPTestingLab = {
    init() { inject(); },

    open(deviceId) {
      _deviceId = deviceId || null;
      if (typeof showSection === 'function') showSection('testingLab');
      if (typeof playSound === 'function') playSound('chime');
      // Reset maximums on open
      _maxL2 = 0; _maxR2 = 0;
    },

    close() {
      if (typeof playSound === 'function') playSound('click');
      stopHorizonLoop();
      if (_telRaf) { cancelAnimationFrame(_telRaf); _telRaf = null; }
      if (typeof showSection === 'function') showSection('dashboard');
    },

    switchTestTab(tabName) {
      switchTestTab(tabName);
      // Start the appropriate loop
      if (tabName === 'gyro') startHorizonLoop();
      if (tabName === 'telemetry') startTelemetryLoop();
    },

    // Called from app.js _syncTestingLab
    updateButtonDisplay,
    updateStickDisplay,
    updateDpadDisplay,
    updateTriggerDisplay,
    updateGyroDisplay,
    updateAccelDisplay,

    calibrateGyro() {
      if (typeof playSound === 'function') playSound('chime');
      if (typeof triggerHaptic === 'function') triggerHaptic(50);
      const g = typeof state !== 'undefined' ? state.inputs.gyro : { pitch:0, roll:0, yaw:0 };
      _gyroZero = { pitch: g.pitch, roll: g.roll, yaw: g.yaw };
      if (typeof showToast === 'function') showToast('✓ Gyro zero calibrated.');
    },

    clearTelemetry() {
      if (typeof playSound === 'function') playSound('click');
      _log = []; _secCount = 0; _epsDisplay = 0;
      updateTelemetry();
      if (typeof showToast === 'function') showToast('Telemetry log cleared.');
    },

    exportTelemetry() {
      if (typeof playSound === 'function') playSound('click');
      const csv = 'Timestamp,Type,Target,State\n' +
        _log.map(e => `${(e.t/1000).toFixed(3)},${e.type},${e.target},${e.state}`).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'hp-telemetry-' + Date.now() + '.csv'; a.click();
      URL.revokeObjectURL(url);
      if (typeof showToast === 'function') showToast('Telemetry exported.');
    },

    _clearKeyboard() {
      _keyStates = {};
      document.querySelectorAll('[id^="kbKey-"]').forEach(el => {
        el.style.background = '#131313'; el.style.color = '#555'; el.style.borderColor = '#2a2a2a';
      });
    },

    // Mouse event handlers (called from inline HTML)
    _onMouseMove, _onMouseDown, _onMouseUp, _onMouseLeave, _onMouseBtnDown, _onMouseBtnUp,

    logEvent
  };

})();
