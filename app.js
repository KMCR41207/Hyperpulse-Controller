/* ==========================================================================
   HYPERPULSE — CONTROLLER ENGINE (app.js)
   ==========================================================================
   Architecture:
     HP.state       — all application state
     HP.nav         — page/section navigation
     HP.input       — controller input engine (touch, gyro, mouse, keyboard)
     HP.broadcast   — BroadcastChannel real-time sync
     HP.render      — canvas renderers (wheel, latency graph)
     HP.ui          — UI utilities (toast, modal, etc.)
   ========================================================================== */

const HP = {

  /* ---- STATE ---- */
  state: {
    page: 'landing',
    dashSection: 'dashboard',
    user: null,
    device: { connected: false, name: 'My Phone', battery: 74, latency: null, transport: null, signal: null },
    mode: 'gamepad',
    gyroActive: false,
    gyroZero: { pitch: 0, roll: 0, yaw: 0 },
    inputs: {
      buttons: {},
      sticks: { LX: 0, LY: 0, RX: 0, RY: 0 },
      wheel: { angle: 0, gear: 0, throttle: 0, brake: 0, speed: 0, handbrake: false },
      gyro: { pitch: 0, roll: 0, yaw: 0, ax: 0, ay: 0, az: 0, sens: 50 },
      mouse: { x: 0, y: 0, left: false, middle: false, right: false, dpi: 5 },
      keys: {}
    },
    profiles: [],
    roomCode: '',
    latencyHistory: [],
    settings: { wheelSens: 72, wheelDz: 4, accent: '#6c63ff' }
  },

  /* ---- INIT ---- */
  init() {
    this.state.roomCode = 'HYPER-' + (1000 + Math.floor(Math.random() * 9000));
    this.nav.init();
    this.input.initSticks();
    this.input.initTrackpad();
    this.input.initSensors();
    this.input.initKeyboard();
    this.render.initWheelCanvas();
    this.render.startLatencyGraph();
    this.render.startWheelLoop();
    this.ui.initQrGrids();
    this.ui.buildKeyboard();
    this.ui.buildNumpad();
    this.ui.buildHelpItems();
    this.ui.buildCommunityGrid();
    this.ui.buildProfiles();
    this.broadcast.init();
    this.ui.updateRoomCode();
    this.phoneModeLoop();
    setTimeout(() => this.ui.updateSidebarDevice(), 200);
  },

  /* ---- NAVIGATION ---- */
  nav: {
    init() {
      const path = window.location.hash.replace('#','');
      if (path && ['landing','auth','dashboard'].includes(path)) HP.nav.go(path);
    },
    go(pageId) {
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      const page = document.getElementById('page-' + pageId);
      if (page) page.classList.add('active');
      HP.state.page = pageId;
      window.location.hash = pageId;
      window.scrollTo(0,0);
      if (pageId === 'landing') document.getElementById('siteNav').style.display = '';
      else document.getElementById('siteNav').style.display = 'none';
    }
  },

  /* ---- CONTROLLER INPUT ENGINE ---- */
  input: {
    /* JOYSTICKS */
    initSticks() {
      HP.input.setupStick('leftStickBase','leftStickThumb',(x,y)=>{
        HP.state.inputs.sticks.LX = x; HP.state.inputs.sticks.LY = y;
        document.getElementById('dbgLS').textContent = `X: ${x.toFixed(2)}  Y: ${y.toFixed(2)}`;
        HP.broadcast.send();
      });
      HP.input.setupStick('rightStickBase','rightStickThumb',(x,y)=>{
        HP.state.inputs.sticks.RX = x; HP.state.inputs.sticks.RY = y;
        document.getElementById('dbgRS').textContent = `X: ${x.toFixed(2)}  Y: ${y.toFixed(2)}`;
        HP.broadcast.send();
      });
    },
    setupStick(baseId, thumbId, cb) {
      const base = document.getElementById(baseId);
      const thumb = document.getElementById(thumbId);
      if (!base || !thumb) return;
      const r = 29; let active = false, tid = null;
      function move(cx, cy) {
        const rect = base.getBoundingClientRect();
        let dx = cx - (rect.left + rect.width/2);
        let dy = cy - (rect.top + rect.height/2);
        const dist = Math.hypot(dx, dy);
        if (dist > r*2) { dx = dx/dist*r*2; dy = dy/dist*r*2; }
        thumb.style.transform = `translate(${dx}px,${dy}px)`;
        thumb.classList.add('active');
        cb(parseFloat((dx/(r*2)).toFixed(3)), parseFloat((dy/(r*2)).toFixed(3)));
      }
      function end() { active=false; tid=null; thumb.style.transform=''; thumb.classList.remove('active'); cb(0,0); }
      base.addEventListener('mousedown', e=>{active=true; move(e.clientX,e.clientY);});
      window.addEventListener('mousemove', e=>{if(active) move(e.clientX,e.clientY);});
      window.addEventListener('mouseup', ()=>{if(active) end();});
      base.addEventListener('touchstart', e=>{e.preventDefault(); active=true; tid=e.touches[0].identifier; move(e.touches[0].clientX,e.touches[0].clientY);},{passive:false});
      base.addEventListener('touchmove', e=>{e.preventDefault(); for(const t of e.touches){if(t.identifier===tid) move(t.clientX,t.clientY);}},{passive:false});
      base.addEventListener('touchend', ()=>end());
    },

    /* TRACKPAD / MOUSE */
    initTrackpad() {
      const surface = document.getElementById('trackpadSurface');
      const cursor = document.getElementById('trackpadCursor');
      const hint = document.getElementById('trackpadHint');
      if (!surface) return;
      let lx=0, ly=0, active=false;
      function move(cx,cy) {
        const rect = surface.getBoundingClientRect();
        const x = ((cx - rect.left)/rect.width)*100;
        const y = ((cy - rect.top)/rect.height)*100;
        const dx = cx - (lx||cx); const dy = cy - (ly||cy);
        lx=cx; ly=cy;
        const dpi = HP.state.inputs.mouse.dpi;
        HP.state.inputs.mouse.x = Math.round(x*10)/10;
        HP.state.inputs.mouse.y = Math.round(y*10)/10;
        cursor.style.left = x+'%';
        cursor.style.top = y+'%';
        cursor.style.opacity = '1';
        hint.style.opacity = '0';
        document.getElementById('mousePosX').textContent = Math.round(dx*dpi);
        document.getElementById('mousePosY').textContent = Math.round(dy*dpi);
        HP.broadcast.send();
      }
      function start(cx,cy) { active=true; lx=cx; ly=cy; }
      function end() { active=false; }
      surface.addEventListener('mousedown', e=>{start(e.clientX,e.clientY); move(e.clientX,e.clientY);});
      surface.addEventListener('mousemove', e=>{if(active) move(e.clientX,e.clientY);});
      window.addEventListener('mouseup', ()=>end());
      surface.addEventListener('touchstart', e=>{e.preventDefault(); start(e.touches[0].clientX,e.touches[0].clientY);},{passive:false});
      surface.addEventListener('touchmove', e=>{e.preventDefault(); if(active) move(e.touches[0].clientX,e.touches[0].clientY);},{passive:false});
      surface.addEventListener('touchend', ()=>end());
    },

    /* GYROSCOPE */
    initSensors() {
      if (!window.DeviceOrientationEvent) return;
      window.addEventListener('deviceorientation', e => {
        if (e.beta === null) return;
        const g = HP.state.inputs.gyro;
        const z = HP.state.gyroZero;
        g.pitch = parseFloat((e.beta  - z.pitch).toFixed(1));
        g.roll  = parseFloat((e.gamma - z.roll).toFixed(1));
        g.yaw   = parseFloat(((e.alpha||0) - z.yaw).toFixed(1));
        HP.state.gyroActive = true;
        HP.ui.updateGyroUI();
        if (HP.state.mode === 'wheel' && document.getElementById('gyroToggle')?.classList.contains('on')) {
          HP.state.inputs.wheel.angle = g.roll * (HP.state.settings.wheelSens / 100) * 5;
          HP.render.updateWheelAngle();
        }
        HP.broadcast.send();
      });
    },

    /* KEYBOARD */
    initKeyboard() {
      document.addEventListener('keydown', e => {
        const key = e.key.toUpperCase();
        HP.state.inputs.keys[key] = true;
        const el = document.querySelector(`[data-key="${key}"]`);
        if (el) el.classList.add('pressed');
        document.getElementById('lastKeyPressed').textContent = e.key;
        HP.broadcast.send();
      });
      document.addEventListener('keyup', e => {
        const key = e.key.toUpperCase();
        HP.state.inputs.keys[key] = false;
        const el = document.querySelector(`[data-key="${key}"]`);
        if (el) el.classList.remove('pressed');
        HP.broadcast.send();
      });
    }
  },

  /* ---- BROADCAST CHANNEL ---- */
  broadcast: {
    ch: null,
    init() {
      try { this.ch = new BroadcastChannel('hyperpulse_v2'); this.ch.onmessage = e => HP.broadcast.receive(e.data); }
      catch(e) {}
    },
    send() {
      if (!this.ch) return;
      try { this.ch.postMessage({ type:'INPUT', inputs: HP.state.inputs, ts: performance.now() }); }
      catch(e) {}
    },
    receive(data) {
      if (data.type === 'INPUT') HP.state.inputs = data.inputs;
    }
  },

  /* ---- CANVAS RENDERERS ---- */
  render: {
    wheelCtx: null,
    latencyCtx: null,
    wheelAngle: 0,
    draggingWheel: false,
    wheelDragStart: 0,

    initWheelCanvas() {
      const c = document.getElementById('wheelCanvas');
      if (!c) return;
      this.wheelCtx = c.getContext('2d');
      let startX = 0;
      c.addEventListener('mousedown', e=>{this.draggingWheel=true; startX=e.clientX;});
      window.addEventListener('mousemove', e=>{
        if (!this.draggingWheel) return;
        const delta = (e.clientX - startX) * 1.2;
        HP.state.inputs.wheel.angle = Math.max(-450,Math.min(450, HP.state.inputs.wheel.angle+delta));
        startX = e.clientX;
        this.updateWheelAngle();
      });
      window.addEventListener('mouseup', ()=>{this.draggingWheel=false;});
      c.addEventListener('touchstart', e=>{this.draggingWheel=true; startX=e.touches[0].clientX;},{passive:true});
      c.addEventListener('touchmove', e=>{
        const delta = (e.touches[0].clientX - startX) * 1.2;
        HP.state.inputs.wheel.angle = Math.max(-450,Math.min(450, HP.state.inputs.wheel.angle+delta));
        startX = e.touches[0].clientX;
        this.updateWheelAngle();
      },{passive:true});
      c.addEventListener('touchend', ()=>{this.draggingWheel=false;});
    },

    updateWheelAngle() {
      document.getElementById('wheelAngleTxt').textContent = Math.round(HP.state.inputs.wheel.angle) + '°';
      HP.broadcast.send();
    },

    startWheelLoop() {
      const draw = () => {
        if (!this.draggingWheel && HP.state.inputs.wheel.angle !== 0) {
          HP.state.inputs.wheel.angle *= 0.92;
          if (Math.abs(HP.state.inputs.wheel.angle) < 0.5) HP.state.inputs.wheel.angle = 0;
          this.updateWheelAngle();
        }
        this.drawWheel(this.wheelCtx, 160, 160, 130, HP.state.inputs.wheel.angle);
        requestAnimationFrame(draw);
      };
      draw();
    },

    drawWheel(ctx, cx, cy, r, angle) {
      if (!ctx) return;
      ctx.clearRect(0, 0, cx*2, cy*2);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle * Math.PI / 180);
      // Outer rim
      ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2);
      ctx.lineWidth = 26; ctx.strokeStyle = '#1a1a1a'; ctx.stroke();
      // Rim highlight
      ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2);
      ctx.lineWidth = 24; ctx.strokeStyle = '#2a2a2a'; ctx.stroke();
      // Accent marker
      ctx.beginPath(); ctx.arc(0,0,r,-Math.PI/2-0.12,-Math.PI/2+0.12);
      ctx.lineWidth = 24; ctx.strokeStyle = HP.state.settings.accent; ctx.stroke();
      // Spokes
      const spokeAngles = [0, Math.PI*2/3, Math.PI*4/3];
      ctx.lineWidth = 14; ctx.strokeStyle = '#252525'; ctx.lineCap = 'round';
      spokeAngles.forEach(a => {
        ctx.beginPath();
        ctx.moveTo(Math.cos(a)*18, Math.sin(a)*18);
        ctx.lineTo(Math.cos(a)*(r-18), Math.sin(a)*(r-18));
        ctx.stroke();
      });
      // Center
      ctx.beginPath(); ctx.arc(0,0,36,0,Math.PI*2);
      ctx.fillStyle = '#111'; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = HP.state.settings.accent; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = '700 11px "JetBrains Mono",monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('HP', 0, 0);
      ctx.restore();
    },

    startLatencyGraph() {
      const c = document.getElementById('latencyCanvas');
      if (!c) return;
      this.latencyCtx = c.getContext('2d');
      const draw = () => {
        if (HP.state.device.connected) {
          const jitter = Math.random() * 4 - 2;
          const base = HP.state.device.latency || 8;
          HP.state.latencyHistory.push(base + jitter);
        } else {
          HP.state.latencyHistory.push(null);
        }
        if (HP.state.latencyHistory.length > 80) HP.state.latencyHistory.shift();
        this.drawLatencyGraph();
        setTimeout(draw, 100);
      };
      draw();
    },

    drawLatencyGraph() {
      const ctx = this.latencyCtx;
      if (!ctx) return;
      const W = ctx.canvas.width, H = ctx.canvas.height;
      ctx.clearRect(0,0,W,H);
      // Grid lines
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 1;
      for (let i=0;i<4;i++) { const y=H/4*i; ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
      // Graph line
      const hist = HP.state.latencyHistory;
      if (hist.length < 2) return;
      const max = 60, min = 0;
      ctx.beginPath();
      ctx.strokeStyle = HP.state.settings.accent;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      let started = false;
      hist.forEach((val, i) => {
        if (val === null) { started=false; return; }
        const x = (i / (hist.length-1)) * W;
        const y = H - ((val - min) / (max - min)) * H;
        if (!started) { ctx.moveTo(x,y); started=true; } else ctx.lineTo(x,y);
      });
      ctx.stroke();
      // Fill under
      ctx.lineTo(W,H); ctx.lineTo(0,H); ctx.closePath();
      ctx.fillStyle = `${HP.state.settings.accent}18`;
      ctx.fill();
    }
  },

  /* ---- UI UTILITIES ---- */
  ui: {
    toast(msg, type='info') {
      const c = document.getElementById('toastContainer');
      const t = document.createElement('div');
      t.className = `toast ${type}`;
      t.textContent = msg;
      c.appendChild(t);
      setTimeout(()=>t.remove(), 3100);
    },

    openModal(id) {
      document.getElementById('modalOverlay').classList.add('active');
      document.getElementById(id).classList.add('active');
    },

    closeModal(id) {
      document.getElementById(id).classList.remove('active');
      const open = document.querySelectorAll('.modal.active');
      if (!open.length) document.getElementById('modalOverlay').classList.remove('active');
    },

    closeAllModals() {
      document.querySelectorAll('.modal').forEach(m=>m.classList.remove('active'));
      document.getElementById('modalOverlay').classList.remove('active');
    },

    updateRoomCode() {
      const code = HP.state.roomCode;
      ['dashBigCode','roomCode','modalRoomCodeDisplay'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = code;
      });
    },

    updateSidebarDevice() {
      const d = HP.state.device;
      const dot = document.querySelector('.sdc-dot');
      const name = document.getElementById('sdcName');
      const lat = document.getElementById('sdcLatency');
      const bat = document.getElementById('sdcBattery');
      const devPill = document.getElementById('devicePillLabel');
      const devDot = document.getElementById('deviceDot');
      if (dot) dot.classList.toggle('connected', d.connected);
      if (name) name.textContent = d.connected ? d.name : 'No Device';
      if (lat) lat.textContent = d.connected ? `${d.latency}ms` : '--';
      if (bat) bat.textContent = d.connected ? `${d.battery}%` : '--';
      if (devPill) devPill.textContent = d.connected ? `${d.name} · ${d.latency}ms` : 'Not Connected';
      if (devDot) devDot.classList.toggle('active', d.connected);
      // stat cards
      const sc = v => document.getElementById(v);
      if (sc('statLatency')) sc('statLatency').textContent = d.connected ? `${d.latency} ms` : '--';
      if (sc('statConn')) sc('statConn').textContent = d.connected ? 'Online' : 'Offline';
      if (sc('statConnType')) sc('statConnType').textContent = d.connected ? (d.transport||'Wi-Fi') : 'No transport';
      if (sc('statInputRate')) sc('statInputRate').textContent = d.connected ? '120 Hz' : '--';
      if (sc('statBattery')) sc('statBattery').textContent = d.connected ? `${d.battery}%` : '--';
      if (sc('statBattSub')) sc('statBattSub').textContent = d.connected ? 'Device battery' : 'Not connected';
      if (sc('perfLatency')) sc('perfLatency').textContent = d.connected ? `${d.latency} ms` : '--';
      if (sc('perfRate')) sc('perfRate').textContent = d.connected ? '120 Hz' : '--';
      if (sc('perfSignal')) { sc('perfSignal').textContent = d.connected ? (d.signal||'Excellent') : '—'; sc('perfSignal').className = 'psc-value' + (d.connected ? ' cs-success' : ''); }
    },

    initQrGrids() {
      // QR grids are static SVG inline — just animate scan lines
    },

    updateGyroUI() {
      const g = HP.state.inputs.gyro;
      const set = (id, val, max) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val + (id.includes('Val') ? '°' : '');
      };
      set('gyroPitchVal', g.pitch); set('gyroRollVal', g.roll); set('gyroYawVal', g.yaw);
      set('accelXVal', g.ax.toFixed(2)); set('accelYVal', g.ay.toFixed(2)); set('accelZVal', g.az.toFixed(2));
      // Bars (center = 50%, range ±90)
      const barPct = v => Math.min(100, Math.max(0, 50 + (v/90)*50));
      const setBar = (id, pct) => { const el=document.getElementById(id); if(el) el.style.width=pct+'%'; };
      setBar('gyroPitchBar', barPct(g.pitch));
      setBar('gyroRollBar', barPct(g.roll));
      setBar('gyroYawBar', barPct(g.yaw));
      setBar('accelXBar', barPct(g.ax*90));
      setBar('accelYBar', barPct(g.ay*90));
      setBar('accelZBar', barPct(g.az*90));
      // 3D phone transform
      const phone = document.getElementById('gyroPhone3d');
      if (phone) phone.style.transform = `rotateX(${-g.pitch*0.5}deg) rotateZ(${g.roll}deg) rotateY(${g.yaw*0.2}deg)`;
    },

    buildKeyboard() {
      const rows = [
        ['Esc','F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11','F12'],
        ['`','1','2','3','4','5','6','7','8','9','0','-','=','⌫'],
        ['Tab','Q','W','E','R','T','Y','U','I','O','P','[',']','\\'],
        ['Caps','A','S','D','F','G','H','J','K','L',';',"'",'Enter'],
        ['Shift','Z','X','C','V','B','N','M',',','.','/','Shift'],
        ['Ctrl','Alt','⌘','Space','⌘','Alt','←','↑','↓','→']
      ];
      const rowIds = ['kbFnRow','kbRow1','kbRow2','kbRow3','kbRow4','kbRow5'];
      const wideKeys = new Set(['⌫','Tab','Caps','Enter','Shift','Ctrl','Alt','⌘','Space']);
      rows.forEach((row, ri) => {
        const el = document.getElementById(rowIds[ri]);
        if (!el) return;
        row.forEach(k => {
          const btn = document.createElement('button');
          btn.className = 'kb-key';
          if (k === 'Space') btn.classList.add('xxl');
          else if (wideKeys.has(k)) btn.classList.add(k==='Enter'||k==='Shift'||k==='Caps'?'xl':'wide');
          btn.textContent = k;
          btn.dataset.key = k.toUpperCase();
          btn.addEventListener('mousedown', () => pressKey(k, true));
          btn.addEventListener('mouseup', () => pressKey(k, false));
          btn.addEventListener('touchstart', e=>{e.preventDefault(); pressKey(k,true);},{passive:false});
          btn.addEventListener('touchend', e=>{e.preventDefault(); pressKey(k,false);},{passive:false});
          el.appendChild(btn);
        });
      });
    },

    buildNumpad() {
      const keys = ['7','8','9','/','4','5','6','*','1','2','3','-','0','.','Enter','+'];
      const grid = document.getElementById('numpadGrid');
      if (!grid) return;
      keys.forEach(k => {
        const btn = document.createElement('button');
        btn.className = 'kb-key';
        if (k === 'Enter' || k === '+') btn.style.height='96px';
        btn.textContent = k;
        btn.addEventListener('mousedown', ()=>pressKey(k,true));
        btn.addEventListener('mouseup', ()=>pressKey(k,false));
        btn.addEventListener('touchstart',e=>{e.preventDefault();pressKey(k,true);},{passive:false});
        btn.addEventListener('touchend',e=>{e.preventDefault();pressKey(k,false);},{passive:false});
        grid.appendChild(btn);
      });
    },

    buildHelpItems() {
      const items = [
        { title: '🔌 Connection Problems', steps: ['Check that your phone and PC are on the same Wi-Fi network.','Disable VPN or firewall temporarily and retry.','Try USB mode: connect cable, enable USB debugging on phone.','Restart the Hyperpulse app on both devices.','If QR fails, enter the room code manually.'] },
        { title: '🌀 Gyroscope Not Working', steps: ['Tap "Enable Sensors" button in the Gyroscope section.','On iOS 13+, you must grant motion permission via prompt.','On Android, ensure the app has motion sensor permissions.','Restart browser or reload page.','Calibrate sensor using the Calibrate button after enabling.'] },
        { title: '🎮 Controller Not Responding', steps: ['Verify device is shown as Connected in the sidebar.','Check the input monitor at the bottom of Gamepad mode.','Reload the page and reconnect.','Try a different controller mode and switch back.','Check browser compatibility (Chrome/Edge recommended).'] },
        { title: '⚡ High Latency', steps: ['Switch from Wi-Fi to USB for lowest latency.','Move phone closer to router.','Close background apps on your phone.','Set polling rate to 120Hz in Settings → Connection.','Check for interference from other wireless devices.'] },
        { title: '🔵 Bluetooth Issues', steps: ['Ensure Bluetooth is enabled on both devices.','Unpair and re-pair devices in system Bluetooth settings.','Keep devices within 10 meters of each other.','Bluetooth Web API requires Chrome/Edge on Windows.','Fallback: use Wi-Fi or USB mode.'] },
        { title: '📱 Phone Compatibility', steps: ['Supported: any modern Android/iOS with Chrome/Safari.','Gyroscope requires device with motion sensors.','Some older devices may have limited touch points.','iOS requires Safari 14.5+ for full Web API support.','Haptic feedback works on Android and iPhone.'] }
      ];
      const grid = document.getElementById('helpGrid');
      if (!grid) return;
      items.forEach(item => {
        const div = document.createElement('div');
        div.className = 'help-item';
        const header = document.createElement('div');
        header.className = 'help-item-header';
        header.innerHTML = `<span class="help-item-title">${item.title}</span><span class="help-item-chevron">▼</span>`;
        const body = document.createElement('div');
        body.className = 'help-item-body';
        const ol = document.createElement('ol');
        ol.className = 'help-steps';
        item.steps.forEach(s => { const li=document.createElement('li'); li.textContent=s; ol.appendChild(li); });
        body.appendChild(ol);
        header.onclick = () => { div.classList.toggle('open'); };
        div.appendChild(header);
        div.appendChild(body);
        grid.appendChild(div);
      });
    },

    buildCommunityGrid() {
      const data = [
        {game:'GTA V',creator:'HyperUser_01',mode:'Gamepad',rating:4.9,downloads:'28.7K',tags:['gamepad','action']},
        {game:'Forza Horizon 5',creator:'RacerPro_X',mode:'Racing',rating:4.8,downloads:'12.4K',tags:['racing','sim']},
        {game:'Rocket League',creator:'SonicBoost',mode:'Gamepad',rating:4.7,downloads:'9.2K',tags:['gamepad','sports']},
        {game:'Valorant',creator:'AimGod_99',mode:'Gyro',rating:4.8,downloads:'18.1K',tags:['gyro','fps']},
        {game:'Minecraft',creator:'CraftBuilder',mode:'Custom',rating:4.6,downloads:'7.4K',tags:['custom','builder']},
        {game:'FIFA 24',creator:'FootballKing',mode:'Gamepad',rating:4.5,downloads:'6.8K',tags:['gamepad','sports']},
        {game:'Cyberpunk 2077',creator:'NeoGamer',mode:'Gyro',rating:4.7,downloads:'14.3K',tags:['gyro','action']},
        {game:'Assetto Corsa',creator:'SimRacer',mode:'Racing',rating:4.9,downloads:'8.6K',tags:['racing','sim']},
      ];
      HP._communityData = data;
      HP.ui.renderCommunityGrid(data);
    },

    renderCommunityGrid(data) {
      const grid = document.getElementById('communityGrid');
      if (!grid) return;
      grid.innerHTML = '';
      data.forEach((item,i) => {
        const card = document.createElement('div');
        card.className = 'community-card';
        card.dataset.mode = item.mode.toLowerCase();
        const stars = '★'.repeat(Math.floor(item.rating)) + (item.rating%1>=0.5?'½':'');
        card.innerHTML = `
          <div class="cc-top">
            <div class="cc-game">${item.game}</div>
            <span class="cc-tag">${item.mode}</span>
          </div>
          <div class="cc-creator">by ${item.creator}</div>
          <div class="cc-stats">
            <span class="cc-stat"><span class="star-rating">${stars}</span> ${item.rating}</span>
            <span class="cc-stat">⬇ ${item.downloads}</span>
          </div>
          <div class="cc-actions">
            <button class="btn btn-accent btn-sm" onclick="downloadCommunityProfile(${i})">⬇ Download</button>
            <button class="fav-btn" id="fav-${i}" onclick="toggleFav(${i})">☆</button>
          </div>`;
        grid.appendChild(card);
      });
    },

    buildProfiles() {
      HP.state.profiles = [
        {id:'gta', name:'GTA V', mode:'gamepad', icon:'🎮', meta:'Last used 2h ago'},
        {id:'forza', name:'Forza Horizon 5', mode:'wheel', icon:'🏎️', meta:'Last used yesterday'},
        {id:'val', name:'Valorant', mode:'gyro', icon:'🌀', meta:'Last used 3 days ago'},
        {id:'mc', name:'Minecraft', mode:'custom', icon:'🎛️', meta:'Last used 1 week ago'},
      ];
      HP.ui.renderProfiles();
    },

    renderProfiles() {
      const grid = document.getElementById('profilesGrid');
      if (!grid) return;
      grid.innerHTML = '';
      HP.state.profiles.forEach(p => {
        const card = document.createElement('div');
        card.className = 'profile-card';
        card.innerHTML = `
          <div class="pc-top"><div class="pc-icon">${p.icon}</div><div><div class="pc-name">${p.name}</div><div class="pc-mode">${p.mode.toUpperCase()}</div></div></div>
          <div class="pc-meta">${p.meta}</div>
          <div class="pc-actions">
            <button class="btn btn-accent btn-sm" onclick="loadProfile('${p.id}')">▶ Load</button>
            <button class="btn btn-ghost btn-sm" onclick="duplicateProfile('${p.id}')">⧉</button>
            <button class="btn btn-ghost btn-sm" onclick="exportProfile('${p.id}')">↓</button>
            <button class="btn btn-ghost btn-sm" onclick="deleteProfile('${p.id}')">🗑</button>
          </div>`;
        grid.appendChild(card);
      });
    }
  },

  phoneModeLoop() {
    const modes = [
      {icon:'🎮', label:'GAMEPAD'},
      {icon:'🏎️', label:'RACING'},
      {icon:'🌀', label:'GYRO'},
      {icon:'🖱️', label:'MOUSE'},
      {icon:'⌨️', label:'KEYBOARD'},
    ];
    let idx = 0;
    setInterval(() => {
      idx = (idx+1) % modes.length;
      const m = modes[idx];
      const iconEl = document.querySelector('.phone-mode-icon');
      const lblEl = document.querySelector('.phone-mode-label');
      if (iconEl) { iconEl.style.opacity='0'; setTimeout(()=>{iconEl.textContent=m.icon; iconEl.style.opacity='1';},250); }
      if (lblEl)  { lblEl.style.opacity='0';  setTimeout(()=>{lblEl.textContent=m.label; lblEl.style.opacity='1';},250); }
    }, 2500);
  }
};

