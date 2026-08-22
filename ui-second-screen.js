/* ==========================================================================
   HYPERPULSE // SECOND SCREEN MODE  (ui-second-screen.js)
   Phone displays real-time game telemetry from PC companion.
   Demo mode clearly labelled when no real connection exists.
   ========================================================================== */

window.HPSecondScreen = (function () {

  /* ── Widget registry ─────────────────────────────────────────────────────── */
  const ALL_WIDGETS = [
    { id:'speed',    label:'Speed',       icon:'🚗', unit:'km/h',  default:0,   fmt: v => Math.round(v) },
    { id:'rpm',      label:'RPM',         icon:'⚙️',  unit:'rpm',   default:0,   fmt: v => Math.round(v) },
    { id:'gear',     label:'Gear',        icon:'🔧', unit:'',      default:'N', fmt: v => v },
    { id:'lap',      label:'Lap Time',    icon:'⏱️',  unit:'',      default:'0:00.000', fmt: v => v },
    { id:'position', label:'Position',    icon:'🏁', unit:'',      default:'P1',fmt: v => 'P' + v },
    { id:'health',   label:'Health',      icon:'❤️',  unit:'%',     default:100, fmt: v => Math.round(v) },
    { id:'armor',    label:'Armor',       icon:'🛡️',  unit:'%',     default:0,   fmt: v => Math.round(v) },
    { id:'ammo',     label:'Ammo',        icon:'🔫', unit:'',      default:'30/90', fmt: v => v },
    { id:'score',    label:'Score',       icon:'⭐', unit:'',      default:0,   fmt: v => v.toLocaleString() },
    { id:'minimap',  label:'Minimap',     icon:'🗺️',  unit:'',      default:null,fmt: v => v },
    { id:'raceinfo', label:'Race Info',   icon:'🏆', unit:'',      default:'—', fmt: v => v },
  ];

  const WIDGET_MAP = Object.fromEntries(ALL_WIDGETS.map(w => [w.id, w]));

  /* ── State ───────────────────────────────────────────────────────────────── */
  let _telemetry   = {};          // live values from companion
  let _demoMode    = true;        // true until real data arrives
  let _demoRafId   = null;
  let _demoState   = { speed:0, rpm:800, gear:1, lap:'0:00.000', position:1, lapSec:0 };
  let _activeWidgets = new Set(['speed','rpm','gear','lap','position']);
  let _isVisible   = false;
  let _updateIntervalId = null;

  function esc(s) {
    return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  /* ── Companion bridge ────────────────────────────────────────────────────── */
  function initCompanionBridge() {
    try {
      const ch = new BroadcastChannel('hyperpulse_companion');
      ch.onmessage = (e) => {
        if (e.data && e.data.type === 'TELEMETRY') {
          _telemetry = { ..._telemetry, ...e.data.data };
          _demoMode  = false;
          stopDemo();
          if (_isVisible) renderWidgets();
          updateDemoBanner();
        }
      };
    } catch(_) {}
  }

  /* ── Demo mode (clearly labelled, runs only when visible + no real data) ── */
  let _demoTick = 0;
  function startDemo() {
    if (_demoRafId) return;
    let last = 0;
    function tick(now) {
      if (!_isVisible) { _demoRafId = null; return; }
      if (now - last > 100) { // 10 Hz demo tick — lightweight
        last = now;
        _demoTick++;
        // Simulate a driving loop
        _demoState.speed = 80 + Math.sin(_demoTick * 0.05) * 60 + Math.random() * 5;
        _demoState.rpm   = 3000 + (_demoState.speed / 200) * 6000 + Math.random() * 200;
        _demoState.gear  = Math.max(1, Math.min(6, Math.floor(_demoState.speed / 30) + 1));
        _demoState.lapSec += 0.1;
        const m  = Math.floor(_demoState.lapSec / 60);
        const s  = (_demoState.lapSec % 60).toFixed(3).padStart(6, '0');
        _demoState.lap = `${m}:${s}`;
        _telemetry = {
          speed:    _demoState.speed,
          rpm:      _demoState.rpm,
          gear:     _demoState.gear,
          lap:      _demoState.lap,
          position: 1,
          health:   85 + Math.sin(_demoTick * 0.02) * 10,
          armor:    60,
          ammo:     '28/90',
          score:    _demoTick * 12,
          raceinfo: 'LAP 1 / 3',
        };
        renderWidgets();
      }
      _demoRafId = requestAnimationFrame(tick);
    }
    _demoRafId = requestAnimationFrame(tick);
  }

  function stopDemo() {
    if (_demoRafId) { cancelAnimationFrame(_demoRafId); _demoRafId = null; }
  }

  function updateDemoBanner() {
    const el = document.getElementById('ssDemoBanner');
    if (el) el.style.display = _demoMode ? 'flex' : 'none';
  }

  /* ── Widget rendering ────────────────────────────────────────────────────── */
  function renderWidgets() {
    ALL_WIDGETS.forEach(w => {
      if (!_activeWidgets.has(w.id)) return;
      const el = document.getElementById('ssw-' + w.id);
      if (!el) return;
      const raw = _telemetry[w.id] !== undefined ? _telemetry[w.id] : w.default;
      el.textContent = w.fmt(raw) + (w.unit ? ' ' + w.unit : '');
    });
    renderRacingDash();
    renderRPMBar();
  }

  /* Premium racing dashboard */
  function renderRacingDash() {
    const sd = document.getElementById('rdSpeed');
    const rd = document.getElementById('rdRPM');
    const gd = document.getElementById('rdGear');
    const ld = document.getElementById('rdLap');
    const pd = document.getElementById('rdPos');
    if (sd) sd.textContent = Math.round(_telemetry.speed || 0);
    if (rd) rd.textContent = Math.round(_telemetry.rpm   || 0);
    if (gd) gd.textContent = _telemetry.gear || 'N';
    if (ld) ld.textContent = _telemetry.lap  || '0:00.000';
    if (pd) pd.textContent = 'P' + (_telemetry.position || 1);
  }

  function renderRPMBar() {
    const canvas = document.getElementById('ssRpmCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    const rpm = _telemetry.rpm || 0;
    const maxRpm = 8000;
    const pct = Math.min(1, rpm / maxRpm);
    ctx.clearRect(0, 0, w, h);
    // Background track
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, w, h);
    // Colour gradient based on RPM
    const color = pct > 0.85 ? '#cc1111' : pct > 0.65 ? '#e6b800' : '#22cc44';
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, w * pct, h);
    // Redline marker
    ctx.fillStyle = '#cc1111';
    ctx.fillRect(w * 0.85, 0, 2, h);
  }

  /* ── Widget selector (checkboxes) ────────────────────────────────────────── */
  function renderWidgetSelector() {
    const el = document.getElementById('ssWidgetSelector');
    if (!el) return;
    el.innerHTML = ALL_WIDGETS.map(w => `
      <label style="display:flex; align-items:center; gap:8px; padding:6px 0; cursor:pointer;
        font-family:var(--font-mono); font-size:0.72rem; border-bottom:1px solid #1a1a1a;">
        <input type="checkbox" ${_activeWidgets.has(w.id) ? 'checked' : ''}
          onchange="HPSecondScreen.toggleWidget('${w.id}', this.checked)"
          style="accent-color:#cc1111;">
        <span>${w.icon} ${w.label}</span>
        ${w.unit ? `<span style="color:#555; margin-left:auto;">${w.unit}</span>` : ''}
      </label>`).join('');
  }

  function renderActiveWidgets() {
    const el = document.getElementById('ssActiveWidgets');
    if (!el) return;
    el.innerHTML = ALL_WIDGETS
      .filter(w => _activeWidgets.has(w.id))
      .map(w => {
        const raw = _telemetry[w.id] !== undefined ? _telemetry[w.id] : w.default;
        return `
          <div class="ss-widget-card">
            <div class="ss-widget-icon">${w.icon}</div>
            <div class="ss-widget-label">${w.label}</div>
            <div class="ss-widget-value" id="ssw-${w.id}">${w.fmt(raw)}${w.unit ? ' '+w.unit : ''}</div>
          </div>`;
      }).join('');
  }

  /* ── Inject HTML ─────────────────────────────────────────────────────────── */
  function inject() {
    document.body.insertAdjacentHTML('beforeend', `
<section id="secondScreenSection" class="app-section">
<div class="section-container">

  <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:24px; flex-wrap:wrap; gap:12px;">
    <div>
      <h2 class="section-title">SECOND SCREEN</h2>
      <p class="section-sub">LIVE GAME TELEMETRY · CUSTOMIZABLE WIDGETS</p>
    </div>
    <button class="cyber-button sm secondary" onclick="showSection('dashboard')">← BACK</button>
  </div>

  <!-- Demo mode banner -->
  <div id="ssDemoBanner" style="display:flex; align-items:center; gap:12px; padding:10px 16px;
    background:#1a0f00; border:1px solid #ff9900; border-left:3px solid #ff9900; margin-bottom:20px;">
    <span style="font-size:1.1rem;">⚠</span>
    <div style="font-family:var(--font-mono); font-size:0.72rem; color:#ff9900;">
      <strong>DEMO MODE</strong> — No PC companion connected. Data shown is simulated for preview only.
      <span style="color:#666; margin-left:8px;">Connect PC companion to show real game telemetry.</span>
    </div>
  </div>

  <div style="display:grid; grid-template-columns:1fr 300px; gap:24px; align-items:start;">

    <!-- Left: Dashboard + widgets -->
    <div>
      <!-- Premium racing dashboard -->
      <div class="ss-racing-dash" style="margin-bottom:20px;">
        <div style="font-family:var(--font-mono); font-size:0.65rem; color:#555; letter-spacing:2px; margin-bottom:12px;">
          RACING TELEMETRY DASHBOARD
        </div>
        <div style="display:grid; grid-template-columns:2fr 1fr 1fr 1fr 1fr; gap:10px; align-items:center;">
          <div class="ss-big-stat">
            <div class="ss-big-label">SPEED</div>
            <div class="ss-big-value" id="rdSpeed">0</div>
            <div class="ss-big-unit">km/h</div>
          </div>
          <div class="ss-dash-stat">
            <div class="ss-dash-label">RPM</div>
            <div class="ss-dash-value" id="rdRPM">0</div>
          </div>
          <div class="ss-dash-stat">
            <div class="ss-dash-label">GEAR</div>
            <div class="ss-dash-value" id="rdGear">N</div>
          </div>
          <div class="ss-dash-stat">
            <div class="ss-dash-label">LAP</div>
            <div class="ss-dash-value" id="rdLap" style="font-size:0.85rem;">0:00.000</div>
          </div>
          <div class="ss-dash-stat">
            <div class="ss-dash-label">POS</div>
            <div class="ss-dash-value" id="rdPos">P1</div>
          </div>
        </div>
        <!-- RPM bar -->
        <div style="margin-top:10px;">
          <div style="font-family:var(--font-mono); font-size:0.6rem; color:#444; margin-bottom:4px;">RPM BAR</div>
          <canvas id="ssRpmCanvas" width="600" height="14" style="width:100%; height:14px; display:block;"></canvas>
        </div>
      </div>

      <!-- Active widgets grid -->
      <div style="font-family:var(--font-mono); font-size:0.65rem; color:#555; letter-spacing:2px; margin-bottom:10px;">ACTIVE WIDGETS</div>
      <div id="ssActiveWidgets" class="ss-widgets-grid"></div>
    </div>

    <!-- Right: Widget selector -->
    <div>
      <div style="font-family:var(--font-mono); font-size:0.65rem; color:#555; letter-spacing:2px; margin-bottom:10px;">WIDGET SELECTION</div>
      <div style="background:var(--bg-panel); border:1px solid var(--dark-border); padding:12px;">
        <div id="ssWidgetSelector"></div>
      </div>

      <!-- Companion spec -->
      <details style="margin-top:14px;">
        <summary style="font-family:var(--font-mono); font-size:0.7rem; color:#666; cursor:pointer; padding:6px 0;">
          PC COMPANION SPEC
        </summary>
        <div style="font-family:var(--font-mono); font-size:0.65rem; color:#888; line-height:1.8; padding:10px; background:#0a0a0a; border:1px solid #1a1a1a; margin-top:4px;">
          Channel: <code style="color:#cc1111;">BroadcastChannel('hyperpulse_companion')</code><br>
          Payload:
          <pre style="background:#050505; padding:6px; margin:4px 0; overflow-x:auto; color:#aaa; font-size:0.62rem;">{
  "type": "TELEMETRY",
  "data": {
    "speed": 184.5,
    "rpm": 7200,
    "gear": 5,
    "lap": "1:32.441",
    "position": 2,
    "health": 100,
    "ammo": "28/90"
  }
}</pre>
        </div>
      </details>
    </div>

  </div>
</div>
</section>`);
  }

  /* ── Public API ──────────────────────────────────────────────────────────── */
  return {
    init() {
      inject();
      initCompanionBridge();
    },

    open() {
      _isVisible = true;
      if (typeof showSection === 'function') showSection('secondScreen');
      renderWidgetSelector();
      renderActiveWidgets();
      updateDemoBanner();
      if (_demoMode) startDemo();
    },

    close() {
      _isVisible = false;
      stopDemo();
    },

    toggleWidget(id, on) {
      on ? _activeWidgets.add(id) : _activeWidgets.delete(id);
      renderActiveWidgets();
    },

    /* Called by PC companion integration */
    receiveTelemetry(data) {
      _telemetry = { ..._telemetry, ...data };
      _demoMode  = false;
      stopDemo();
      updateDemoBanner();
      if (_isVisible) renderWidgets();
    },
  };
})();
