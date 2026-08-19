/* ==========================================================================
   HYPERPULSE // PROFILES UI (ui-profiles.js)
   ControllerProfile + GameProfile entities.
   Panel slides in from the right, consistent with existing drawer pattern.
   ========================================================================== */

(function () {

  const TYPES = ['gamepad', 'racing', 'gyro', 'mouse', 'keyboard', 'custom'];
  const TYPE_ICONS = { gamepad:'🎮', racing:'🏎', gyro:'🔭', mouse:'🖱', keyboard:'⌨', custom:'🛠' };

  /* ── Inject HTML ─────────────────────────────────────────── */
  function inject() {
    document.body.insertAdjacentHTML('beforeend', `
<div class="hp-side-panel" id="profilesPanel">
  <div class="hp-panel-header">
    <span class="hp-panel-title">MY PROFILES</span>
    <button class="close-btn" onclick="HPProfiles.close()" style="color:#fff;">✕</button>
  </div>

  <div class="hp-panel-tabs">
    <button class="hp-panel-tab active" id="profTabController" onclick="HPProfiles.switchTab('controller')">CONTROLLER</button>
    <button class="hp-panel-tab" id="profTabGame" onclick="HPProfiles.switchTab('game')">GAME MAPS</button>
  </div>

  <!-- Controller Profiles -->
  <div class="hp-panel-body" id="profControllerBody">
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
      <span style="font-family:var(--font-mono); font-size:0.7rem; color:var(--text-muted-dark);">SAVED PROFILES</span>
      <button class="cyber-button sm primary" onclick="HPProfiles.openNewProfileForm()">+ NEW</button>
    </div>

    <div id="profilesList"></div>

    <!-- New Profile Form -->
    <div id="newProfileForm" style="display:none; margin-top:16px; border:1px solid var(--dark-border); padding:16px;">
      <div class="hp-label" style="margin-bottom:10px;">NEW CONTROLLER PROFILE</div>
      <div class="hp-field">
        <label class="hp-label">NAME</label>
        <input class="hp-input" id="newProfileName" placeholder="My Custom Layout">
      </div>
      <div class="hp-field">
        <label class="hp-label">TYPE</label>
        <select class="hp-input" id="newProfileType">
          ${TYPES.map(t => `<option value="${t}">${TYPE_ICONS[t]} ${t.toUpperCase()}</option>`).join('')}
        </select>
      </div>
      <div style="display:flex; gap:8px; margin-top:12px;">
        <button class="cyber-button sm primary" onclick="HPProfiles.saveNewProfile()">SAVE</button>
        <button class="cyber-button sm secondary" onclick="HPProfiles.cancelNewProfile()">CANCEL</button>
      </div>
    </div>
  </div>

  <!-- Game Profile Maps -->
  <div class="hp-panel-body" id="profGameBody" style="display:none;">
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
      <span style="font-family:var(--font-mono); font-size:0.7rem; color:var(--text-muted-dark);">GAME KEYMAPS</span>
      <button class="cyber-button sm primary" onclick="HPProfiles.openNewGameForm()">+ NEW</button>
    </div>

    <div id="gameProfilesList"></div>

    <!-- New Game Form -->
    <div id="newGameForm" style="display:none; margin-top:16px; border:1px solid var(--dark-border); padding:16px;">
      <div class="hp-label" style="margin-bottom:10px;">NEW GAME MAP</div>
      <div class="hp-field">
        <label class="hp-label">GAME NAME</label>
        <input class="hp-input" id="newGameName" placeholder="e.g. Fortnite">
      </div>
      <div class="hp-field">
        <label class="hp-label">CONTROLLER TYPE</label>
        <select class="hp-input" id="newGameType">
          ${TYPES.map(t => `<option value="${t}">${TYPE_ICONS[t]} ${t.toUpperCase()}</option>`).join('')}
        </select>
      </div>
      <div style="display:flex; gap:8px; margin-top:12px;">
        <button class="cyber-button sm primary" onclick="HPProfiles.saveNewGame()">SAVE</button>
        <button class="cyber-button sm secondary" onclick="HPProfiles.cancelNewGame()">CANCEL</button>
      </div>
    </div>
  </div>
</div>
    `);
  }

  /* ── Render controller profiles list ─────────────────────── */
  function renderProfiles() {
    const list = document.getElementById('profilesList');
    if (!list) return;
    const profiles = HP.getControllerProfiles();
    if (profiles.length === 0) {
      list.innerHTML = '<p style="font-family:var(--font-mono);font-size:0.75rem;color:var(--text-muted-dark);">No profiles yet.</p>';
      return;
    }
    list.innerHTML = profiles.map(p => `
      <div class="hp-profile-card" id="pcard-${p.profile_id}">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <span class="hp-profile-icon">${TYPE_ICONS[p.controller_type] || '🎮'}</span>
            <span class="hp-profile-name">${escHtml(p.profile_name)}</span>
            ${p.is_favorite ? '<span class="hp-fav-star">★</span>' : ''}
          </div>
          <span class="hp-profile-type-tag">${p.controller_type.toUpperCase()}</span>
        </div>
        <div style="display:flex; gap:6px; margin-top:10px;">
          <button class="cyber-button sm secondary" onclick="HPProfiles.loadProfile('${p.profile_id}')">▶ LOAD</button>
          <button class="cyber-button sm secondary" onclick="HPProfiles.toggleFav('${p.profile_id}')">
            ${p.is_favorite ? '★ UNFAV' : '☆ FAV'}
          </button>
          <button class="cyber-button sm secondary" onclick="HPProfiles.publishProfile('${p.profile_id}')">⬆ SHARE</button>
          <button class="cyber-button sm danger" onclick="HPProfiles.deleteProfile('${p.profile_id}')">✕</button>
        </div>
      </div>
    `).join('');
  }

  /* ── Render game profiles ─────────────────────────────────── */
  function renderGameProfiles() {
    const list = document.getElementById('gameProfilesList');
    if (!list) return;
    const games = HP.getGameProfiles();
    if (games.length === 0) {
      list.innerHTML = '<p style="font-family:var(--font-mono);font-size:0.75rem;color:var(--text-muted-dark);">No game maps yet.</p>';
      return;
    }
    list.innerHTML = games.map(g => `
      <div class="hp-profile-card">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span class="hp-profile-name">${escHtml(g.game_name)}</span>
          <span class="hp-profile-type-tag">${(g.recommended_controller_type || '').toUpperCase()}</span>
        </div>
        <div class="hp-keymap-grid" style="margin:8px 0;">
          ${Object.entries(g.button_mapping_json || {}).map(([k, v]) =>
            `<span class="hp-keymap-chip"><b>${k}</b>→${v}</span>`
          ).join('')}
        </div>
        <div style="display:flex; gap:6px; margin-top:6px;">
          <button class="cyber-button sm danger" onclick="HPProfiles.deleteGame('${g.game_profile_id}')">✕ DELETE</button>
        </div>
      </div>
    `).join('');
  }

  function escHtml(s) {
    return String(s).replace(/[&<>"']/g, c =>
      ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  /* ── Publish dialog (inline, no extra modal) ─────────────── */
  function openPublishDialog(profileId) {
    const card = document.getElementById('pcard-' + profileId);
    if (!card) return;

    // Remove any existing publish form
    const existing = document.getElementById('publishForm-' + profileId);
    if (existing) { existing.remove(); return; }

    const form = document.createElement('div');
    form.id = 'publishForm-' + profileId;
    form.className = 'hp-publish-form';
    form.innerHTML = `
      <div class="hp-label">SHARE TO COMMUNITY</div>
      <div class="hp-field">
        <label class="hp-label">GAME NAME</label>
        <input class="hp-input" id="pubGame-${profileId}" placeholder="e.g. Fortnite">
      </div>
      <div class="hp-field">
        <label class="hp-label">DESCRIPTION</label>
        <textarea class="hp-input" id="pubDesc-${profileId}" rows="2" placeholder="Describe your profile..."></textarea>
      </div>
      <div class="hp-field">
        <label class="hp-label">TAGS (comma separated)</label>
        <input class="hp-input" id="pubTags-${profileId}" placeholder="FPS, Competitive">
      </div>
      <div style="display:flex; gap:8px; margin-top:10px;">
        <button class="cyber-button sm primary" onclick="HPProfiles.confirmPublish('${profileId}')">PUBLISH</button>
        <button class="cyber-button sm secondary" onclick="document.getElementById('publishForm-${profileId}').remove()">CANCEL</button>
      </div>
    `;
    card.appendChild(form);
  }

  /* ── Public API ──────────────────────────────────────────── */
  window.HPProfiles = {

    init() { inject(); },

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
      document.getElementById('profGameBody').style.display = tab === 'game' ? 'block' : 'none';
      if (tab === 'controller') renderProfiles();
      else renderGameProfiles();
    },

    openNewProfileForm() {
      document.getElementById('newProfileForm').style.display = 'block';
      document.getElementById('newProfileName').value = '';
    },

    cancelNewProfile() {
      document.getElementById('newProfileForm').style.display = 'none';
    },

    saveNewProfile() {
      const name = document.getElementById('newProfileName').value.trim();
      const type = document.getElementById('newProfileType').value;
      if (!name) { if (typeof showToast === 'function') showToast('Enter a profile name.'); return; }
      HP.createControllerProfile(name, type);
      document.getElementById('newProfileForm').style.display = 'none';
      renderProfiles();
      if (typeof showToast === 'function') showToast('✓ Profile "' + name + '" saved.');
    },

    deleteProfile(id) {
      HP.deleteControllerProfile(id);
      renderProfiles();
      if (typeof showToast === 'function') showToast('Profile deleted.');
    },

    toggleFav(id) {
      const isFav = HP.toggleProfileFavorite(id);
      renderProfiles();
      if (typeof showToast === 'function') showToast(isFav ? '★ Added to favorites.' : '☆ Removed from favorites.');
    },

    loadProfile(id) {
      const p = HP.getControllerProfiles().find(x => x.profile_id === id);
      if (!p) return;
      // Map controller_type to the existing tab system
      const typeMap = { gamepad:'gamepad', racing:'wheel', gyro:'gyro', mouse:'mouse' };
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
      openPublishDialog(id);
    },

    confirmPublish(id) {
      const game = document.getElementById('pubGame-' + id).value.trim();
      const desc = document.getElementById('pubDesc-' + id).value.trim();
      const tagsRaw = document.getElementById('pubTags-' + id).value.trim();
      const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];

      if (!game) { if (typeof showToast === 'function') showToast('Game name required.'); return; }

      HP.publishCommunityProfile(id, game, desc, tags);
      document.getElementById('publishForm-' + id).remove();
      renderProfiles();
      if (typeof showToast === 'function') showToast('✓ Published to Community Hub.');
    },

    /* Game profiles */
    openNewGameForm() {
      document.getElementById('newGameForm').style.display = 'block';
      document.getElementById('newGameName').value = '';
    },

    cancelNewGame() {
      document.getElementById('newGameForm').style.display = 'none';
    },

    saveNewGame() {
      const name = document.getElementById('newGameName').value.trim();
      const type = document.getElementById('newGameType').value;
      if (!name) { if (typeof showToast === 'function') showToast('Enter a game name.'); return; }
      HP.createGameProfile(name, type, {});
      document.getElementById('newGameForm').style.display = 'none';
      renderGameProfiles();
      if (typeof showToast === 'function') showToast('✓ Game map created.');
    },

    deleteGame(id) {
      HP.deleteGameProfile(id);
      renderGameProfiles();
    }
  };

})();
