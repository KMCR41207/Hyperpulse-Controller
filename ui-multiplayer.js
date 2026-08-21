/* ==========================================================================
   HYPERPULSE // MULTIPLAYER SESSION UI  (ui-multiplayer.js)
   ConnectionSession + SessionPlayer entities from ERD.

   Architecture note:
   This module manages session state via HP (state.js / localStorage).
   The BroadcastChannel in app.js handles local multi-tab sync.
   Real WebSocket / WebRTC transport is intentionally NOT faked here —
   the architecture is ready to wire up when a backend exists.
   ========================================================================== */

(function () {

  const MAX_PLAYERS  = 4;
  const CTRL_ICONS   = { gamepad:'🎮', racing:'🏎', gyro:'🔭', mouse:'🖱', keyboard:'⌨', custom:'🛠' };
  const CTRL_TYPES   = ['gamepad','racing','gyro','mouse','keyboard','custom'];
  const SIGNAL_COLOR = { 100:'#22cc44', 75:'#22cc44', 50:'#ff9900', 25:'#cc4444', 0:'#555' };

  function esc(s) {
    return String(s||'').replace(/[&<>"']/g, c =>
      ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function signalColor(q) {
    if (q >= 80) return '#22cc44';
    if (q >= 50) return '#ff9900';
    if (q >= 25) return '#ff5500';
    return '#cc4444';
  }

  function signalBars(q) {
    const filled = Math.round(q / 25); // 0-4 bars
    return Array.from({length:4}, (_,i) =>
      `<span style="display:inline-block;width:4px;height:${6+i*3}px;background:${i<filled?signalColor(q):'#333'};margin:0 1px;vertical-align:bottom;"></span>`
    ).join('');
  }

  function timeAgo(iso) {
    if (!iso) return '';
    const d = Math.floor((Date.now()-new Date(iso))/1000);
    if (d < 60) return d + 's ago';
    if (d < 3600) return Math.floor(d/60) + 'm ago';
    return Math.floor(d/3600) + 'h ago';
  }

  /* ── Inject HTML ────────────────────────────────────────────────────────── */
  function inject() {
    document.body.insertAdjacentHTML('beforeend', `
<section id="multiplayerSection" class="app-section">
<div class="section-container">

  <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:28px; flex-wrap:wrap; gap:12px;">
    <div>
      <h2 class="section-title">MULTIPLAYER</h2>
      <p class="section-sub">SESSION ROOMS · UP TO ${MAX_PLAYERS} PLAYERS · REAL-TIME SYNC</p>
    </div>
    <button class="cyber-button sm secondary" onclick="showSection('dashboard')">← BACK</button>
  </div>

  <!-- ── State: NO SESSION ─────────────────────────────────── -->
  <div id="mpNoSession">
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px; max-width:700px; margin:0 auto;">

      <!-- Create room -->
      <div style="background:var(--bg-panel); border:1px solid var(--dark-border); padding:28px; text-align:center;">
        <div style="font-size:2.5rem; margin-bottom:12px;">🎮</div>
        <div style="font-family:var(--font-display); font-size:1.2rem; letter-spacing:2px; margin-bottom:8px;">CREATE ROOM</div>
        <p style="font-family:var(--font-mono); font-size:0.72rem; color:var(--text-muted-dark); line-height:1.6; margin-bottom:20px;">
          Host a session. Share the code with up to ${MAX_PLAYERS-1} friends.
        </p>
        <div class="hp-field" style="text-align:left; margin-bottom:12px;">
          <label class="hp-label">TRANSPORT MODE</label>
          <select class="hp-input" id="mpTransportMode">
            <option value="local">🔗 LOCAL SYNC (same browser)</option>
            <option value="usb">⚡ USB WIRED</option>
            <option value="wifi">📶 WI-FI P2P</option>
          </select>
        </div>
        <div class="hp-field" style="text-align:left; margin-bottom:16px;">
          <label class="hp-label">MY CONTROLLER TYPE</label>
          <select class="hp-input" id="mpHostCtrlType">
            ${CTRL_TYPES.map(t=>`<option value="${t}">${CTRL_ICONS[t]} ${t.toUpperCase()}</option>`).join('')}
          </select>
        </div>
        <button class="cyber-button md primary" style="width:100%;" onclick="HPMultiplayer.createRoom()">
          [ CREATE SESSION ⚡ ]
        </button>
      </div>

      <!-- Join room -->
      <div style="background:var(--bg-panel); border:1px solid var(--dark-border); padding:28px; text-align:center;">
        <div style="font-size:2.5rem; margin-bottom:12px;">🔗</div>
        <div style="font-family:var(--font-display); font-size:1.2rem; letter-spacing:2px; margin-bottom:8px;">JOIN ROOM</div>
        <p style="font-family:var(--font-mono); font-size:0.72rem; color:var(--text-muted-dark); line-height:1.6; margin-bottom:20px;">
          Enter a HYPER code from the host to connect.
        </p>
        <div class="hp-field" style="text-align:left; margin-bottom:12px;">
          <label class="hp-label">SESSION CODE</label>
          <input class="hp-input" id="mpJoinCode" placeholder="HYPER-0000"
            style="text-transform:uppercase; letter-spacing:2px; font-size:1rem; text-align:center;"
            oninput="this.value=this.value.toUpperCase()" maxlength="10">
        </div>
        <div class="hp-field" style="text-align:left; margin-bottom:16px;">
          <label class="hp-label">MY CONTROLLER TYPE</label>
          <select class="hp-input" id="mpJoinCtrlType">
            ${CTRL_TYPES.map(t=>`<option value="${t}">${CTRL_ICONS[t]} ${t.toUpperCase()}</option>`).join('')}
          </select>
        </div>
        <div id="mpJoinError" style="color:var(--accent-red); font-family:var(--font-mono); font-size:0.72rem; min-height:16px; margin-bottom:8px;"></div>
        <button class="cyber-button md primary" style="width:100%;" onclick="HPMultiplayer.joinRoom()">
          [ JOIN SESSION → ]
        </button>
      </div>
    </div>

    <!-- Transport info banner -->
    <div style="max-width:700px; margin:20px auto 0; padding:12px 16px; background:var(--bg-charcoal); border:1px solid #2a2a2a; border-left:3px solid #ff9900;">
      <p style="font-family:var(--font-mono); font-size:0.7rem; color:#888; line-height:1.7;">
        ⚠ <strong style="color:#ff9900;">PROTOTYPE MODE</strong> — Session state is managed locally via BroadcastChannel.
        Real WebSocket / WebRTC multiplayer requires a backend server.
        Architecture is ready for integration when a server is available.
      </p>
    </div>
  </div>

  <!-- ── State: ACTIVE SESSION ─────────────────────────────── -->
  <div id="mpActiveSession" style="display:none;">

    <!-- Session info bar -->
    <div style="display:flex; justify-content:space-between; align-items:center; padding:14px 20px;
      background:var(--bg-charcoal); border:1px solid var(--dark-border); margin-bottom:20px; flex-wrap:wrap; gap:10px;">
      <div style="display:flex; gap:20px; flex-wrap:wrap; align-items:center;">
        <div>
          <div style="font-family:var(--font-mono); font-size:0.6rem; color:#666; margin-bottom:2px;">SESSION CODE</div>
          <div id="mpSessionCode" style="font-family:var(--font-display); font-size:1.8rem; letter-spacing:4px; color:#fff;"></div>
        </div>
        <div>
          <div style="font-family:var(--font-mono); font-size:0.6rem; color:#666; margin-bottom:2px;">STATUS</div>
          <div id="mpSessionStatus" style="font-family:var(--font-mono); font-size:0.8rem; color:#22cc44; font-weight:700;">ACTIVE</div>
        </div>
        <div>
          <div style="font-family:var(--font-mono); font-size:0.6rem; color:#666; margin-bottom:2px;">PLAYERS</div>
          <div id="mpPlayerCount" style="font-family:var(--font-mono); font-size:0.8rem; font-weight:700;">0 / ${MAX_PLAYERS}</div>
        </div>
        <div>
          <div style="font-family:var(--font-mono); font-size:0.6rem; color:#666; margin-bottom:2px;">TRANSPORT</div>
          <div id="mpTransportLabel" style="font-family:var(--font-mono); font-size:0.8rem;">LOCAL</div>
        </div>
      </div>
      <div style="display:flex; gap:8px; flex-wrap:wrap;">
        <button class="cyber-button sm secondary" onclick="HPMultiplayer.copyCode()">📋 COPY CODE</button>
        <button class="cyber-button sm danger"    onclick="HPMultiplayer.endSession()">⏹ END SESSION</button>
      </div>
    </div>

    <!-- Player slots -->
    <div style="margin-bottom:24px;">
      <div style="font-family:var(--font-mono); font-size:0.7rem; color:#666; letter-spacing:2px; margin-bottom:12px;">
        CONNECTED PLAYERS
      </div>
      <div id="mpPlayerSlots" style="display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:12px;"></div>
    </div>

    <!-- Add simulated player (for testing) -->
    <div style="padding:16px; background:var(--bg-charcoal); border:1px solid var(--dark-border); margin-bottom:20px;">
      <div style="font-family:var(--font-mono); font-size:0.7rem; color:#666; margin-bottom:10px; letter-spacing:1px;">
        ADD SIMULATED PLAYER <span style="color:#555;">(local test only)</span>
      </div>
      <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
        <input class="hp-input" id="mpSimName" placeholder="Player name" style="flex:1; min-width:120px;">
        <select class="hp-input" id="mpSimCtrl" style="flex:0 0 auto;">
          ${CTRL_TYPES.map(t=>`<option value="${t}">${CTRL_ICONS[t]} ${t.toUpperCase()}</option>`).join('')}
        </select>
        <button class="cyber-button sm primary" onclick="HPMultiplayer.addSimPlayer()">+ ADD</button>
      </div>
    </div>

    <!-- Session log -->
    <div>
      <div style="font-family:var(--font-mono); font-size:0.7rem; color:#666; letter-spacing:2px; margin-bottom:8px;">SESSION LOG</div>
      <div id="mpSessionLog" style="height:160px; overflow-y:auto; background:#080808; border:1px solid #1a1a1a; padding:8px;
        font-family:var(--font-mono); font-size:0.72rem; color:#666;"></div>
    </div>

  </div>

</div>
</section>`);
  }

  /* ── Session log ────────────────────────────────────────────────────────── */
  const _log = [];
  function logEvent(msg) {
    const ts = new Date().toLocaleTimeString();
    _log.push({ ts, msg });
    if (_log.length > 50) _log.shift();
    const el = document.getElementById('mpSessionLog');
    if (!el) return;
    el.innerHTML = [..._log].reverse().map(e =>
      `<div style="padding:2px 0; border-bottom:1px solid #111;">
        <span style="color:#444;">${e.ts}</span>
        <span style="margin-left:8px; color:#aaa;">${esc(e.msg)}</span>
      </div>`).join('');
  }

  /* ── Render player slots ────────────────────────────────────────────────── */
  function renderPlayers() {
    const session = HP.getActiveSession();
    const players = HP.getSessionPlayers();
    const container = document.getElementById('mpPlayerSlots');
    const countEl   = document.getElementById('mpPlayerCount');
    if (!container) return;
    if (countEl) countEl.innerText = players.length + ' / ' + (session ? session.max_players : MAX_PLAYERS);

    // Render filled slots
    const slots = Array.from({length: MAX_PLAYERS}, (_, i) => {
      const p = players.find(x => x.player_number === i+1);
      if (p) {
        const isHost = session && p.user_id === session.host_user_id;
        const user   = HP.getUser();
        const isMe   = user && p.user_id === user.user_id;
        return `
          <div style="background:var(--bg-panel); border:1px solid ${isHost?'var(--accent-red)':'var(--dark-border)'};
            padding:16px; position:relative;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
              <div style="display:flex; align-items:center; gap:10px;">
                <div style="width:36px; height:36px; background:${isHost?'var(--accent-red)':'#2a2a2a'};
                  display:flex; align-items:center; justify-content:center;
                  font-family:var(--font-display); font-size:1.2rem; font-weight:700; flex-shrink:0;">
                  P${p.player_number}
                </div>
                <div>
                  <div style="font-family:var(--font-mono); font-size:0.85rem; font-weight:700; color:#fff;">
                    ${esc(p.display_name || 'Player ' + p.player_number)}
                    ${isHost ? '<span style="font-size:0.6rem; color:var(--accent-red); margin-left:6px;">HOST</span>' : ''}
                    ${isMe && !isHost ? '<span style="font-size:0.6rem; color:#888; margin-left:6px;">YOU</span>' : ''}
                  </div>
                  <div style="font-family:var(--font-mono); font-size:0.7rem; color:#666; margin-top:2px;">
                    ${CTRL_ICONS[p.current_controller_type]||'🎮'} ${(p.current_controller_type||'').toUpperCase()}
                  </div>
                </div>
              </div>
              <div style="text-align:right;">
                <div>${signalBars(p.signal_quality)}</div>
                <div style="font-family:var(--font-mono); font-size:0.65rem; color:${signalColor(p.signal_quality)}; margin-top:2px;">
                  ${p.signal_quality}%
                </div>
              </div>
            </div>
            <div style="display:flex; justify-content:space-between; font-family:var(--font-mono); font-size:0.65rem; color:#555;">
              <span>Joined ${timeAgo(p.joined_at)}</span>
              ${isMe || isHost ? `<button class="cyber-button sm danger" style="padding:2px 8px; font-size:0.6rem;"
                onclick="HPMultiplayer.removePlayer('${esc(p.user_id)}')">KICK</button>` : ''}
            </div>
          </div>`;
      } else {
        return `
          <div style="background:#0a0a0a; border:1px dashed #1f1f1f; padding:16px;
            display:flex; align-items:center; justify-content:center; min-height:96px; opacity:0.5;">
            <div style="text-align:center;">
              <div style="font-family:var(--font-display); font-size:1.2rem; color:#2a2a2a;">P${i+1}</div>
              <div style="font-family:var(--font-mono); font-size:0.65rem; color:#333; margin-top:4px;">EMPTY SLOT</div>
            </div>
          </div>`;
      }
    });
    container.innerHTML = slots.join('');
  }

  /* ── Show/hide session views ────────────────────────────────────────────── */
  function showSessionView(active) {
    const ns = document.getElementById('mpNoSession');
    const as = document.getElementById('mpActiveSession');
    if (ns) ns.style.display = active ? 'none' : 'block';
    if (as) as.style.display = active ? 'block' : 'none';
  }

  /* ── Auth check helper ──────────────────────────────────────────────────── */
  function requireAuth(action) {
    if (!HP.isLoggedIn()) {
      if (typeof showToast === 'function') showToast('Sign in to ' + action + '.');
      if (window.HPAuth) HPAuth.open();
      return false;
    }
    return true;
  }

  /* ── Public API ─────────────────────────────────────────────────────────── */
  window.HPMultiplayer = {

    init() { inject(); },

    open() {
      if (typeof showSection === 'function') showSection('multiplayer');
      const session = HP.getActiveSession();
      if (session && session.status === 'active') {
        this._restoreSession(session);
      } else {
        showSessionView(false);
      }
    },

    createRoom() {
      if (!requireAuth('create a room')) return;

      const transport = document.getElementById('mpTransportMode')?.value || 'local';
      const ctrlType  = document.getElementById('mpHostCtrlType')?.value || 'gamepad';

      const session = HP.createSession(transport);
      const user    = HP.getUser();

      // Add host as player 1
      HP.addSessionPlayer(user.user_id, null, ctrlType);
      const players = HP.getSessionPlayers();
      if (players[0]) {
        players[0].display_name = user.name || user.email || 'Host';
        players[0].signal_quality = 100;
      }

      // Update global session code in app.js
      if (typeof state !== 'undefined') {
        state.sessionId = session.session_code;
        state.isConnected = true;
      }

      this._restoreSession(session);
      logEvent('Session created: ' + session.session_code);
      logEvent('Host joined as P1 (' + ctrlType + ')');

      if (typeof showToast === 'function') showToast('⚡ Session created: ' + session.session_code);
      if (typeof playSound === 'function') playSound('chime');
    },

    joinRoom() {
      const errEl = document.getElementById('mpJoinError');
      if (errEl) errEl.textContent = '';

      if (!requireAuth('join a room')) return;

      const code     = (document.getElementById('mpJoinCode')?.value || '').trim().toUpperCase();
      const ctrlType = document.getElementById('mpJoinCtrlType')?.value || 'gamepad';

      if (!code) { if (errEl) errEl.textContent = 'Enter a session code.'; return; }
      if (!code.startsWith('HYPER-')) { if (errEl) errEl.textContent = 'Code must start with HYPER-'; return; }

      // Check if there's an active session with this code
      const existing = HP.getActiveSession();
      if (!existing || existing.session_code !== code) {
        // Create a session matching the code (simulates joining in prototype mode)
        // In a real app, this would be a WebSocket handshake
        const fakeSession = HP.createSession('local');
        // Override the generated code with the entered one
        fakeSession.session_code = code;
        // Save back (direct mutation since HP state is in-memory)
        const s = HP.getActiveSession();
        if (s) s.session_code = code;
        logEvent('Joined existing session: ' + code + ' (prototype — local simulation)');
      }

      const user = HP.getUser();
      const player = HP.addSessionPlayer(user.user_id, null, ctrlType);
      if (!player) {
        if (errEl) errEl.textContent = 'Session is full or you are already in it.';
        HP.endSession();
        return;
      }
      player.display_name = user.name || user.email || ('Player ' + player.player_number);
      player.signal_quality = Math.floor(70 + Math.random() * 30);

      const session = HP.getActiveSession();
      this._restoreSession(session);
      logEvent(player.display_name + ' joined as P' + player.player_number + ' (' + ctrlType + ')');
      if (typeof showToast === 'function') showToast('✓ Joined session: ' + code);
      if (typeof playSound === 'function') playSound('chime');
    },

    _restoreSession(session) {
      showSessionView(true);
      const codeEl    = document.getElementById('mpSessionCode');
      const statusEl  = document.getElementById('mpSessionStatus');
      const transportEl = document.getElementById('mpTransportLabel');
      if (codeEl)    codeEl.innerText    = session.session_code || '';
      if (statusEl)  statusEl.innerText  = (session.status || 'active').toUpperCase();
      if (transportEl) transportEl.innerText = (session.transport_mode || 'local').toUpperCase();
      renderPlayers();
    },

    addSimPlayer() {
      const session = HP.getActiveSession();
      if (!session) { if (typeof showToast === 'function') showToast('No active session.'); return; }

      const name  = document.getElementById('mpSimName')?.value.trim() || 'SimPlayer';
      const ctrl  = document.getElementById('mpSimCtrl')?.value || 'gamepad';
      const fakeUid = 'sim-' + Math.random().toString(36).slice(2, 8);

      const player = HP.addSessionPlayer(fakeUid, null, ctrl);
      if (!player) {
        if (typeof showToast === 'function') showToast('Session full (' + MAX_PLAYERS + ' max).');
        return;
      }
      player.display_name   = name;
      player.signal_quality = Math.floor(40 + Math.random() * 60);

      const nameEl = document.getElementById('mpSimName');
      if (nameEl) nameEl.value = '';

      renderPlayers();
      logEvent(name + ' simulated as P' + player.player_number + ' (' + ctrl + ')');
      if (typeof showToast === 'function') showToast('+ ' + name + ' added as P' + player.player_number);
      if (typeof playSound === 'function') playSound('click');
    },

    removePlayer(userId) {
      const session = HP.getActiveSession();
      const user    = HP.getUser();

      // Only host or the player themselves can remove
      if (!session || !user) return;
      const isHost = session.host_user_id === user.user_id;
      const isSelf = userId === user.user_id;
      if (!isHost && !isSelf) {
        if (typeof showToast === 'function') showToast('Only the host can kick players.');
        return;
      }

      const players = HP.getSessionPlayers();
      const p = players.find(x => x.user_id === userId);
      HP.removeSessionPlayer(userId);
      renderPlayers();
      logEvent((p?.display_name || 'Player') + ' removed from session.');
      if (typeof showToast === 'function') showToast('Player removed.');
      if (typeof playSound === 'function') playSound('click');
    },

    copyCode() {
      const session = HP.getActiveSession();
      if (!session) return;
      const url = window.location.origin + window.location.pathname + '?join=' + session.session_code;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(url)
          .then(() => { if (typeof showToast === 'function') showToast('📋 Link copied!'); })
          .catch(() => { if (typeof showToast === 'function') showToast(url); });
      } else {
        if (typeof showToast === 'function') showToast(url);
      }
      logEvent('Session link copied.');
    },

    endSession() {
      if (!confirm('End this session for all players?')) return;
      HP.endSession();
      if (typeof state !== 'undefined') { state.isConnected = false; }
      showSessionView(false);
      _log.length = 0;
      if (typeof showToast === 'function') showToast('Session ended.');
      if (typeof playSound === 'function') playSound('click');
    },

    // Expose renderPlayers for external refresh
    refresh: renderPlayers
  };

})();
