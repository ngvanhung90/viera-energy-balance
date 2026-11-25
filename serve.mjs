import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = new URL('./public/', import.meta.url);
const files = new Set([
  'index.html', 'app.css', 'sw.js', 'manifest.webmanifest', 'firebase-config.json',
  'src/main.js', 'src/catalog.js', 'src/planner.js', 'src/storage.js', 'src/ai.js',
  'src/locales.js', 'src/catalog-locales.js',
  'src/nearby.js', 'src/nearby-view.js', 'src/nearby-discovery.js',
  'vendor/firebase-app.js', 'vendor/firebase-app-check.js', 'vendor/firebase-ai.js',
  'assets/icon.png', 'assets/icon-large.png', 'assets/lemongrass.webp', 'assets/pasta.webp',
  'assets/soba.webp', 'assets/salmon.webp', 'assets/rolls.webp', 'assets/chickpea.webp', 'assets/living-movement.webp',
  'assets/edamame-rice.webp', 'assets/tofu-quinoa.webp', 'assets/egg-rice.webp', 'assets/lentil-salad.webp',
  'assets/tuna-potatoes.webp', 'assets/yogurt-oats.webp', 'assets/living-movement-home.webp'
]);
const types = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.webp': 'image/webp'
};
const port = Number(process.env.VIERA_PORT || 4173);
const server = createServer(async (request, response) => {
  const path = new URL(request.url, 'http://localhost').pathname.slice(1) || 'index.html';
  if (!['GET', 'HEAD'].includes(request.method) || !files.has(path)) {
    response.writeHead(404).end();
    return;
  }
  try {
    const contents = await readFile(fileURLToPath(new URL(path, root)));
    response.writeHead(200, {
      'Content-Type': types[extname(path)],
      'Content-Length': contents.length,
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin'
    }).end(request.method === 'HEAD' ? undefined : contents);
  } catch {
    response.writeHead(404).end();
  }
});
server.listen(port, '127.0.0.1', () => console.log(`Viera Energy Balance at http://127.0.0.1:${server.address().port}`));
