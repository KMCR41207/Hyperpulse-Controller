/* ==========================================================================
   HYPERPULSE // PROFILES UI (ui-profiles.js)
   ControllerProfile + GameProfile entities.
   Panel slides in from the right, consistent with existing drawer pattern.
   ========================================================================== */

(function () {

  const TYPES = ['gamepad','racing','gyro','mouse','keyboard','custom'];
  const TYPE_ICONS = { gamepad:'🎮', racing:'🏎', gyro:'🔭', mouse:'🖱', keyboard:'⌨', custom:'🛠' };

  function esc(s) {
    return String(s || '').replace(/[&<>"']/g, c =>
      ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }

  /* Ownership guard — users can only modify their own profiles.
     Guest/null user can manage guest profiles (user_id === null). */
  function isOwner(profile) {
    const user = HP.getUser();
    const userId = user ? user.user_id : null;
    return profile.user_id === userId;
  }

  /* ── Inject HTML ─────────────────────────────────────── */
  function inject() {
    document.body.insertAdjacentHTML('beforeend', `
<div class="hp-side-panel" id="profilesPanel" role="complementary" aria-label="Profiles Panel">
  <div class="hp-panel-header">
    <span class="hp-panel-title">MY PROFILES</span>
    <button class="close-btn" onclick="HPProfiles.close()" aria-label="Close profiles panel" style="color:#fff;">✕</button>
  </div>

  <div class="hp-panel-tabs">
    <button class="hp-panel-tab active" id="profTabController" onclick="HPProfiles.switchTab('controller')">CONTROLLER</button>
    <button class="hp-panel-tab"        id="profTabGame"       onclick="HPProfiles.switchTab('game')">GAME MAPS</button>
  </div>

  <!-- ── Controller Profiles ─────────────────────────────── -->
  <div class="hp-panel-body" id="profControllerBody">
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
      <span style="font-family:var(--font-mono); font-size:0.7rem; color:var(--text-muted-dark);">SAVED PROFILES</span>
      <button class="cyber-button sm primary" onclick="HPProfiles.openNewProfileForm()">+ NEW</button>
    </div>

    <!-- Search + filter -->
    <div style="display:flex; gap:6px; margin-bottom:10px;">
      <input type="text" id="profileSearch" class="hp-input" placeholder="Search…" style="flex:1;" oninput="HPProfiles.filterProfiles()">
      <select id="profileTypeFilter" class="hp-input" style="flex:0 0 auto; min-width:90px;" onchange="HPProfiles.filterProfiles()">
        <option value="">ALL</option>
        ${TYPES.map(t => `<option value="${t}">${TYPE_ICONS[t]} ${t.toUpperCase()}</option>`).join('')}
      </select>
    </div>

    <!-- Favorites toggle -->
    <div style="margin-bottom:12px;">
      <label style="font-family:var(--font-mono); font-size:0.7rem; cursor:pointer; display:flex; align-items:center; gap:6px;">
        <input type="checkbox" id="profileFavOnly" onchange="HPProfiles.filterProfiles()" style="accent-color:#cc1111;">
        ★ FAVORITES ONLY
      </label>
    </div>

    <div id="profilesList"></div>

    <!-- New/Edit form -->
    <div id="profileForm" style="display:none; margin-top:14px; border:1px solid var(--dark-border); padding:14px;">
      <div class="hp-label" id="profileFormTitle" style="margin-bottom:10px;">NEW CONTROLLER PROFILE</div>
      <div class="hp-field">
        <label class="hp-label">NAME</label>
        <input class="hp-input" id="profileFormName" placeholder="My Custom Layout">
      </div>
      <div class="hp-field">
        <label class="hp-label">TYPE</label>
        <select class="hp-input" id="profileFormType">
          ${TYPES.map(t => `<option value="${t}">${TYPE_ICONS[t]} ${t.toUpperCase()}</option>`).join('')}
        </select>
      </div>
      <div style="display:flex; gap:8px; margin-top:12px;">
        <button class="cyber-button sm primary"    onclick="HPProfiles.saveProfile()">SAVE</button>
        <button class="cyber-button sm secondary"  onclick="HPProfiles.cancelProfile()">CANCEL</button>
      </div>
    </div>
  </div>

  <!-- ── Game Profile Maps ──────────────────────────────── -->
  <div class="hp-panel-body" id="profGameBody" style="display:none;">
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
      <span style="font-family:var(--font-mono); font-size:0.7rem; color:var(--text-muted-dark);">GAME KEYMAPS</span>
      <button class="cyber-button sm primary" onclick="HPProfiles.openNewGameForm()">+ NEW</button>
    </div>

    <div id="gameProfilesList"></div>

    <!-- New/Edit Game Form -->
    <div id="newGameForm" style="display:none; margin-top:14px; border:1px solid var(--dark-border); padding:14px;">
      <div class="hp-label" id="gameFormTitle" style="margin-bottom:10px;">NEW GAME MAP</div>
      <div class="hp-field">
        <label class="hp-label">GAME NAME</label>
        <input class="hp-input" id="newGameName" placeholder="e.g. Fortnite">
      </div>
      <div class="hp-field">
        <label class="hp-label">GAME ICON URL <span style="color:#666;">(optional)</span></label>
        <input class="hp-input" id="newGameIcon" placeholder="https://…">
      </div>
      <div class="hp-field">
        <label class="hp-label">RECOMMENDED CONTROLLER</label>
        <select class="hp-input" id="newGameType">
          ${TYPES.map(t => `<option value="${t}">${TYPE_ICONS[t]} ${t.toUpperCase()}</option>`).join('')}
        </select>
      </div>
      <div class="hp-field">
        <label class="hp-label">ASSIGN CONTROLLER PROFILE <span style="color:#666;">(optional)</span></label>
        <select class="hp-input" id="newGameAssignedProfile">
          <option value="">— None —</option>
        </select>
      </div>

      <div class="hp-label" style="margin:12px 0 6px;">BUTTON MAPPINGS</div>
      <div id="gameMappingRows" style="display:flex; flex-direction:column; gap:6px;"></div>
      <button class="cyber-button sm secondary" onclick="HPProfiles.addMappingRow()" style="margin-top:8px; width:100%;">+ ADD MAPPING</button>

      <div style="display:flex; gap:8px; margin-top:12px;">
        <button class="cyber-button sm primary"   onclick="HPProfiles.saveNewGame()">SAVE</button>
        <button class="cyber-button sm secondary" onclick="HPProfiles.cancelNewGame()">CANCEL</button>
      </div>
    </div>
  </div>
</div>`);
  }

  /* ── Controller profiles list ─────────────────────────── */
  let _editingProfileId = null;

  function renderProfiles() {
    const list = document.getElementById('profilesList');
    if (!list) return;

    let profiles = HP.getControllerProfiles();
    const q    = (document.getElementById('profileSearch')?.value || '').toLowerCase().trim();
    const type = document.getElementById('profileTypeFilter')?.value || '';
    const fav  = document.getElementById('profileFavOnly')?.checked || false;
    const currentUserId = HP.getUser() ? HP.getUser().user_id : null;

    if (q)    profiles = profiles.filter(p => p.profile_name.toLowerCase().includes(q) || p.controller_type.toLowerCase().includes(q));
    if (type) profiles = profiles.filter(p => p.controller_type === type);
    if (fav)  profiles = profiles.filter(p => p.is_favorite);

    if (profiles.length === 0) {
      list.innerHTML = `<p style="font-family:var(--font-mono); font-size:0.75rem; color:var(--text-muted-dark);">No profiles found.</p>`;
      return;
    }

    list.innerHTML = profiles.map(p => {
      const owned = isOwner(p);
      return `
      <div class="hp-profile-card" id="pcard-${p.profile_id}">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <span class="hp-profile-icon">${TYPE_ICONS[p.controller_type] || '🎮'}</span>
            <span class="hp-profile-name">${esc(p.profile_name)}</span>
            ${p.is_favorite ? '<span class="hp-fav-star" title="Favorite">★</span>' : ''}
            ${!owned ? '<span style="font-size:0.6rem; color:#555; font-family:var(--font-mono); margin-left:4px;">[GUEST]</span>' : ''}
          </div>
          <span class="hp-profile-type-tag">${p.controller_type.toUpperCase()}</span>
        </div>
        <div style="display:flex; gap:6px; margin-top:10px; flex-wrap:wrap;">
          <button class="cyber-button sm secondary" onclick="HPProfiles.loadProfile('${p.profile_id}')" title="Load this profile">▶ LOAD</button>
          ${owned ? `
          <button class="cyber-button sm secondary" onclick="HPProfiles.editProfile('${p.profile_id}')">✎ EDIT</button>
          <button class="cyber-button sm secondary" onclick="HPProfiles.duplicateProfile('${p.profile_id}')">⬓ DUP</button>
          <button class="cyber-button sm secondary" onclick="HPProfiles.toggleFav('${p.profile_id}')">${p.is_favorite ? '★ UNFAV' : '☆ FAV'}</button>
          <button class="cyber-button sm secondary" onclick="HPProfiles.publishProfile('${p.profile_id}')">⬆ SHARE</button>
          <button class="cyber-button sm danger"    onclick="HPProfiles.deleteProfile('${p.profile_id}')">✕</button>
          ` : `
          <button class="cyber-button sm secondary" onclick="HPProfiles.duplicateProfile('${p.profile_id}')">⬓ COPY</button>
          `}
        </div>
      </div>`;
    }).join('');
  }

  /* ── Game profiles list ───────────────────────────────── */
  let _editingGameId = null;

  function renderGameProfiles() {
    const list = document.getElementById('gameProfilesList');
    if (!list) return;
    const games = HP.getGameProfiles();
    if (games.length === 0) {
      list.innerHTML = `<p style="font-family:var(--font-mono); font-size:0.75rem; color:var(--text-muted-dark);">No game maps yet.</p>`;
      return;
    }

    list.innerHTML = games.map(g => {
      const owned = isOwner(g);
      const iconHtml = g.game_icon_url
        ? `<img src="${esc(g.game_icon_url)}" alt="" style="width:32px;height:32px;object-fit:cover;border-radius:3px;margin-right:8px;vertical-align:middle;" onerror="this.style.display='none'">`
        : '';
      return `
      <div class="hp-profile-card" id="gcard-${g.game_profile_id}">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div style="display:flex; align-items:center;">
            ${iconHtml}
            <span class="hp-profile-name">${esc(g.game_name)}</span>
          </div>
          <span class="hp-profile-type-tag">${(g.recommended_controller_type || '').toUpperCase()}</span>
        </div>
        ${g.assigned_controller_profile_id ? (() => {
          const cp = HP.getControllerProfiles().find(p => p.profile_id === g.assigned_controller_profile_id);
          return cp ? `<div style="font-family:var(--font-mono); font-size:0.7rem; color:#888; margin-top:4px;">🎮 ${esc(cp.profile_name)}</div>` : '';
        })() : ''}
        <div class="hp-keymap-grid" style="margin:8px 0; display:flex; flex-wrap:wrap; gap:4px;">
          ${Object.entries(g.button_mapping_json || {}).map(([k, v]) =>
            `<span class="hp-keymap-chip" style="font-size:0.65rem; padding:2px 6px; background:#1a1a1a; border:1px solid #333;"><b>${esc(k)}</b>→${esc(v)}</span>`
          ).join('')}
        </div>
        <div style="display:flex; gap:6px; margin-top:8px; flex-wrap:wrap;">
          <button class="cyber-button sm primary" onclick="HPProfiles.launchGame('${g.game_profile_id}')" title="Launch with this game's profile">▶ LAUNCH</button>
          ${owned ? `
          <button class="cyber-button sm secondary" onclick="HPProfiles.editGame('${g.game_profile_id}')">✎ EDIT</button>
          <button class="cyber-button sm secondary" onclick="HPProfiles.duplicateGame('${g.game_profile_id}')">⬓ DUP</button>
          <button class="cyber-button sm danger"    onclick="HPProfiles.deleteGame('${g.game_profile_id}')">✕ DELETE</button>
          ` : `
          <button class="cyber-button sm secondary" onclick="HPProfiles.duplicateGame('${g.game_profile_id}')">⬓ COPY</button>
          `}
        </div>
      </div>`;
    }).join('');
  }

  /* ── Publish dialog ───────────────────────────────────── */
  function openPublishDialog(profileId) {
    const card = document.getElementById('pcard-' + profileId);
    if (!card) return;
    const existing = document.getElementById('publishForm-' + profileId);
    if (existing) { existing.remove(); return; }

    const form = document.createElement('div');
    form.id = 'publishForm-' + profileId;
    form.className = 'hp-publish-form';
    form.style.cssText = 'margin-top:10px; padding:12px; border:1px solid var(--dark-border); background:#0a0a0a;';
    form.innerHTML = `
      <div class="hp-label" style="margin-bottom:8px;">SHARE TO COMMUNITY</div>
      <div class="hp-field">
        <label class="hp-label">GAME NAME</label>
        <input class="hp-input" id="pubGame-${profileId}" placeholder="e.g. Fortnite">
      </div>
      <div class="hp-field">
        <label class="hp-label">DESCRIPTION</label>
        <textarea class="hp-input" id="pubDesc-${profileId}" rows="2" placeholder="Describe your layout…"></textarea>
      </div>
      <div class="hp-field">
        <label class="hp-label">TAGS (comma-separated)</label>
        <input class="hp-input" id="pubTags-${profileId}" placeholder="FPS, Competitive">
      </div>
      <div style="display:flex; gap:8px; margin-top:10px;">
        <button class="cyber-button sm primary"   onclick="HPProfiles.confirmPublish('${profileId}')">PUBLISH</button>
        <button class="cyber-button sm secondary" onclick="document.getElementById('publishForm-${profileId}').remove()">CANCEL</button>
      </div>`;
    card.appendChild(form);
  }

  /* ── Mapping rows ─────────────────────────────────────── */
  const CONTROLLER_BUTTONS = ['A','B','X','Y','L1','R1','L2','R2','START','SELECT',
    'DPAD_UP','DPAD_DOWN','DPAD_LEFT','DPAD_RIGHT'];
  let _rowCount = 0;

  function clearMappingRows() {
    _rowCount = 0;
    const c = document.getElementById('gameMappingRows');
    if (c) c.innerHTML = '';
  }

  function addMappingRow(btnKey, targetVal) {
    const c = document.getElementById('gameMappingRows');
    if (!c) return;
    const id = _rowCount++;
    const row = document.createElement('div');
    row.style.cssText = 'display:flex; gap:6px; align-items:center;';
    row.innerHTML = `
      <select class="hp-input" id="mapBtn-${id}" style="flex:1;">
        ${CONTROLLER_BUTTONS.map(b => `<option value="${b}" ${b === btnKey ? 'selected' : ''}>${b}</option>`).join('')}
      </select>
      <span style="font-family:var(--font-mono); font-size:0.75rem; color:var(--text-muted-dark);">→</span>
      <input class="hp-input" id="mapVal-${id}" value="${esc(targetVal || '')}" placeholder="KEY / ACTION" style="flex:1;">
      <button class="cyber-button sm danger" onclick="this.parentElement.remove()" style="padding:4px 8px;" aria-label="Remove">✕</button>`;
    c.appendChild(row);
  }

  function collectMappingRows() {
    const c = document.getElementById('gameMappingRows');
    if (!c) return {};
    const mapping = {};
    c.querySelectorAll('[id^="mapBtn-"]').forEach(sel => {
      const id = sel.id.replace('mapBtn-', '');
      const v = document.getElementById('mapVal-' + id);
      if (sel.value && v && v.value.trim()) mapping[sel.value] = v.value.trim();
    });
    return mapping;
  }

  function populateMappingRows(json) {
    clearMappingRows();
    Object.entries(json || {}).forEach(([k, v]) => addMappingRow(k, v));
  }

  function populateAssignedProfileSelect(selectedId) {
    const sel = document.getElementById('newGameAssignedProfile');
    if (!sel) return;
    const profiles = HP.getControllerProfiles();
    sel.innerHTML = '<option value="">— None —</option>' +
      profiles.map(p => `<option value="${p.profile_id}" ${p.profile_id === selectedId ? 'selected' : ''}>${esc(p.profile_name)} (${p.controller_type})</option>`).join('');
  }

  /* ── Public API ───────────────────────────────────────── */
  window.HPProfiles = {
    init() { inject(); },
    addMappingRow() { addMappingRow('A', ''); },

    open() {
      document.getElementById('profilesPanel').classList.add('active');
      this.switchTab('controller');
    },

    close() {
      document.getElementById('profilesPanel').classList.remove('active');
    },

    switchTab(tab) {
      document.getElementById('profTabController').classList.toggle('active', tab === 'controller');
      document.getElementById('profTabGame').classList.toggle('active', tab === 'game');
      document.getElementById('profControllerBody').style.display = tab === 'controller' ? 'block' : 'none';
      document.getElementById('profGameBody').style.display       = tab === 'game'       ? 'block' : 'none';
      if (tab === 'controller') renderProfiles();
      else renderGameProfiles();
    },

    filterProfiles() { renderProfiles(); },

    // ── Controller Profile CRUD ──────────────────────────

    openNewProfileForm() {
      _editingProfileId = null;
      document.getElementById('profileFormTitle').innerText = 'NEW CONTROLLER PROFILE';
      document.getElementById('profileFormName').value = '';
      document.getElementById('profileFormType').value = 'gamepad';
      document.getElementById('profileForm').style.display = 'block';
      document.getElementById('profileFormName').focus();
    },

    editProfile(profileId) {
      const p = HP.getControllerProfiles().find(x => x.profile_id === profileId);
      if (!p) return;
      if (!isOwner(p)) { if (typeof showToast === 'function') showToast('You can only edit your own profiles.'); return; }
      _editingProfileId = profileId;
      document.getElementById('profileFormTitle').innerText = 'EDIT PROFILE';
      document.getElementById('profileFormName').value = p.profile_name;
      document.getElementById('profileFormType').value = p.controller_type;
      document.getElementById('profileForm').style.display = 'block';
      document.getElementById('profileFormName').focus();
    },

    duplicateProfile(profileId) {
      const src = HP.getControllerProfiles().find(x => x.profile_id === profileId);
      if (!src) return;
      const name = 'Copy of ' + src.profile_name;
      HP.createControllerProfile(name, src.controller_type, JSON.parse(JSON.stringify(src.layout_json || {})));
      renderProfiles();
      if (typeof showToast === 'function') showToast('✓ Profile duplicated as "' + name + '".');
    },

    cancelProfile() {
      _editingProfileId = null;
      document.getElementById('profileForm').style.display = 'none';
    },

    saveProfile() {
      const name = document.getElementById('profileFormName').value.trim();
      const type = document.getElementById('profileFormType').value;
      if (!name) { if (typeof showToast === 'function') showToast('Enter a profile name.'); return; }

      if (_editingProfileId) {
        const p = HP.getControllerProfiles().find(x => x.profile_id === _editingProfileId);
        if (p && !isOwner(p)) { if (typeof showToast === 'function') showToast('You can only edit your own profiles.'); return; }
        HP.updateControllerProfile(_editingProfileId, { profile_name: name, controller_type: type });
        if (typeof showToast === 'function') showToast('✓ Profile updated.');
      } else {
        HP.createControllerProfile(name, type);
        if (typeof showToast === 'function') showToast('✓ Profile "' + name + '" created.');
      }

      _editingProfileId = null;
      document.getElementById('profileForm').style.display = 'none';
      renderProfiles();
    },

    deleteProfile(id) {
      const p = HP.getControllerProfiles().find(x => x.profile_id === id);
      if (!p) return;
      if (!isOwner(p)) { if (typeof showToast === 'function') showToast('You can only delete your own profiles.'); return; }
      if (!confirm('Delete profile "' + p.profile_name + '"?')) return;
      HP.deleteControllerProfile(id);
      renderProfiles();
      if (typeof showToast === 'function') showToast('Profile deleted.');
    },

    toggleFav(id) {
      const p = HP.getControllerProfiles().find(x => x.profile_id === id);
      if (!p) return;
      if (!isOwner(p)) { if (typeof showToast === 'function') showToast('You can only favorite your own profiles.'); return; }
      const isFav = HP.toggleProfileFavorite(id);
      renderProfiles();
      if (typeof showToast === 'function') showToast(isFav ? '★ Added to favorites.' : '☆ Removed from favorites.');
    },

    loadProfile(id) {
      const p = HP.getControllerProfiles().find(x => x.profile_id === id);
      if (!p) return;
      const typeMap = { gamepad:'gamepad', racing:'wheel', gyro:'gyro', mouse:'mouse', keyboard:'gamepad', custom:'gamepad' };
      const tab = typeMap[p.controller_type] || 'gamepad';
      if (typeof showSection === 'function') showSection('modes');
      if (typeof switchControllerTab === 'function') switchControllerTab(tab);
      this.close();
      if (typeof showToast === 'function') showToast('▶ Loaded: ' + p.profile_name);
    },

    publishProfile(id) {
      if (!HP.isLoggedIn()) {
        if (typeof showToast === 'function') showToast('Sign in to share profiles.');
        if (window.HPAuth) HPAuth.open();
        return;
      }
      const p = HP.getControllerProfiles().find(x => x.profile_id === id);
      if (p && !isOwner(p)) { if (typeof showToast === 'function') showToast('You can only publish your own profiles.'); return; }
      openPublishDialog(id);
    },

    confirmPublish(id) {
      const game = document.getElementById('pubGame-' + id)?.value.trim();
      const desc = document.getElementById('pubDesc-' + id)?.value.trim();
      const tagsRaw = document.getElementById('pubTags-' + id)?.value.trim();
      const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];
      if (!game) { if (typeof showToast === 'function') showToast('Game name required.'); return; }
      HP.publishCommunityProfile(id, game, desc || '', tags);
      document.getElementById('publishForm-' + id)?.remove();
      renderProfiles();
      if (typeof showToast === 'function') showToast('✓ Published to Community Hub.');
    },

    // ── Game Profile CRUD ────────────────────────────────

    openNewGameForm() {
      _editingGameId = null;
      document.getElementById('gameFormTitle').innerText = 'NEW GAME MAP';
      document.getElementById('newGameName').value  = '';
      document.getElementById('newGameIcon').value  = '';
      document.getElementById('newGameType').value  = 'gamepad';
      populateAssignedProfileSelect('');
      clearMappingRows();
      addMappingRow('A', 'SPACE'); addMappingRow('B', 'E');
      addMappingRow('X', 'R');     addMappingRow('Y', 'F');
      document.getElementById('newGameForm').style.display = 'block';
      document.getElementById('newGameName').focus();
    },

    editGame(gameId) {
      const g = HP.getGameProfiles().find(x => x.game_profile_id === gameId);
      if (!g) return;
      if (!isOwner(g)) { if (typeof showToast === 'function') showToast('You can only edit your own game maps.'); return; }
      _editingGameId = gameId;
      document.getElementById('gameFormTitle').innerText = 'EDIT GAME MAP';
      document.getElementById('newGameName').value = g.game_name;
      document.getElementById('newGameIcon').value = g.game_icon_url || '';
      document.getElementById('newGameType').value = g.recommended_controller_type || 'gamepad';
      populateAssignedProfileSelect(g.assigned_controller_profile_id || '');
      populateMappingRows(g.button_mapping_json || {});
      document.getElementById('newGameForm').style.display = 'block';
      document.getElementById('newGameName').focus();
    },

    duplicateGame(gameId) {
      const src = HP.getGameProfiles().find(x => x.game_profile_id === gameId);
      if (!src) return;
      const name = 'Copy of ' + src.game_name;
      HP.createGameProfile(name, src.recommended_controller_type, JSON.parse(JSON.stringify(src.button_mapping_json || {})), src.game_icon_url);
      renderGameProfiles();
      if (typeof showToast === 'function') showToast('✓ Game map duplicated as "' + name + '".');
    },

    cancelNewGame() {
      _editingGameId = null;
      clearMappingRows();
      document.getElementById('newGameForm').style.display = 'none';
    },

    saveNewGame() {
      const name = document.getElementById('newGameName')?.value.trim();
      const icon = document.getElementById('newGameIcon')?.value.trim();
      const type = document.getElementById('newGameType')?.value;
      const assignedId = document.getElementById('newGameAssignedProfile')?.value || null;
      if (!name) { if (typeof showToast === 'function') showToast('Enter a game name.'); return; }
      const mappings = collectMappingRows();

      if (_editingGameId) {
        const g = HP.getGameProfiles().find(x => x.game_profile_id === _editingGameId);
        if (g && !isOwner(g)) { if (typeof showToast === 'function') showToast('You can only edit your own game maps.'); return; }
        HP.updateGameProfile(_editingGameId, {
          game_name: name, game_icon_url: icon,
          recommended_controller_type: type,
          button_mapping_json: mappings,
          assigned_controller_profile_id: assignedId || null
        });
        if (typeof showToast === 'function') showToast('✓ Game map updated.');
      } else {
        const g = HP.createGameProfile(name, type, mappings, icon);
        if (assignedId) HP.updateGameProfile(g.game_profile_id, { assigned_controller_profile_id: assignedId });
        if (typeof showToast === 'function') showToast('✓ Game map "' + name + '" created.');
      }

      _editingGameId = null;
      document.getElementById('newGameForm').style.display = 'none';
      renderGameProfiles();
    },

    deleteGame(id) {
      const g = HP.getGameProfiles().find(x => x.game_profile_id === id);
      if (!g) return;
      if (!isOwner(g)) { if (typeof showToast === 'function') showToast('You can only delete your own game maps.'); return; }
      if (!confirm('Delete game map "' + g.game_name + '"?')) return;
      HP.deleteGameProfile(id);
      renderGameProfiles();
      if (typeof showToast === 'function') showToast('Game map deleted.');
    },

    launchGame(gameId) {
      const g = HP.getGameProfiles().find(x => x.game_profile_id === gameId);
      if (!g) return;
      // If there's an assigned controller profile, load it
      if (g.assigned_controller_profile_id) {
        const p = HP.getControllerProfiles().find(x => x.profile_id === g.assigned_controller_profile_id);
        if (p) {
          const typeMap = { gamepad:'gamepad', racing:'wheel', gyro:'gyro', mouse:'mouse', keyboard:'gamepad', custom:'gamepad' };
          const tab = typeMap[p.controller_type] || 'gamepad';
          if (typeof showSection === 'function') showSection('modes');
          if (typeof switchControllerTab === 'function') switchControllerTab(tab);
          this.close();
          if (typeof showToast === 'function') showToast('▶ Launched: ' + g.game_name + ' with ' + p.profile_name);
          return;
        }
      }
      // Otherwise just switch to the recommended controller type
      const typeMap = { gamepad:'gamepad', racing:'wheel', gyro:'gyro', mouse:'mouse', keyboard:'gamepad', custom:'gamepad' };
      const tab = typeMap[g.recommended_controller_type] || 'gamepad';
      if (typeof showSection === 'function') showSection('modes');
      if (typeof switchControllerTab === 'function') switchControllerTab(tab);
      this.close();
      if (typeof showToast === 'function') showToast('▶ Launched: ' + g.game_name);
    }
  };

})();