/* ==========================================================================
   GLOBAL HANDLER FUNCTIONS (called from HTML)
   ========================================================================== */

// ---- NAVIGATION ----
function navigate(pageId) { HP.nav.go(pageId); }
function scrollToSection(id) {
  if (HP.state.page !== 'landing') navigate('landing');
  setTimeout(() => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({behavior:'smooth'});
  }, 100);
}
function switchMode(mode) { HP.state.mode = mode; }
function toggleMobileNav() { document.getElementById('mobileNav').classList.toggle('open'); }

// ---- AUTH ----
function switchAuthTab(tab) {
  document.getElementById('tabLogin').classList.toggle('active', tab==='login');
  document.getElementById('tabSignup').classList.toggle('active', tab==='signup');
  document.getElementById('authFormLogin').style.display = tab==='login' ? '' : 'none';
  document.getElementById('authFormSignup').style.display = tab==='signup' ? '' : 'none';
}
function doLogin() {
  const email = document.getElementById('loginEmail')?.value || 'user@demo.com';
  const name = email.split('@')[0];
  HP.state.user = { name, email };
  document.getElementById('userAvatarInitial').textContent = name[0].toUpperCase();
  document.getElementById('userMenuName').textContent = name;
  navigate('dashboard');
  HP.ui.toast(`Welcome back, ${name}!`, 'success');
}
function doSignup() {
  const name = document.getElementById('signupName')?.value || 'New User';
  const email = document.getElementById('signupEmail')?.value || 'user@demo.com';
  HP.state.user = { name, email };
  document.getElementById('userAvatarInitial').textContent = name[0].toUpperCase();
  document.getElementById('userMenuName').textContent = name;
  navigate('dashboard');
  HP.ui.toast(`Account created! Welcome, ${name}!`, 'success');
}
function doLogout() {
  HP.state.user = null;
  navigate('landing');
  HP.ui.toast('Logged out.', 'info');
  toggleUserMenu();
}
function toggleUserMenu() {
  document.getElementById('userMenu').classList.toggle('open');
}

