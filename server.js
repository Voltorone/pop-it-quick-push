const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;
const htmlPath = path.join(__dirname, 'mobile-preview.html');

const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="120" fill="#f5a3c7"/>
  <rect x="56" y="106" width="400" height="300" rx="130" fill="#e8aa74" stroke="#b57138" stroke-width="18"/>
  <circle cx="176" cy="196" r="38" fill="#4eff5e" stroke="#ffffff" stroke-width="8"/>
  <circle cx="256" cy="196" r="38" fill="#f4c28c" stroke="#b57138" stroke-width="8"/>
  <circle cx="336" cy="196" r="38" fill="#f4c28c" stroke="#b57138" stroke-width="8"/>
  <circle cx="136" cy="276" r="38" fill="#f4c28c" stroke="#b57138" stroke-width="8"/>
  <circle cx="216" cy="276" r="38" fill="#ffbe0b" stroke="#ffffff" stroke-width="8"/>
  <circle cx="296" cy="276" r="38" fill="#f4c28c" stroke="#b57138" stroke-width="8"/>
  <circle cx="376" cy="276" r="38" fill="#00f5d4" stroke="#ffffff" stroke-width="8"/>
</svg>`;

const manifestJson = JSON.stringify({
  name: 'ALE-POP Quick Push',
  short_name: 'ALE-POP',
  description: 'Consola Pop-It electrónica con niveles infinitos aleatorios',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  background_color: '#1c1226',
  theme_color: '#f5a3c7',
  orientation: 'portrait',
  icons: [
    {
      src: '/icon.svg',
      sizes: 'any',
      type: 'image/svg+xml',
      purpose: 'any maskable',
    },
  ],
});

const serviceWorkerJs = `
const CACHE_NAME = 'alepop-v1';
const ASSETS = ['/', '/manifest.json', '/icon.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request))
  );
});
`;

const server = http.createServer((req, res) => {
  if (req.url === '/ALE-POP-QuickPush.apk') {
    const apkPath = path.join(__dirname, 'ALE-POP-QuickPush.apk');
    if (fs.existsSync(apkPath)) {
      const apkBuf = fs.readFileSync(apkPath);
      res.writeHead(200, {
        'Content-Type': 'application/vnd.android.package-archive',
        'Content-Disposition': 'attachment; filename="ALE-POP-QuickPush.apk"',
        'Content-Length': apkBuf.length,
      });
      res.end(apkBuf);
      return;
    }
  }
  if (req.url === '/manifest.json') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(manifestJson);
    return;
  }
  if (req.url === '/icon.svg') {
    res.writeHead(200, { 'Content-Type': 'image/svg+xml; charset=utf-8' });
    res.end(iconSvg);
    return;
  }
  if (req.url === '/sw.js') {
    res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
    res.end(serviceWorkerJs);
    return;
  }

  fs.readFile(htmlPath, 'utf8', (err, content) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Error cargando la app');
      return;
    }
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache',
    });
    res.end(content);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor movil PWA activo en http://10.184.190.176:${PORT}`);
});
