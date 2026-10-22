import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { LETTER_PRICE, ESTIMATED_SHIPPING, GIFT_SETS, quoteFor } from './order-catalog.mjs';

const databaseFile = () => resolve(process.env.ORDER_DATA_FILE || 'data/orders.json');
const orders = new Map();
const clients = new Set();
const attempts = new Map();
const adminSessions = new Map();
const sessionToken = req => /(?:^|; )admin_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || '')?.[1];
let writeQueue = Promise.resolve();
const idPattern = /^YTGB[A-F0-9]{32}$/;
const hash = value => createHash('sha256').update(value).digest('hex');
const equal = (a, b) => {
  const left = Buffer.from(String(a)); const right = Buffer.from(String(b));
  return left.length === right.length && timingSafeEqual(left, right);
};
const json = (res, status, value, extra = {}) => res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra }).end(JSON.stringify(value));
const isAdmin = req => {
  const token = sessionToken(req);
  const [expires, signature] = token ? [Number.parseInt(token.slice(0, 16), 16), token.slice(16)] : [0, ''];
  return Boolean(adminSessions.has(token) && process.env.ADMIN_SESSION_SECRET && expires > Date.now() && equal(signature, hash(`${expires}:${process.env.ADMIN_SESSION_SECRET}`).slice(0, 48)));
};
const isOpen = order => order.status === 'paid' && !order.linkRevoked && (!order.expiresAt || order.expiresAt > Date.now());
const publicOrder = order => ({ id: order.id, status: order.status, package: order.package, createdAt: order.createdAt, updatedAt: order.updatedAt, letterData: isOpen(order) && !order.passwordHash ? order.letterData : undefined, letterUrl: order.letterUrl, passwordRequired: Boolean(order.passwordHash), expiresAt: order.expiresAt || null, linkRevoked: Boolean(order.linkRevoked) });
const ownerOrder = order => ({ ...publicOrder(order), letterData: order.letterData, phone: order.phone, giftSetId: order.giftSetId || null, shipping: order.shipping || null, shippingStatus: order.shippingStatus || null, quote: order.quote || null, editCount: order.editCount || 0, editsRemaining: Math.max(0, 3 - (order.editCount || 0)) });
const validShipping = value => value && typeof value === 'object' && !Array.isArray(value)
  && ['recipientName', 'recipientPhone', 'address', 'deliveryDate', 'timeNote', 'cardNote', 'buyerPhone'].every(key => typeof value[key] === 'string')
  && value.recipientName.trim().length >= 2 && value.recipientName.length <= 100
  && /^0\d{8,10}$/.test(value.recipientPhone)
  && value.address.trim().length >= 12 && value.address.length <= 500
  && /^\d{4}-\d{2}-\d{2}$/.test(value.deliveryDate)
  && !Number.isNaN(Date.parse(`${value.deliveryDate}T00:00:00`))
  && Date.parse(`${value.deliveryDate}T23:59:59`) >= Date.now() - 86400000
  && value.timeNote.length <= 120 && value.cardNote.length <= 300
  && /^0\d{8,10}$/.test(value.buyerPhone);
const notify = order => {
  for (const client of clients) {
    if (client.admin && !isAdmin(client.req)) { client.res.end(); continue; }
    if (client.id === order.id || client.admin) client.res.write(`data: ${JSON.stringify(client.admin ? ownerOrder(order) : publicOrder(order))}\n\n`);
  }
};
const persist = () => { writeQueue = writeQueue.then(async () => { const file = databaseFile(); await mkdir(dirname(file), { recursive: true }); await writeFile(file, JSON.stringify([...orders.values()])); }); return writeQueue; };
const body = async req => {
  let raw = ''; for await (const chunk of req) { raw += chunk; if (raw.length > 30000) throw new Error('Dữ liệu quá lớn'); }
  return JSON.parse(raw || '{}');
};
const validLetter = data => data && typeof data === 'object' && !Array.isArray(data)
  && ['title', 'recipient', 'message', 'sender', 'photo', 'audio'].every(k => typeof data[k] === 'string' && data[k].length <= (k === 'message' ? 2400 : k === 'photo' || k === 'audio' ? 500 : 100))
  && ['photo', 'audio'].every(k => !data[k] || (/^https:\/\/[^\s]+$/i.test(data[k]) || /^\/media\/YTGB[A-F0-9]{32}\/[a-f0-9]{32}\.(webp|mp3|m4a)$/.test(data[k])))
  && (!data.photos || (Array.isArray(data.photos) && data.photos.length <= 3 && data.photos.every(url => typeof url === 'string' && (/^https:\/\/[^\s]+$/i.test(url) || /^\/media\/YTGB[A-F0-9]{32}\/[a-f0-9]{32}\.webp$/.test(url)))));