// ---- DASHBOARD SECTIONS ----
function switchDashSection(section) {
  document.querySelectorAll('.dash-section').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.sidebar-btn').forEach(b=>b.classList.remove('active'));
  const el = document.getElementById('ds-'+section);
  if (el) el.classList.add('active');
  const btn = document.getElementById('snav-'+section);
  if (btn) btn.classList.add('active');
  HP.state.dashSection = section;
  const labels = {dashboard:'Dashboard',gamepad:'Gamepad',wheel:'Racing Wheel',gyro:'Gyroscope',mouse:'Mouse Trackpad',keyboard:'Keyboard',custom:'Custom Builder',profiles:'Game Profiles',community:'Community',multiplayer:'Multiplayer',performance:'Performance',settings:'Settings',help:'Help & Troubleshoot'};
  document.getElementById('dashBreadcrumb').textContent = labels[section] || section;
  // Close mobile sidebar
  document.getElementById('sidebar').classList.remove('mobile-open');
}
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('mobile-open');
}

// ---- GAMEPAD ----
HP.hapticEnabled = true;

function pressBtn(name, isDown) {
  HP.state.inputs.buttons[name] = isDown;
  const el = document.getElementById('btn'+name);
  if (el) el.classList.toggle('pressed', isDown);
  if (isDown && HP.hapticEnabled && navigator.vibrate) try { navigator.vibrate(25); } catch(e){}
  // Update debug
  const active = Object.keys(HP.state.inputs.buttons).filter(k=>HP.state.inputs.buttons[k]);
  const dbg = document.getElementById('dbgBtns');
  if (dbg) dbg.textContent = active.length ? active.join(', ') : '—';
  const dpad = ['UP','DOWN','LEFT','RIGHT'];
  const dpadActive = dpad.filter(k=>HP.state.inputs.buttons[k]);
  const ddbg = document.getElementById('dbgDpad');
  if (ddbg) ddbg.textContent = dpadActive.length ? dpadActive.join('+') : '—';
  HP.broadcast.send();
}

