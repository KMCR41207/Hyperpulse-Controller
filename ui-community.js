/* ==========================================================================
   HYPERPULSE // COMMUNITY HUB (ui-community.js)
   CommunityProfile · CommunityReview · CommunityDownload · CommunityFavorite
   Security: only is_public=true profiles are shown to non-owners.
   ========================================================================== */

(function () {

  const TYPE_ICONS = { gamepad:'🎮', racing:'🏎', gyro:'🔭', mouse:'🖱', keyboard:'⌨', custom:'🛠' };
  const RATING_LABELS = { 0:'All Ratings', 1:'1+ Stars', 2:'2+ Stars', 3:'3+ Stars', 4:'4+ Stars', 5:'5 Stars Only' };

  // Active filter state
  let _f = { search:'', controller_type:'', sort:'downloads', min_rating:0, tag:'' };
  let _detailId   = null;
  let _loading    = false;

  // ─── helpers ──────────────────────────────────────────────────────────────
  function esc(s) {
    return String(s||'').replace(/[&<>"']/g, c =>
      ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function stars(rating, interactive, profileId) {
    if (interactive) {
      return [1,2,3,4,5].map(n =>
        `<button class="hp-star-btn" data-n="${n}" aria-label="${n} star"
          onclick="HPCommunity._setRating('${esc(profileId)}',${n})">★</button>`
      ).join('');
    }
    const r = parseFloat(rating) || 0;
    const full = Math.floor(r), half = r - full >= 0.5 ? 1 : 0, empty = 5 - full - half;
    return '<span class="hp-stars-display" aria-label="' + r.toFixed(1) + ' out of 5">' +
      '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(empty) +
      ` <span style="opacity:.65; font-size:.85em">${r.toFixed(1)}</span></span>`;
  }

  function timeAgo(iso) {
    if (!iso) return '';
    const diff = Date.now() - new Date(iso);
    const m = Math.floor(diff/60000), h = Math.floor(diff/3600000), d = Math.floor(diff/86400000);
    if (d > 30) return new Date(iso).toLocaleDateString();
    if (d >= 1) return d + 'd ago';
    if (h >= 1) return h + 'h ago';
    if (m >= 1) return m + 'm ago';
    return 'just now';
  }

  /* Returns only publicly visible profiles for the current user:
     - is_public === true, OR
     - owned by the current user (they can see their own private profiles) */
  function visibleProfiles(filters) {
    const user = HP.getUser();
    const uid  = user ? user.user_id : null;
    let list = HP.getCommunityProfiles(filters).filter(p =>
      p.is_public === true || (uid && p.user_id === uid)
    );
    // Rating filter
    if (filters && filters.min_rating > 0) {
      list = list.filter(p => p.average_rating >= filters.min_rating);
    }
    // Tag filter
    if (filters && filters.tag) {
      const t = filters.tag.toLowerCase();
      list = list.filter(p => (p.tags||[]).some(x => x.toLowerCase() === t));
    }
    return list;
  }

  /* All unique tags across public profiles */
  function allTags() {
    const set = new Set();
    HP.getCommunityProfiles().filter(p => p.is_public).forEach(p =>
      (p.tags||[]).forEach(t => set.add(t))
    );
    return [...set].sort();
  }

  // ─── HTML injection ────────────────────────────────────────────────────────
  function inject() {
    document.body.insertAdjacentHTML('beforeend', `
<section id="communitySection" class="app-section">
<div class="section-container">

  <!-- Header -->
  <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:24px; flex-wrap:wrap; gap:12px;">
    <div>
      <h2 class="section-title">COMMUNITY HUB</h2>
      <p class="section-sub">BROWSE · DOWNLOAD · RATE SHARED CONTROLLER PROFILES</p>
    </div>
    <div style="display:flex; gap:8px; flex-wrap:wrap;">
      <button class="cyber-button sm secondary" onclick="HPCommunity.openFavorites()">★ MY FAVORITES</button>
      <button class="cyber-button sm primary"   onclick="HPCommunity.openPublishPanel()">⬆ PUBLISH</button>
    </div>
  </div>

  <!-- ── Featured sections ─────────────────────────────────── -->
  <div id="commFeaturedWrap">
    <!-- Featured row -->
    <div style="margin-bottom:28px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <span style="font-family:var(--font-mono); font-size:0.7rem; color:var(--text-muted-dark); letter-spacing:2px;">🔥 TRENDING THIS WEEK</span>
      </div>
      <div id="commFeaturedRow" class="hp-comm-featured-row"></div>
    </div>
    <!-- Highest rated row -->
    <div style="margin-bottom:28px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <span style="font-family:var(--font-mono); font-size:0.7rem; color:var(--text-muted-dark); letter-spacing:2px;">★ HIGHEST RATED</span>
      </div>
      <div id="commRatedRow" class="hp-comm-featured-row"></div>
    </div>
    <hr style="border-color:var(--dark-border); margin:24px 0;">
  </div>

  <!-- ── Filter bar ─────────────────────────────────────────── -->
  <div class="hp-filter-bar" style="margin-bottom:20px;">
    <!-- Search -->
    <div style="position:relative; flex:1; min-width:180px;">
      <input class="hp-input hp-search-input" id="commSearch" placeholder="Search profiles, games, tags…"
        style="width:100%; padding-left:32px;"
        oninput="HPCommunity._onSearch(this.value)" aria-label="Search community profiles">
      <span style="position:absolute; left:10px; top:50%; transform:translateY(-50%); color:#555; pointer-events:none;">🔍</span>
    </div>

    <!-- Controller type chips -->
    <div class="hp-filter-chips" style="flex-wrap:wrap; gap:4px;">
      <button class="hp-chip active" data-type="" onclick="HPCommunity._filterType(this,'')">ALL</button>
      <button class="hp-chip" data-type="gamepad"   onclick="HPCommunity._filterType(this,'gamepad')">🎮</button>
      <button class="hp-chip" data-type="racing"    onclick="HPCommunity._filterType(this,'racing')">🏎</button>
      <button class="hp-chip" data-type="gyro"      onclick="HPCommunity._filterType(this,'gyro')">🔭</button>
      <button class="hp-chip" data-type="mouse"     onclick="HPCommunity._filterType(this,'mouse')">🖱</button>
      <button class="hp-chip" data-type="keyboard"  onclick="HPCommunity._filterType(this,'keyboard')">⌨</button>
    </div>

    <!-- Sort + Rating -->
    <div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
      <select class="hp-input" id="commSortSel" onchange="HPCommunity._filterSort(this.value)"
        style="min-width:130px; font-size:0.75rem;" aria-label="Sort by">
        <option value="downloads">↓ Most Downloaded</option>
        <option value="rating">★ Highest Rated</option>
        <option value="newest">⏱ Recently Added</option>
      </select>
      <select class="hp-input" id="commRatingSel" onchange="HPCommunity._filterRating(this.value)"
        style="min-width:120px; font-size:0.75rem;" aria-label="Minimum rating">
        <option value="0">All Ratings</option>
        <option value="3">3+ Stars</option>
        <option value="4">4+ Stars</option>
        <option value="5">5 Stars</option>
      </select>
      <select class="hp-input" id="commTagSel" onchange="HPCommunity._filterTag(this.value)"
        style="min-width:110px; font-size:0.75rem;" aria-label="Filter by tag">
        <option value="">All Tags</option>
      </select>
    </div>
  </div>

  <!-- Results count -->
  <div id="commResultCount" style="font-family:var(--font-mono); font-size:0.7rem; color:var(--text-muted-dark); margin-bottom:12px;"></div>

  <!-- Loading state -->
  <div id="commLoading" style="display:none; text-align:center; padding:40px; font-family:var(--font-mono); font-size:0.8rem; color:#666;">
    <div style="font-size:1.5rem; margin-bottom:8px;">⟳</div>LOADING PROFILES…
  </div>

  <!-- Grid -->
  <div class="hp-community-grid" id="communityGrid" role="list"></div>

  <!-- Empty state -->
  <div id="communityEmpty" style="display:none; text-align:center; padding:60px 20px;">
    <div style="font-size:3rem; margin-bottom:12px;">🔍</div>
    <div style="font-family:var(--font-display); font-size:1.3rem; letter-spacing:2px; color:var(--accent-red);">NO RESULTS</div>
    <p style="font-family:var(--font-mono); font-size:0.8rem; color:var(--text-muted-dark); margin-top:8px;">
      Try a different search, filter, or be the first to publish one.
    </p>
    <button class="cyber-button sm primary" onclick="HPCommunity.openPublishPanel()" style="margin-top:16px;">⬆ PUBLISH YOURS</button>
  </div>

</div>
</section>

<!-- ── Detail Modal ─────────────────────────────────────────── -->
<div class="modal-backdrop" id="communityDetailModal" role="dialog" aria-modal="true" aria-label="Profile Details">
  <div class="modal-card" style="width:620px; max-height:90vh; overflow-y:auto; position:relative;" id="communityDetailCard">
    <div style="text-align:center; padding:40px; font-family:var(--font-mono); font-size:0.85rem; color:#666;">Loading…</div>
  </div>
</div>

<!-- ── Favorites Side Panel ──────────────────────────────────── -->
<div class="hp-side-panel" id="favoritesPanel" role="complementary" aria-label="My Favorites">
  <div class="hp-panel-header">
    <span class="hp-panel-title">★ MY FAVORITES</span>
    <button class="close-btn" onclick="HPCommunity.closeFavorites()" style="color:#fff;" aria-label="Close">✕</button>
  </div>
  <div class="hp-panel-body" id="favoritesList"></div>
</div>

<!-- ── Publish Panel ─────────────────────────────────────────── -->
<div class="hp-side-panel" id="publishPanel" role="complementary" aria-label="Publish Profile">
  <div class="hp-panel-header">
    <span class="hp-panel-title">⬆ PUBLISH PROFILE</span>
    <button class="close-btn" onclick="HPCommunity.closePublishPanel()" style="color:#fff;" aria-label="Close">✕</button>
  </div>
  <div class="hp-panel-body" id="publishPanelBody">
    <p style="font-family:var(--font-mono); font-size:0.75rem; color:var(--text-muted-dark); margin-bottom:16px;">
      Share your controller layout with the community. You must be signed in.
    </p>
    <div class="hp-field">
      <label class="hp-label">SELECT YOUR PROFILE</label>
      <select class="hp-input" id="pubSrcProfile" aria-label="Source profile"></select>
    </div>
    <div class="hp-field">
      <label class="hp-label">GAME NAME</label>
      <input class="hp-input" id="pubGameName" placeholder="e.g. Valorant">
    </div>
    <div class="hp-field">
      <label class="hp-label">DESCRIPTION</label>
      <textarea class="hp-input" id="pubDescription" rows="3" placeholder="Describe your layout, sensitivity, use-case…" style="width:100%;"></textarea>
    </div>
    <div class="hp-field">
      <label class="hp-label">TAGS <span style="color:#666;">(comma-separated)</span></label>
      <input class="hp-input" id="pubTags" placeholder="FPS, Competitive, Low-Sensitivity">
    </div>
    <div class="hp-field">
      <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-family:var(--font-mono); font-size:0.75rem;">
        <input type="checkbox" id="pubIsPublic" checked style="accent-color:var(--accent-red);">
        PUBLIC (discoverable by everyone)
      </label>
    </div>
    <div id="pubError" style="color:var(--accent-red); font-family:var(--font-mono); font-size:0.75rem; min-height:18px; margin-bottom:8px;"></div>
    <button class="cyber-button md primary" style="width:100%;" onclick="HPCommunity._confirmPublish()">PUBLISH NOW</button>

    <!-- My Published -->
    <div style="margin-top:24px; border-top:1px solid var(--dark-border); padding-top:16px;">
      <div style="font-family:var(--font-mono); font-size:0.7rem; color:var(--text-muted-dark); margin-bottom:12px;">MY PUBLISHED PROFILES</div>
      <div id="myPublishedList"></div>
    </div>
  </div>
</div>`);
  }

  // ─── Featured rows ─────────────────────────────────────────────────────────
  function renderFeaturedRows() {
    const all = visibleProfiles({ sort:'downloads' });

    // Trending = top 4 by downloads
    const trending = all.slice(0, 4);
    // Highest rated = top 4 by rating with at least 1 review
    const rated = [...all].sort((a,b) => b.average_rating - a.average_rating)
                          .filter(p => p.average_rating > 0).slice(0, 4);

    renderRow('commFeaturedRow', trending);
    renderRow('commRatedRow', rated);
  }

  function renderRow(containerId, profiles) {
    const el = document.getElementById(containerId);
    if (!el) return;
    if (!profiles.length) { el.innerHTML = '<span style="font-family:var(--font-mono);font-size:0.75rem;color:#444;">None yet.</span>'; return; }
    el.innerHTML = profiles.map(p => `
      <div class="hp-comm-mini-card" onclick="HPCommunity.openDetail('${esc(p.community_profile_id)}')" role="button" tabindex="0"
        aria-label="${esc(p.profile_name)}">
        <div class="hp-comm-mini-type">${TYPE_ICONS[p.controller_type] || '🎮'}</div>
        <div class="hp-comm-mini-name">${esc(p.profile_name)}</div>
        <div class="hp-comm-mini-game">${esc(p.game_name)}</div>
        <div class="hp-comm-mini-stat">${stars(p.average_rating)} · ⬇${p.download_count.toLocaleString()}</div>
      </div>`).join('');
  }

  // ─── Tag selector ──────────────────────────────────────────────────────────
  function populateTagSelector() {
    const sel = document.getElementById('commTagSel');
    if (!sel) return;
    const tags = allTags();
    sel.innerHTML = '<option value="">All Tags</option>' +
      tags.map(t => `<option value="${esc(t)}">${esc(t)}</option>`).join('');
  }

  // ─── Main grid ─────────────────────────────────────────────────────────────
  function renderGrid() {
    const grid  = document.getElementById('communityGrid');
    const empty = document.getElementById('communityEmpty');
    const count = document.getElementById('commResultCount');
    const load  = document.getElementById('commLoading');
    if (!grid) return;

    if (load) load.style.display = 'block';
    grid.innerHTML = '';
    if (empty) empty.style.display = 'none';

    // Micro-defer to let loading spinner show
    setTimeout(() => {
      if (load) load.style.display = 'none';
      const profiles = visibleProfiles(_f);

      if (count) count.innerText = profiles.length
        ? profiles.length + ' PROFILE' + (profiles.length !== 1 ? 'S' : '') + ' FOUND'
        : '';

      if (!profiles.length) {
        grid.innerHTML = '';
        if (empty) empty.style.display = 'block';
        return;
      }

      grid.innerHTML = profiles.map(p => {
        const isFav = HP.isCommunityFavorite(p.community_profile_id);
        const isOwn = HP.getUser() && p.user_id === HP.getUser().user_id;
        return `
        <div class="hp-community-card" role="listitem"
          onclick="HPCommunity.openDetail('${esc(p.community_profile_id)}')"
          tabindex="0" aria-label="${esc(p.profile_name)}">
          <div class="hp-comm-card-header">
            <span class="hp-comm-type-icon" title="${p.controller_type}">${TYPE_ICONS[p.controller_type]||'🎮'}</span>
            <span class="hp-comm-type-tag">${p.controller_type.toUpperCase()}</span>
            ${!p.is_public ? '<span style="font-family:var(--font-mono);font-size:0.55rem;color:#888;background:#1a1a1a;padding:2px 5px;border-radius:2px;">PRIVATE</span>' : ''}
            ${isOwn ? '<span style="font-family:var(--font-mono);font-size:0.55rem;color:#e6b800;background:#1a1500;padding:2px 5px;border-radius:2px;">MINE</span>' : ''}
            <button class="hp-fav-btn ${isFav?'active':''}" style="margin-left:auto;"
              onclick="event.stopPropagation(); HPCommunity._toggleFav('${esc(p.community_profile_id)}')"
              aria-label="${isFav?'Remove from favorites':'Add to favorites'}"
              title="${isFav?'Favorited':'Add to favorites'}">${isFav?'★':'☆'}</button>
          </div>
          <div class="hp-comm-card-name">${esc(p.profile_name)}</div>
          <div class="hp-comm-card-game" style="font-family:var(--font-mono);font-size:0.72rem;color:#888;margin-bottom:6px;">${esc(p.game_name)}</div>
          <div class="hp-comm-card-tags" style="margin-bottom:8px;">
            ${(p.tags||[]).slice(0,3).map(t=>`<span class="hp-comm-tag">${esc(t)}</span>`).join('')}
          </div>
          <div class="hp-comm-card-footer">
            ${stars(p.average_rating)}
            <span class="hp-comm-downloads">⬇ ${p.download_count.toLocaleString()}</span>
          </div>
          <div class="hp-comm-author">by ${esc(p.author_name||'Unknown')} · ${timeAgo(p.created_at)}</div>
        </div>`;
      }).join('');
    }, 50);
  }

  // ─── Detail modal ──────────────────────────────────────────────────────────
  function renderDetail(id) {
    const p = HP.getCommunityProfiles().find(x => x.community_profile_id === id);
    const card = document.getElementById('communityDetailCard');
    if (!card) return;

    // Privacy check: non-owner cannot view private profiles
    const user = HP.getUser();
    const uid  = user ? user.user_id : null;
    if (!p) { card.innerHTML = _errCard('Profile not found.'); return; }
    if (!p.is_public && p.user_id !== uid) {
      card.innerHTML = _errCard('This profile is private.');
      return;
    }

    const reviews = HP.getReviewsForProfile(id);
    const isFav   = HP.isCommunityFavorite(id);
    const isOwn   = uid && p.user_id === uid;
    const alreadyReviewed = uid && reviews.some(r => r.user_id === uid);

    card.innerHTML = `
      <div class="modal-header" style="display:flex; justify-content:space-between; align-items:flex-start;">
        <div>
          <h3 style="font-family:var(--font-display); font-size:1.4rem; letter-spacing:2px; margin-bottom:6px;">${esc(p.profile_name)}</h3>
          <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
            <span class="hp-profile-type-tag">${p.controller_type.toUpperCase()}</span>
            <span style="font-family:var(--font-mono); font-size:0.75rem; color:#888;">${esc(p.game_name)}</span>
            ${!p.is_public ? '<span style="font-family:var(--font-mono);font-size:0.65rem;color:#888;padding:2px 6px;border:1px solid #333;">PRIVATE</span>' : ''}
          </div>
        </div>
        <button class="close-btn" onclick="HPCommunity.closeDetail()" aria-label="Close" style="font-size:1.1rem; background:none; border:none; color:#fff; cursor:pointer; padding:4px 8px;">✕</button>
      </div>

      <div style="display:flex; align-items:center; gap:16px; margin:14px 0; flex-wrap:wrap;">
        ${stars(p.average_rating)}
        <span style="font-family:var(--font-mono); font-size:0.75rem; color:#888;">⬇ ${p.download_count.toLocaleString()} downloads</span>
        <span style="font-family:var(--font-mono); font-size:0.75rem; color:#666;">by ${esc(p.author_name||'Unknown')} · ${timeAgo(p.created_at)}</span>
      </div>

      <p style="font-size:0.88rem; line-height:1.6; color:#ccc; margin-bottom:14px;">${esc(p.description||'No description.')}</p>

      <div style="margin-bottom:16px; display:flex; flex-wrap:wrap; gap:6px;">
        ${(p.tags||[]).map(t=>`<span class="hp-comm-tag">${esc(t)}</span>`).join('')}
      </div>

      <div style="display:flex; gap:10px; margin-bottom:24px; flex-wrap:wrap;">
        <button class="cyber-button md primary" onclick="HPCommunity._download('${esc(id)}')">⬇ DOWNLOAD</button>
        <button class="cyber-button md secondary hp-fav-btn ${isFav?'active':''}" id="detFavBtn"
          onclick="HPCommunity._toggleFav('${esc(id)}'); HPCommunity._refreshFavBtn('${esc(id)}')">
          ${isFav?'★ FAVORITED':'☆ FAVORITE'}</button>
        ${isOwn ? `
          <button class="cyber-button sm secondary" onclick="HPCommunity._togglePublic('${esc(id)}')">
            ${p.is_public?'🔒 MAKE PRIVATE':'🌐 MAKE PUBLIC'}</button>
          <button class="cyber-button sm danger" onclick="HPCommunity._deleteProfile('${esc(id)}')">✕ DELETE</button>` : ''}
      </div>

      <!-- Reviews section -->
      <div style="border-top:1px solid #2a2a2a; padding-top:20px;">
        <div style="font-family:var(--font-mono); font-size:0.75rem; font-weight:700; margin-bottom:14px; letter-spacing:1px;">
          REVIEWS (${reviews.length})
        </div>

        ${reviews.length === 0
          ? '<p style="font-family:var(--font-mono);font-size:0.75rem;color:#555;margin-bottom:16px;">No reviews yet.</p>'
          : reviews.map(r => `
            <div class="hp-review-card" style="padding:12px; background:#0d0d0d; border:1px solid #1f1f1f; margin-bottom:10px; border-radius:2px;">
              <div style="display:flex; justify-content:space-between; margin-bottom:6px; flex-wrap:wrap; gap:6px;">
                <span style="font-family:var(--font-mono); font-size:0.75rem; font-weight:700; color:#fff;">${esc(r.author_name)}</span>
                <div style="display:flex; align-items:center; gap:8px;">
                  ${stars(r.rating)}
                  <span style="font-family:var(--font-mono); font-size:0.65rem; color:#555;">${timeAgo(r.created_at)}</span>
                </div>
              </div>
              <p style="font-size:0.85rem; color:#bbb; line-height:1.5;">${esc(r.comment_text)}</p>
            </div>`).join('')}

        ${isOwn
          ? '<p style="font-family:var(--font-mono);font-size:0.72rem;color:#555;font-style:italic;">You cannot review your own profile.</p>'
          : !user
          ? `<p style="font-family:var(--font-mono);font-size:0.72rem;color:#555;">
               <button class="cyber-button sm secondary" onclick="HPAuth&&HPAuth.open()">Sign in</button> to leave a review.
             </p>`
          : alreadyReviewed
          ? '<p style="font-family:var(--font-mono);font-size:0.72rem;color:#555;font-style:italic;">You have already reviewed this profile.</p>'
          : `<div style="margin-top:14px;">
               <div style="font-family:var(--font-mono);font-size:0.7rem;color:#888;margin-bottom:8px;">WRITE A REVIEW</div>
               <div id="starRow-${esc(id)}" style="display:flex; gap:4px; margin-bottom:10px; font-size:1.2rem;">
                 ${[1,2,3,4,5].map(n =>
                   `<button class="hp-star-btn" data-n="${n}" onclick="HPCommunity._setRating('${esc(id)}',${n})" aria-label="${n} star">☆</button>`
                 ).join('')}
               </div>
               <textarea class="hp-input" id="reviewText-${esc(id)}" rows="2"
                 placeholder="Share your experience…" style="width:100%; margin-bottom:8px;"></textarea>
               <div id="reviewErr-${esc(id)}" style="color:var(--accent-red);font-family:var(--font-mono);font-size:0.72rem;min-height:16px;margin-bottom:6px;"></div>
               <button class="cyber-button sm primary" onclick="HPCommunity._submitReview('${esc(id)}')">SUBMIT REVIEW</button>
             </div>`}
      </div>`;
  }

  function _errCard(msg) {
    return `<div style="padding:40px; text-align:center;">
      <div style="font-size:2rem;margin-bottom:12px;">⚠</div>
      <p style="font-family:var(--font-mono);font-size:0.85rem;color:#888;">${esc(msg)}</p>
      <button class="cyber-button sm secondary" onclick="HPCommunity.closeDetail()" style="margin-top:16px;">CLOSE</button>
    </div>`;
  }

  // ─── Favorites panel ───────────────────────────────────────────────────────
  function renderFavorites() {
    const list = document.getElementById('favoritesList');
    if (!list) return;
    if (!HP.isLoggedIn()) {
      list.innerHTML = `<div style="text-align:center;padding:30px;font-family:var(--font-mono);font-size:0.8rem;color:#555;">
        <button class="cyber-button sm primary" onclick="HPAuth&&HPAuth.open()">Sign in to see favorites</button></div>`;
      return;
    }
    const favs = HP.getCommunityFavorites();
    if (!favs.length) {
      list.innerHTML = '<p style="font-family:var(--font-mono);font-size:0.75rem;color:#555;padding:16px 0;">No favorites yet. Star any profile to save it here.</p>';
      return;
    }
    const all = HP.getCommunityProfiles();
    list.innerHTML = favs.map(f => {
      const p = all.find(x => x.community_profile_id === f.community_profile_id);
      if (!p) return '';
      return `<div class="hp-profile-card" style="cursor:pointer;margin-bottom:10px;"
        onclick="HPCommunity.closeFavorites(); HPCommunity.openDetail('${esc(p.community_profile_id)}')">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span class="hp-profile-name">${esc(p.profile_name)}</span>
          <span class="hp-profile-type-tag">${p.controller_type.toUpperCase()}</span>
        </div>
        <div style="font-family:var(--font-mono);font-size:0.7rem;color:#666;margin-top:4px;">
          ${esc(p.game_name)} · ${stars(p.average_rating)}
        </div>
      </div>`;
    }).join('');
  }

  // ─── Publish panel ─────────────────────────────────────────────────────────
  function renderPublishPanel() {
    if (!HP.isLoggedIn()) {
      document.getElementById('publishPanelBody').innerHTML = `
        <div style="text-align:center;padding:30px;">
          <div style="font-size:2rem;margin-bottom:12px;">🔐</div>
          <p style="font-family:var(--font-mono);font-size:0.8rem;color:#888;margin-bottom:16px;">Sign in to publish profiles.</p>
          <button class="cyber-button sm primary" onclick="HPAuth&&HPAuth.open(); HPCommunity.closePublishPanel()">SIGN IN</button>
        </div>`;
      return;
    }

    // Populate profile selector with own profiles only
    const myProfiles = HP.getControllerProfiles().filter(p => {
      const u = HP.getUser();
      return p.user_id === (u ? u.user_id : null) || p.user_id === null;
    });
    const sel = document.getElementById('pubSrcProfile');
    if (sel) {
      sel.innerHTML = myProfiles.length
        ? myProfiles.map(p => `<option value="${esc(p.profile_id)}">${esc(p.profile_name)} (${p.controller_type})</option>`).join('')
        : '<option value="">— No profiles yet —</option>';
    }

    // My published
    const uid = HP.getUser().user_id;
    const mine = HP.getCommunityProfiles().filter(p => p.user_id === uid);
    const myEl = document.getElementById('myPublishedList');
    if (myEl) {
      myEl.innerHTML = mine.length
        ? mine.map(p => `<div class="hp-profile-card" style="margin-bottom:8px;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span class="hp-profile-name" style="font-size:0.8rem;">${esc(p.profile_name)}</span>
              <span style="font-family:var(--font-mono);font-size:0.6rem;color:${p.is_public?'#22cc44':'#888'};">${p.is_public?'PUBLIC':'PRIVATE'}</span>
            </div>
            <div style="font-family:var(--font-mono);font-size:0.65rem;color:#666;margin-top:3px;">${esc(p.game_name)} · ⬇${p.download_count}</div>
            <div style="display:flex;gap:6px;margin-top:8px;">
              <button class="cyber-button sm secondary" onclick="HPCommunity._togglePublic('${esc(p.community_profile_id)}'); HPCommunity.openPublishPanel()">
                ${p.is_public?'🔒 PRIVATE':'🌐 PUBLIC'}</button>
              <button class="cyber-button sm danger" onclick="HPCommunity._deleteProfile('${esc(p.community_profile_id)}'); HPCommunity.openPublishPanel()">✕</button>
            </div>
          </div>`).join('')
        : '<p style="font-family:var(--font-mono);font-size:0.72rem;color:#555;">You have not published any profiles yet.</p>';
    }
  }

  // ─── Per-profile rating selection ─────────────────────────────────────────
  const _pendingRatings = {};

  // ─── Public API ───────────────────────────────────────────────────────────
  window.HPCommunity = {

    init() { inject(); },

    open() {
      if (typeof showSection === 'function') showSection('community');
      populateTagSelector();
      renderFeaturedRows();
      renderGrid();
    },

    // Filter handlers
    _onSearch(val)   { _f.search = val;                     renderGrid(); },
    _filterType(btn, type) {
      document.querySelectorAll('.hp-filter-chips .hp-chip[data-type]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _f.controller_type = type; renderGrid();
    },
    _filterSort(val)    { _f.sort = val;                      renderGrid(); },
    _filterRating(val)  { _f.min_rating = parseFloat(val)||0; renderGrid(); },
    _filterTag(val)     { _f.tag = val;                       renderGrid(); },

    // Detail
    openDetail(id) {
      _detailId = id;
      const modal = document.getElementById('communityDetailModal');
      const card  = document.getElementById('communityDetailCard');
      if (card) card.innerHTML = '<div style="padding:40px; text-align:center; font-family:var(--font-mono); color:#666;">Loading…</div>';
      if (modal) modal.classList.add('active');
      setTimeout(() => renderDetail(id), 30);
    },
    closeDetail() {
      document.getElementById('communityDetailModal')?.classList.remove('active');
      _detailId = null;
    },

    // Favorites
    openFavorites()  { renderFavorites(); document.getElementById('favoritesPanel')?.classList.add('active'); },
    closeFavorites() { document.getElementById('favoritesPanel')?.classList.remove('active'); },

    // Publish
    openPublishPanel() {
      document.getElementById('publishPanel')?.classList.add('active');
      renderPublishPanel();
    },
    closePublishPanel() {
      document.getElementById('publishPanel')?.classList.remove('active');
    },

    // Actions
    _download(id) {
      const p = HP.getCommunityProfiles().find(x => x.community_profile_id === id);
      if (!p) return;
      // Privacy guard
      const user = HP.getUser();
      if (!p.is_public && !(user && p.user_id === user.user_id)) {
        if (typeof showToast === 'function') showToast('This profile is private.');
        return;
      }
      const imported = HP.downloadCommunityProfile(id);
      if (imported) {
        if (typeof showToast === 'function') showToast('⬇ Saved: ' + imported.profile_name);
        renderGrid();
        if (_detailId === id) renderDetail(id);
      }
    },

    _toggleFav(id) {
      if (!HP.isLoggedIn()) {
        if (typeof showToast === 'function') showToast('Sign in to save favorites.');
        if (window.HPAuth) HPAuth.open();
        return;
      }
      const became = HP.toggleCommunityFavorite(id);
      if (typeof showToast === 'function') showToast(became ? '★ Added to favorites.' : '☆ Removed from favorites.');
      renderGrid();
      if (_detailId === id) this._refreshFavBtn(id);
    },

    _refreshFavBtn(id) {
      const btn = document.getElementById('detFavBtn');
      if (!btn) return;
      const fav = HP.isCommunityFavorite(id);
      btn.textContent = fav ? '★ FAVORITED' : '☆ FAVORITE';
      btn.classList.toggle('active', fav);
    },

    _togglePublic(id) {
      const p = HP.getCommunityProfiles().find(x => x.community_profile_id === id);
      if (!p) return;
      const user = HP.getUser();
      if (!user || p.user_id !== user.user_id) { if (typeof showToast === 'function') showToast('Not your profile.'); return; }
      // Direct mutation on the raw list (update via state layer)
      const all = HP.getCommunityProfiles();
      const raw = all.find(x => x.community_profile_id === id);
      if (raw) {
        // Use state internal method if available, otherwise patch through HP
        const newVal = !p.is_public;
        // We need to patch this — state doesn't have updateCommunityProfile,
        // so we add a simple one or use the existing array reference
        p.is_public = newVal;
        // Force save via publishCommunityProfile workaround — just toggle in _communityProfiles
        // Since we can't directly, let's update via the HP API we'll add below
        HP.updateCommunityProfile && HP.updateCommunityProfile(id, { is_public: newVal });
        if (typeof showToast === 'function') showToast(newVal ? '🌐 Made public.' : '🔒 Made private.');
        renderGrid();
        if (_detailId === id) renderDetail(id);
      }
    },

    _deleteProfile(id) {
      const p = HP.getCommunityProfiles().find(x => x.community_profile_id === id);
      if (!p) return;
      const user = HP.getUser();
      if (!user || p.user_id !== user.user_id) { if (typeof showToast === 'function') showToast('Not your profile.'); return; }
      if (!confirm('Delete "' + p.profile_name + '" from the community? This cannot be undone.')) return;
      HP.deleteCommunityProfile && HP.deleteCommunityProfile(id);
      if (typeof showToast === 'function') showToast('Profile deleted from community.');
      if (_detailId === id) this.closeDetail();
      renderGrid();
      renderFeaturedRows();
    },

    _confirmPublish() {
      const errEl = document.getElementById('pubError');
      if (errEl) errEl.textContent = '';

      if (!HP.isLoggedIn()) { if (errEl) errEl.textContent = 'Sign in first.'; return; }

      const srcId = document.getElementById('pubSrcProfile')?.value;
      const game  = document.getElementById('pubGameName')?.value.trim();
      const desc  = document.getElementById('pubDescription')?.value.trim();
      const tagsRaw = document.getElementById('pubTags')?.value.trim();
      const isPublic = document.getElementById('pubIsPublic')?.checked !== false;

      if (!srcId) { if (errEl) errEl.textContent = 'Select a profile.'; return; }
      if (!game)  { if (errEl) errEl.textContent = 'Enter a game name.'; return; }

      const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];
      const cp = HP.publishCommunityProfile(srcId, game, desc||'', tags);
      if (cp) {
        // Apply is_public flag
        if (!isPublic && HP.updateCommunityProfile) HP.updateCommunityProfile(cp.community_profile_id, { is_public: false });
        else if (!isPublic) cp.is_public = false;
        if (typeof showToast === 'function') showToast('✓ Published: ' + cp.profile_name);
        document.getElementById('pubGameName').value = '';
        document.getElementById('pubDescription').value = '';
        document.getElementById('pubTags').value = '';
        renderGrid(); renderFeaturedRows(); populateTagSelector();
        renderPublishPanel();
      }
    },

    _setRating(profileId, n) {
      _pendingRatings[profileId] = n;
      const row = document.getElementById('starRow-' + profileId);
      if (!row) return;
      row.querySelectorAll('.hp-star-btn').forEach(btn => {
        const bn = parseInt(btn.dataset.n);
        btn.textContent = bn <= n ? '★' : '☆';
        btn.style.color = bn <= n ? '#e6b800' : '#555';
      });
    },

    _submitReview(profileId) {
      const errEl = document.getElementById('reviewErr-' + profileId);
      if (errEl) errEl.textContent = '';

      if (!HP.isLoggedIn()) { if (errEl) errEl.textContent = 'Sign in to review.'; return; }
      const rating = _pendingRatings[profileId] || 0;
      const text   = document.getElementById('reviewText-' + profileId)?.value.trim() || '';

      if (!rating) { if (errEl) errEl.textContent = 'Select a star rating.'; return; }
      if (!text)   { if (errEl) errEl.textContent = 'Write a comment first.'; return; }

      // Prevent reviewing own profile
      const p = HP.getCommunityProfiles().find(x => x.community_profile_id === profileId);
      const user = HP.getUser();
      if (p && user && p.user_id === user.user_id) {
        if (errEl) errEl.textContent = 'You cannot review your own profile.';
        return;
      }
      // Prevent duplicate review
      const existing = HP.getReviewsForProfile(profileId).find(r => r.user_id === user.user_id);
      if (existing) { if (errEl) errEl.textContent = 'You have already reviewed this.'; return; }

      HP.addReview(profileId, rating, text);
      delete _pendingRatings[profileId];
      if (typeof showToast === 'function') showToast('✓ Review submitted.');
      renderDetail(profileId);
      renderGrid();
    }
  };

})();
