import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleApi, loadOrders, mediaPath } from './order-api.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.webm': 'video/webm',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

// Serve only public site files, including byte ranges for music/video seeking.
export function createSiteServer() {
  return createServer(async (request, response) => {
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(request.url, 'http://site.invalid').pathname);
    } catch {
      response.writeHead(400).end('Bad request');
      return;
    }
    if (await handleApi(request, response, pathname, new URL(request.url, `http://${request.headers.host || 'localhost'}`))) return;
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(405, { Allow: 'GET, HEAD' }).end();
      return;
    }
    if (pathname === '/') pathname = '/index.html';
    if (pathname === '/admin' || pathname === '/admin/') pathname = '/admin.html';
    if (/^\/thu\/[A-Za-z0-9_-]{12}$/.test(pathname)) pathname = '/index.html';
    const mediaFile = mediaPath(pathname);
    const allowed = ['/index.html', '/admin.html', '/favicon.svg'].includes(pathname)
      || /^\/(assets|styles)\//.test(pathname)
      || /^\/scripts\/[a-z-]+\.js$/.test(pathname) || Boolean(mediaFile);
    const file = mediaFile || resolve(root, `.${pathname}`);
    if (!allowed || (!mediaFile && !file.startsWith(root + sep)) || !contentTypes[extname(file)]) {
      response.writeHead(404).end('Not found');
      return;
    }

    let info;
    try {
      info = await stat(file);
      if (!info.isFile()) throw new Error('Not a file');
    } catch {
      response.writeHead(404).end('Not found');
      return;
    }

    const headers = {
      'Content-Type': contentTypes[extname(file)],
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...(mediaFile ? { 'Content-Security-Policy': "default-src 'none'; sandbox", 'Content-Disposition': 'inline' } : {}),
    };
    let start = 0;
    let end = info.size - 1;
    const range = request.headers.range;
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (match && (match[1] || match[2])) {
        if (match[1]) {
          start = Number(match[1]);
          end = match[2] ? Math.min(Number(match[2]), end) : end;
        } else {
          start = Math.max(0, info.size - Number(match[2]));
        }
      }
      if (!match || (!match[1] && !match[2]) || start > end || start >= info.size
          || (match[1] === '' && Number(match[2]) === 0)) {
        response.writeHead(416, { ...headers, 'Content-Range': `bytes */${info.size}` }).end();
        return;
      }
      headers['Content-Range'] = `bytes ${start}-${end}/${info.size}`;
    }
    headers['Content-Length'] = end - start + 1;
    response.writeHead(range ? 206 : 200, headers);
    if (request.method === 'HEAD') {
      response.end();
      return;
    }
    createReadStream(file, { start, end }).on('error', () => response.destroy()).pipe(response);
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3000);
  const server = createSiteServer();
  server.on('error', error => {
    console.error(error.message);
    process.exitCode = 1;
  });
  loadOrders().then(() => server.listen(port, '0.0.0.0', () => console.log(`Yêu thương gửi bạn: http://localhost:${server.address().port}`))).catch(error => { console.error(error); process.exitCode = 1; });
}
