/* ==========================================================================
   HYPERPULSE // AUTH UI (ui-auth.js)
   User entity: register, login, logout, profile display.
   Uses HP (state.js) as the data layer.
   ========================================================================== */

(function HPAuth() {

  /* Simple hash — NOT cryptographic, for prototype only.
     Real auth needs bcrypt on a backend server. */
  function weakHash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
    return h.toString(16);
  }

  /* ── Inject Auth Modal HTML ──────────────────────────────── */
  function injectAuthModal() {
    const el = document.createElement('div');
    el.innerHTML = `
<div class="modal-backdrop" id="authModal">
  <div class="modal-card" style="width:440px;">
    <div class="modal-header">
      <h3 id="authModalTitle">SIGN IN</h3>
      <button class="close-btn" onclick="HPAuth.close()">✕</button>
    </div>

    <!-- Login Form -->
    <div id="authLoginForm">
      <div class="hp-field">
        <label class="hp-label">EMAIL</label>
        <input class="hp-input" id="authLoginEmail" type="email" placeholder="you@example.com">
      </div>
      <div class="hp-field">
        <label class="hp-label">PASSWORD</label>
        <input class="hp-input" id="authLoginPass" type="password" placeholder="••••••••">
      </div>
      <div class="hp-field-error" id="authLoginError"></div>
      <div style="display:flex; gap:10px; margin-top:16px;">
        <button class="cyber-button md primary" style="flex:1;" onclick="HPAuth.login()">[ SIGN IN ]</button>
        <button class="cyber-button md secondary" style="flex:1;" onclick="HPAuth.showRegister()">CREATE ACCOUNT</button>
      </div>
      <p style="font-family:var(--font-mono); font-size:0.65rem; color:var(--text-muted-light); margin-top:14px; border-top:1px solid var(--ink-black); padding-top:10px;">
        ⚠ PROTOTYPE MODE: Auth is local-only. No data leaves your device.
      </p>
    </div>

    <!-- Register Form -->
    <div id="authRegisterForm" style="display:none;">
      <div class="hp-field">
        <label class="hp-label">DISPLAY NAME</label>
        <input class="hp-input" id="authRegName" type="text" placeholder="ProGamer">
      </div>
      <div class="hp-field">
        <label class="hp-label">EMAIL</label>
        <input class="hp-input" id="authRegEmail" type="email" placeholder="you@example.com">
      </div>
      <div class="hp-field">
        <label class="hp-label">PASSWORD</label>
        <input class="hp-input" id="authRegPass" type="password" placeholder="min 6 chars">
      </div>
      <div class="hp-field-error" id="authRegError"></div>
      <div style="display:flex; gap:10px; margin-top:16px;">
        <button class="cyber-button md primary" style="flex:1;" onclick="HPAuth.register()">[ CREATE ACCOUNT ]</button>
        <button class="cyber-button md secondary" style="flex:1;" onclick="HPAuth.showLogin()">BACK TO SIGN IN</button>
      </div>
    </div>
  </div>
</div>

<!-- User Profile Dropdown -->
<div class="hp-user-dropdown" id="userDropdown" style="display:none;">
  <div class="hp-user-info">
    <div class="hp-user-avatar" id="userAvatarBtn">
      <span id="userAvatarInitial">?</span>
    </div>
    <div>
      <div class="hp-user-name" id="userDisplayName">GUEST</div>
      <div class="hp-user-email" id="userDisplayEmail"></div>
    </div>
  </div>
  <hr style="border-color:var(--dark-border); margin:8px 0;">
  <button class="hp-dropdown-item" onclick="HPProfiles && HPProfiles.open(); HPAuth.closeDropdown();">MY PROFILES</button>
  <button class="hp-dropdown-item" onclick="HPSettingsUI && HPSettingsUI.open(); HPAuth.closeDropdown();">SETTINGS</button>
  <hr style="border-color:var(--dark-border); margin:8px 0;">
  <button class="hp-dropdown-item danger" onclick="HPAuth.logout()">SIGN OUT</button>
</div>
    `;
    document.body.appendChild(el.firstElementChild); // authModal
    document.body.appendChild(el.children[0]);        // userDropdown
    // re-grab since we used firstElementChild
    document.body.insertAdjacentHTML('beforeend',
      `<div class="hp-user-dropdown" id="userDropdown" style="display:none;">
        <div class="hp-user-info">
          <div class="hp-user-avatar-circle" id="userAvatarBtn">
            <span id="userAvatarInitial">?</span>
          </div>
          <div>
            <div class="hp-user-name" id="userDisplayName">GUEST</div>
            <div class="hp-user-email" id="userDisplayEmail"></div>
          </div>
        </div>
        <hr style="border-color:#2a2a2a; margin:8px 0;">
        <button class="hp-dropdown-item" onclick="HPProfiles && HPProfiles.open(); HPAuth.closeDropdown();">⬡ MY PROFILES</button>
        <button class="hp-dropdown-item" onclick="HPSettingsUI && HPSettingsUI.open(); HPAuth.closeDropdown();">⚙ SETTINGS</button>
        <hr style="border-color:#2a2a2a; margin:8px 0;">
        <button class="hp-dropdown-item danger" onclick="HPAuth.logout()">⏻ SIGN OUT</button>
      </div>`
    );
  }

  /* ── Update header user button ───────────────────────────── */
  function updateHeaderUserBtn() {
    const user = HP.getUser();
    let btn = document.getElementById('headerUserBtn');
    if (!btn) return;
    if (user) {
      const initial = (user.name || user.email || '?')[0].toUpperCase();
      btn.innerHTML = `<span style="font-family:var(--font-mono);font-size:0.7rem;">${initial}</span>`;
      btn.title = user.name || user.email;
      btn.classList.add('logged-in');
    } else {
      btn.innerHTML = `<span style="font-family:var(--font-mono);font-size:0.7rem;">↩</span>`;
      btn.title = 'Sign In';
      btn.classList.remove('logged-in');
    }

    // also update dropdown
    const name  = document.getElementById('userDisplayName');
    const email = document.getElementById('userDisplayEmail');
    const init  = document.getElementById('userAvatarInitial');
    if (name)  name.textContent  = user ? (user.name || 'User') : 'GUEST';
    if (email) email.textContent = user ? user.email : '';
    if (init)  init.textContent  = user ? (user.name || user.email || '?')[0].toUpperCase() : '?';
  }

  /* ── Public API ──────────────────────────────────────────── */
  window.HPAuth = {

    init() {
      injectAuthModal();
      updateHeaderUserBtn();

      // Close dropdown on outside click
      document.addEventListener('click', (e) => {
        const dd = document.getElementById('userDropdown');
        const btn = document.getElementById('headerUserBtn');
        if (dd && !dd.contains(e.target) && btn && !btn.contains(e.target)) {
          dd.style.display = 'none';
        }
      });
    },

    open() {
      const modal = document.getElementById('authModal');
      if (modal) modal.classList.add('active');
      this.showLogin();
    },

    close() {
      const modal = document.getElementById('authModal');
      if (modal) modal.classList.remove('active');
    },

    showLogin() {
      document.getElementById('authModalTitle').textContent = 'SIGN IN';
      document.getElementById('authLoginForm').style.display = 'block';
      document.getElementById('authRegisterForm').style.display = 'none';
      document.getElementById('authLoginError').textContent = '';
    },

    showRegister() {
      document.getElementById('authModalTitle').textContent = 'CREATE ACCOUNT';
      document.getElementById('authLoginForm').style.display = 'none';
      document.getElementById('authRegisterForm').style.display = 'block';
      document.getElementById('authRegError').textContent = '';
    },

    login() {
      const email = document.getElementById('authLoginEmail').value.trim();
      const pass  = document.getElementById('authLoginPass').value;
      const errEl = document.getElementById('authLoginError');

      if (!email || !pass) { errEl.textContent = 'All fields required.'; return; }

      const user = HP.getUser();
      if (!user || user.email !== email) {
        errEl.textContent = 'No account found. Please register first.';
        return;
      }
      if (user.password_hash !== weakHash(pass)) {
        errEl.textContent = 'Incorrect password.';
        return;
      }

      this.close();
      updateHeaderUserBtn();
      if (typeof showToast === 'function') showToast('✓ Signed in as ' + user.name);
    },

    register() {
      const name  = document.getElementById('authRegName').value.trim();
      const email = document.getElementById('authRegEmail').value.trim();
      const pass  = document.getElementById('authRegPass').value;
      const errEl = document.getElementById('authRegError');

      if (!name || !email || !pass) { errEl.textContent = 'All fields required.'; return; }
      if (pass.length < 6) { errEl.textContent = 'Password must be at least 6 characters.'; return; }
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { errEl.textContent = 'Invalid email.'; return; }

      HP.registerUser(email, name, weakHash(pass));
      this.close();
      updateHeaderUserBtn();
      if (typeof showToast === 'function') showToast('✓ Account created. Welcome, ' + name);
    },

    logout() {
      HP.logoutUser();
      this.closeDropdown();
      updateHeaderUserBtn();
      if (typeof showToast === 'function') showToast('Signed out.');
    },

    toggleDropdown() {
      if (!HP.isLoggedIn()) { this.open(); return; }
      const dd = document.getElementById('userDropdown');
      const btn = document.getElementById('headerUserBtn');
      if (!dd || !btn) return;
      const rect = btn.getBoundingClientRect();
      dd.style.top  = (rect.bottom + 8) + 'px';
      dd.style.right = (window.innerWidth - rect.right) + 'px';
      dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
    },

    closeDropdown() {
      const dd = document.getElementById('userDropdown');
      if (dd) dd.style.display = 'none';
    },

    refreshHeader: updateHeaderUserBtn
  };

})();
