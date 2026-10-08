import express from 'express';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { extname, join } from 'node:path';

const dist = fileURLToPath(new URL('./dist/', import.meta.url));
if (!existsSync(join(dist, 'index.html'))) {
  throw new Error('Production build missing. Run npm run build before npm start.');
}

const app = express();
app.disable('x-powered-by');
app.use(express.static(dist));
// React Router handles page URLs. Missing assets should remain real 404s.
app.get('/{*path}', (req, res, next) => {
  if (extname(req.path) || req.path.split('/').some(part => part.startsWith('.')) || !req.accepts('html')) return next();
  res.sendFile(join(dist, 'index.html'));
});

// GoDaddy supplies the runtime port; 3000 is only the local fallback.
const port = process.env.PORT || 3000;
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`Zomora's Corner listening on 0.0.0.0:${server.address().port}`);
});

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000).unref();
  });
}