const owner = (order, req) => order && equal(hash(req.headers['x-owner-token'] || ''), order.ownerHash);
const mediaRoot = () => resolve(process.env.ORDER_MEDIA_DIR || 'data/media');
export function mediaPath(pathname) {
  const match = /^\/media\/(YTGB[A-F0-9]{32})\/([a-f0-9]{32})\.(webp|mp3|m4a)$/.exec(pathname);
  return match ? resolve(mediaRoot(), match[1], `${match[2]}.${match[3]}`) : null;
}
const limited = req => {
  const key = req.socket.remoteAddress || 'unknown', now = Date.now();
  const recent = (attempts.get(key) || []).filter(t => now - t < 60000); recent.push(now); attempts.set(key, recent);
  return recent.length > 30;
};

export async function loadOrders() {
  try { for (const item of JSON.parse(await readFile(databaseFile(), 'utf8'))) if (idPattern.test(item.id)) orders.set(item.id, item); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}

export async function handleApi(req, res, pathname, url) {
  if (!pathname.startsWith('/api/')) return false;
  try {
    if (pathname === '/api/catalog' && req.method === 'GET') { json(res, 200, { letterPrice: LETTER_PRICE, estimatedShipping: ESTIMATED_SHIPPING, giftSets: GIFT_SETS, estimated: true }); return true; }
    if (pathname === '/api/admin/login' && req.method === 'POST') {
      if (limited(req)) return json(res, 429, { error: 'Thử lại sau một phút.' }), true;
      const input = await body(req);
      if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD || !process.env.ADMIN_SESSION_SECRET || !equal(input.email, process.env.ADMIN_EMAIL) || !equal(input.password, process.env.ADMIN_PASSWORD)) return json(res, 401, { error: 'Thông tin đăng nhập không hợp lệ.' }), true;
      const expires = Date.now() + 12 * 3600000;
      const token = expires.toString(16).padStart(16, '0') + hash(`${expires}:${process.env.ADMIN_SESSION_SECRET}`).slice(0, 48);
      for (const [key, until] of adminSessions) if (until <= Date.now()) adminSessions.delete(key);
      adminSessions.set(token, expires);
      json(res, 200, { ok: true }, { 'Set-Cookie': `admin_session=${token}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=43200${req.socket.encrypted || req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : ''}` }); return true;
    }
    if (pathname === '/api/admin/logout' && req.method === 'POST') {
      const token = sessionToken(req); adminSessions.delete(token);
      for (const client of clients) if (client.admin && sessionToken(client.req) === token) client.res.end();
      json(res, 200, { ok: true }, { 'Set-Cookie': 'admin_session=; HttpOnly; SameSite=Strict; Path=/api; Max-Age=0' }); return true;
    }
    if (pathname === '/api/admin/orders' && req.method === 'GET') { if (!isAdmin(req)) return json(res, 401, { error: 'Cần đăng nhập.' }), true; json(res, 200, [...orders.values()].map(ownerOrder)); return true; }
    if (pathname === '/api/admin/events' && req.method === 'GET') { if (!isAdmin(req)) return json(res, 401, { error: 'Cần đăng nhập.' }), true; return events(req, res, { admin: true }), true; }
    const resetEdits = /^\/api\/admin\/orders\/(YTGB[A-F0-9]{32})\/reset-edits$/.exec(pathname);
    if (resetEdits && req.method === 'POST') {
      if (!isAdmin(req)) return json(res, 401, { error: 'Cần đăng nhập.' }), true;
      const order = orders.get(resetEdits[1]); if (!order) return json(res, 404, { error: 'Không tìm thấy đơn.' }), true;
      order.editCount = 0; order.updatedAt = Date.now();
      await persist(); notify(order); json(res, 200, ownerOrder(order)); return true;
    }
    const adminStatus = /^\/api\/admin\/orders\/(YTGB[A-F0-9]{32})\/status$/.exec(pathname);
    if (adminStatus && req.method === 'PATCH') {
      if (!isAdmin(req)) return json(res, 401, { error: 'Cần đăng nhập.' }), true;
      const order = orders.get(adminStatus[1]); if (!order) return json(res, 404, { error: 'Không tìm thấy đơn.' }), true;
      const { status } = await body(req); if (!['pending', 'paid', 'revoked'].includes(status)) return json(res, 400, { error: 'Trạng thái không hợp lệ.' }), true;
      order.status = status; order.updatedAt = Date.now(); await persist(); notify(order); json(res, 200, ownerOrder(order)); return true;
    }
    const shippingStatus = /^\/api\/admin\/orders\/(YTGB[A-F0-9]{32})\/shipping$/.exec(pathname);
    if (shippingStatus && req.method === 'PATCH') {
      if (!isAdmin(req)) return json(res, 401, { error: 'Cần đăng nhập.' }), true;
      const order = orders.get(shippingStatus[1]); if (!order) return json(res, 404, { error: 'Không tìm thấy đơn.' }), true;
      if (order.package !== 'gift') return json(res, 400, { error: 'Đơn này không có quà cần giao.' }), true;
      const { status } = await body(req);
      const next = { preparing: 'sent', sent: 'delivered' }[order.shippingStatus];
      if (status !== next || (status === 'sent' && order.status !== 'paid')) return json(res, 409, { error: 'Trạng thái vận chuyển không hợp lệ.' }), true;
      order.shippingStatus = status; order.updatedAt = Date.now(); await persist(); notify(order); json(res, 200, ownerOrder(order)); return true;
    }
    if (pathname === '/api/orders' && req.method === 'POST') {
      if (limited(req)) return json(res, 429, { error: 'Thử lại sau một phút.' }), true;
      const input = await body(req);
      if (!validLetter(input.letterData) || !/^0\d{8,10}$/.test(input.phone || '') || !/^\d{4}$/.test(input.pin || '')) return json(res, 400, { error: 'Cần số điện thoại, PIN 4 số và nội dung thư hợp lệ.' }), true;
      const packageType = input.package === 'gift' ? 'gift' : input.package === 'online' || !input.package ? 'online' : null;
      const quote = packageType && quoteFor(packageType, input.giftSetId);
      if (!quote || (packageType === 'gift' && !validShipping(input.shipping))) return json(res, 400, { error: 'Thông tin gói quà hoặc địa chỉ giao hàng không hợp lệ.' }), true;
      const id = 'YTGB' + randomBytes(16).toString('hex').toUpperCase();
      const ownerToken = randomBytes(24).toString('hex');
      const slug = randomBytes(9).toString('base64url');
      const order = { id, slug, phone: input.phone, pinHash: hash(`${id}:${input.pin}`), ownerHash: hash(ownerToken), package: packageType, giftSetId: packageType === 'gift' ? input.giftSetId : null, shipping: packageType === 'gift' ? input.shipping : null, shippingStatus: packageType === 'gift' ? 'preparing' : null, quote, status: 'pending', createdAt: Date.now(), updatedAt: Date.now(), letterData: input.letterData, letterUrl: `/thu/${slug}`, editCount: 0 };
      orders.set(id, order); await persist(); notify(order); json(res, 201, { ...ownerOrder(order), ownerToken }); return true;
    }
    if (pathname === '/api/orders/recover' && req.method === 'POST') {
      if (limited(req)) return json(res, 429, { error: 'Thử lại sau một phút.' }), true;
      const input = await body(req); const id = String(input.id || '').toUpperCase();
      if (id && (!input.phone && !input.pin)) return json(res, 400, { error: 'Nhập mã đơn kèm số điện thoại hoặc PIN.' }), true;
      const matches = id ? [orders.get(id)].filter(Boolean) : [...orders.values()].filter(order => input.phone && equal(input.phone, order.phone) && equal(hash(`${order.id}:${input.pin || ''}`), order.pinHash));
      const order = matches[0];
      if (!order || (id && !(input.phone && equal(input.phone, order.phone)) && !(input.pin && equal(hash(`${order.id}:${input.pin}`), order.pinHash)))) return json(res, 404, { error: 'Không tìm thấy đơn hoặc thông tin không đúng.' }), true;
      const recovered = await Promise.all(matches.map(async item => {
        const ownerToken = randomBytes(24).toString('hex'); item.ownerHash = hash(ownerToken);
        return { ...ownerOrder(item), ownerToken };
      }));
      await persist(); json(res, 200, id ? recovered[0] : recovered); return true;
    }
    const short = /^\/api\/thu\/([A-Za-z0-9_-]{12})$/.exec(pathname);
    if (short && req.method === 'GET') {
      const order = [...orders.values()].find(item => item.slug === short[1]);
      if (!order) return json(res, 404, { error: 'Không tìm thấy thư.' }), true;
      json(res, 200, publicOrder(order)); return true;
    }
    const open = /^\/api\/thu\/([A-Za-z0-9_-]{12})\/open$/.exec(pathname);
    if (open && req.method === 'POST') {
      if (limited(req)) return json(res, 429, { error: 'Thử lại sau một phút.' }), true;
      const order = [...orders.values()].find(item => item.slug === open[1]);
      if (!order || !isOpen(order)) return json(res, 404, { error: 'Link không còn khả dụng.' }), true;
      const input = await body(req);
      if (order.passwordHash && !equal(hash(`${order.id}:${input.password || ''}`), order.passwordHash)) return json(res, 403, { error: 'Mật khẩu mở thư không đúng.' }), true;
      json(res, 200, { letterData: order.letterData, id: order.id }); return true;
    }
    const media = /^\/api\/orders\/(YTGB[A-F0-9]{32})\/media$/.exec(pathname);
    if (media && req.method === 'POST') {
      const order = orders.get(media[1]); if (!owner(order, req)) return json(res, 403, { error: 'Thiếu quyền tải tệp.' }), true;
      const type = req.headers['content-type']; const isImage = type === 'image/webp';
      if (!['image/webp', 'audio/mpeg', 'audio/mp4'].includes(type)) return json(res, 415, { error: 'Chỉ nhận WebP, MP3 hoặc M4A.' }), true;
      const limit = isImage ? 200000 : 5 * 1024 * 1024; const chunks = []; let size = 0;
      for await (const chunk of req) { size += chunk.length; if (size > limit) return json(res, 413, { error: 'Tệp vượt dung lượng cho phép.' }), true; chunks.push(chunk); }
      const bytes = Buffer.concat(chunks);
      const webp = bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
      const mp3 = bytes.toString('ascii', 0, 3) === 'ID3' || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0);
      const m4a = bytes.toString('ascii', 4, 8) === 'ftyp';
      if (!(isImage ? webp : type === 'audio/mpeg' ? mp3 : m4a)) return json(res, 415, { error: 'Định dạng tệp không hợp lệ.' }), true;
      const extension = isImage ? 'webp' : type === 'audio/mpeg' ? 'mp3' : 'm4a';
      const name = `${randomBytes(16).toString('hex')}.${extension}`; const folder = resolve(mediaRoot(), order.id);
      await mkdir(folder, { recursive: true });
      if ((await readdir(folder)).length >= 20) return json(res, 409, { error: 'Đã đạt giới hạn tệp tải lên cho đơn này.' }), true;
      await writeFile(resolve(folder, name), bytes);
      json(res, 201, { url: `/media/${order.id}/${name}` }); return true;
    }
    const settings = /^\/api\/orders\/(YTGB[A-F0-9]{32})\/settings$/.exec(pathname);
    if (settings && req.method === 'PATCH') {
      const order = orders.get(settings[1]); const input = await body(req);
      if (!order || !equal(hash(input.ownerToken || ''), order.ownerHash)) return json(res, 403, { error: 'Thiếu quyền quản lý thư.' }), true;
      if (Object.hasOwn(input, 'password')) {
        if (input.password && (typeof input.password !== 'string' || input.password.length < 6 || input.password.length > 80)) return json(res, 400, { error: 'Mật khẩu cần từ 6 đến 80 ký tự.' }), true;
        order.passwordHash = input.password ? hash(`${order.id}:${input.password}`) : null;
      }
      if (Object.hasOwn(input, 'expiresAt')) {
        if (input.expiresAt !== null && (!Number.isSafeInteger(input.expiresAt) || input.expiresAt < Date.now() || input.expiresAt > Date.now() + 366 * 86400000)) return json(res, 400, { error: 'Ngày hết hạn không hợp lệ.' }), true;
        order.expiresAt = input.expiresAt;
      }
      if (Object.hasOwn(input, 'linkRevoked')) order.linkRevoked = input.linkRevoked === true;
      order.updatedAt = Date.now(); await persist(); notify(order); json(res, 200, ownerOrder(order)); return true;
    }
    const own = /^\/api\/orders\/(YTGB[A-F0-9]{32})\/owner$/.exec(pathname);
    if (own && req.method === 'GET') {
      const order = orders.get(own[1]); if (!owner(order, req)) return json(res, 403, { error: 'Thiếu quyền truy cập thư.' }), true;
      json(res, 200, ownerOrder(order)); return true;
    }
    const match = /^\/api\/orders\/(YTGB[A-F0-9]{32})(\/events)?$/.exec(pathname);
    if (match) {
      const order = orders.get(match[1]); if (!order) return json(res, 404, { error: 'Không tìm thấy đơn.' }), true;
      if (match[2] && req.method === 'GET') return events(req, res, { id: order.id, initial: publicOrder(order) }), true;
      if (!match[2] && req.method === 'GET') return json(res, 200, publicOrder(order)), true;
      if (!match[2] && req.method === 'PUT') {
        const input = await body(req);
        if (!equal(hash(input.ownerToken || ''), order.ownerHash)) return json(res, 403, { error: 'Thiếu quyền chỉnh sửa.' }), true;
        if (!validLetter(input.letterData)) return json(res, 400, { error: 'Nội dung thư không hợp lệ.' }), true;
        const changed = JSON.stringify(order.letterData) !== JSON.stringify(input.letterData);
        if (order.status === 'paid' && changed && (order.editCount || 0) >= 3) return json(res, 409, { error: 'Đã hết 3 lượt chỉnh sửa miễn phí.' }), true;
        if (order.status === 'paid' && changed) order.editCount = (order.editCount || 0) + 1;
        order.letterData = input.letterData; order.updatedAt = Date.now(); await persist(); notify(order); json(res, 200, ownerOrder(order)); return true;
      }
    }
    json(res, 404, { error: 'Không tìm thấy API.' }); return true;
  } catch (error) { json(res, 400, { error: error.message || 'Yêu cầu không hợp lệ.' }); return true; }
}

function events(req, res, client) {
  res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
  res.write(`data: ${JSON.stringify(client.admin ? { orders: [...orders.values()].map(ownerOrder) } : client.initial)}\n\n`);
  clients.add({ ...client, req, res });
  const ping = setInterval(() => { if (client.admin && !isAdmin(req)) res.end(); else res.write(': ping\n\n'); }, 25000);
  req.on('close', () => { clearInterval(ping); for (const item of clients) if (item.res === res) clients.delete(item); });
}
