import express from 'express';

const app = express();
app.use(express.json({ limit: '1mb' }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'nexora-publishing-platform' });
});

// Auth placeholder (real implementation comes next phase)
app.post('/api/auth/login', (req, res) => {
  return res.status(501).json({ error: 'Not implemented yet' });
});

// Draft placeholder
app.post('/api/drafts', (req, res) => {
  return res.status(501).json({ error: 'Not implemented yet' });
});

// Publish placeholder
app.post('/api/publish', (req, res) => {
  return res.status(501).json({ error: 'Not implemented yet' });
});

const port = process.env.PORT ? Number(process.env.PORT) : 3000;
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`API server listening on ${port}`);
});

