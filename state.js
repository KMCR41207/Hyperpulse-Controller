/* ==========================================================================
   HYPERPULSE // ERD STATE LAYER (state.js)
   Single source of truth — maps directly to ERD entities.
   No fake backend. All persistence uses localStorage as offline store.
   ========================================================================== */

const HP = (function () {

  /* ── helpers ─────────────────────────────────────────────────── */
  function uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }
  function now() { return new Date().toISOString(); }
  function save(key, val) {
    try { localStorage.setItem('hp_' + key, JSON.stringify(val)); } catch (_) {}
  }
  function load(key, fallback) {
    try {
      const raw = localStorage.getItem('hp_' + key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) { return fallback; }
  }

  /* ─────────────────────────────────────────────────────────────
     ERD ENTITY: User
  ───────────────────────────────────────────────────────────── */
  let _user = load('user', null);
  // Schema: { user_id, email, name, avatar_url, created_at, updated_at }

  /* ─────────────────────────────────────────────────────────────
     ERD ENTITY: Settings  (1:1 with User)
  ───────────────────────────────────────────────────────────── */
  const _defaultSettings = {
    setting_id: uuid(),
    user_id: null,
    theme: 'dark',
    accent_color: '#cc1111',
    button_sensitivity: 5,
    joystick_sensitivity: 5,
    dead_zone_percent: 5,
    gyro_sensitivity: 5,
    haptic_enabled: true,
    auto_reconnect: true,
    auto_profile_switch: false,
    low_latency_mode: false,
    updated_at: now()
  };
  let _settings = load('settings', _defaultSettings);

  /* ─────────────────────────────────────────────────────────────
     ERD ENTITY: Device  (1:M from User)
  ───────────────────────────────────────────────────────────── */
  // Schema: { device_id, user_id, device_name, os_type, os_version,
  //           connection_type, battery_level, latency_ms,
  //           signal_strength, is_connected, last_connected_at, paired_at }
  let _devices = load('devices', []);

  /* ─────────────────────────────────────────────────────────────
     ERD ENTITY: ControllerProfile  (1:M from User)
  ───────────────────────────────────────────────────────────── */
  const _defaultProfiles = [
    {
      profile_id: uuid(),
      user_id: null,
      profile_name: 'Default Gamepad',
      controller_type: 'gamepad',
      layout_json: { buttons: [], sticks: [] },
      created_at: now(), updated_at: now(),
      is_favorite: true
    },
    {
      profile_id: uuid(),
      user_id: null,
      profile_name: 'Racing Setup',
      controller_type: 'racing',
      layout_json: { buttons: [], sticks: [] },
      created_at: now(), updated_at: now(),
      is_favorite: false
    }
  ];
  let _controllerProfiles = load('controller_profiles', _defaultProfiles);

  /* ─────────────────────────────────────────────────────────────
     ERD ENTITY: GameProfile  (1:M from User)
  ───────────────────────────────────────────────────────────── */
  const _defaultGameProfiles = [
    {
      game_profile_id: uuid(),
      user_id: null,
      game_name: 'Gran Turismo 7',
      game_icon_url: '',
      recommended_controller_type: 'racing',
      button_mapping_json: { A: 'SPACEBAR', B: 'C', X: 'SHIFT', Y: 'Q', L1: 'TAB', R1: 'E' },
      created_at: now(), updated_at: now()
    },
    {
      game_profile_id: uuid(),
      user_id: null,
      game_name: 'Fortnite',
      game_icon_url: '',
      recommended_controller_type: 'gamepad',
      button_mapping_json: { A: 'SPACE', B: 'E', X: 'R', Y: 'F', L1: 'Q', R1: 'MOUSE1' },
      created_at: now(), updated_at: now()
    }
  ];
  let _gameProfiles = load('game_profiles', _defaultGameProfiles);

  /* ─────────────────────────────────────────────────────────────
     ERD ENTITY: CommunityProfile  (1:M from User)
  ───────────────────────────────────────────────────────────── */
  const _seedCommunity = [
    {
      community_profile_id: 'cp-001',
      user_id: 'seed',
      profile_name: 'Pro FPS Setup',
      game_name: 'Valorant',
      controller_type: 'gamepad',
      description: 'High-sensitivity FPS layout optimized for competitive play.',
      layout_json: {},
      tags: ['FPS', 'Competitive', 'High-Sensitivity'],
      download_count: 1842,
      average_rating: 4.7,
      is_public: true,
      created_at: '2026-07-01T00:00:00.000Z',
      updated_at: '2026-07-01T00:00:00.000Z',
      author_name: 'ProGamer_X'
    },
    {
      community_profile_id: 'cp-002',
      user_id: 'seed',
      profile_name: 'Drift King G29',
      game_name: 'Assetto Corsa',
      controller_type: 'racing',
      description: '900° full steering travel, clutch tuned for drift. Best for sim racing.',
      layout_json: {},
      tags: ['Racing', 'Drift', 'Sim'],
      download_count: 934,
      average_rating: 4.9,
      is_public: true,
      created_at: '2026-07-15T00:00:00.000Z',
      updated_at: '2026-07-15T00:00:00.000Z',
      author_name: 'DriftKing99'
    },
    {
      community_profile_id: 'cp-003',
      user_id: 'seed',
      profile_name: 'Gyro Aim Elite',
      game_name: 'Call of Duty',
      controller_type: 'gyro',
      description: 'Motion-assisted aim with dead-zone fine-tuned for fast flick shots.',
      layout_json: {},
      tags: ['FPS', 'Gyro', 'Motion'],
      download_count: 2201,
      average_rating: 4.5,
      is_public: true,
      created_at: '2026-08-01T00:00:00.000Z',
      updated_at: '2026-08-01T00:00:00.000Z',
      author_name: 'GyroMaster'
    },
    {
      community_profile_id: 'cp-004',
      user_id: 'seed',
      profile_name: 'Trackpad Precision',
      game_name: 'StarCraft II',
      controller_type: 'mouse',
      description: 'Multi-zone trackpad with scroll precision for RTS control.',
      layout_json: {},
      tags: ['RTS', 'Mouse', 'Precision'],
      download_count: 411,
      average_rating: 4.2,
      is_public: true,
      created_at: '2026-08-10T00:00:00.000Z',
      updated_at: '2026-08-10T00:00:00.000Z',
      author_name: 'SCPro'
    }
  ];
  let _communityProfiles = load('community_profiles', _seedCommunity);

  /* ─────────────────────────────────────────────────────────────
     ERD ENTITY: CommunityReview  (1:M from CommunityProfile)
  ───────────────────────────────────────────────────────────── */
  let _communityReviews = load('community_reviews', [
    {
      review_id: uuid(), community_profile_id: 'cp-001', user_id: 'seed',
      rating: 5, comment_text: 'Best layout I have used for FPS. No lag at all.',
      created_at: '2026-07-10T00:00:00.000Z', author_name: 'User_Alpha'
    },
    {
      review_id: uuid(), community_profile_id: 'cp-001', user_id: 'seed',
      rating: 4, comment_text: 'Very responsive. Took 10 mins to adjust sensitivity.',
      created_at: '2026-07-12T00:00:00.000Z', author_name: 'User_Beta'
    },
    {
      review_id: uuid(), community_profile_id: 'cp-002', user_id: 'seed',
      rating: 5, comment_text: 'Absolutely perfect for sim drift. 10/10.',
      created_at: '2026-07-20T00:00:00.000Z', author_name: 'RacerKai'
    }
  ]);

  /* ─────────────────────────────────────────────────────────────
     ERD ENTITY: CommunityDownload  (1:M from CommunityProfile)
  ───────────────────────────────────────────────────────────── */
  let _communityDownloads = load('community_downloads', []);

  /* ─────────────────────────────────────────────────────────────
     ERD ENTITY: CommunityFavorite  (M:M User ↔ CommunityProfile)
  ───────────────────────────────────────────────────────────── */
  let _communityFavorites = load('community_favorites', []);

  /* ─────────────────────────────────────────────────────────────
     ERD ENTITY: ConnectionSession  (1:M from User as host)
  ───────────────────────────────────────────────────────────── */
  let _activeSession = load('active_session', null);
  // Schema: { session_id, host_user_id, session_code, max_players,
  //           current_players, created_at, expires_at, status }

  /* ─────────────────────────────────────────────────────────────
     ERD ENTITY: SessionPlayer  (1:M from ConnectionSession)
  ───────────────────────────────────────────────────────────── */
  let _sessionPlayers = load('session_players', []);
  // Schema: { player_id, session_id, user_id, device_id,
  //           player_number, current_controller_type, signal_quality, joined_at }

  /* ─────────────────────────────────────────────────────────────
     ERD ENTITY: InputLog  (1:M from Device, nullable session_id)
  ───────────────────────────────────────────────────────────── */
  const INPUT_LOG_MAX = 500; // keep last 500 entries in memory
  let _inputLog = [];

  /* ────────────────────────────────────────────────────────────
     PUBLIC API
  ─────────────────────────────────────────────────────────────*/
  return {

    /* ── User ───────────────────────────────────────────────── */
    getUser()  { return _user; },
    isLoggedIn() { return !!_user; },
    getUserById(id) { return _user && _user.user_id === id ? _user : null; },

    registerUser(email, name, passwordHash) {
      _user = {
        user_id: uuid(), email, name,
        password_hash: passwordHash,
        avatar_url: '',
        created_at: now(), updated_at: now()
      };
      _settings.user_id = _user.user_id;
      save('user', _user);
      save('settings', _settings);
      return _user;
    },

    loginUser(email) {
      // NOTE: Real auth requires a backend. This is a local-session prototype.
      if (!_user || _user.email !== email) return false;
      save('user', _user);
      return true;
    },

    logoutUser() {
      _user = null;
      save('user', null);
      _activeSession = null;
      save('active_session', null);
    },

    updateUserProfile(fields) {
      if (!_user) return;
      Object.assign(_user, fields, { updated_at: now() });
      save('user', _user);
    },

    /* ── Settings ───────────────────────────────────────────── */
    getSettings()  { return { ..._settings }; },

    updateSettings(fields) {
      Object.assign(_settings, fields, { updated_at: now() });
      if (_user) _settings.user_id = _user.user_id;
      save('settings', _settings);
    },

    /* ── Device ─────────────────────────────────────────────── */
    getDevices() { return [..._devices]; },

    registerDevice(deviceName, connectionType) {
      const device = {
        device_id: uuid(),
        user_id: _user ? _user.user_id : null,
        device_name: deviceName || 'Unknown Device',
        os_type: /Android/i.test(navigator.userAgent) ? 'Android' :
                 /iPhone|iPad/i.test(navigator.userAgent) ? 'iOS' : 'Web',
        os_version: navigator.userAgent.match(/OS [\d_]+|Android [\d.]+/)?.[0] || 'Unknown',
        connection_type: connectionType || 'USB',
        battery_level: 100,
        latency_ms: 0,
        signal_strength: 'Excellent',
        is_connected: true,
        last_connected_at: now(),
        paired_at: now()
      };
      _devices.push(device);
      save('devices', _devices);
      return device;
    },

    updateDeviceTelemetry(deviceId, latencyMs, signalStrength) {
      const d = _devices.find(d => d.device_id === deviceId);
      if (!d) return;
      d.latency_ms = latencyMs;
      d.signal_strength = signalStrength;
      d.last_connected_at = now();
      save('devices', _devices);
    },

    updateDevice(deviceId, fields) {
      const d = _devices.find(d => d.device_id === deviceId);
      if (!d) return;
      Object.assign(d, fields);
      save('devices', _devices);
    },

    disconnectDevice(deviceId) {
      const d = _devices.find(d => d.device_id === deviceId);
      if (!d) return;
      d.is_connected = false;
      d.last_connected_at = now();
      save('devices', _devices);
    },

    deleteDevice(deviceId) {
      _devices = _devices.filter(d => d.device_id !== deviceId);
      save('devices', _devices);
    },

    connectDevice(deviceId) {
      const d = _devices.find(d => d.device_id === deviceId);
      if (!d) return;
      d.is_connected = true;
      d.last_connected_at = now();
      save('devices', _devices);
    },

    /* ── ControllerProfile ──────────────────────────────────── */
    getControllerProfiles() { return [..._controllerProfiles]; },

    createControllerProfile(name, type, layoutJson) {
      const p = {
        profile_id: uuid(),
        user_id: _user ? _user.user_id : null,
        profile_name: name,
        controller_type: type,
        layout_json: layoutJson || { buttons: [], sticks: [] },
        created_at: now(), updated_at: now(),
        is_favorite: false
      };
      _controllerProfiles.push(p);
      save('controller_profiles', _controllerProfiles);
      return p;
    },

    updateControllerProfile(profileId, fields) {
      const p = _controllerProfiles.find(p => p.profile_id === profileId);
      if (!p) return;
      Object.assign(p, fields, { updated_at: now() });
      save('controller_profiles', _controllerProfiles);
    },

    deleteControllerProfile(profileId) {
      _controllerProfiles = _controllerProfiles.filter(p => p.profile_id !== profileId);
      save('controller_profiles', _controllerProfiles);
    },

    toggleProfileFavorite(profileId) {
      const p = _controllerProfiles.find(p => p.profile_id === profileId);
      if (!p) return;
      p.is_favorite = !p.is_favorite;
      save('controller_profiles', _controllerProfiles);
      return p.is_favorite;
    },

    /* ── GameProfile ────────────────────────────────────────── */
    getGameProfiles() { return [..._gameProfiles]; },

    createGameProfile(gameName, controllerType, mappingJson, iconUrl) {
      const g = {
        game_profile_id: uuid(),
        user_id: _user ? _user.user_id : null,
        game_name: gameName,
        game_icon_url: iconUrl || '',
        recommended_controller_type: controllerType,
        button_mapping_json: mappingJson || {},
        assigned_controller_profile_id: null,
        created_at: now(), updated_at: now()
      };
      _gameProfiles.push(g);
      save('game_profiles', _gameProfiles);
      return g;
    },

    deleteGameProfile(id) {
      _gameProfiles = _gameProfiles.filter(g => g.game_profile_id !== id);
      save('game_profiles', _gameProfiles);
    },

    updateGameProfile(gameId, fields) {
      const g = _gameProfiles.find(g => g.game_profile_id === gameId);
      if (!g) return;
      Object.assign(g, fields, { updated_at: now() });
      save('game_profiles', _gameProfiles);
    },

    /* ── CommunityProfile ───────────────────────────────────── */
    getCommunityProfiles(filters) {
      let list = [..._communityProfiles];
      if (filters) {
        if (filters.controller_type)
          list = list.filter(p => p.controller_type === filters.controller_type);
        if (filters.search)
          list = list.filter(p =>
            p.profile_name.toLowerCase().includes(filters.search.toLowerCase()) ||
            p.game_name.toLowerCase().includes(filters.search.toLowerCase()) ||
            (p.tags || []).some(t => t.toLowerCase().includes(filters.search.toLowerCase()))
          );
        if (filters.sort === 'downloads')
          list.sort((a, b) => b.download_count - a.download_count);
        else if (filters.sort === 'rating')
          list.sort((a, b) => b.average_rating - a.average_rating);
        else if (filters.sort === 'newest')
          list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      }
      return list;
    },

    updateCommunityProfile(communityProfileId, fields) {
      const cp = _communityProfiles.find(p => p.community_profile_id === communityProfileId);
      if (!cp) return;
      Object.assign(cp, fields, { updated_at: now() });
      save('community_profiles', _communityProfiles);
    },

    deleteCommunityProfile(communityProfileId) {
      _communityProfiles = _communityProfiles.filter(p => p.community_profile_id !== communityProfileId);
      // Also remove associated reviews, downloads, favorites
      _communityReviews   = _communityReviews.filter(r => r.community_profile_id !== communityProfileId);
      _communityDownloads = _communityDownloads.filter(d => d.community_profile_id !== communityProfileId);
      _communityFavorites = _communityFavorites.filter(f => f.community_profile_id !== communityProfileId);
      save('community_profiles', _communityProfiles);
      save('community_reviews',  _communityReviews);
      save('community_downloads', _communityDownloads);
      save('community_favorites', _communityFavorites);
    },

    publishCommunityProfile(controllerProfileId, gameName, description, tags) {
      const src = _controllerProfiles.find(p => p.profile_id === controllerProfileId);
      if (!src) return null;
      const cp = {
        community_profile_id: uuid(),
        user_id: _user ? _user.user_id : 'anon',
        profile_name: src.profile_name,
        game_name: gameName,
        controller_type: src.controller_type,
        description,
        layout_json: src.layout_json,
        tags: tags || [],
        download_count: 0,
        average_rating: 0,
        is_public: true,
        created_at: now(), updated_at: now(),
        author_name: _user ? _user.name : 'Anonymous'
      };
      _communityProfiles.push(cp);
      save('community_profiles', _communityProfiles);
      return cp;
    },

    /* ── CommunityReview ────────────────────────────────────── */
    getReviewsForProfile(communityProfileId) {
      return _communityReviews.filter(r => r.community_profile_id === communityProfileId);
    },

    addReview(communityProfileId, rating, commentText) {
      const r = {
        review_id: uuid(),
        community_profile_id: communityProfileId,
        user_id: _user ? _user.user_id : 'anon',
        author_name: _user ? _user.name : 'Anonymous',
        rating,
        comment_text: commentText,
        created_at: now()
      };
      _communityReviews.push(r);
      save('community_reviews', _communityReviews);

      // Recalculate average rating on the profile
      const profileReviews = _communityReviews.filter(x => x.community_profile_id === communityProfileId);
      const avg = profileReviews.reduce((sum, x) => sum + x.rating, 0) / profileReviews.length;
      const cp = _communityProfiles.find(p => p.community_profile_id === communityProfileId);
      if (cp) { cp.average_rating = parseFloat(avg.toFixed(1)); save('community_profiles', _communityProfiles); }
      return r;
    },

    /* ── CommunityDownload ──────────────────────────────────── */
    downloadCommunityProfile(communityProfileId) {
      const cp = _communityProfiles.find(p => p.community_profile_id === communityProfileId);
      if (!cp) return false;

      // Create a local ControllerProfile from this community profile
      const imported = {
        profile_id: uuid(),
        user_id: _user ? _user.user_id : null,
        profile_name: '[Community] ' + cp.profile_name,
        controller_type: cp.controller_type,
        layout_json: cp.layout_json,
        created_at: now(), updated_at: now(),
        is_favorite: false
      };
      _controllerProfiles.push(imported);
      save('controller_profiles', _controllerProfiles);

      // Record download
      _communityDownloads.push({
        download_id: uuid(),
        community_profile_id: communityProfileId,
        user_id: _user ? _user.user_id : 'anon',
        downloaded_at: now()
      });
      save('community_downloads', _communityDownloads);

      cp.download_count += 1;
      save('community_profiles', _communityProfiles);
      return imported;
    },

    /* ── CommunityFavorite ──────────────────────────────────── */
    getCommunityFavorites() {
      if (!_user) return [];
      return _communityFavorites.filter(f => f.user_id === _user.user_id);
    },

    isCommunityFavorite(communityProfileId) {
      if (!_user) return false;
      return _communityFavorites.some(
        f => f.user_id === _user.user_id && f.community_profile_id === communityProfileId
      );
    },

    toggleCommunityFavorite(communityProfileId) {
      if (!_user) return false;
      const idx = _communityFavorites.findIndex(
        f => f.user_id === _user.user_id && f.community_profile_id === communityProfileId
      );
      if (idx >= 0) {
        _communityFavorites.splice(idx, 1);
      } else {
        _communityFavorites.push({
          favorite_id: uuid(),
          user_id: _user.user_id,
          community_profile_id: communityProfileId,
          added_at: now()
        });
      }
      save('community_favorites', _communityFavorites);
      return idx < 0; // true = now favorited
    },

    /* ── ConnectionSession ──────────────────────────────────── */
    getActiveSession() { return _activeSession; },

    createSession(transportMode) {
      const code = 'HYPER-' + Math.floor(1000 + Math.random() * 9000);
      _activeSession = {
        session_id: uuid(),
        host_user_id: _user ? _user.user_id : null,
        session_code: code,
        max_players: 4,
        current_players: 0,
        created_at: now(),
        expires_at: new Date(Date.now() + 4 * 3600 * 1000).toISOString(),
        status: 'active',
        transport_mode: transportMode || 'usb'
      };
      _sessionPlayers = [];
      save('active_session', _activeSession);
      save('session_players', _sessionPlayers);
      return _activeSession;
    },

    endSession() {
      if (_activeSession) {
        _activeSession.status = 'ended';
        save('active_session', _activeSession);
      }
      _activeSession = null;
      _sessionPlayers = [];
      save('active_session', null);
      save('session_players', []);
    },

    /* ── SessionPlayer ──────────────────────────────────────── */
    getSessionPlayers() { return [..._sessionPlayers]; },

    addSessionPlayer(userId, deviceId, controllerType) {
      if (!_activeSession) return null;
      const existing = _sessionPlayers.find(p => p.user_id === userId);
      if (existing) return existing;
      const count = _sessionPlayers.length + 1;
      if (count > _activeSession.max_players) return null;
      const player = {
        player_id: uuid(),
        session_id: _activeSession.session_id,
        user_id: userId,
        device_id: deviceId,
        player_number: count,
        current_controller_type: controllerType,
        signal_quality: 100,
        joined_at: now()
      };
      _sessionPlayers.push(player);
      _activeSession.current_players = _sessionPlayers.length;
      save('session_players', _sessionPlayers);
      save('active_session', _activeSession);
      return player;
    },

    removeSessionPlayer(userId) {
      _sessionPlayers = _sessionPlayers.filter(p => p.user_id !== userId);
      if (_activeSession) {
        _activeSession.current_players = _sessionPlayers.length;
        save('active_session', _activeSession);
      }
      save('session_players', _sessionPlayers);
    },

    /* ── InputLog (in-memory, not persisted) ────────────────── */
    logInput(deviceId, sessionId, inputType, valueJson, latencyMs) {
      _inputLog.push({
        log_id: uuid(),
        device_id: deviceId,
        session_id: sessionId || null,
        input_type: inputType,
        value_json: valueJson,
        timestamp: now(),
        latency_ms: latencyMs || 0
      });
      if (_inputLog.length > INPUT_LOG_MAX) _inputLog.shift();
    },

    getInputLog() { return [..._inputLog]; },
    getInputLogForDevice(deviceId) { return _inputLog.filter(l => l.device_id === deviceId); },
    clearInputLog() { _inputLog = []; }

  };

})();

// Expose globally
window.HP = HP;
