import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// Always listen on port 3000 to match internal Nginx reverse-proxy
const PORT = 3000;
const distPath = path.resolve(__dirname, 'dist');

// Health check endpoint for Cloud Run and monitoring
app.get('/healthz', (_req, res) => {
  res.status(200).send('OK');
});

// Serve pre-built static assets from dist
app.use(express.static(distPath, {
  maxAge: '1d',
  etag: true,
}));

// Fallback to index.html for client-side SPA routing
app.use((_req, res) => {
  const indexPath = path.resolve(distPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(200).send('Application build in progress. Please refresh in a moment.');
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running and listening on 0.0.0.0:${PORT}`);
});