// ---- RACING WHEEL ----
function shiftGear(delta) {
  let g = HP.state.inputs.wheel.gear + delta;
  g = Math.max(-1, Math.min(6, g));
  HP.state.inputs.wheel.gear = g;
  const labels = {'-1':'R', '0':'N'};
  document.getElementById('cockpitGear').textContent = labels[g] ?? g;
  if (navigator.vibrate) try { navigator.vibrate(40); } catch(e) {}
  HP.broadcast.send();
}
function handlePedal(type, val) {
  val = parseInt(val);
  HP.state.inputs.wheel[type] = val;
  document.getElementById(type+'Val').textContent = val+'%';
  document.getElementById(type+'Fill').style.height = val+'%';
  // Simulate speed from throttle/brake
  HP.state.inputs.wheel.speed = Math.round(val * 2.8);
  document.getElementById('cockpitSpeed').textContent = HP.state.inputs.wheel.speed;
  HP.broadcast.send();
}
function toggleGyroSteering() {
  const toggle = document.getElementById('gyroToggle');
  toggle.classList.toggle('on');
  const active = toggle.classList.contains('on');
  const badge = document.getElementById('wheelGyroBadge');
  if (badge) badge.classList.toggle('active', active);
  document.getElementById('gyroActiveDot').classList.toggle('active', active);
  document.getElementById('gyroActiveLabel').textContent = active ? 'Gyro Active' : 'Gyro Off';
  HP.ui.toast(active ? '🌀 Gyro steering ON' : 'Gyro steering OFF', 'info');
  if (active) requestMotionPermission();
}

