import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

// Dev-only endpoint: lets the in-browser render engine save exported files
// into build-out/ (used for scripted full-pack exports).
function saveEndpoint() {
  return {
    name: 'save-endpoint',
    configureServer(server) {
      server.middlewares.use('/__save', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          return res.end('POST only');
        }
        const rel = new URL(req.url, 'http://localhost').searchParams.get('path') || '';
        const outRoot = path.resolve(server.config.root, 'build-out');
        const target = path.resolve(outRoot, rel);
        if (!target.startsWith(outRoot + path.sep)) {
          res.statusCode = 400;
          return res.end('bad path');
        }
        fs.mkdirSync(path.dirname(target), { recursive: true });
        const chunks = [];
        req.on('data', (c) => chunks.push(c));
        req.on('end', () => {
          fs.writeFileSync(target, Buffer.concat(chunks));
          res.end('ok');
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), saveEndpoint()],
  // strictPort: never silently hop to 5174/5175 — fail loudly if 5173 is taken,
  // so the app always lives at http://localhost:5173
  server: { port: 5173, strictPort: true },
  preview: { port: 5173, strictPort: true },
});
