/**
 * Admin Dashboard — Yêu thương gửi bạn
 * Node API, server sessions and Server-Sent Events
 *
 * Cấu trúc DB:
 *   orders/{orderId}: { id, phone, package, status, createdAt, letterUrl, letterData, editCount, maxEdits }
 *
 * Trạng thái đơn: "pending" | "paid" | "revoked"
 */
(() => {
  'use strict';

  async function api(path, options) {
    const response = await fetch(path, { credentials: 'same-origin', ...options, headers: { 'Content-Type': 'application/json', ...options?.headers } });
    const result = await response.json();
    if (!response.ok) { const error = new Error(result.error || 'Yêu cầu thất bại'); error.status = response.status; throw error; }
    return result;
  }

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
  const giftManagement = $('#gift-management');
  const giftManagementGrid = $('#gift-management-grid');
  let adminGiftSets = [];

  let stream;
  let allOrders = {};
  let currentFilter = 'all';
  let searchQuery = '';
  let toastTimer = null;
  let confirmCallback = null;
  let previewAudioContext, previewMusicTimer;
  function stopPreviewMusic() {
    clearInterval(previewMusicTimer); previewMusicTimer = null;
    previewAudioContext?.close().catch(() => {}); previewAudioContext = null;
  }
  async function togglePreviewMusic(track, button) {
    if (previewAudioContext) { stopPreviewMusic(); button.textContent = 'Nghe nhạc nền'; return; }
    const tunes = { romantic: [523.25, 659.25, 783.99, 659.25, 587.33, 698.46, 880, 783.99], birthday: [392, 392, 440, 392, 523.25, 493.88, 392, 392, 440, 392, 587.33, 523.25], memories: [440, 523.25, 659.25, 587.33, 523.25, 440, 392, 440], family: [392, 493.88, 587.33, 493.88, 440, 392, 329.63, 392] };
    try {
      const context = new (window.AudioContext || window.webkitAudioContext)(); previewAudioContext = context;
      await context.resume(); if (previewAudioContext !== context) return;
      const notes = tunes[track] || tunes.romantic; let index = 0;
      const play = () => { const oscillator = context.createOscillator(), gain = context.createGain(), now = context.currentTime;
        oscillator.frequency.value = notes[index++ % notes.length]; gain.gain.setValueAtTime(.1, now); gain.gain.exponentialRampToValueAtTime(.001, now + 1.8);
        oscillator.connect(gain); gain.connect(context.destination); oscillator.start(); oscillator.stop(now + 1.9); oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
      };
      play(); previewMusicTimer = setInterval(play, 600); button.textContent = 'Dừng nhạc nền';
    } catch { stopPreviewMusic(); showToast('Không phát được nhạc trên thiết bị này.', 'error'); }
  }

  async function doLogin(email, password) {
    loginBtn.classList.add('loading');
    loginBtn.disabled = true;
    loginError.hidden = true;
    try {
      await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      showDashboard({ email });
    } catch (err) {
      loginError.textContent = err.message;
      loginError.hidden = false;
      loginBtn.classList.remove('loading');
      loginBtn.disabled = false;
    }
  }

  function showLogin() {
    loginScreen.hidden = false;
    dashboard.hidden = true;
    loginBtn.classList.remove('loading');
    loginBtn.disabled = false;
    stopRealtimeListeners();
    previewModal.close(); confirmModal.close(); previewBody.replaceChildren();
    allOrders = {}; ordersBody.replaceChildren(); loginPassword.value = '';
  }

  function showDashboard(user) {
    loginScreen.hidden = true;
    dashboard.hidden = false;
    setAdminSection('orders');
    adminEmail.textContent = user.email;
    loadGiftManagement();
    startRealtimeListeners();
  }

  function setAdminSection(section) {
    const gifts = section === 'gifts';
    giftManagement.hidden = !gifts;
    document.querySelectorAll('#dashboard > .stats-row, #dashboard > .filters-bar, #dashboard > .table-container').forEach(node => { node.hidden = gifts; });
    $$('[data-admin-section]').forEach(button => button.classList.toggle('active', button.dataset.adminSection === section));
  }

  async function loadGiftManagement() {
    try {
      const result = await api('/api/admin/gifts');
      adminGiftSets = result.giftSets;
      renderGiftManagement();
    } catch (error) { showToast(`Không tải được danh mục quà: ${error.message}`, 'error'); }
  }

  function renderGiftManagement() {
    giftManagementGrid.innerHTML = adminGiftSets.map(gift => `
      <article class="gift-admin-card" data-gift-id="${escapeAttr(gift.id)}">
        <div class="gift-admin-title"><img src="${escapeAttr(gift.images?.[0] || gift.image)}" alt=""><h2>${escapeHtml(gift.name)}</h2></div>
        <label>Tên set quà<input data-field="name" maxlength="100" value="${escapeAttr(gift.name)}"></label>
        <label>Giá dự kiến (đ)<input data-field="price" type="number" min="0" max="100000000" step="1000" value="${gift.price}"></label>
        <label>Mô tả ngắn<input data-field="description" maxlength="180" value="${escapeAttr(gift.description || '')}"></label>
        <label>Trong hộp (mỗi dòng một thành phần)<textarea data-field="components" rows="5">${escapeHtml((gift.components || []).join('\n'))}</textarea></label>
        <label>Tên phân loại<input data-field="variantLabel" maxlength="60" value="${escapeAttr(gift.variantLabel || '')}"></label>
        <label>Các lựa chọn (phân cách bằng dấu phẩy)<input data-field="variants" maxlength="720" value="${escapeAttr((gift.variants || []).join(', '))}"></label>
        <label class="gift-upload-label">Tải ảnh sản phẩm (tối đa 5)<input data-gift-images type="file" accept="image/*" multiple></label>
        <div class="gift-admin-images">${(gift.images || []).map(url => `<figure><img src="${escapeAttr(url)}" alt="Ảnh sản phẩm"><button type="button" data-remove-gift-image="${escapeAttr(url.split('/').pop())}" aria-label="Xóa ảnh">×</button></figure>`).join('') || '<p>Chưa có ảnh thật. Đang dùng hình minh họa.</p>'}</div>
      </article>`).join('');
  }

  function updateGiftCardImages(gift) {
    const card = giftManagementGrid.querySelector(`[data-gift-id="${CSS.escape(gift.id)}"]`);
    if (!card) return;
    const preview = card.querySelector('.gift-admin-title img'); if (preview) preview.src = gift.images?.[0] || gift.image;
    const host = card.querySelector('.gift-admin-images');
    host.innerHTML = (gift.images || []).map(url => `<figure><img src="${escapeAttr(url)}" alt="Ảnh sản phẩm"><button type="button" data-remove-gift-image="${escapeAttr(url.split('/').pop())}" aria-label="Xóa ảnh">×</button></figure>`).join('') || '<p>Chưa có ảnh thật. Đang dùng hình minh họa.</p>';
  }

  async function uploadGiftImages(input) {
    const card = input.closest('.gift-admin-card'); const gift = adminGiftSets.find(item => item.id === card?.dataset.giftId);
    if (!gift) return;
    const files = [...input.files]; input.value = '';
    if (files.length > 5 - (gift.images || []).length) { showToast('Mỗi set quà tối đa 5 ảnh.', 'error'); return; }
    for (const file of files) {
      try {
        const blob = await compressGiftPhoto(file);
        const response = await fetch(`/api/admin/gifts/${gift.id}/images`, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'image/webp' }, body: blob });
        const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Tải ảnh thất bại.');
        const index = adminGiftSets.findIndex(item => item.id === gift.id); adminGiftSets[index] = result.giftSet; updateGiftCardImages(result.giftSet);
      } catch (error) { showToast(error.message, 'error'); return; }
    }
    showToast('Đã tải ảnh sản phẩm lên.', 'success');
  }

  async function removeGiftImage(button) {
    const card = button.closest('.gift-admin-card'), id = card?.dataset.giftId, filename = button.dataset.removeGiftImage;
    try {
      const result = await api(`/api/admin/gifts/${id}/images/${filename}`, { method: 'DELETE' });
      adminGiftSets = result.giftSets; updateGiftCardImages(adminGiftSets.find(item => item.id === id)); showToast('Đã xóa ảnh sản phẩm.', 'success');
    } catch (error) { showToast(error.message, 'error'); }
  }

  async function compressGiftPhoto(file) {
    const bitmap = await createImageBitmap(file); const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
    let quality = .82, blob;
    do { blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', quality)); quality -= .1; } while (blob?.size > 500000 && quality >= .52);
    if (!blob || blob.size > 500000) throw new Error('Ảnh vẫn lớn hơn 500KB sau khi nén.');
    return blob;
  }

  async function saveGiftCatalog() {
    const next = [...giftManagementGrid.querySelectorAll('.gift-admin-card')].map(card => {
      const original = adminGiftSets.find(item => item.id === card.dataset.giftId);
      const field = name => card.querySelector(`[data-field="${name}"]`).value.trim();
      return { ...original, name: field('name'), price: Number(field('price')), description: field('description'), components: field('components').split('\n').map(value => value.trim()).filter(Boolean), variantLabel: field('variantLabel'), variants: field('variants').split(',').map(value => value.trim()).filter(Boolean) };
    });
    try {
      const result = await api('/api/admin/gifts', { method: 'PUT', body: JSON.stringify({ giftSets: next }) });
      adminGiftSets = result.giftSets; renderGiftManagement(); showToast('Đã lưu thông tin các set quà.', 'success');
    } catch (error) { showToast(error.message, 'error'); }
  }

  /* ═══════════ REALTIME LISTENERS ═══════════ */
  async function startRealtimeListeners() {
    if (stream) return;
    try {
      const orders = await api('/api/admin/orders');
      allOrders = Object.fromEntries(orders.map(order => [order.id, order]));
      renderOrders(); updateStats();
      stream = new EventSource('/api/admin/events');
      stream.onopen = () => realtimeDot.classList.remove('offline');
      stream.onerror = async () => {
        realtimeDot.classList.add('offline'); realtimeDot.title = 'Mất kết nối, đang thử kết nối lại';
        try { await api('/api/admin/orders'); } catch (error) { if (error.status === 401) showLogin(); }
      };
      stream.onmessage = event => {
        const order = JSON.parse(event.data);
        if (Array.isArray(order.orders)) { allOrders = Object.fromEntries(order.orders.map(item => [item.id, item])); renderOrders(); updateStats(); return; }
        if (!order.id) return;
        const fresh = !allOrders[order.id]; allOrders[order.id] = order; renderOrders(fresh ? [order.id] : []); updateStats();
      };
    } catch (error) { showToast(error.message, 'error'); showLogin(); }
  }

  function stopRealtimeListeners() {
    stream?.close(); stream = null;
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
      const pkgLabel = pkg === 'gift' ? 'CẦN SHIP QUÀ' : pkg === 'online' ? 'Thư online' : pkg === 'vip' ? 'VIP' : 'Cơ bản';
      const time = order.createdAt ? formatTime(order.createdAt) : '—';
      const letterPath = order.letterUrl ? shortPath(order.letterUrl) : '—';
      const letterHref = order.letterUrl || '#';

      return `<tr class="${isNew ? 'new-order' : ''}" style="animation-delay:${idx * 30}ms" data-order-id="${order.id}">
        <td><span class="order-id">${escapeHtml(order.id)}</span></td>
        <td>${time}</td>
        <td>${escapeHtml(order.phone || '—')}</td>
        <td><span class="package-badge ${pkg}">${pkgLabel}</span>${pkg === 'gift' ? `<small class="shipping-progress">${escapeHtml({ preparing: 'Đang chuẩn bị quà', sent: 'Đã gửi ship', delivered: 'Đã giao thành công' }[order.shippingStatus] || 'Đang chuẩn bị quà')}</small>` : ''}</td>
        <td><span class="status-badge ${status}">${statusLabel}</span><small class="edit-count">Còn ${order.editsRemaining ?? 3}/3 lượt sửa</small>${order.linkRevoked ? '<small>Khách đã thu hồi link</small>' : ''}</td>
        <td class="link-cell">${order.letterUrl ? `<a href="${escapeAttr(letterHref)}" target="_blank" rel="noopener">${escapeHtml(letterPath)}</a>` : '—'}</td>
        <td>
          <div class="action-btns">
            <button class="action-btn info" data-action="preview" data-id="${order.id}" title="Xem trước thư">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>
              Xem trước thư
            </button>
            ${pkg === 'gift' ? `<button class="action-btn info" data-action="download-qr" data-id="${order.id}">Tải ảnh QR để in thiệp</button>${status === 'paid' && order.shippingStatus === 'preparing' ? `<button class="action-btn warning" data-action="ship-sent" data-id="${order.id}">Đã gửi ship</button>` : ''}${order.shippingStatus === 'sent' ? `<button class="action-btn confirm" data-action="ship-delivered" data-id="${order.id}">Đã giao thành công</button>` : ''}` : ''}
            ${status === 'pending' ? `
              <button class="action-btn confirm" data-action="pay" data-id="${order.id}" title="Xác nhận thanh toán">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                Xác nhận thanh toán
              </button>
            ` : ''}
            <button class="action-btn warning" data-action="reset-edits" data-id="${order.id}">Đặt lại số lượt sửa</button>
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
    const revoked = entries.filter(o => o.status === 'revoked').length;

    animateCounter($('#stat-total .stat-value'), total);
    animateCounter($('#stat-pending .stat-value'), pending);
    animateCounter($('#stat-paid .stat-value'), paid);
    animateCounter($('#stat-revoked .stat-value'), revoked);
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
      case 'download-qr':
        downloadLetterQr(order);
        break;
      case 'ship-sent':
      case 'ship-delivered':
        showConfirm('Cập nhật giao hàng', `Cập nhật đơn <strong>${escapeHtml(orderId)}</strong> sang trạng thái <strong>${action === 'ship-sent' ? 'Đã gửi ship' : 'Đã giao thành công'}</strong>?`, () => updateShippingStatus(orderId, action === 'ship-sent' ? 'sent' : 'delivered'));
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
        showConfirm('Đặt lại số lượt sửa', `Cấp lại đủ <strong>3 lượt sửa miễn phí</strong> cho đơn <strong>${escapeHtml(orderId)}</strong>?`, async () => {
          try { allOrders[orderId] = await api(`/api/admin/orders/${orderId}/reset-edits`, { method: 'POST' }); renderOrders(); showToast('Đã cấp lại 3 lượt sửa miễn phí.', 'success'); }
          catch (error) { showToast(error.message, 'error'); }
        });
        break;
    }
  }

  async function updateOrderStatus(orderId, status) {
    try {
      allOrders[orderId] = await api(`/api/admin/orders/${orderId}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
      renderOrders(); updateStats();
      showToast(`Đã cập nhật trạng thái đơn ${orderId}`, 'success');
    } catch (err) {
      showToast('Lỗi cập nhật: ' + err.message, 'error');
    }
  }
  async function updateShippingStatus(orderId, status) {
    try { allOrders[orderId] = await api(`/api/admin/orders/${orderId}/shipping`, { method: 'PATCH', body: JSON.stringify({ status }) }); renderOrders(); showToast('Đã cập nhật tình trạng giao quà.', 'success'); }
    catch (error) { showToast(error.message, 'error'); }
  }
  function downloadLetterQr(order) {
    try {
      const qr = window.qrcode(0, 'L'); qr.addData(new URL(order.letterUrl, location.origin).href, 'Byte'); qr.make();
      const svg = qr.createSvgTag({ cellSize: 8, margin: 4, scalable: true });
      const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
      const link = document.createElement('a'); link.href = url; link.download = `${order.id}-qr-thiep.svg`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { showToast('Không tạo được mã QR cho đơn này.', 'error'); }
  }

  /* ═══════════ LETTER PREVIEW ═══════════ */
  function showPreview(orderId, order) {
    stopPreviewMusic();
    previewTitle.textContent = `Xem trước — ${orderId}`;

    const letterData = order.letterData || {};
    const photos = letterData.photos?.length ? letterData.photos : letterData.photo ? [letterData.photo] : [];
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
        ${photos.length ? `
          <div class="preview-field">
            <span class="preview-label">Ảnh kỷ niệm</span>
            ${photos.map(photo => `<img class="preview-photo" src="${escapeAttr(photo)}" alt="Ảnh kỷ niệm" referrerpolicy="no-referrer">`).join('')}
          </div>
        ` : ''}
        ${hasAudio ? `
          <div class="preview-field">
            <span class="preview-label">Link nhạc</span>
            <audio controls preload="none" src="${escapeAttr(letterData.audio)}"></audio>
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
        ${order.package === 'gift' && order.shipping ? `<div class="preview-field shipping-detail"><span class="preview-label">CẦN SHIP QUÀ · ${escapeHtml({ preparing: 'Đang chuẩn bị quà', sent: 'Đã gửi ship', delivered: 'Đã giao thành công' }[order.shippingStatus] || 'Đang chuẩn bị quà')}</span><span class="preview-value">Set quà: ${escapeHtml(order.giftSetId || '—')}<br>${order.giftVariant ? `${escapeHtml(order.giftVariant.label)}: ${escapeHtml(order.giftVariant.value)}<br>` : ''}Người nhận: ${escapeHtml(order.shipping.recipientName)} · ${escapeHtml(order.shipping.recipientPhone)}<br>Địa chỉ: ${escapeHtml(order.shipping.address)}<br>Ngày hẹn: ${escapeHtml(order.shipping.deliveryDate)} · ${escapeHtml(order.shipping.timeNote || 'Không ghi chú giờ')}<br>Lời nhắn trên thiệp: ${escapeHtml(order.shipping.cardNote || 'Không có')}<br>SĐT/Zalo người đặt (giữ bí mật): ${escapeHtml(order.shipping.buyerPhone)}<br>Tổng dự kiến: ${order.quote?.total == null ? 'Shop báo giá' : new Intl.NumberFormat('vi-VN').format(order.quote.total) + 'đ'}</span></div>` : ''}
      </div>
    `;

    if (letterData.music && !hasAudio) {
      const button = document.createElement('button'); button.className = 'action-btn info'; button.textContent = 'Nghe nhạc nền';
      button.addEventListener('click', () => togglePreviewMusic(letterData.musicTrack, button)); previewBody.append(button);
    }
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
    $$('[data-admin-section]').forEach(button => button.addEventListener('click', () => setAdminSection(button.dataset.adminSection)));
    $('#save-gift-catalog').addEventListener('click', saveGiftCatalog);
    giftManagementGrid.addEventListener('change', event => { if (event.target.matches('[data-gift-images]')) uploadGiftImages(event.target); });
    giftManagementGrid.addEventListener('click', event => { const button = event.target.closest('[data-remove-gift-image]'); if (button) removeGiftImage(button); });
    // Login form
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = loginEmail.value.trim();
      const password = loginPassword.value;
      if (!email || !password) return;

      doLogin(email, password);
    });

    // Toggle password
    togglePw.addEventListener('click', () => {
      const type = loginPassword.type === 'password' ? 'text' : 'password';
      loginPassword.type = type;
      togglePw.setAttribute('aria-label', type === 'password' ? 'Hiện mật khẩu' : 'Ẩn mật khẩu');
    });

    // Logout
    logoutBtn.addEventListener('click', async () => { try { await api('/api/admin/logout', { method: 'POST' }); showLogin(); } catch (error) { showToast(error.message, 'error'); } });
    previewModal.addEventListener('close', () => { stopPreviewMusic(); previewBody.querySelectorAll('audio').forEach(audio => audio.pause()); });

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
  async function boot() {
    setupEvents();
    try { await api('/api/admin/orders'); showDashboard({ email: 'Chủ shop' }); } catch { showLogin(); }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
