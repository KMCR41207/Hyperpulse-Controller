/* ==========================================================================
   HYPERPULSE // BATTERY-AWARE UI  (ui-battery-aware.js)
   Monitors browser Battery API + device battery from HP state.
   When battery is low: reduces decorative effects ONLY.
   NEVER reduces controller input rate, gyro, or latency.
   ========================================================================== */

window.HPBatteryAware = (function () {

  const THRESHOLDS = { LOW: 20, CRITICAL: 10 };
  let _level      = 100;
  let _charging   = false;
  let _mode       = 'normal'; // 'normal' | 'low' | 'critical'
  let _batteryApi = null;
  let _pollId     = null;

  /* ── Apply / remove CSS classes ──────────────────────────────────────────── */
  function applyMode(mode) {
    if (_mode === mode) return;
    _mode = mode;
    document.body.classList.remove('battery-low', 'battery-critical');
    if (mode === 'low')      document.body.classList.add('battery-low');
    if (mode === 'critical') document.body.classList.add('battery-critical');

    const msg = {
      low:      '🔋 Battery Low — decorative effects reduced. Controller input unchanged.',
      critical: '🪫 Battery Critical — minimal UI mode active. Controller input unchanged.',
      normal:   null
    }[mode];
    if (msg && typeof showToast === 'function') showToast(msg);
    updateIndicator();
  }

  function evaluate(level, charging) {
    if (charging) { applyMode('normal'); return; }
    if (level <= THRESHOLDS.CRITICAL) applyMode('critical');
    else if (level <= THRESHOLDS.LOW) applyMode('low');
    else                               applyMode('normal');
  }

  /* ── Browser Battery API ─────────────────────────────────────────────────── */
  async function initBatteryAPI() {
    if (!navigator.getBattery) return;
    try {
      _batteryApi = await navigator.getBattery();
      _level    = Math.round(_batteryApi.level * 100);
      _charging = _batteryApi.charging;
      evaluate(_level, _charging);

      _batteryApi.addEventListener('levelchange',   () => { _level    = Math.round(_batteryApi.level * 100); evaluate(_level, _charging); updateIndicator(); });
      _batteryApi.addEventListener('chargingchange', () => { _charging = _batteryApi.charging; evaluate(_level, _charging); updateIndicator(); });
    } catch(_) {}
  }

  /* ── Poll device battery from HP state (supplement API) ─────────────────── */
  function startPolling() {
    if (_pollId) return;
    _pollId = setInterval(() => {
      const devices = HP.getDevices();
      const conn = devices.find(d => d.is_connected);
      if (!conn) return;
      const devLevel = conn.battery_level;
      if (devLevel != null && devLevel < _level) {
        // Use the lower of the two readings
        _level = devLevel;
        evaluate(_level, _charging);
      }
      updateIndicator();
    }, 15000); // check every 15s — no CPU impact
  }

  function stopPolling() {
    clearInterval(_pollId);
    _pollId = null;
  }

  /* ── Indicator in header area ────────────────────────────────────────────── */
  function updateIndicator() {
    const el = document.getElementById('batteryIndicator');
    if (!el) return;
    const color = _level <= THRESHOLDS.CRITICAL ? '#cc1111' :
                  _level <= THRESHOLDS.LOW       ? '#ff9900' : '#22cc44';
    const icon  = _charging ? '🔌' : _level <= THRESHOLDS.CRITICAL ? '🪫' : '🔋';
    el.innerHTML = `<span style="color:${color}; font-family:var(--font-mono); font-size:0.65rem;">${icon} ${_level}%</span>`;
    el.style.display = 'inline-flex';
  }

  function injectIndicator() {
    const controls = document.querySelector('.header-controls');
    if (!controls || document.getElementById('batteryIndicator')) return;
    const span = document.createElement('div');
    span.id = 'batteryIndicator';
    span.style.cssText = 'display:none; align-items:center; padding:0 8px;';
    controls.insertBefore(span, controls.firstChild);
  }

  /* ── Public API ──────────────────────────────────────────────────────────── */
  return {
    init() {
      injectIndicator();
      initBatteryAPI();
      startPolling();
    },

    getLevel()  { return _level;    },
    getMode()   { return _mode;     },
    isLow()     { return _mode !== 'normal'; },

    /* Force a level for testing */
    simulate(level) {
      _level = level;
      evaluate(level, false);
    },

    cleanup() { stopPolling(); },
  };
})();
