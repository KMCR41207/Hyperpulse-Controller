/* ==========================================================================
   HYPERPULSE // PERFORMANCE DASHBOARD (ui-performance.js)
   Real-time FPS, latency, signal quality, battery, connection monitoring.
   IMPORTANT: Never throttle controller input. UI refresh is separate.
   ========================================================================== */

(function () {

  const MAX_POINTS = 60; // 60s rolling window at 1Hz
  const GRAPH_W = 300, GRAPH_H = 80;

  let _data = { fps: [], latency: [], signal: [], battery: [] };
  let _fpsFrames = 0;
  let _lastFpsSample = performance.now();
  let _fpsRafId = null;
  let _metricsIntervalId = null;
  let _active = false;

  function esc(s) {
    return String(s || '').replace(/[&<>"']/g, c =>
      ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }

  function inject() {
    document.body.insertAdjacentHTML('beforeend', `
<section id="performanceDashboardSection" class="app-section">
<div class="section-container">

  <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:28px; flex-wrap:wrap; gap:12px;">
    <div>
      <h2 class="section-title">PERFORMANCE DASHBOARD</h2>
      <p class="section-sub">SYSTEM METRICS · REAL-TIME MONITORING · RESOURCE USAGE</p>
    </div>
    <button class="cyber-button sm secondary" onclick="HPPerformance.close()">← BACK</button>
  </div>

  <!-- Live metric cards -->
  <div class="metrics-grid" style="display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:14px; margin-bottom:32px;">
    <div class="metric-card">
      <div class="metric-label">FPS</div>
      <div class="metric-value" id="mFps">—</div>
      <div class="metric-unit">frames/sec</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">LATENCY</div>
      <div class="metric-value" id="mLatency">—</div>
      <div class="metric-unit">milliseconds</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">SIGNAL</div>
      <div class="metric-value" id="mSignal">—</div>
      <div class="metric-unit">percent</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">BATTERY</div>
      <div class="metric-value" id="mBattery">—</div>
      <div class="metric-unit">percent</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">CONNECTION</div>
      <div class="metric-value" id="mConn" style="font-size:0.9rem;">READY</div>
      <div class="metric-unit">status</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">INPUT EVENTS</div>
      <div class="metric-value" id="mEvents">0</div>
      <div class="metric-unit">logged</div>
    </div>
  </div>

  <!-- Graphs -->
  <h3 style="margin-bottom:6px;">PERFORMANCE GRAPHS</h3>
  <p style="font-size:0.8rem; color:var(--text-muted-dark); margin-bottom:16px;">60-second rolling window · samples at 1 Hz</p>
  <div class="graphs-grid" style="display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:20px; margin-bottom:36px;">
    ${[
      {id:'gFps',     title:'FPS / POLLING',  color:'#cc1111', unit:'fps'},
      {id:'gLatency', title:'LATENCY',         color:'#ff5500', unit:'ms'},
      {id:'gSignal',  title:'SIGNAL QUALITY',  color:'#e6b800', unit:'%'},
      {id:'gBattery', title:'BATTERY LEVEL',   color:'#00ccff', unit:'%'}
    ].map(g => `
      <div class="graph-container" style="background:var(--bg-panel); border:1px solid var(--dark-border); padding:12px;">
        <h4 style="font-family:var(--font-mono); font-size:0.7rem; color:var(--text-muted-dark); margin-bottom:8px;">${g.title}</h4>
        <canvas id="${g.id}" width="${GRAPH_W}" height="${GRAPH_H}" style="width:100%; display:block;"></canvas>
        <div style="display:flex; justify-content:space-between; font-family:var(--font-mono); font-size:0.65rem; color:var(--text-muted-dark); margin-top:6px;">
          <span id="${g.id}Min">Min: —</span>
          <span id="${g.id}Avg">Avg: —</span>
          <span id="${g.id}Max">Max: —</span>
        </div>
      </div>`).join('')}
  </div>

  <!-- System capability status -->
  <h3 style="margin-bottom:12px;">SYSTEM STATUS</h3>
  <div class="status-grid" style="display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:10px; margin-bottom:32px;">
    ${[
      ['sVisibility',  'PAGE VISIBILITY'],
      ['sAudio',       'AUDIO CONTEXT'],
      ['sMotion',      'MOTION SENSORS'],
      ['sBroadcast',   'BROADCAST CHANNEL'],
      ['sGamepad',     'GAMEPAD API'],
      ['sVibration',   'VIBRATION'],
      ['sWebSocket',   'WEBSOCKET'],
      ['sWebRTC',      'WEBRTC']
    ].map(([id, label]) => `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 12px; background:var(--bg-panel); border:1px solid var(--dark-border);">
        <span style="font-family:var(--font-mono); font-size:0.65rem; color:var(--text-muted-dark);">${label}</span>
        <span id="${id}" style="font-family:var(--font-mono); font-size:0.7rem; font-weight:700;">—</span>
      </div>`).join('')}
  </div>

  <!-- Memory & resources -->
  <h3 style="margin-bottom:12px;">MEMORY &amp; RESOURCES</h3>
  <div style="background:var(--bg-panel); border:1px solid var(--dark-border); padding:16px;">
    <div style="display:grid; grid-template-columns:repeat(auto-fill,minmax(180px,1fr)); gap:12px; margin-bottom:14px;">
      ${[
        ['mHeapUsed',  'JS HEAP USED'],
        ['mHeapLimit', 'JS HEAP LIMIT'],
        ['mInputLog',  'INPUT LOG SIZE'],
        ['mStorage',   'LOCALSTORAGE']
      ].map(([id, label]) => `
        <div>
          <div style="font-family:var(--font-mono); font-size:0.65rem; color:var(--text-muted-dark); margin-bottom:4px;">${label}</div>
          <div id="${id}" style="font-family:var(--font-mono); font-size:0.9rem; color:#fff;">—</div>
        </div>`).join('')}
    </div>
    <button class="cyber-button sm secondary" onclick="HPPerformance.resetMetrics()">RESET METRICS</button>
  </div>

</div>
</section>`);
  }

  // ---------------------------------------------------------------------------
  // Data helpers
  // ---------------------------------------------------------------------------
  function push(arr, val) {
    arr.push(val);
    if (arr.length > MAX_POINTS) arr.shift();
  }

  function stats(arr) {
    if (!arr.length) return { min: '—', avg: '—', max: '—' };
    const min = Math.min(...arr), max = Math.max(...arr);
    const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
    return { min: min.toFixed(1), avg: avg.toFixed(1), max: max.toFixed(1) };
  }

  // ---------------------------------------------------------------------------
  // Canvas graph renderer
  // ---------------------------------------------------------------------------
  function drawGraph(canvasId, data, color, maxVal) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.fillStyle = '#0d0d0d';
    ctx.fillRect(0, 0, w, h);

    // Grid
    ctx.strokeStyle = '#1f1f1f'; ctx.lineWidth = 0.5;
    for (let i = 1; i < 4; i++) {
      const y = (i / 4) * h;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    if (data.length < 2) return;

    // Fill area under line
    ctx.beginPath();
    for (let i = 0; i < data.length; i++) {
      const x = (i / (MAX_POINTS - 1)) * w;
      const y = h - Math.min(1, data[i] / maxVal) * h;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.lineTo(((data.length - 1) / (MAX_POINTS - 1)) * w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fillStyle = color + '22';
    ctx.fill();

    // Line
    ctx.beginPath();
    ctx.strokeStyle = color; ctx.lineWidth = 1.5;
    for (let i = 0; i < data.length; i++) {
      const x = (i / (MAX_POINTS - 1)) * w;
      const y = h - Math.min(1, data[i] / maxVal) * h;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Current-value dot
    const lx = ((data.length - 1) / (MAX_POINTS - 1)) * w;
    const ly = h - Math.min(1, data[data.length - 1] / maxVal) * h;
    ctx.beginPath(); ctx.arc(lx, ly, 3, 0, Math.PI * 2);
    ctx.fillStyle = color; ctx.fill();
  }

  function updateGraphs() {
    const graphs = [
      { id:'gFps',     data:_data.fps,     color:'#cc1111', max:120,  unit:'fps' },
      { id:'gLatency', data:_data.latency, color:'#ff5500', max:50,   unit:'ms'  },
      { id:'gSignal',  data:_data.signal,  color:'#e6b800', max:100,  unit:'%'   },
      { id:'gBattery', data:_data.battery, color:'#00ccff', max:100,  unit:'%'   }
    ];
    graphs.forEach(g => {
      drawGraph(g.id, g.data, g.color, g.max);
      const s = stats(g.data);
      const el = (id) => document.getElementById(id);
      if (el(g.id + 'Min')) el(g.id + 'Min').innerText = 'Min: ' + s.min + (s.min === '—' ? '' : ' ' + g.unit);
      if (el(g.id + 'Avg')) el(g.id + 'Avg').innerText = 'Avg: ' + s.avg + (s.avg === '—' ? '' : ' ' + g.unit);
      if (el(g.id + 'Max')) el(g.id + 'Max').innerText = 'Max: ' + s.max + (s.max === '—' ? '' : ' ' + g.unit);
    });
  }

  // ---------------------------------------------------------------------------
  // System capability checks
  // ---------------------------------------------------------------------------
  function statusBadge(ok, trueLabel, falseLabel) {
    const color = ok ? '#22cc44' : '#666';
    const label = ok ? trueLabel : falseLabel;
    return `<span style="color:${color};">${label}</span>`;
  }

  function updateStatus() {
    const el = (id) => document.getElementById(id);
    const s = statusBadge;

    if (el('sVisibility')) el('sVisibility').innerHTML  = s(!document.hidden, 'VISIBLE', 'HIDDEN');
    if (el('sAudio'))      el('sAudio').innerHTML       = s(window.audioCtx && window.audioCtx.state === 'running', 'RUNNING', window.audioCtx ? window.audioCtx.state.toUpperCase() : 'N/A');
    if (el('sMotion'))     el('sMotion').innerHTML      = s(!!window.DeviceOrientationEvent, 'AVAILABLE', 'UNAVAILABLE');
    if (el('sBroadcast'))  el('sBroadcast').innerHTML   = s(!!window.BroadcastChannel, 'READY', 'UNSUPPORTED');
    if (el('sGamepad'))    el('sGamepad').innerHTML     = s(!!navigator.getGamepads, 'READY', 'UNSUPPORTED');
    if (el('sVibration'))  el('sVibration').innerHTML   = s(!!navigator.vibrate, 'READY', 'UNSUPPORTED');
    if (el('sWebSocket'))  el('sWebSocket').innerHTML   = s(!!window.WebSocket, 'READY', 'UNSUPPORTED');
    if (el('sWebRTC'))     el('sWebRTC').innerHTML      = s(!!(window.RTCPeerConnection || window.webkitRTCPeerConnection), 'READY', 'UNSUPPORTED');
  }

  // ---------------------------------------------------------------------------
  // Main metrics collector (runs at 1 Hz via setInterval)
  // ---------------------------------------------------------------------------
  function collectMetrics() {
    // FPS from counter
    const now = performance.now();
    const elapsed = now - _lastFpsSample;
    if (elapsed >= 950) {
      const fps = Math.round(_fpsFrames * (1000 / elapsed));
      push(_data.fps, fps);
      const el = document.getElementById('mFps');
      if (el) {
        el.innerText = fps;
        el.style.color = fps < 30 ? '#cc1111' : fps < 50 ? '#ff9900' : '#22cc44';
      }
      _fpsFrames = 0;
      _lastFpsSample = now;
    }

    // Latency from global state
    const latMs = (typeof state !== 'undefined') ? (state.latencyMs || 0) : 0;
    push(_data.latency, latMs);
    const latEl = document.getElementById('mLatency');
    if (latEl) {
      latEl.innerText = latMs.toFixed(1);
      latEl.style.color = latMs > 20 ? '#cc1111' : latMs > 5 ? '#ff9900' : '#22cc44';
    }

    // Signal & battery from first connected device
    const devices = (window.HP && window.HP.getDevices) ? window.HP.getDevices() : [];
    const connDev = devices.find(d => d.is_connected) || devices[0];
    const sigMap = { 'Excellent':100, 'Good':75, 'Fair':50, 'Poor':25 };
    const sig = connDev ? (sigMap[connDev.signal_strength] || 50) : 100;
    const bat = connDev ? (connDev.battery_level || 100) : 100;
    push(_data.signal, sig);
    push(_data.battery, bat);
    const sigEl = document.getElementById('mSignal');  if (sigEl) sigEl.innerText = sig;
    const batEl = document.getElementById('mBattery'); if (batEl) batEl.innerText = bat + '%';

    // Connection status
    const isConn = (typeof state !== 'undefined') ? state.isConnected : false;
    const connEl = document.getElementById('mConn');
    if (connEl) {
      connEl.innerText = isConn ? 'CONNECTED' : 'READY';
      connEl.style.color = isConn ? '#22cc44' : '#888';
    }

    // Input events
    const log = (window.HP && window.HP.getInputLog) ? window.HP.getInputLog() : [];
    const evEl = document.getElementById('mEvents'); if (evEl) evEl.innerText = log.length;

    // Status checks
    updateStatus();

    // Memory
    if (performance.memory) {
      const used  = (performance.memory.usedJSHeapSize  / 1048576).toFixed(1);
      const limit = (performance.memory.jsHeapSizeLimit / 1048576).toFixed(1);
      const hu = document.getElementById('mHeapUsed');  if (hu) hu.innerText = used  + ' MB';
      const hl = document.getElementById('mHeapLimit'); if (hl) hl.innerText = limit + ' MB';
    } else {
      const hu = document.getElementById('mHeapUsed');  if (hu) hu.innerText = 'N/A';
      const hl = document.getElementById('mHeapLimit'); if (hl) hl.innerText = 'N/A';
    }
    const il = document.getElementById('mInputLog'); if (il) il.innerText = log.length + ' events';
    let lsSize = 0;
    try { for (const k in localStorage) { if (Object.prototype.hasOwnProperty.call(localStorage, k)) lsSize += (localStorage[k] || '').length; } } catch(_) {}
    const ls = document.getElementById('mStorage'); if (ls) ls.innerText = (lsSize / 1024).toFixed(1) + ' KB';

    updateGraphs();
  }

  // ---------------------------------------------------------------------------
  // FPS counter — runs as a lightweight RAF, SEPARATE from UI updates.
  // Only increments a counter; never touches DOM. Zero impact on controller.
  // ---------------------------------------------------------------------------
  function startFpsCounter() {
    if (_fpsRafId) return;
    _fpsFrames = 0;
    _lastFpsSample = performance.now();
    function count() {
      if (!_active) { _fpsRafId = null; return; }
      _fpsFrames++;
      _fpsRafId = requestAnimationFrame(count);
    }
    _fpsRafId = requestAnimationFrame(count);
  }

  function stopFpsCounter() {
    if (_fpsRafId) { cancelAnimationFrame(_fpsRafId); _fpsRafId = null; }
  }

  function startMonitoring() {
    if (_active) return;
    _active = true;
    startFpsCounter();
    collectMetrics(); // immediate first read
    _metricsIntervalId = setInterval(collectMetrics, 1000); // 1 Hz
  }

  function stopMonitoring() {
    _active = false;
    stopFpsCounter();
    if (_metricsIntervalId) { clearInterval(_metricsIntervalId); _metricsIntervalId = null; }
  }

  function resetMetrics() {
    if (typeof playSound === 'function') playSound('click');
    _data = { fps: [], latency: [], signal: [], battery: [] };
    _fpsFrames = 0;
    _lastFpsSample = performance.now();
    collectMetrics();
    if (typeof showToast === 'function') showToast('Metrics reset.');
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------
  window.HPPerformance = {
    init() { inject(); },

    open() {
      if (typeof showSection === 'function') showSection('performance');
      startMonitoring();
      if (typeof playSound === 'function') playSound('chime');
    },

    close() {
      stopMonitoring();
      if (typeof playSound === 'function') playSound('click');
      if (typeof showSection === 'function') showSection('dashboard');
    },

    resetMetrics,
    startMonitoring,
    stopMonitoring
  };

})();
