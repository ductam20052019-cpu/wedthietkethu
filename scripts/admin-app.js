/**
 * Admin Dashboard — Yêu thương gửi bạn
 * Firebase Realtime Database + Firebase Auth
 *
 * Cấu trúc DB:
 *   orders/{orderId}: { id, phone, package, status, createdAt, letterUrl, letterData, editCount, maxEdits }
 *
 * Trạng thái đơn: "pending" | "paid" | "revoked"
 */
(() => {
  'use strict';

  /* ═══════════ FIREBASE CONFIG ═══════════ */
  // Thay bằng config Firebase thực của bạn
  const FIREBASE_CONFIG = {
    apiKey: "AIzaSyDEMO_KEY_REPLACE_ME",
    authDomain: "tam-gui-wedthietkethu.firebaseapp.com",
    databaseURL: "https://tam-gui-wedthietkethu-default-rtdb.firebaseio.com",
    projectId: "tam-gui-wedthietkethu",
    storageBucket: "tam-gui-wedthietkethu.appspot.com",
    messagingSenderId: "000000000000",
    appId: "1:000000000000:web:0000000000000000"
  };

  /* ═══════════ PRICE MAP (VNĐ) ═══════════ */
  const PRICE_MAP = { free: 0, vip: 150000 };

  /* ═══════════ ELEMENTS ═══════════ */
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => [...document.querySelectorAll(sel)];

  const loginScreen = $('#login-screen');
  const dashboard = $('#dashboard');
  const loginForm = $('#login-form');
  const loginEmail = $('#login-email');
  const loginPassword = $('#login-password');
  const loginError = $('#login-error');
  const loginBtn = $('#login-btn');
  const togglePw = $('#toggle-password');
  const logoutBtn = $('#logout-btn');
  const adminEmail = $('#admin-email');
  const realtimeDot = $('#realtime-dot');
  const searchInput = $('#search-input');
  const ordersBody = $('#orders-body');
  const emptyState = $('#empty-state');
  const previewModal = $('#preview-modal');
  const previewBody = $('#preview-modal-body');
  const previewTitle = $('#preview-modal-title');
  const confirmModal = $('#confirm-modal');
  const confirmTitle = $('#confirm-title');
  const confirmMessage = $('#confirm-message');
  const confirmOk = $('#confirm-ok');
  const toastEl = $('#admin-toast');

  let db, auth, ordersRef;
  let allOrders = {};
  let currentFilter = 'all';
  let searchQuery = '';
  let toastTimer = null;
  let confirmCallback = null;

  /* ═══════════ INIT FIREBASE ═══════════ */
  function initFirebase() {
    if (typeof firebase === 'undefined') {
      showToast('Firebase SDK chưa tải xong. Tải lại trang.', 'error');
      return false;
    }
    firebase.initializeApp(FIREBASE_CONFIG);
    auth = firebase.auth();
    db = firebase.database();
    ordersRef = db.ref('orders');
    return true;
  }

  /* ═══════════ AUTH ═══════════ */
  function setupAuth() {
    auth.onAuthStateChanged((user) => {
      if (user) {
        showDashboard(user);
      } else {
        showLogin();
      }
    });
  }

  async function doLogin(email, password) {
    loginBtn.classList.add('loading');
    loginBtn.disabled = true;
    loginError.hidden = true;
    try {
      await auth.signInWithEmailAndPassword(email, password);
    } catch (err) {
      loginError.textContent = mapAuthError(err.code);
      loginError.hidden = false;
      loginBtn.classList.remove('loading');
      loginBtn.disabled = false;
    }
  }

  function mapAuthError(code) {
    const map = {
      'auth/user-not-found': 'Tài khoản không tồn tại.',
      'auth/wrong-password': 'Mật khẩu không đúng.',
      'auth/invalid-credential': 'Thông tin đăng nhập không hợp lệ.',
      'auth/invalid-email': 'Email không hợp lệ.',
      'auth/too-many-requests': 'Quá nhiều lần thử. Vui lòng đợi.',
      'auth/network-request-failed': 'Lỗi mạng. Kiểm tra kết nối internet.',
    };
    return map[code] || 'Đăng nhập thất bại. Vui lòng thử lại.';
  }

  function showLogin() {
    loginScreen.hidden = false;
    dashboard.hidden = true;
    loginBtn.classList.remove('loading');
    loginBtn.disabled = false;
    stopRealtimeListeners();
  }

  function showDashboard(user) {
    loginScreen.hidden = true;
    dashboard.hidden = false;
    adminEmail.textContent = user.email;
    startRealtimeListeners();
  }

  /* ═══════════ REALTIME LISTENERS ═══════════ */
  let listenersActive = false;

  function startRealtimeListeners() {
    if (listenersActive) return;
    listenersActive = true;

    // Connection state
    db.ref('.info/connected').on('value', (snap) => {
      realtimeDot.classList.toggle('offline', !snap.val());
    });

    // Orders listener: value event for initial + updates
    ordersRef.orderByChild('createdAt').on('value', (snap) => {
      const newOrders = snap.val() || {};
      const addedIds = Object.keys(newOrders).filter(id => !allOrders[id]);
      allOrders = newOrders;
      renderOrders(addedIds);
      updateStats();
    });
  }

  function stopRealtimeListeners() {
    if (!listenersActive || !db) return;
    listenersActive = false;
    ordersRef.off();
    db.ref('.info/connected').off();
  }

  /* ═══════════ RENDER ORDERS ═══════════ */
  function renderOrders(newIds = []) {
    const entries = Object.entries(allOrders)
      .map(([id, order]) => ({ id, ...order }))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    // Apply filter + search
    const filtered = entries.filter((order) => {
      if (currentFilter !== 'all' && order.status !== currentFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchId = (order.id || '').toLowerCase().includes(q);
        const matchPhone = (order.phone || '').includes(q);
        if (!matchId && !matchPhone) return false;
      }
      return true;
    });

    if (filtered.length === 0) {
      ordersBody.innerHTML = '';
      emptyState.hidden = false;
      $('#orders-table').style.display = 'none';
      return;
    }

    emptyState.hidden = true;
    $('#orders-table').style.display = '';

    ordersBody.innerHTML = filtered.map((order, idx) => {
      const isNew = newIds.includes(order.id);
      const status = order.status || 'pending';
      const statusLabel = { pending: 'Chờ duyệt', paid: 'Đã thanh toán', revoked: 'Đã thu hồi' }[status] || status;
      const pkg = order.package || 'free';
      const pkgLabel = pkg === 'vip' ? 'VIP' : 'Cơ bản';
      const time = order.createdAt ? formatTime(order.createdAt) : '—';
      const letterPath = order.letterUrl ? shortPath(order.letterUrl) : '—';
      const letterHref = order.letterUrl || '#';

      return `<tr class="${isNew ? 'new-order' : ''}" style="animation-delay:${idx * 30}ms" data-order-id="${order.id}">
        <td><span class="order-id">${escapeHtml(order.id)}</span></td>
        <td>${time}</td>
        <td>${escapeHtml(order.phone || '—')}</td>
        <td><span class="package-badge ${pkg}">${pkgLabel}</span></td>
        <td><span class="status-badge ${status}">${statusLabel}</span></td>
        <td class="link-cell">${order.letterUrl ? `<a href="${escapeAttr(letterHref)}" target="_blank" rel="noopener">${escapeHtml(letterPath)}</a>` : '—'}</td>
        <td>
          <div class="action-btns">
            <button class="action-btn info" data-action="preview" data-id="${order.id}" title="Xem trước thư">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>
              Xem thư
            </button>
            ${status === 'pending' ? `
              <button class="action-btn confirm" data-action="pay" data-id="${order.id}" title="Xác nhận thanh toán">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                Xác nhận TT
              </button>
            ` : ''}
            <button class="action-btn warning" data-action="reset-edits" data-id="${order.id}" title="Đặt lại số lượt sửa">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
              Đặt lại sửa
            </button>
            ${status !== 'revoked' ? `
              <button class="action-btn danger" data-action="revoke" data-id="${order.id}" title="Khóa/Thu hồi link">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                Thu hồi
              </button>
            ` : `
              <button class="action-btn confirm" data-action="restore" data-id="${order.id}" title="Mở lại link">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4" stroke-dasharray="4 2"/></svg>
                Mở lại
              </button>
            `}
          </div>
        </td>
      </tr>`;
    }).join('');
  }

  /* ═══════════ UPDATE STATS ═══════════ */
  function updateStats() {
    const entries = Object.values(allOrders);
    const total = entries.length;
    const pending = entries.filter(o => o.status === 'pending').length;
    const paid = entries.filter(o => o.status === 'paid').length;
    const revenue = entries
      .filter(o => o.status === 'paid')
      .reduce((sum, o) => sum + (PRICE_MAP[o.package] || 0), 0);

    animateCounter($('#stat-total .stat-value'), total);
    animateCounter($('#stat-pending .stat-value'), pending);
    animateCounter($('#stat-paid .stat-value'), paid);
    $('#stat-revenue .stat-value').textContent = formatMoney(revenue);
  }

  function animateCounter(el, target) {
    const current = parseInt(el.textContent) || 0;
    if (current === target) return;
    const diff = target - current;
    const steps = Math.min(Math.abs(diff), 15);
    let step = 0;
    const interval = setInterval(() => {
      step++;
      const progress = step / steps;
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(current + diff * eased);
      if (step >= steps) {
        el.textContent = target;
        clearInterval(interval);
      }
    }, 30);
  }

  /* ═══════════ ACTIONS ═══════════ */
  function handleAction(action, orderId) {
    const order = allOrders[orderId];
    if (!order) return;

    switch (action) {
      case 'preview':
        showPreview(orderId, order);
        break;
      case 'pay':
        showConfirm(
          'Xác nhận thanh toán',
          `Chuyển đơn <strong>${escapeHtml(orderId)}</strong> sang trạng thái <strong>Đã thanh toán</strong>? Khách hàng sẽ nhận được tín hiệu realtime và link sẽ được mở khóa tự động.`,
          () => updateOrderStatus(orderId, 'paid')
        );
        break;
      case 'revoke':
        showConfirm(
          'Khóa / Thu hồi link',
          `Thu hồi đơn <strong>${escapeHtml(orderId)}</strong>? Link sẽ bị khóa và khách không thể xem thư.`,
          () => updateOrderStatus(orderId, 'revoked')
        );
        break;
      case 'restore':
        showConfirm(
          'Mở lại link',
          `Mở lại link cho đơn <strong>${escapeHtml(orderId)}</strong>? Link sẽ được kích hoạt trở lại.`,
          () => updateOrderStatus(orderId, 'paid')
        );
        break;
      case 'reset-edits':
        showConfirm(
          'Đặt lại số lượt sửa',
          `Đặt lại số lượt chỉnh sửa của đơn <strong>${escapeHtml(orderId)}</strong> về 0?`,
          () => resetEditCount(orderId)
        );
        break;
    }
  }

  async function updateOrderStatus(orderId, status) {
    try {
      await ordersRef.child(orderId).update({
        status,
        updatedAt: firebase.database.ServerValue.TIMESTAMP
      });
      showToast(`Đã cập nhật trạng thái đơn ${orderId}`, 'success');
    } catch (err) {
      showToast('Lỗi cập nhật: ' + err.message, 'error');
    }
  }

  async function resetEditCount(orderId) {
    try {
      await ordersRef.child(orderId).update({
        editCount: 0,
        updatedAt: firebase.database.ServerValue.TIMESTAMP
      });
      showToast(`Đã đặt lại lượt sửa cho ${orderId}`, 'success');
    } catch (err) {
      showToast('Lỗi: ' + err.message, 'error');
    }
  }

  /* ═══════════ LETTER PREVIEW ═══════════ */
  function showPreview(orderId, order) {
    previewTitle.textContent = `Xem trước — ${orderId}`;

    const letterData = order.letterData || {};
    const hasPhoto = !!letterData.photo;
    const hasAudio = !!letterData.audio;

    previewBody.innerHTML = `
      <div class="letter-preview">
        <div class="preview-row">
          <div class="preview-field">
            <span class="preview-label">Người nhận</span>
            <span class="preview-value">${escapeHtml(letterData.recipient || '—')}</span>
          </div>
          <div class="preview-field">
            <span class="preview-label">Người gửi</span>
            <span class="preview-value">${escapeHtml(letterData.sender || '—')}</span>
          </div>
        </div>
        <div class="preview-field">
          <span class="preview-label">Tiêu đề</span>
          <span class="preview-value">${escapeHtml(letterData.title || '—')}</span>
        </div>
        <div class="preview-field">
          <span class="preview-label">Nội dung thư</span>
          <span class="preview-value">${escapeHtml(letterData.message || '(Không có nội dung)')}</span>
        </div>
        <div class="preview-row">
          <div class="preview-field">
            <span class="preview-label">Bảng màu</span>
            <span class="preview-value">${escapeHtml(letterData.theme || '—')}</span>
          </div>
          <div class="preview-field">
            <span class="preview-label">Hiệu ứng</span>
            <span class="preview-value">${escapeHtml(letterData.effect || '—')}</span>
          </div>
        </div>
        <div class="preview-row">
          <div class="preview-field">
            <span class="preview-label">Phong bì</span>
            <span class="preview-value">${escapeHtml(letterData.envelope || '—')}</span>
          </div>
          <div class="preview-field">
            <span class="preview-label">Nhạc Music Box</span>
            <span class="preview-value">${letterData.music ? 'Bật' : 'Tắt'}</span>
          </div>
        </div>
        ${hasPhoto ? `
          <div class="preview-field">
            <span class="preview-label">Ảnh kỷ niệm</span>
            <img class="preview-photo" src="${escapeAttr(letterData.photo)}" alt="Ảnh kỷ niệm" referrerpolicy="no-referrer" onerror="this.alt='Không tải được ảnh';this.style.display='none'">
          </div>
        ` : ''}
        ${hasAudio ? `
          <div class="preview-field">
            <span class="preview-label">Link nhạc</span>
            <a class="preview-music-link" href="${escapeAttr(letterData.audio)}" target="_blank" rel="noopener">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
              ${escapeHtml(letterData.audio)}
            </a>
          </div>
        ` : ''}
        ${order.letterUrl ? `
          <div class="preview-field">
            <span class="preview-label">Link thư đầy đủ</span>
            <a class="preview-music-link" href="${escapeAttr(order.letterUrl)}" target="_blank" rel="noopener">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              Mở link thư
            </a>
          </div>
        ` : ''}
      </div>
    `;

    previewModal.showModal();
  }

  /* ═══════════ CONFIRM DIALOG ═══════════ */
  function showConfirm(title, message, onConfirm) {
    confirmTitle.textContent = title;
    confirmMessage.innerHTML = message;
    confirmCallback = onConfirm;
    confirmModal.showModal();
  }

  /* ═══════════ TOAST ═══════════ */
  function showToast(msg, type = '') {
    clearTimeout(toastTimer);
    toastEl.textContent = msg;
    toastEl.className = 'admin-toast show ' + type;
    toastEl.hidden = false;
    toastTimer = setTimeout(() => {
      toastEl.classList.remove('show');
      setTimeout(() => { toastEl.hidden = true; }, 300);
    }, 3500);
  }

  /* ═══════════ HELPERS ═══════════ */
  function formatTime(ts) {
    const d = new Date(ts);
    const pad = n => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function formatMoney(n) {
    return n.toLocaleString('vi-VN') + '₫';
  }

  function shortPath(url) {
    try {
      const u = new URL(url);
      const path = u.pathname + u.search;
      return path.length > 35 ? path.slice(0, 32) + '…' : path;
    } catch {
      return url.length > 35 ? url.slice(0, 32) + '…' : url;
    }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function escapeAttr(str) {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* ═══════════ EVENT LISTENERS ═══════════ */
  function setupEvents() {
    // Login form
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = loginEmail.value.trim();
      const password = loginPassword.value;
      if (!email || !password) return;

      if (!auth) {
        loginError.textContent = 'Không thể kết nối Firebase. Vui lòng tải lại trang hoặc thử lại sau.';
        loginError.hidden = false;
        return;
      }
      doLogin(email, password);
    });

    // Toggle password
    togglePw.addEventListener('click', () => {
      const type = loginPassword.type === 'password' ? 'text' : 'password';
      loginPassword.type = type;
      togglePw.setAttribute('aria-label', type === 'password' ? 'Hiện mật khẩu' : 'Ẩn mật khẩu');
    });

    // Logout
    logoutBtn.addEventListener('click', () => {
      auth.signOut();
    });

    // Filter tabs
    $$('.filter-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        $$('.filter-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentFilter = tab.dataset.filter;
        renderOrders();
      });
    });

    // Search
    let searchTimer;
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        searchQuery = searchInput.value.trim();
        renderOrders();
      }, 200);
    });

    // Table actions (event delegation)
    ordersBody.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      handleAction(btn.dataset.action, btn.dataset.id);
    });

    // Modal close buttons
    $$('[data-close]').forEach((btn) => {
      btn.addEventListener('click', () => {
        btn.closest('dialog')?.close();
      });
    });

    // Modal backdrop click to close
    $$('.modal-overlay').forEach((modal) => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.close();
      });
    });

    // Confirm OK
    confirmOk.addEventListener('click', () => {
      confirmModal.close();
      if (confirmCallback) {
        confirmCallback();
        confirmCallback = null;
      }
    });

    // Keyboard: Escape closes modals
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (previewModal.open) previewModal.close();
        if (confirmModal.open) confirmModal.close();
      }
    });
  }

  /* ═══════════ BOOT ═══════════ */
  function boot() {
    setupEvents();

    try {
      const fbReady = initFirebase();
      if (fbReady) {
        setupAuth();
      }
    } catch (err) {
      console.error('Firebase initialization failed:', err);
      showToast('Không thể kết nối Firebase. Kiểm tra cấu hình rồi tải lại trang.', 'error');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
