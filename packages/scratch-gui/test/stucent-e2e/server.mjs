/**
 * A tiny static server for the bridge end-to-end check (run.mjs).
 * `node server.mjs <port> <dir> [<mount path>] [<frame ancestor origin>]`
 *
 * It sends what a StuCent deployment should send for the editor: CORS open to
 * any origin (the editor runs in a sandboxed iframe, so its origin is opaque
 * and every fetch of its own files is cross-origin) and a frame-ancestors
 * policy naming the host page.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const [port, dir, mount = '/', ancestor = ''] = process.argv.slice(2);
const root = path.resolve(dir);

const TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.jpg': 'image/jpeg',
    '.wav': 'audio/wav',
    '.mp3': 'audio/mpeg',
    '.ttf': 'font/ttf',
    '.otf': 'font/otf',
    '.woff2': 'font/woff2',
    '.json': 'application/json',
    '.txt': 'text/plain; charset=utf-8'
};

http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (!url.pathname.startsWith(mount)) {
        res.writeHead(404).end();
        return;
    }
    let rel = decodeURIComponent(url.pathname.slice(mount.length));
    if (rel === '' || rel.endsWith('/')) rel += 'index.html';
    const file = path.resolve(root, rel);
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404).end();
        return;
    }
    const headers = {
        'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store'
    };
    if (ancestor) headers['Content-Security-Policy'] = `frame-ancestors ${ancestor}`;
    res.writeHead(200, headers);
    fs.createReadStream(file).pipe(res);
}).listen(Number(port), '127.0.0.1');
