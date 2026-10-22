(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const themes = { rose: ['Hồng lãng mạn', '#dba9a1'], midnight: ['Đêm đầy sao', '#38364e'], vintage: ['Cổ điển Vintage', '#c3ab88'], minimal: ['Tối giản', '#a5b09c'] };
  const templates = {
    birthday: { name: 'Một tuổi mới rực rỡ', caption: 'Pháo hoa giấy · Bóng bay · Niềm vui', tag: 'MAKE A WISH', motif: '✧', theme: 'vintage', effect: 'confetti', title: 'Một điều ước dành riêng cho bạn', recipient: 'Bạn thân mến', message: 'Chúc mừng sinh nhật bạn! 🎂\n\nMong tuổi mới mang đến cho bạn thật nhiều niềm vui, những cuộc gặp gỡ ấm áp và đủ can đảm để theo đuổi điều mình yêu.\n\nHãy luôn rực rỡ theo cách riêng của bạn nhé. Hôm nay và cả những ngày sau nữa!', sender: 'Một người luôn quý bạn' },
    love: { name: 'Gửi người tớ thương', caption: 'Tim bay · Cánh hồng · Ngọt ngào', tag: 'MOST LOVED', motif: '♡', theme: 'rose', effect: 'hearts', title: 'Gửi người đặc biệt nhất…', recipient: 'Người tớ thương', message: 'Có những ngày thật bình thường, nhưng chỉ cần có bạn, mọi thứ bỗng trở nên đặc biệt.\n\nCảm ơn bạn vì đã xuất hiện, vì những điều nhỏ bé mà ấm áp, vì đã cùng tớ viết nên những kỷ niệm thật đẹp.\n\nMong chúng mình sẽ còn cùng nhau đi qua thật nhiều mùa thương nhớ. Và mong bạn luôn biết: bạn được yêu thương, rất nhiều.', sender: 'Tâm' },
    flowers: { name: 'Dịu dàng như một đóa hoa', caption: 'Hoa anh đào · Ánh sáng lấp lánh', tag: '20/10 · 8/3 · NGÀY CỦA MẸ', motif: '❀', theme: 'minimal', effect: 'petals', title: 'Một đóa hoa, ngàn lời thương', recipient: 'Người phụ nữ tuyệt vời', message: 'Gửi bạn một chút dịu dàng trong ngày đặc biệt này.\n\nCảm ơn bạn vì những yêu thương, sự kiên nhẫn và ánh sáng mà bạn mang đến cho cuộc sống. Mong bạn luôn được nâng niu, luôn có thời gian cho chính mình và luôn mỉm cười với những điều giản dị.\n\nChúc bạn một ngày thật đẹp, như chính bạn vậy!', sender: 'Một người thương bạn' },
    christmas: { name: 'Một mùa an lành', caption: 'Tuyết rơi · Trời sao · Ấm áp', tag: 'SEASON’S GREETINGS', motif: '✴', theme: 'midnight', effect: 'snow', title: 'Gửi bạn một mùa đông ấm áp', recipient: 'Bạn yêu quý', message: 'Khi những ánh đèn nhỏ sáng lên, tớ muốn gửi đến bạn một lời chúc thật ấm áp.\n\nChúc bạn một mùa Giáng sinh an lành, một năm mới đầy hy vọng và thật nhiều khoảnh khắc ở bên những người mình thương.\n\nMong những điều tốt đẹp đang trên đường tìm đến bạn. Merry Christmas & Happy New Year! ✨', sender: 'Người bạn phương xa' }
  };
  const defaults = { v: 1, occasion: 'love', ...pickTemplate('love'), envelope: 'classic', seal: '#b36a70', font: 'hand', speed: 'medium', music: true, musicTrack: 'romantic', photo: '', photos: [], audio: '' };
  let data = { ...defaults }, view = 'home', preview, receiver, toastTimer, saveTimer, currentOrder, orderStream;
  let pendingPhotos = [], pendingAudio = null;
  async function api(path, options) { const response = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json', ...options?.headers } }); const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Không kết nối được máy chủ.'); return result; }
  const music = new MusicBox();
  function pickTemplate(key) { const { theme, effect, title, recipient, message, sender } = templates[key]; return { theme, effect, title, recipient, message, sender }; }
  function icons() { window.lucide?.createIcons(); }
  function toast(message) { clearTimeout(toastTimer); $('#toast').textContent = message; $('#toast').hidden = false; toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 4000); }
  function safeUrl(value) { if (!value) return ''; if (/^\/media\/YTGB[A-F0-9]{32}\/[a-f0-9]{32}\.(webp|mp3|m4a)$/.test(value)) return value; try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : ''; } catch { return ''; } }
  function validate(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Invalid letter');
    const output = { ...defaults };
    for (const [key, limit] of Object.entries({ title: 100, recipient: 60, message: 2400, sender: 60, photo: 500, audio: 500 })) {
      if (typeof raw[key] !== 'string' || raw[key].length > limit) throw new Error('Invalid field');
      output[key] = raw[key];
    }
    for (const [key, allowed] of Object.entries({ occasion: Object.keys(templates), theme: Object.keys(themes), envelope: ['classic', 'lined', 'botanical'], font: ['hand', 'serif', 'modern'], effect: ['hearts', 'petals', 'snow', 'confetti', 'fireflies'], speed: ['slow', 'medium', 'instant'] })) {
      if (!allowed.includes(raw[key])) throw new Error('Invalid option');
      output[key] = raw[key];
    }
    if (!/^#[0-9a-f]{6}$/i.test(raw.seal) || typeof raw.music !== 'boolean') throw new Error('Invalid style');
    output.seal = raw.seal; output.music = raw.music;
    for (const key of ['photo', 'audio']) { if (raw[key] && !safeUrl(raw[key])) throw new Error('Invalid media URL'); }
    output.photos = Array.isArray(raw.photos) ? raw.photos.filter(url => typeof url === 'string' && safeUrl(url)).slice(0, 3) : [];
    output.musicTrack = ['romantic', 'birthday', 'memories', 'family'].includes(raw.musicTrack) ? raw.musicTrack : 'romantic';
    return output;
  }
  // Standard UTF-8 Base64 links remain compatible with the requested format.
  function encodeLetter(value) { return btoa(unescape(encodeURIComponent(JSON.stringify(value)))); }
  async function encodeCompact(value) {
    const plain = encodeLetter(value);
    if (plain.length < 1600 || !window.CompressionStream) return plain;
    const stream = new Blob([JSON.stringify(value)]).stream().pipeThrough(new CompressionStream('gzip'));
    const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
    const compressed = 'gz.' + btoa(String.fromCharCode(...bytes));
    return compressed.length < plain.length ? compressed : plain;
  }
  async function decodeLetter(encoded) {
    if (!encoded || encoded.length > 35000) throw new Error('Invalid length');
    if (!encoded.startsWith('gz.')) return validate(JSON.parse(decodeURIComponent(escape(atob(encoded)))));
    if (!window.DecompressionStream) throw new Error('Compression unsupported');
    const bytes = Uint8Array.from(atob(encoded.slice(3)), character => character.charCodeAt(0));
    const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')).getReader();
    const chunks = []; let size = 0;
    try { while (true) { const { value, done } = await reader.read(); if (done) break; size += value.length; if (size > 22000) throw new Error('Letter too large'); chunks.push(value); } } finally { await reader.cancel(); }
    return validate(JSON.parse(await new Blob(chunks).text()));
  }
  function loadDraft() { try { const draft = localStorage.getItem('tamgui-letter-v1'); if (draft) data = validate(JSON.parse(draft)); } catch { /* A private browser or older draft must not prevent editing. */ } }
  function saveDraft() { clearTimeout(saveTimer); saveTimer = setTimeout(() => { try { localStorage.setItem('tamgui-letter-v1', JSON.stringify(data)); $('#save-status').textContent = '✓ Đã lưu bản nháp trên thiết bị'; } catch { $('#save-status').textContent = 'Bản nháp chưa lưu được; hãy lấy link trước khi rời trang.'; } }, 300); }
  function changeView(next) {
    view = next; music.stop(); preview?.destroy(); receiver?.destroy(); preview = receiver = null;
    $('#home-view').hidden = next !== 'home'; $('#studio-view').hidden = next !== 'studio'; $('#receiver-view').hidden = next !== 'receiver'; $('#header').hidden = next === 'receiver';
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function populateForm() {
    for (const [key, value] of Object.entries(data)) { const field = $('#editor').elements.namedItem(key); if (field) { if (field.type === 'checkbox') field.checked = value; else field.value = value; } }
    $$('.theme-option').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.theme === data.theme)));
    $('#char-count').textContent = `${data.message.length}/2400`;
  }
  function studio(template, open = false) {
    if (template) data = { ...data, ...pickTemplate(template), occasion: template };
    history.replaceState(null, '', location.pathname + '#studio');
    changeView('studio'); populateForm(); setTab(open ? 'preview' : 'edit');
    preview = new Experience($('#preview-stage'), data); if (open) preview.open();
    saveDraft();
  }
  function setTab(tab) { $('.studio-grid').dataset.mobile = tab; $$('[data-tab]').forEach(button => { button.setAttribute('aria-selected', String(button.dataset.tab === tab)); button.tabIndex = button.dataset.tab === tab ? 0 : -1; }); }
  function refreshPreview() { preview?.update(data); $('#char-count').textContent = `${data.message.length}/2400`; saveDraft(); }
  function home() { history.replaceState(null, '', location.pathname + '#home'); changeView('home'); }
  async function copy(text, success, field) {
    try { await navigator.clipboard.writeText(text); toast(success); } catch {
      const input = field || document.createElement('textarea'); if (!field) { input.value = text; const parent = $('dialog[open]') || document.body; parent.append(input); }
      input.focus(); input.select(); let copied = false; try { copied = document.execCommand('copy'); } catch { /* Manual selection remains available. */ } if (!field) input.remove();
      toast(copied ? success : 'Hãy chọn nội dung và nhấn Ctrl/Cmd+C để sao chép.');
    }
  }
  function showOrder() {
    const contact = safeUrl(window.LETTER_SHOP?.contactUrl);
    $('#contact-shop').hidden = !contact; if (contact) $('#contact-shop').href = contact;
    $('#contact-status').textContent = contact ? 'Gửi yêu cầu cho shop để xác nhận báo giá và thời gian thực hiện trước khi thanh toán.' : 'Shop chưa thiết lập kênh nhận đơn trực tuyến. Bạn có thể sao chép yêu cầu để gửi qua kênh đang trao đổi với shop. Chưa có khoản thanh toán nào được thu.';
    $('#order-dialog').showModal();
  }
  function MusicBox() {
    this.active = false; this.context = null; this.timer = null; this.audio = null; this.nodes = []; this.run = 0;
    this.stop = () => { this.run++; this.active = false; clearInterval(this.timer); this.nodes.forEach(node => { try { node.stop(); } catch {} }); this.nodes = []; this.audio?.pause(); this.audio = null; this.context?.suspend().catch(() => {}); updateSoundButton(); };
    this.play = async (letter) => {
      this.stop(); const run = this.run; this.active = true; updateSoundButton();
      if (letter.audio) {
        const audio = new Audio(letter.audio); this.audio = audio; audio.loop = true; audio.volume = .4;
        try { await audio.play(); } catch { if (this.audio === audio) { this.stop(); toast('Không phát được link nhạc. Kiểm tra link MP3 hoặc dùng music box.'); } }
        return;
      }
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!this.context) this.context = new AudioContext();
        await this.context.resume(); if (!this.active || this.run !== run) return;
        const tunes = { romantic: [523.25, 659.25, 783.99, 659.25, 587.33, 698.46, 880, 783.99], birthday: [392, 392, 440, 392, 523.25, 493.88, 392, 392, 440, 392, 587.33, 523.25], memories: [440, 523.25, 659.25, 587.33, 523.25, 440, 392, 440], family: [392, 493.88, 587.33, 493.88, 440, 392, 329.63, 392] };
        const notes = tunes[letter.musicTrack] || tunes.romantic; let index = 0;
        const note = () => {
          if (!this.active || this.run !== run || document.hidden) return;
          const oscillator = this.context.createOscillator(), gain = this.context.createGain(), now = this.context.currentTime;
          oscillator.type = 'sine'; oscillator.frequency.value = notes[index++ % notes.length];
          gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(.1, now + .015); gain.gain.exponentialRampToValueAtTime(.001, now + 1.8);
          oscillator.connect(gain); gain.connect(this.context.destination); oscillator.start(now); oscillator.stop(now + 1.9); this.nodes.push(oscillator);
          oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); this.nodes = this.nodes.filter(node => node !== oscillator); };
        };
        note(); this.timer = setInterval(note, 600);
      } catch { this.stop(); toast('Trình duyệt chưa hỗ trợ âm thanh. Bạn vẫn có thể đọc thư.'); }
    };
  }
  function updateSoundButton() { const button = $('#sound-toggle'); if (!button) return; button.setAttribute('aria-pressed', String(music?.active || false)); button.innerHTML = music?.active ? '<i data-lucide="volume-2"></i> Tắt nhạc' : '<i data-lucide="volume-x"></i> Bật nhạc'; icons(); }

  class Particles {
    constructor(host, effect) {
      this.host = host; this.effect = effect; this.canvas = document.createElement('canvas'); this.canvas.className = 'particle-canvas'; this.canvas.setAttribute('aria-hidden', 'true'); host.prepend(this.canvas); this.ctx = this.canvas.getContext('2d'); this.frame = 0; this.last = 0; this.visible = true;
      this.resizeObserver = new ResizeObserver(() => this.resize()); this.resizeObserver.observe(host);
      this.intersection = new IntersectionObserver(([entry]) => { this.visible = entry.isIntersecting; this.start(); }); this.intersection.observe(host);
      this.visibility = () => this.start(); document.addEventListener('visibilitychange', this.visibility); this.resize();
    }
    resize() {
      this.w = this.host.clientWidth; this.h = this.host.clientHeight;
      const dpr = Math.min(devicePixelRatio || 1, 2); this.canvas.width = this.w * dpr; this.canvas.height = this.h * dpr; this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.points = Array.from({ length: reduced ? 12 : Math.min(65, Math.round(this.w * this.h / 11000) + 15) }, () => ({ x: Math.random() * this.w, y: Math.random() * this.h, size: 2 + Math.random() * 6, speed: 12 + Math.random() * 22, phase: Math.random() * Math.PI * 2, color: Math.floor(Math.random() * 4) }));
      this.start();
    }
    start() { cancelAnimationFrame(this.frame); this.last = 0; if (this.visible && !document.hidden && this.w) this.frame = requestAnimationFrame(time => this.draw(time)); }
    draw(time) {
      const dt = this.last ? Math.min((time - this.last) / 1000, .04) : 0; this.last = time; const c = this.ctx; c.clearRect(0, 0, this.w, this.h);
      this.points.forEach((p, i) => {
        if (!reduced) { p.y += (this.effect === 'fireflies' || (this.effect === 'confetti' && i % 7 === 0) ? -1 : 1) * p.speed * dt; p.x += Math.sin(time / 1800 + p.phase) * dt * 12; if (p.y > this.h + 25) p.y = -25; if (p.y < -30) p.y = this.h + 20; }
        c.save(); c.translate(p.x, p.y); c.globalAlpha = .3 + Math.sin(time / 1300 + p.phase) * .18;
        if (this.effect === 'hearts') { c.fillStyle = '#bd6f82'; c.rotate(p.phase + time / 8000); c.beginPath(); if (i % 3 === 0) c.ellipse(0, 0, p.size, p.size * .5, .4, 0, Math.PI * 2); else { c.moveTo(0, p.size / 2); c.bezierCurveTo(-p.size * 2, -p.size / 2, -p.size, -p.size * 1.8, 0, -p.size / 2); c.bezierCurveTo(p.size, -p.size * 1.8, p.size * 2, -p.size / 2, 0, p.size / 2); } c.fill(); }
        else if (this.effect === 'petals') { c.fillStyle = i % 4 ? '#d79ca5' : '#fff7c8'; c.rotate(p.phase + time / 3500); c.beginPath(); c.ellipse(0, 0, p.size, p.size * .48, 0, 0, Math.PI * 2); c.fill(); }
        else if (this.effect === 'confetti') { c.fillStyle = ['#bb7f88', '#d1ab63', '#a0ae8c', '#ffffff'][p.color]; if (i % 7 === 0) { c.beginPath(); c.ellipse(0, 0, p.size * 2, p.size * 2.6, 0, 0, Math.PI * 2); c.fill(); c.strokeStyle = c.fillStyle; c.beginPath(); c.moveTo(0, p.size * 2.6); c.quadraticCurveTo(8, 20, 0, 34); c.stroke(); } else { c.rotate(p.phase + time / 1200); c.fillRect(-p.size / 2, 0, p.size, p.size * .45); } }
        else { c.fillStyle = this.effect === 'snow' ? '#ffffff' : '#fff2a1'; c.globalAlpha = .25 + Math.abs(Math.sin(time / 1000 + p.phase)) * .4; c.beginPath(); c.arc(0, 0, p.size * .4, 0, Math.PI * 2); c.fill(); if (this.effect === 'fireflies') { c.globalAlpha *= .15; c.beginPath(); c.arc(0, 0, p.size * 1.6, 0, Math.PI * 2); c.fill(); } }
        c.restore();
      });
      if (!reduced && this.visible && !document.hidden) this.frame = requestAnimationFrame(t => this.draw(t));
    }
    destroy() { cancelAnimationFrame(this.frame); this.resizeObserver.disconnect(); this.intersection.disconnect(); document.removeEventListener('visibilitychange', this.visibility); this.canvas.remove(); }
  }
  class Experience {
    constructor(host, letter) { this.host = host; this.data = { ...letter }; this.state = 'closed'; this.timers = []; this.render(); }
    clearTimers() { this.timers.forEach(clearTimeout); this.timers = []; }
    later(fn, delay) { this.timers.push(setTimeout(fn, delay)); }
    render() {
      this.clearTimers(); this.particles?.destroy(); this.host.className = `experience theme-${this.data.theme}`; this.host.style.setProperty('--seal', this.data.seal);
      this.host.innerHTML = '<div class="envelope-view"><p class="arrival-text">Bạn có một bức thư đặc biệt từ<strong></strong></p><div class="interactive-envelope"><div class="envelope-back"></div><div class="paper-peek">Một chút thương ♡</div><div class="envelope-flap"></div><div class="envelope-front"></div><button class="seal-button" aria-label="Chạm con dấu để mở thư" aria-expanded="false">♡</button></div><p class="envelope-title"></p><p class="envelope-hint">CHẠM CON DẤU · MỞ YÊU THƯƠNG</p></div>';
      this.host.querySelector('.arrival-text strong').textContent = this.data.sender || 'Một người thương bạn';
      this.host.querySelector('.envelope-title').textContent = this.data.title;
      this.host.querySelector('.interactive-envelope').classList.add(this.data.envelope);
      this.host.querySelector('.seal-button').addEventListener('click', () => this.open());
      this.particles = new Particles(this.host, this.data.effect);
    }
    update(letter) { const reading = this.state === 'reading'; music.stop(); this.data = { ...letter }; this.state = 'closed'; this.render(); if (reading) this.read(true); }
    open() {
      if (this.state !== 'closed') return;
      this.state = 'opening'; this.host.classList.add('opening'); const seal = this.host.querySelector('.seal-button'); seal.disabled = true; seal.setAttribute('aria-expanded', 'true');
      if (this.data.music) music.play(this.data);
      if (!reduced && window.confetti) {
        const bounds = this.host.getBoundingClientRect();
        window.confetti({ particleCount: 65, spread: 80, startVelocity: 25, origin: { x: (bounds.left + bounds.width / 2) / innerWidth, y: Math.min(.85, (bounds.top + bounds.height / 2) / innerHeight) }, colors: [this.data.seal, '#d7b47b', '#eed1c8', '#ffffff'], disableForReducedMotion: true });
      }
      this.later(() => this.read(false), reduced ? 0 : 1250);
    }
    read(instant) {
      this.state = 'reading'; this.host.classList.remove('opening'); this.host.querySelector('.envelope-view')?.remove();
      const paper = document.createElement('article'); paper.className = `reading-paper font-${this.data.font}`; paper.tabIndex = -1; paper.setAttribute('aria-label', 'Nội dung lá thư');
      paper.innerHTML = '<div class="paper-top" aria-hidden="true">❦</div><h2></h2><div class="letter-content"></div><div class="letter-signature"></div><button class="text-btn skip-typing">Hiện toàn bộ lá thư</button>';
      paper.querySelector('h2').textContent = `Gửi ${this.data.recipient || 'bạn'},`;
      for (const photo of this.data.photos?.length ? this.data.photos : this.data.photo ? [this.data.photo] : []) {
        const image = document.createElement('img'); image.className = 'memory-photo'; image.alt = 'Ảnh kỷ niệm người gửi dành tặng'; image.referrerPolicy = 'no-referrer'; image.src = photo;
        image.onerror = () => { image.remove(); };
        paper.querySelector('h2').after(image);
      }
      this.host.append(paper); if (!instant) paper.focus({ preventScroll: true });
      const content = paper.querySelector('.letter-content'), signature = paper.querySelector('.letter-signature'), skip = paper.querySelector('.skip-typing');
      const fullSignature = `Thương mến,\n${this.data.sender}`;
      const finish = () => { this.clearTimers(); content.textContent = this.data.message; signature.textContent = fullSignature; content.classList.remove('typing'); signature.classList.remove('typing'); skip.hidden = true; };
      skip.addEventListener('click', finish);
      if (instant || reduced || this.data.speed === 'instant') { finish(); return; }
      const parts = [Array.from(this.data.message), Array.from(fullSignature)]; let section = 0, count = 0;
      const tick = () => {
        const node = section === 0 ? content : signature;
        node.classList.add('typing'); count++; node.textContent = parts[section].slice(0, count).join('');
        if (count >= parts[section].length) { node.classList.remove('typing'); if (section === 1) { skip.hidden = true; return; } section = 1; count = 0; }
        this.later(tick, this.data.speed === 'slow' ? 65 : 25);
      };
      tick();
    }
    reset() { music.stop(); this.state = 'closed'; this.render(); }
    destroy() { this.clearTimers(); this.particles?.destroy(); this.host.replaceChildren(); }
  }

  async function compressPhoto(file) {
    if (!file.type.startsWith('image/')) throw new Error('Vui lòng chọn tệp ảnh.');
    const bitmap = await createImageBitmap(file); let scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas'); let blob;
    for (let attempt = 0; attempt < 8; attempt++) {
      canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', Math.max(.55, .8 - attempt * .04)));
      if (blob?.type === 'image/webp' && blob.size <= 200000) break;
      scale *= .85;
    }
    bitmap.close();
    if (!blob || blob.type !== 'image/webp' || blob.size > 200000) throw new Error('Ảnh không thể nén xuống dưới 200KB. Hãy chọn ảnh khác.');
    return blob;
  }
  function renderPhotos() {
    const host = $('#photos-preview'); host.replaceChildren();
    [...data.photos.map((url, index) => ({ url, index, saved: true })), ...pendingPhotos.map((item, index) => ({ url: item.url, index, saved: false }))].forEach(item => {
      const frame = document.createElement('div'); frame.className = 'polaroid';
      const img = document.createElement('img'); img.src = item.url; img.alt = 'Ảnh kỷ niệm xem trước';
      const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = 'Xóa ảnh'; remove.addEventListener('click', () => {
        if (item.saved) data.photos.splice(item.index, 1); else { URL.revokeObjectURL(pendingPhotos[item.index].url); pendingPhotos.splice(item.index, 1); }
        renderPhotos(); refreshPreview();
      }); frame.append(img, remove); host.append(frame);
    });
  }
  async function uploadMedia(order) {
    const upload = async (blob, type) => {
      const response = await fetch(`/api/orders/${order.id}/media`, { method: 'POST', headers: { 'Content-Type': type, 'X-Owner-Token': order.ownerToken }, body: blob });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Tải tệp thất bại.'); return result.url;
    };
    for (const item of pendingPhotos) data.photos.push(await upload(item.blob, 'image/webp'));
    pendingPhotos.forEach(item => URL.revokeObjectURL(item.url)); pendingPhotos = [];
    if (pendingAudio) { data.audio = await upload(pendingAudio.blob, pendingAudio.type); URL.revokeObjectURL(pendingAudio.url); pendingAudio = null; }
    renderPhotos(); saveDraft();
    return data;
  }
  $('#photos-input').addEventListener('change', async event => {
    try {
      const files = [...event.target.files];
      if (files.length + data.photos.length + pendingPhotos.length > 3) throw new Error('Tối đa 3 ảnh cho mỗi thư.');
      for (const file of files) { const blob = await compressPhoto(file); pendingPhotos.push({ blob, url: URL.createObjectURL(blob) }); }
      renderPhotos(); toast('Ảnh đã được nén, sẽ tải lên khi lưu thư.');
    } catch (error) { toast(error.message); } finally { event.target.value = ''; }
  });
  $('#audio-input').addEventListener('change', event => {
    const file = event.target.files[0]; if (!file) return;
    const type = /\.mp3$/i.test(file.name) ? 'audio/mpeg' : /\.m4a$/i.test(file.name) ? 'audio/mp4' : '';
    if (!type || file.size > 5 * 1024 * 1024) { toast('Chỉ nhận MP3/M4A tối đa 5MB.'); event.target.value = ''; return; }
    if (pendingAudio) URL.revokeObjectURL(pendingAudio.url);
    pendingAudio = { blob: file, type, url: URL.createObjectURL(file) };
    $('#audio-preview').src = pendingAudio.url; $('#audio-preview').hidden = false; music.stop();
  });
  $('#preview-track').addEventListener('click', () => music.active ? music.stop() : music.play({ ...data, audio: '' }));
  $$('[data-view-policy]').forEach(link => link.addEventListener('click', event => { event.preventDefault(); link.closest('dialog')?.close(); changeView('home'); $('#faq').scrollIntoView({ behavior: 'smooth' }); }));

  async function generate() {
    setTab('edit'); if (!$('#editor').reportValidity()) return;
    if (['title', 'recipient', 'message', 'sender'].some(key => !data[key].trim())) { toast('Hãy điền đầy đủ tiêu đề, người nhận, lời chúc và chữ ký.'); return; }
    if (['photo', 'audio'].some(key => data[key] && !safeUrl(data[key]))) { toast('Link ảnh và nhạc cần bắt đầu bằng https://.'); return; }
    if (currentOrder?.ownerToken) {
      const button = $('#generate'); button.disabled = true;
      try { await uploadMedia(currentOrder); const order = await api(`/api/orders/${currentOrder.id}`, { method: 'PUT', body: JSON.stringify({ ownerToken: currentOrder.ownerToken, letterData: validate(data) }) }); showShare({ ...order, ownerToken: currentOrder.ownerToken }); }
      catch (error) { toast(error.message); } finally { button.disabled = false; }
      return;
    }
    $('#identity-dialog').showModal();
  }
  function showShare(order) {
    currentOrder = order;
    $('#order-code').textContent = `Mã đơn hàng: ${order.id}`;
    $('#order-state').textContent = order.status === 'paid' ? 'Đã mở khóa Premium. Bạn có thể gửi link và mã QR.' : order.status === 'revoked' ? 'Đơn đã bị thu hồi. Vui lòng liên hệ shop.' : 'Đang chờ thanh toán. Trang sẽ tự mở khóa khi shop xác nhận.';
    const url = new URL(order.letterUrl, location.origin);
    $('#share-url').value = url.href; $('#open-link').href = url.href;
    $('#qr-code').replaceChildren(); $('#qr-status').textContent = '';
    try { const qr = window.qrcode(0, 'L'); qr.addData(url.href, 'Byte'); qr.make(); $('#qr-code').innerHTML = qr.createSvgTag({ cellSize: 4, margin: 4, scalable: true }); $('#qr-status').textContent = 'Quét mã QR để mở thư sau khi thanh toán.'; }
    catch { $('#qr-status').textContent = 'Không tạo được mã QR; bạn vẫn có thể sao chép link.'; }
    $('#hosting-hint').textContent = 'Mã đơn là khóa tra cứu. Chỉ gửi cho người bạn tin tưởng.';
    if (!$('#share-dialog').open) $('#share-dialog').showModal();
    subscribeOrder(order.id);
  }
  function subscribeOrder(id) {
    orderStream?.close();
    orderStream = new EventSource(`/api/orders/${id}/events`);
    orderStream.onmessage = event => {
      const update = JSON.parse(event.data); const prior = currentOrder?.status;
      currentOrder = { ...update, ownerToken: currentOrder?.ownerToken }; $('#order-state').textContent = update.status === 'paid' ? 'Đã mở khóa Premium! Bây giờ bạn có thể gửi thư.' : update.status === 'revoked' ? 'Đơn đã bị thu hồi.' : 'Đang chờ thanh toán.';
      if (update.status === 'paid' && prior !== 'paid') toast('Thư đã được mở khóa Premium!');
      if (view === 'receiver') showOrderReceiver(update);
    };
  }
  function showOrderReceiver(order) {
    const stage = $('#receiver-stage');
    music.stop();
    receiver?.destroy(); receiver = null;
    $('#receiver-view .receiver-controls').hidden = order.status !== 'paid';
    if (order.status === 'paid' && order.letterData && !order.linkRevoked) { data = validate(order.letterData); receiver = new Experience(stage, data); }
    else {
      stage.replaceChildren(); const notice = document.createElement('div'); notice.className = 'order-waiting';
      if (order.status === 'paid' && order.passwordRequired && !order.linkRevoked && (!order.expiresAt || order.expiresAt > Date.now())) {
        const form = document.createElement('form'); const label = document.createElement('label'); label.textContent = 'Nhập mật khẩu mở thư';
        const password = document.createElement('input'); password.type = 'password'; password.required = true;
        const button = document.createElement('button'); button.className = 'btn'; button.textContent = 'Mở thư';
        const error = document.createElement('p'); form.append(label, password, button, error);
        form.addEventListener('submit', async event => { event.preventDefault(); try { const result = await api(`/api/thu/${order.letterUrl.split('/').pop()}/open`, { method: 'POST', body: JSON.stringify({ password: password.value }) }); showOrderReceiver({ ...order, letterData: result.letterData, passwordRequired: false }); } catch (issue) { error.textContent = issue.message; } });
        notice.append(form);
      } else notice.textContent = order.linkRevoked ? 'Link đã được thu hồi.' : order.expiresAt && order.expiresAt <= Date.now() ? 'Link đã hết hạn.' : order.status === 'revoked' ? 'Bức thư đã bị thu hồi.' : 'Bức thư đang chờ xác nhận thanh toán. Trang sẽ tự mở khóa.';
      stage.append(notice);
    }
  }
  $('#identity-form').addEventListener('submit', async event => {
    event.preventDefault(); const form = event.currentTarget; if (!form.reportValidity()) return;
    const button = form.querySelector('button[type=submit]'); button.disabled = true;
    try {
      let order = await api('/api/orders', { method: 'POST', body: JSON.stringify({ phone: $('#customer-phone').value.trim(), pin: $('#customer-pin').value.trim(), letterData: validate(data) }) });
      localStorage.setItem(`ytgb-owner-${order.id}`, order.ownerToken); localStorage.setItem('ytgb-current-order', order.id);
      currentOrder = order; await uploadMedia(order);
      order = { ...await api(`/api/orders/${order.id}`, { method: 'PUT', body: JSON.stringify({ ownerToken: order.ownerToken, letterData: validate(data) }) }), ownerToken: order.ownerToken };
      $('#identity-dialog').close(); showShare(order);
    } catch (error) { toast(error.message); } finally { button.disabled = false; }
  });
  $('#open-lookup').addEventListener('click', () => $('#lookup-dialog').showModal());
  $$('[data-open-lookup]').forEach(button => button.addEventListener('click', () => $('#lookup-dialog').showModal()));
  $('#dismiss-resume').addEventListener('click', () => { $('#resume-banner').hidden = true; sessionStorage.setItem('ytgb-resume-dismissed', '1'); });
  $('#resume-order').addEventListener('click', async () => {
    const id = localStorage.getItem('ytgb-current-order'), token = id && localStorage.getItem(`ytgb-owner-${id}`);
    if (!id || !token) return;
    try { const order = await api(`/api/orders/${id}/owner`, { headers: { 'X-Owner-Token': token } }); currentOrder = { ...order, ownerToken: token }; data = validate(order.letterData); $('#resume-banner').hidden = true; studio(); }
    catch (error) { toast(error.message); }
  });
  function customerPanel(order) {
    const row = document.createElement('div'); row.className = 'lookup-result';
    const heading = document.createElement('h3'); heading.textContent = order.id;
    const status = document.createElement('p'); status.textContent = `Trạng thái: ${order.status === 'paid' ? 'Đã thanh toán' : order.status === 'revoked' ? 'Đã thu hồi' : 'Chờ thanh toán'} · ${order.status === 'paid' ? `Còn ${order.editsRemaining}/3 lần sửa miễn phí` : 'Sửa không giới hạn trước thanh toán'}`;
    const short = document.createElement('code'); short.textContent = order.letterUrl;
    const copyButton = document.createElement('button'); copyButton.type = 'button'; copyButton.className = 'text-btn'; copyButton.textContent = 'Sao chép link ngắn'; copyButton.addEventListener('click', () => copy(new URL(order.letterUrl, location.origin).href, 'Đã sao chép link thư.'));
    const qrButton = document.createElement('button'); qrButton.type = 'button'; qrButton.className = 'text-btn'; qrButton.textContent = 'Xem và tải mã QR'; qrButton.addEventListener('click', () => { $('#lookup-dialog').close(); showShare(order); });
    const edit = document.createElement('button'); edit.type = 'button'; edit.className = 'text-btn'; edit.textContent = 'Chỉnh sửa nội dung thư'; edit.disabled = order.status === 'paid' && order.editsRemaining === 0; edit.addEventListener('click', () => { data = validate(order.letterData); currentOrder = order; $('#lookup-dialog').close(); studio(); });
    const passwordLabel = document.createElement('label'); passwordLabel.textContent = 'Mật khẩu mở thư mới (để trống để giữ nguyên)';
    const password = document.createElement('input'); password.type = 'password'; password.placeholder = 'Tối thiểu 6 ký tự';
    const expiryLabel = document.createElement('label'); expiryLabel.textContent = 'Ngày hết hạn link';
    const expiry = document.createElement('input'); expiry.type = 'date'; expiry.value = order.expiresAt ? new Date(order.expiresAt).toISOString().slice(0, 10) : '';
    const save = document.createElement('button'); save.type = 'button'; save.className = 'btn small'; save.textContent = 'Lưu mật khẩu & hạn sử dụng';
    const clearPassword = document.createElement('button'); clearPassword.type = 'button'; clearPassword.className = 'text-btn'; clearPassword.textContent = 'Gỡ mật khẩu';
    const revoke = document.createElement('button'); revoke.type = 'button'; revoke.className = 'text-btn'; revoke.textContent = order.linkRevoked ? 'Mở lại link' : 'Thu hồi link ngay';
    const feedback = document.createElement('p'); feedback.setAttribute('role', 'status');
    const updateSettings = async payload => {
      try { const updated = await api(`/api/orders/${order.id}/settings`, { method: 'PATCH', body: JSON.stringify({ ownerToken: order.ownerToken, ...payload }) }); Object.assign(order, updated); feedback.textContent = 'Đã cập nhật.'; revoke.textContent = order.linkRevoked ? 'Mở lại link' : 'Thu hồi link ngay'; }
      catch (error) { feedback.textContent = error.message; }
    };
    save.addEventListener('click', () => { const expiresAt = expiry.value ? new Date(`${expiry.value}T23:59:59`).getTime() : null; updateSettings({ ...(password.value ? { password: password.value } : {}), expiresAt }); password.value = ''; });
    clearPassword.addEventListener('click', () => updateSettings({ password: '' }));
    revoke.addEventListener('click', () => updateSettings({ linkRevoked: !order.linkRevoked }));
    row.append(heading, status, short, copyButton, qrButton, edit, passwordLabel, password, expiryLabel, expiry, save, clearPassword, revoke, feedback);
    return row;
  }
  $('#lookup-form').addEventListener('submit', async event => {
    event.preventDefault(); const results = $('#lookup-results'); results.replaceChildren();
    try {
      const found = await api('/api/orders/recover', { method: 'POST', body: JSON.stringify({ id: $('#lookup-code').value.trim(), phone: $('#lookup-phone').value.trim(), pin: $('#lookup-pin').value.trim() }) });
      for (const order of Array.isArray(found) ? found : [found]) {
        localStorage.setItem(`ytgb-owner-${order.id}`, order.ownerToken);
        results.append(customerPanel(order));
      }
    } catch (error) { results.textContent = error.message; }
  });
  $('#template-grid').innerHTML = Object.entries(templates).map(([key, template]) => `<article class="template-card" data-category="${key}"><div class="template-art ${key}"><span class="card-tag">${template.tag}</span><span class="art-motif a">${template.motif}</span><div class="mini-envelope"></div><span class="art-motif b">${template.motif}</span></div><h3>${template.name}</h3><p>${template.caption}</p><div class="card-actions"><button class="text-btn" data-sample="${key}"><i data-lucide="play"></i> Xem mẫu</button><button class="text-btn" data-template="${key}">Dùng mẫu này <i data-lucide="arrow-up-right"></i></button></div></article>`).join('');
  $('#theme-options').innerHTML = Object.entries(themes).map(([key, [name, color]]) => `<button type="button" class="theme-option" data-theme="${key}" aria-pressed="false"><span style="background:${color}"></span>${name}</button>`).join('');
  $$('[data-create]').forEach(button => button.addEventListener('click', () => { currentOrder = null; studio(); }));
  $$('[data-template]').forEach(button => button.addEventListener('click', () => { currentOrder = null; studio(button.dataset.template); }));
  $$('[data-sample]').forEach(button => button.addEventListener('click', () => studio(button.dataset.sample, true)));
  $$('[data-filter]').forEach(button => button.addEventListener('click', () => { $$('[data-filter]').forEach(b => { b.classList.toggle('active', b === button); b.setAttribute('aria-pressed', String(b === button)); }); $$('.template-card').forEach(card => { card.hidden = button.dataset.filter !== 'all' && card.dataset.category !== button.dataset.filter; }); }));
  $$('[data-theme]').forEach(button => button.addEventListener('click', () => { data.theme = button.dataset.theme; populateForm(); refreshPreview(); }));
  $$('[data-tab]').forEach(button => { button.addEventListener('click', () => setTab(button.dataset.tab)); button.addEventListener('keydown', event => { if (['ArrowLeft', 'ArrowRight'].includes(event.key)) { event.preventDefault(); const tab = button.dataset.tab === 'edit' ? 'preview' : 'edit'; setTab(tab); $(`[data-tab="${tab}"]`).focus(); } }); });
  $('#editor').addEventListener('submit', event => event.preventDefault());
  $('#editor').addEventListener('input', event => { const field = event.target; if (!field.name) return; data[field.name] = field.type === 'checkbox' ? field.checked : field.value; if (field.name === 'occasion') { data = { ...data, ...pickTemplate(field.value) }; populateForm(); } refreshPreview(); });
  $('#test-open').addEventListener('click', () => { preview.reset(); preview.open(); });
  $('#generate').addEventListener('click', generate);
  $('#copy-link').addEventListener('click', () => copy($('#share-url').value, 'Đã sao chép link. Gửi thương thôi! ♡', $('#share-url')));
  $('#download-qr').addEventListener('click', () => { const svg = $('#qr-code svg'); if (!svg) return toast('Chưa có mã QR để tải.'); const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `${currentOrder?.id || 'thu'}-qr.svg`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); });
  $$('[data-order]').forEach(button => button.addEventListener('click', showOrder));
  $('#copy-order').addEventListener('click', () => copy($('#order-note').value, 'Đã sao chép yêu cầu thiết kế.', $('#order-note')));
  $$('[data-close]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
  $$('dialog').forEach(dialog => dialog.addEventListener('click', event => { if (event.target !== dialog) return; const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close(); }));
  $('#back-home').addEventListener('click', home);
  $('#error-home').addEventListener('click', () => { $('#error-dialog').close(); home(); });
  $('#replay').addEventListener('click', () => receiver?.reset());
  $('#sound-toggle').addEventListener('click', () => music.active ? music.stop() : music.play(data));
  $('#create-similar').addEventListener('click', () => { currentOrder = null; studio(); });
  $('#header').addEventListener('click', event => { const anchor = event.target.closest('a'); if (anchor && view !== 'home') { changeView('home'); history.replaceState(null, '', location.pathname + anchor.hash); requestAnimationFrame(() => $(anchor.hash)?.scrollIntoView()); } });
  document.addEventListener('visibilitychange', () => { if (document.hidden) music.stop(); });
  window.addEventListener('pagehide', () => { music.stop(); preview?.destroy(); receiver?.destroy(); });
  window.addEventListener('pageshow', event => { if (event.persisted) { if (view === 'studio') preview = new Experience($('#preview-stage'), data); if (view === 'receiver') receiver = new Experience($('#receiver-stage'), data); } });
  async function init() {
    icons(); const params = new URLSearchParams(location.search);
    if (location.pathname.startsWith('/thu/')) { changeView('receiver'); try { const slug = location.pathname.split('/').pop(); const order = await api(`/api/thu/${encodeURIComponent(slug)}`); currentOrder = order; showOrderReceiver(order); subscribeOrder(order.id); } catch { $('#error-dialog').showModal(); } }
    else if (params.has('order')) { changeView('receiver'); try { const order = await api(`/api/orders/${encodeURIComponent(params.get('order'))}`); currentOrder = order; showOrderReceiver(order); subscribeOrder(order.id); } catch { $('#error-dialog').showModal(); } }
    else if (params.has('letter')) { changeView('receiver'); try { data = await decodeLetter(params.get('letter')); receiver = new Experience($('#receiver-stage'), data); document.title = `Một lá thư từ ${data.sender} — Tâm gửi`; } catch { $('#error-dialog').showModal(); } }
    else {
      loadDraft();
      const id = localStorage.getItem('ytgb-current-order'); const ownerToken = id && localStorage.getItem(`ytgb-owner-${id}`);
      if (id && ownerToken) {
        if (!sessionStorage.getItem('ytgb-resume-dismissed')) { $('#resume-message').textContent = `Khôi phục bức thư bạn đang thực hiện (Mã: ${id})`; $('#resume-banner').hidden = false; }
        try { currentOrder = { ...await api(`/api/orders/${id}/owner`, { headers: { 'X-Owner-Token': ownerToken } }), ownerToken }; }
        catch { /* Draft remains available offline. */ }
      }
      if (location.hash === '#studio') studio();
    }
  }
  init();
})();