// ---- GYROSCOPE ----
function requestMotionPermission() {
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    DeviceOrientationEvent.requestPermission()
      .then(res => { HP.ui.toast('Motion sensors: ' + res, res==='granted'?'success':'error'); HP.state.gyroActive = res==='granted'; })
      .catch(() => HP.ui.toast('Permission denied', 'error'));
  } else {
    HP.ui.toast('Motion sensors active (no permission required)', 'success');
    // Demo mode: simulate gyro
    HP.input.startGyroSimulation();
  }
}
HP.input.startGyroSimulation = function() {
  if (HP._gyroSim) return;
  let t = 0;
  HP._gyroSim = setInterval(() => {
    t += 0.05;
    HP.state.inputs.gyro.pitch = parseFloat((Math.sin(t) * 20).toFixed(1));
    HP.state.inputs.gyro.roll  = parseFloat((Math.cos(t*0.7) * 15).toFixed(1));
    HP.state.inputs.gyro.yaw   = parseFloat((Math.sin(t*0.3) * 30).toFixed(1));
    HP.state.inputs.gyro.ax    = parseFloat((Math.sin(t*1.2) * 0.5).toFixed(3));
    HP.state.inputs.gyro.ay    = parseFloat((Math.cos(t*0.9) * 0.8).toFixed(3));
    HP.state.inputs.gyro.az    = parseFloat((0.98 + Math.sin(t*2)*0.02).toFixed(3));
    HP.ui.updateGyroUI();
    if (HP.state.mode === 'wheel' && document.getElementById('gyroToggle')?.classList.contains('on')) {
      HP.state.inputs.wheel.angle = HP.state.inputs.gyro.roll * (HP.state.settings.wheelSens / 100) * 5;
      HP.render.updateWheelAngle();
    }
  }, 50);
};
function calibrateGyroZero() {
  const g = HP.state.inputs.gyro;
  HP.state.gyroZero = { pitch: g.pitch, roll: g.roll, yaw: g.yaw };
  HP.ui.toast('⊕ Gyro calibrated to zero', 'success');
}

