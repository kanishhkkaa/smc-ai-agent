const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const chatRouter = require('./routes/chat');
const cache = require('./cache');

app.use('/api/chat', chatRouter);

// ── Health check ─────────────────────────────────
app.get('/', (req, res) => {
  res.send('SMC Agent Backend is running ✅');
});

// ── Cache monitoring ─────────────────────────────
// GET /api/cache/stats → see hit rate, key count
app.get('/api/cache/stats', (req, res) => {
  res.json(cache.getStats());
});

// POST /api/cache/flush → clear all caches (use when new data arrives)
app.post('/api/cache/flush', (req, res) => {
  cache.flushAll();
  res.json({ message: 'All caches flushed ✅', timestamp: new Date().toISOString() });
});

// ── Start server ─────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Cache stats: http://localhost:${PORT}/api/cache/stats\n`);
});