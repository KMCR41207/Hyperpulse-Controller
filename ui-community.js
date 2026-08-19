/* ==========================================================================
   HYPERPULSE // COMMUNITY UI (ui-community.js)
   CommunityProfile + CommunityReview + CommunityDownload + CommunityFavorite
   ========================================================================== */

(function () {

  const TYPE_ICONS = { gamepad:'🎮', racing:'🏎', gyro:'🔭', mouse:'🖱', keyboard:'⌨', custom:'🛠' };

  let _currentFilters = { controller_type: '', search: '', sort: 'downloads' };
  let _detailId = null;

  function esc(s) {
    return String(s || '').replace(/[&<>"']/g, c =>
      ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }

  function stars(rating) {
    const full  = Math.floor(rating);
    const empty = 5 - full;
    return '★'.repeat(full) + '☆'.repeat(empty) + ` <span style="opacity:.7">${rating.toFixed(1)}</span>`;
  }

  /* ── Inject HTML ─────────────────────────────────────────── */
  function inject() {
    document.body.insertAdjacentHTML('beforeend', `

<!-- COMMUNITY FULL-PAGE SECTION (injected, hidden until showSection('community')) -->
<section id="communitySection" class="app-section">
  <div class="section-container">

    <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:30px; flex-wrap:wrap; gap:16px;">
      <div>
        <h2 class="section-title">COMMUNITY HUB</h2>
        <p class="section-sub">BROWSE · DOWNLOAD · RATE SHARED CONTROLLER PROFILES</p>
      </div>
      <button class="cyber-button sm primary" onclick="HPCommunity.openFavorites()">★ MY FAVORITES</button>
    </div>

    <!-- Filter Bar -->
    <div class="hp-filter-bar">
      <input class="hp-input hp-search-input" id="commSearch" placeholder="SEARCH PROFILES / GAMES / TAGS…"
             oninput="HPCommunity.onSearch(this.value)">

      <div class="hp-filter-chips">
        <button class="hp-chip active" data-type="" onclick="HPCommunity.filterType(this, '')">ALL</button>
        <button class="hp-chip" data-type="gamepad"  onclick="HPCommunity.filterType(this,'gamepad')">🎮 GAMEPAD</button>
        <button class="hp-chip" data-type="racing"   onclick="HPCommunity.filterType(this,'racing')">🏎 RACING</button>
        <button class="hp-chip" data-type="gyro"     onclick="HPCommunity.filterType(this,'gyro')">🔭 GYRO</button>
        <button class="hp-chip" data-type="mouse"    onclick="HPCommunity.filterType(this,'mouse')">🖱 MOUSE</button>
      </div>

      <div class="hp-filter-chips">
        <button class="hp-chip active" data-sort="downloads" onclick="HPCommunity.filterSort(this,'downloads')">↓ POPULAR</button>
        <button class="hp-chip" data-sort="rating"    onclick="HPCommunity.filterSort(this,'rating')">★ RATING</button>
        <button class="hp-chip" data-sort="newest"    onclick="HPCommunity.filterSort(this,'newest')">⏱ NEWEST</button>
      </div>
    </div>

    <!-- Grid -->
    <div class="hp-community-grid" id="communityGrid"></div>

    <!-- Empty state -->
    <div id="communityEmpty" style="display:none; text-align:center; padding:60px 0;">
      <div style="font-family:var(--font-display); font-size:3rem; color:var(--accent-red);">NO RESULTS</div>
      <p style="font-family:var(--font-mono); font-size:0.8rem; color:var(--text-muted-light); margin-top:8px;">Try a different filter or search term.</p>
    </div>
  </div>
</section>

<!-- COMMUNITY PROFILE DETAIL MODAL -->
<div class="modal-backdrop" id="communityDetailModal">
  <div class="modal-card" style="width:600px; max-height:90vh; overflow-y:auto;" id="communityDetailCard">
    <!-- rendered dynamically -->
  </div>
</div>

<!-- FAVORITES PANEL -->
<div class="hp-side-panel" id="favoritesPanel">
  <div class="hp-panel-header">
    <span class="hp-panel-title">★ FAVORITES</span>
    <button class="close-btn" onclick="HPCommunity.closeFavorites()" style="color:#fff;">✕</button>
  </div>
  <div class="hp-panel-body" id="favoritesList"></div>
</div>

    `);
  }

  /* ── Render grid ─────────────────────────────────────────── */
  function renderGrid() {
    const grid  = document.getElementById('communityGrid');
    const empty = document.getElementById('communityEmpty');
    if (!grid) return;

    const profiles = HP.getCommunityProfiles(_currentFilters);

    if (profiles.length === 0) {
      grid.innerHTML = '';
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';

    grid.innerHTML = profiles.map(p => {
      const isFav = HP.isCommunityFavorite(p.community_profile_id);
      return `
        <div class="hp-community-card" onclick="HPCommunity.openDetail('${esc(p.community_profile_id)}')">
          <div class="hp-comm-card-header">
            <span class="hp-comm-type-icon">${TYPE_ICONS[p.controller_type] || '🎮'}</span>
            <span class="hp-comm-type-tag">${p.controller_type.toUpperCase()}</span>
            <button class="hp-fav-btn ${isFav ? 'active' : ''}"
              onclick="event.stopPropagation(); HPCommunity.toggleFav('${esc(p.community_profile_id)}')"
              title="${isFav ? 'Remove favorite' : 'Add to favorites'}">
              ${isFav ? '★' : '☆'}
            </button>
          </div>
          <div class="hp-comm-card-name">${esc(p.profile_name)}</div>
          <div class="hp-comm-card-game">${esc(p.game_name)}</div>
          <div class="hp-comm-card-tags">
            ${(p.tags || []).slice(0, 3).map(t => `<span class="hp-comm-tag">${esc(t)}</span>`).join('')}
          </div>
          <div class="hp-comm-card-footer">
            <span class="hp-comm-stars">${stars(p.average_rating)}</span>
            <span class="hp-comm-downloads">⬇ ${p.download_count.toLocaleString()}</span>
          </div>
          <div class="hp-comm-author">by ${esc(p.author_name || 'Unknown')}</div>
        </div>
      `;
    }).join('');
  }

  /* ── Render detail modal ─────────────────────────────────── */
  function renderDetail(communityProfileId) {
    const p = HP.getCommunityProfiles().find(x => x.community_profile_id === communityProfileId);
    if (!p) return;

    const reviews = HP.getReviewsForProfile(communityProfileId);
    const isFav   = HP.isCommunityFavorite(communityProfileId);

    document.getElementById('communityDetailCard').innerHTML = `
      <div class="modal-header">
        <h3>${esc(p.profile_name)}</h3>
        <button class="close-btn" onclick="HPCommunity.closeDetail()">✕</button>
      </div>

      <div style="display:flex; gap:12px; flex-wrap:wrap; margin-bottom:16px; align-items:center;">
        <span class="hp-profile-type-tag">${p.controller_type.toUpperCase()}</span>
        <span style="font-family:var(--font-mono); font-size:0.75rem; color:var(--text-muted-light);">${esc(p.game_name)}</span>
        <span class="hp-comm-stars">${stars(p.average_rating)}</span>
        <span style="font-family:var(--font-mono); font-size:0.75rem;">⬇ ${p.download_count.toLocaleString()} downloads</span>
      </div>

      <p style="font-size:0.9rem; color:var(--text-muted-light); margin-bottom:16px; line-height:1.5;">${esc(p.description)}</p>

      <div style="margin-bottom:16px;">
        ${(p.tags || []).map(t => `<span class="hp-comm-tag">${esc(t)}</span>`).join(' ')}
      </div>

      <div style="font-family:var(--font-mono); font-size:0.7rem; color:var(--text-muted-light); margin-bottom:20px;">
        by ${esc(p.author_name || 'Unknown')} · ${new Date(p.created_at).toLocaleDateString()}
      </div>

      <div style="display:flex; gap:10px; margin-bottom:28px; flex-wrap:wrap;">
        <button class="cyber-button md primary" onclick="HPCommunity.download('${esc(communityProfileId)}')">
          ⬇ DOWNLOAD TO MY PROFILES
        </button>
        <button class="cyber-button md secondary hp-fav-btn ${isFav ? 'active' : ''}"
          id="detailFavBtn"
          onclick="HPCommunity.toggleFav('${esc(communityProfileId)}'); HPCommunity.refreshDetailFavBtn('${esc(communityProfileId)}')">
          ${isFav ? '★ FAVORITED' : '☆ ADD TO FAVORITES'}
        </button>
      </div>

      <!-- Reviews -->
      <div style="border-top:2px solid var(--ink-black); padding-top:20px;">
        <div style="font-family:var(--font-mono); font-weight:700; font-size:0.85rem; margin-bottom:16px;">
          REVIEWS (${reviews.length})
        </div>

        ${reviews.length === 0 ? '<p style="font-family:var(--font-mono);font-size:0.75rem;color:var(--text-muted-light);">No reviews yet. Be the first.</p>' : ''}

        ${reviews.map(r => `
          <div class="hp-review-card">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
              <span style="font-family:var(--font-mono); font-size:0.75rem; font-weight:700;">${esc(r.author_name)}</span>
              <span class="hp-comm-stars">${stars(r.rating)}</span>
            </div>
            <p style="font-size:0.85rem; color:var(--text-muted-light);">${esc(r.comment_text)}</p>
            <div style="font-family:var(--font-mono); font-size:0.65rem; color:var(--text-muted-light); margin-top:6px;">
              ${new Date(r.created_at).toLocaleDateString()}
            </div>
          </div>
        `).join('')}

        <!-- Add review -->
        <div class="hp-review-form" id="reviewForm-${communityProfileId}">
          <div class="hp-label" style="margin-bottom:8px;">WRITE A REVIEW</div>
          <div style="display:flex; gap:8px; margin-bottom:8px;">
            ${[1,2,3,4,5].map(n =>
              `<button class="hp-star-btn" data-rating="${n}"
                onclick="HPCommunity.setReviewRating('${esc(communityProfileId)}', ${n})">${n}★</button>`
            ).join('')}
          </div>
          <textarea class="hp-input" id="reviewText-${communityProfileId}" rows="2"
            placeholder="Share your experience…" style="width:100%; margin-bottom:8px;"></textarea>
          <button class="cyber-button sm primary"
            onclick="HPCommunity.submitReview('${esc(communityProfileId)}')">SUBMIT REVIEW</button>
        </div>
      </div>
    `;
  }

  /* ── Render favorites panel ──────────────────────────────── */
  function renderFavorites() {
    const list = document.getElementById('favoritesList');
    if (!list) return;
    const favs = HP.getCommunityFavorites();
    if (favs.length === 0) {
      list.innerHTML = '<p style="font-family:var(--font-mono);font-size:0.75rem;color:var(--text-muted-dark);">No favorites yet. Star a profile to save it here.</p>';
      return;
    }
    const allProfiles = HP.getCommunityProfiles();
    list.innerHTML = favs.map(f => {
      const p = allProfiles.find(x => x.community_profile_id === f.community_profile_id);
      if (!p) return '';
      return `
        <div class="hp-profile-card" style="cursor:pointer;"
          onclick="HPCommunity.closeFavorites(); HPCommunity.openDetail('${esc(p.community_profile_id)}')">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span class="hp-profile-name">${esc(p.profile_name)}</span>
            <span class="hp-profile-type-tag">${p.controller_type.toUpperCase()}</span>
          </div>
          <div style="font-family:var(--font-mono); font-size:0.7rem; color:var(--text-muted-dark); margin-top:4px;">
            ${esc(p.game_name)} · ${stars(p.average_rating)}
          </div>
        </div>
      `;
    }).join('');
  }

  /* track review rating selection per profile */
  const _selectedRatings = {};

  /* ── Public API ──────────────────────────────────────────── */
  window.HPCommunity = {

    init() { inject(); },

    open() {
      if (typeof showSection === 'function') showSection('community');
      renderGrid();
    },

    onSearch(val) {
      _currentFilters.search = val;
      renderGrid();
    },

    filterType(btn, type) {
      document.querySelectorAll('.hp-filter-chips .hp-chip[data-type]')
        .forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _currentFilters.controller_type = type;
      renderGrid();
    },

    filterSort(btn, sort) {
      document.querySelectorAll('.hp-filter-chips .hp-chip[data-sort]')
        .forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _currentFilters.sort = sort;
      renderGrid();
    },

    openDetail(id) {
      _detailId = id;
      renderDetail(id);
      document.getElementById('communityDetailModal').classList.add('active');
    },

    closeDetail() {
      document.getElementById('communityDetailModal').classList.remove('active');
      _detailId = null;
    },

    download(id) {
      const imported = HP.downloadCommunityProfile(id);
      if (imported) {
        if (typeof showToast === 'function') showToast('⬇ Downloaded: ' + imported.profile_name);
        renderGrid();
        renderDetail(id);
      }
    },

    toggleFav(id) {
      if (!HP.isLoggedIn()) {
        if (typeof showToast === 'function') showToast('Sign in to save favorites.');
        if (window.HPAuth) HPAuth.open();
        return;
      }
      const now = HP.toggleCommunityFavorite(id);
      if (typeof showToast === 'function') showToast(now ? '★ Added to favorites.' : '☆ Removed from favorites.');
      renderGrid();
    },

    refreshDetailFavBtn(id) {
      const btn = document.getElementById('detailFavBtn');
      if (!btn) return;
      const isFav = HP.isCommunityFavorite(id);
      btn.textContent = isFav ? '★ FAVORITED' : '☆ ADD TO FAVORITES';
      btn.classList.toggle('active', isFav);
    },

    openFavorites() {
      renderFavorites();
      document.getElementById('favoritesPanel').classList.add('active');
    },

    closeFavorites() {
      document.getElementById('favoritesPanel').classList.remove('active');
    },

    setReviewRating(profileId, rating) {
      _selectedRatings[profileId] = rating;
      const form = document.getElementById('reviewForm-' + profileId);
      if (!form) return;
      form.querySelectorAll('.hp-star-btn').forEach(btn => {
        const r = parseInt(btn.dataset.rating);
        btn.classList.toggle('active', r <= rating);
      });
    },

    submitReview(profileId) {
      const rating = _selectedRatings[profileId] || 0;
      const text   = (document.getElementById('reviewText-' + profileId) || {}).value || '';

      if (!rating) {
        if (typeof showToast === 'function') showToast('Select a star rating first.');
        return;
      }
      if (!text.trim()) {
        if (typeof showToast === 'function') showToast('Write a comment before submitting.');
        return;
      }

      HP.addReview(profileId, rating, text.trim());
      if (typeof showToast === 'function') showToast('✓ Review submitted.');
      delete _selectedRatings[profileId];
      renderDetail(profileId);
      renderGrid();
    }
  };

})();