// ---- MOUSE ----
function pressMouseBtn(btn, isDown) {
  HP.state.inputs.mouse[btn] = isDown;
  const ids = {left:'mouseLeftBtn', middle:'mouseMiddleBtn', right:'mouseRightBtn'};
  const el = document.getElementById(ids[btn]);
  if (el) el.classList.toggle('pressed', isDown);
  const active = ['left','middle','right'].filter(b=>HP.state.inputs.mouse[b]);
  document.getElementById('mouseClickState').textContent = active.length ? active.join('+').toUpperCase()+' CLICK' : '—';
  HP.broadcast.send();
}

// ---- KEYBOARD ----
function pressKey(key, isDown) {
  HP.state.inputs.keys[key] = isDown;
  const els = document.querySelectorAll(`[data-key="${key.toUpperCase()}"]`);
  els.forEach(el => el.classList.toggle('pressed', isDown));
  if (isDown) {
    document.getElementById('lastKeyPressed').textContent = key;
    if (navigator.vibrate) try { navigator.vibrate(15); } catch(e) {}
    HP.broadcast.send();
  }
}
function switchKbMode(mode) {
  document.querySelectorAll('.kb-tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.keyboard-view').forEach(v=>v.classList.remove('active'));
  document.getElementById('kbt-'+mode).classList.add('active');
  document.getElementById('kb-'+mode).classList.add('active');
}

// ---- CUSTOM BUILDER ----
let builderDragType = null;
function dragPalette(e, type) { builderDragType = type; e.dataTransfer.effectAllowed = 'copy'; }
function dropOnCanvas(e) {
  if (!builderDragType) return;
  const canvas = document.getElementById('builderCanvas');
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left - 50;
  const y = e.clientY - rect.top - 30;
  const hint = canvas.querySelector('.builder-grid-hint');
  if (hint) hint.remove();
  const el = document.createElement('div');
  el.className = `builder-element b-${builderDragType}`;
  el.style.left = Math.max(0,x)+'px';
  el.style.top  = Math.max(0,y)+'px';
  const labels = {joystick:'Stick',button:'BTN',dpad:'D-Pad',trigger:'Trigger',slider:'Slider',touchpad:'Touchpad',gyro:'Gyro',macro:'Macro'};
  el.textContent = labels[builderDragType] || builderDragType;
  const del = document.createElement('button');
  del.className = 'del-btn'; del.textContent = '×';
  del.onclick = (ev) => { ev.stopPropagation(); el.remove(); };
  el.appendChild(del);
  makeDraggable(el);
  el.onclick = () => { document.querySelectorAll('.builder-element').forEach(e=>e.classList.remove('selected')); el.classList.add('selected'); showBuilderProps(el); };
  canvas.appendChild(el);
  builderDragType = null;
}
function makeDraggable(el) {
  let ox=0,oy=0,sx=0,sy=0;
  el.addEventListener('mousedown', e=>{
    if (e.target.classList.contains('del-btn')) return;
    sx=e.clientX; sy=e.clientY;
    ox=parseInt(el.style.left)||0; oy=parseInt(el.style.top)||0;
    const move = ev=>{el.style.left=(ox+ev.clientX-sx)+'px'; el.style.top=(oy+ev.clientY-sy)+'px';};
    const up = ()=>{ window.removeEventListener('mousemove',move); window.removeEventListener('mouseup',up); };
    window.addEventListener('mousemove',move); window.addEventListener('mouseup',up);
  });
}
function showBuilderProps(el) {
  const panel = document.getElementById('builderProps');
  panel.innerHTML = `<div style="font-size:0.78rem;color:var(--text-m);margin-bottom:8px;">Position: <b style="color:var(--text)">${el.style.left} / ${el.style.top}</b></div><div style="font-size:0.78rem;color:var(--text-m);">Type: <b style="color:var(--accent)">${el.className.split('b-')[1]?.split(' ')[0]||'element'}</b></div>`;
}
function clearBuilder() {
  const canvas = document.getElementById('builderCanvas');
  canvas.innerHTML = '<div class="builder-grid-hint">Drag controls here to build your layout</div>';
  document.getElementById('builderProps').innerHTML = '<div class="empty-props">No element selected</div>';
}
function saveBuilderProfile() {
  const name = document.getElementById('builderProfileName')?.value || 'Custom Layout';
  HP.ui.toast(`💾 Profile "${name}" saved`, 'success');
}
function loadBuilderProfile() { HP.ui.toast('📂 Load profile coming soon', 'info'); }

// ---- GAME PROFILES ----
function openNewProfileModal() { HP.ui.openModal('newProfileModal'); }
function createProfile() {
  const name = document.getElementById('npGameName')?.value;
  const mode = document.getElementById('npMode')?.value;
  if (!name) { HP.ui.toast('Enter a game name', 'error'); return; }
  const modeIcons = {gamepad:'🎮',wheel:'🏎️',gyro:'🌀',mouse:'🖱️',keyboard:'⌨️',custom:'🎛️'};
  HP.state.profiles.unshift({id:'p'+Date.now(), name, mode, icon:modeIcons[mode]||'🎮', meta:'Just created'});
  HP.ui.renderProfiles();
  HP.ui.closeModal('newProfileModal');
  HP.ui.toast(`Profile "${name}" created!`, 'success');
}
function loadProfile(id) {
  const p = HP.state.profiles.find(x=>x.id===id);
  if (p) { HP.state.mode = p.mode; switchDashSection(p.mode==='wheel'?'wheel':p.mode==='gyro'?'gyro':p.mode); HP.ui.toast(`▶ Loaded: ${p.name}`, 'success'); }
}
function duplicateProfile(id) {
  const p = HP.state.profiles.find(x=>x.id===id);
  if (p) { const copy={...p, id:'p'+Date.now(), name:p.name+' (copy)', meta:'Just created'}; HP.state.profiles.push(copy); HP.ui.renderProfiles(); HP.ui.toast('Profile duplicated', 'info'); }
}
function deleteProfile(id) {
  HP.state.profiles = HP.state.profiles.filter(x=>x.id!==id);
  HP.ui.renderProfiles();
  HP.ui.toast('Profile deleted', 'info');
}
function importProfile() {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = '.json';
  input.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const p = JSON.parse(ev.target.result);
        if (!p.name || !p.mode) throw new Error('Invalid');
        p.id = 'imp-' + Date.now();
        p.meta = 'Imported just now';
        HP.state.profiles.unshift(p);
        HP.ui.renderProfiles();
        HP.ui.toast('📥 Profile imported: ' + p.name, 'success');
      } catch(err) { HP.ui.toast('Invalid profile file', 'error'); }
    };
    reader.readAsText(file);
  };
  input.click();
}

function exportProfile(id) {
  const p = HP.state.profiles.find(x => x.id === id);
  if (!p) return;
  const blob = new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = p.name.replace(/\s+/g, '-').toLowerCase() + '-hyperpulse.json';
  a.click();
  URL.revokeObjectURL(a.href);
  HP.ui.toast('↓ Profile exported', 'success');
}

// ---- COMMUNITY ----
function filterCommunity(query) {
  const q = (query || document.getElementById('communitySearch')?.value || '').toLowerCase();
  const modeFilter = document.getElementById('communityFilter')?.value?.toLowerCase() || '';
  const filtered = HP._communityData?.filter(d => {
    const matchQ = !q || d.game.toLowerCase().includes(q) || d.creator.toLowerCase().includes(q);
    const matchM = !modeFilter || d.mode.toLowerCase().includes(modeFilter);
    return matchQ && matchM;
  }) || [];
  HP.ui.renderCommunityGrid(filtered);
}
function sortCommunity(by) {
  const data = [...(HP._communityData || [])];
  if (by === 'rating') data.sort((a,b)=>b.rating-a.rating);
  else if (by === 'downloads') data.sort((a,b)=>parseFloat(b.downloads)-parseFloat(a.downloads));
  HP.ui.renderCommunityGrid(data);
}
function downloadCommunityProfile(i) { HP.ui.toast('⬇ Profile downloaded to your library!', 'success'); }
function toggleFav(i) {
  const btn = document.getElementById('fav-'+i);
  if (!btn) return;
  btn.classList.toggle('active');
  btn.textContent = btn.classList.contains('active') ? '★' : '☆';
  HP.ui.toast(btn.classList.contains('active') ? '★ Added to favorites' : 'Removed from favorites', 'info');
}
function openUploadModal() { HP.ui.openModal('uploadModal'); }
function uploadCommunityProfile() { HP.ui.closeModal('uploadModal'); HP.ui.toast('↑ Profile shared with community!', 'success'); }

// ---- MULTIPLAYER ----
function newRoomCode() {
  HP.state.roomCode = 'HYPER-' + (1000 + Math.floor(Math.random()*9000));
  HP.ui.updateRoomCode();
  HP.ui.toast('⟳ New room code generated', 'info');
}
function copyRoomCode() {
  if (navigator.clipboard) navigator.clipboard.writeText(HP.state.roomCode);
  HP.ui.toast('📋 Room code copied!', 'success');
}
function startMultiplayerSession() { HP.ui.toast('▶ Multiplayer session started — share code with players', 'success'); }

// ---- DEVICE CONNECTION ----
function openConnectModal() { HP.ui.openModal('connectModal'); }
function switchConnectTab(tab) {
  document.querySelectorAll('.cmt').forEach(b=>b.classList.remove('active'));
  document.querySelectorAll('.cmc').forEach(c=>c.classList.remove('active'));
  document.getElementById('cmt-'+tab).classList.add('active');
  document.getElementById('cmc-'+tab).classList.add('active');
}
function simulateConnect(transport) {
  const status = document.getElementById('modalDeviceStatus');
  if (status) status.textContent = `⏳ Searching for devices on ${transport}...`;
  setTimeout(() => {
    HP.state.device = { connected: true, name: "Mani's Phone", battery: 74, latency: 8, transport, signal: 'Excellent' };
    if (status) status.textContent = '● Connected — Mani\'s Phone (8ms)';
    HP.ui.updateSidebarDevice();
    addConnLog(`Device connected via ${transport}`);
    setTimeout(() => { HP.ui.closeModal('connectModal'); HP.ui.toast(`✓ Connected via ${transport}`, 'success'); }, 800);
  }, 1500);
}
function connectUsb() {
  if (navigator.usb) {
    navigator.usb.requestDevice({filters:[]})
      .then(d => { simulateConnect('USB'); })
      .catch(() => simulateConnect('USB'));
  } else { simulateConnect('USB'); }
}
function joinByCode() {
  const code = document.getElementById('manualCodeInput')?.value?.trim();
  if (!code) return HP.ui.toast('Enter a room code', 'error');
  simulateConnect('Wi-Fi');
}
function closeModal(id) { HP.ui.closeModal(id); }
function closeAllModals() { HP.ui.closeAllModals(); }

// ---- PERFORMANCE ----
function addConnLog(msg) {
  const log = document.getElementById('connLog');
  if (!log) return;
  const now = new Date(); const time = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}:${now.getSeconds().toString().padStart(2,'0')}`;
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  entry.textContent = `[${time}] ${msg}`;
  log.insertBefore(entry, log.firstChild);
}
function clearPerfLog() { const l=document.getElementById('connLog'); if(l) l.innerHTML=''; }

// ---- SETTINGS ----
function switchSettingsTab(tab) {
  document.querySelectorAll('.stab').forEach(b=>b.classList.remove('active'));
  document.querySelectorAll('.settings-pane').forEach(p=>p.classList.remove('active'));
  document.getElementById('stab-'+tab).classList.add('active');
  document.getElementById('spane-'+tab).classList.add('active');
}
function applyTheme(theme) {
  const root = document.documentElement;
  if (theme==='amoled') { root.style.setProperty('--bg','#000000'); root.style.setProperty('--bg-2','#050505'); }
  else if (theme==='light') { root.style.setProperty('--bg','#f5f5f5'); root.style.setProperty('--bg-2','#ffffff'); root.style.setProperty('--text','#111'); root.style.setProperty('--text-m','#555'); }
  else { root.style.setProperty('--bg','#0a0a0a'); root.style.setProperty('--bg-2','#111111'); root.style.setProperty('--text','#f0f0f0'); root.style.setProperty('--text-m','#888888'); }
}
function setAccent(color) {
  document.documentElement.style.setProperty('--accent', color);
  HP.state.settings.accent = color;
  HP.ui.toast('Accent color updated', 'info');
}
function resetSettings() { HP.ui.toast('Settings reset to defaults', 'info'); }
function saveSettings() { HP.ui.toast('💾 Settings saved', 'success'); }

// ---- HELP ----
function filterHelp(query) {
  const q = query.toLowerCase();
  document.querySelectorAll('.help-item').forEach(item => {
    const title = item.querySelector('.help-item-title')?.textContent.toLowerCase() || '';
    item.style.display = title.includes(q) ? '' : 'none';
  });
}

// ---- INIT ----
document.addEventListener('DOMContentLoaded', () => HP.init());

// Close user menu on outside click
document.addEventListener('click', e => {
  const menu = document.getElementById('userMenu');
  const avatar = document.getElementById('userAvatar');
  if (menu && !avatar?.contains(e.target) && !menu.contains(e.target)) menu.classList.remove('open');
});

// Prevent joystick context menu on mobile
document.querySelectorAll?.('.joystick-base, .trackpad-surface');
document.addEventListener('contextmenu', e => {
  if (e.target.closest?.('.joystick-base') || e.target.closest?.('.trackpad-surface')) e.preventDefault();
});

/* ---- HERO STATS COUNTER ANIMATION ---- */
function animateCounters() {
  document.querySelectorAll('.hs-num[data-target]').forEach(el => {
    const target = parseInt(el.dataset.target);
    const duration = 1800;
    const step = target / (duration / 16);
    let current = 0;
    const timer = setInterval(() => {
      current = Math.min(current + step, target);
      el.textContent = current >= 1000 ? Math.round(current/1000)+'K+' : Math.round(current)+'';
      if (current >= target) clearInterval(timer);
    }, 16);
  });
}
// Trigger once hero is visible
const heroObserver = new IntersectionObserver(entries => {
  if (entries[0].isIntersecting) { animateCounters(); heroObserver.disconnect(); }
}, { threshold: 0.3 });
const heroEl = document.getElementById('hero');
if (heroEl) heroObserver.observe(heroEl);

/* ---- SCROLL REVEAL OBSERVER ---- */
const revealObserver = new IntersectionObserver(entries => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); revealObserver.unobserve(e.target); } });
}, { threshold: 0.12 });
function initScrollReveal() {
  document.querySelectorAll('.reveal, .reveal-left, .reveal-right').forEach(el => revealObserver.observe(el));
}
document.addEventListener('DOMContentLoaded', initScrollReveal);

/* ---- ACTIVE NAV LINK ON SCROLL ---- */
function initNavHighlight() {
  const sections = ['modes','how-it-works','pairing','testimonials'];
  const links = document.querySelectorAll('.nav-link');
  const sectionMap = { 'modes':0, 'how-it-works':1, 'pairing':2, 'testimonials':3 };
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        links.forEach(l => l.classList.remove('active'));
        const idx = sectionMap[entry.target.id];
        if (idx !== undefined && links[idx]) links[idx].classList.add('active');
      }
    });
  }, { threshold: 0.4 });
  sections.forEach(id => { const el = document.getElementById(id); if (el) observer.observe(el); });
}
document.addEventListener('DOMContentLoaded', initNavHighlight);

/* ---- TRIGGER PRESSURE ---- */
function updateTriggerPressure(trigger, val) {
  val = parseInt(val);
  HP.state.inputs.triggers = HP.state.inputs.triggers || {};
  HP.state.inputs.triggers[trigger] = val;
  const key = trigger.toLowerCase();
  const fill = document.getElementById(key+'Fill');
  const lbl  = document.getElementById(key+'PctLabel');
  if (fill) fill.style.width = val + '%';
  if (lbl)  lbl.textContent  = val + '%';
  document.getElementById('dbgTriggers').textContent =
    (HP.state.inputs.triggers['L2']||0) + '% / ' + (HP.state.inputs.triggers['R2']||0) + '%';
  HP.broadcast.send();
}

/* ---- RPM SHIFT BAR ---- */
function updateRPMBar(throttle) {
  const leds = document.querySelectorAll('#rpmBar .rpm-led');
  const active = Math.round((throttle / 100) * leds.length);
  leds.forEach((led, i) => led.classList.toggle('on', i < active));
}
// Hook into pedal handler
const _origHandlePedal = handlePedal;
handlePedal = function(type, val) {
  _origHandlePedal(type, val);
  if (type === 'throttle') updateRPMBar(parseInt(val));
};

/* ---- MOBILE BOTTOM NAV ---- */
function mbnActive(section) {
  document.querySelectorAll('.mbn-btn').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById('mbn-' + section);
  if (btn) btn.classList.add('active');
}
// Show/hide bottom nav based on active page
const _origNavigate = navigate;
navigate = function(pageId) {
  _origNavigate(pageId);
  const mbn = document.getElementById('mobileBottomNav');
  if (mbn) mbn.style.display = pageId === 'dashboard' ? '' : 'none';
};
