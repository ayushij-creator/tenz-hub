const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_KEY;

app.set('trust proxy', 1);
app.use(express.json({ limit: '10kb' }));
app.use(express.static(path.join(__dirname, 'public')));

function sbHeaders(extra = {}) {
  const h = { apikey: SB_KEY, 'Content-Type': 'application/json', ...extra };
  if (SB_KEY && SB_KEY.startsWith('eyJ')) h.Authorization = `Bearer ${SB_KEY}`;
  return h;
}

// small rate limit: 5 submissions per key per 10 minutes
const hits = new Map();
function limited(key) {
  const now = Date.now();
  const list = (hits.get(key) || []).filter(t => now - t < 10 * 60 * 1000);
  list.push(now);
  hits.set(key, list);
  return list.length > 5;
}

const RANKS = ['Unranked','Iron','Bronze','Silver','Gold','Platinum','Diamond','Ascendant','Immortal','Radiant'];
const clean = (v, max) => String(v ?? '').trim().slice(0, max);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// returns 'ok' | 'duplicate' | 'error'
async function saveSubscriber(email, source) {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/newsletter_subscribers`, {
      method: 'POST',
      headers: sbHeaders({ Prefer: 'return=minimal' }),
      body: JSON.stringify({ email, source })
    });
    if (r.status === 409) return 'duplicate';
    if (!r.ok) { console.error('Newsletter error:', r.status, await r.text()); return 'error'; }
    return 'ok';
  } catch (e) { console.error(e); return 'error'; }
}

app.get('/health', (req, res) => res.json({ ok: true, db: Boolean(SB_URL && SB_KEY) }));

app.get('/api/squad', async (req, res) => {
  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/squad_members?select=gamertag,rank,agent&order=created_at.desc&limit=30`,
      { headers: sbHeaders() }
    );
    if (!r.ok) throw new Error('db');
    res.json(await r.json());
  } catch {
    res.status(500).json({ error: 'Could not load the Squad Wall.' });
  }
});

app.post('/api/squad', async (req, res) => {
  const b = req.body || {};

  // honeypot: bots fill the hidden field. Pretend success, store nothing.
  if (clean(b.website, 100)) return res.json({ ok: true });

  if (limited('squad:' + req.ip)) return res.status(429).json({ error: 'Too many tries. Please wait a few minutes.' });

  const gamertag = clean(b.gamertag, 24);
  const email = clean(b.email, 120).toLowerCase();
  const rank = clean(b.rank, 20);
  const agent = clean(b.agent, 30);
  const clip = clean(b.clip, 200);
  const message = clean(b.message, 500);
  const wantsNews = b.newsletter === 'on' || b.newsletter === true;

  if (gamertag.length < 2) return res.status(400).json({ error: 'Gamertag must be at least 2 characters.' });
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Enter a valid email.' });
  if (!RANKS.includes(rank)) return res.status(400).json({ error: 'Pick a rank.' });
  if (agent.length < 2) return res.status(400).json({ error: 'Enter your favorite agent.' });
  if (clip && !/^https?:\/\//i.test(clip)) return res.status(400).json({ error: 'Clip link must start with http:// or https://' });

  if (!SB_URL || !SB_KEY) return res.status(500).json({ error: 'Server is not configured yet.' });

  try {
    const r = await fetch(`${SB_URL}/rest/v1/squad_members`, {
      method: 'POST',
      headers: sbHeaders({ Prefer: 'return=minimal' }),
      body: JSON.stringify({ gamertag, email, rank, agent, clip: clip || null, message: message || null })
    });
    if (r.status === 409) return res.status(409).json({ error: 'That email has already joined.' });
    if (!r.ok) {
      console.error('Supabase error:', r.status, await r.text());
      return res.status(500).json({ error: 'Could not save. Try again.' });
    }
    if (wantsNews) await saveSubscriber(email, 'squad');
    res.status(201).json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not save. Try again.' });
  }
});

app.post('/api/newsletter', async (req, res) => {
  const b = req.body || {};
  if (clean(b.website, 100)) return res.json({ ok: true }); // honeypot
  if (limited('news:' + req.ip)) return res.status(429).json({ error: 'Too many tries. Please wait a few minutes.' });

  const email = clean(b.email, 120).toLowerCase();
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Enter a valid email.' });
  if (!SB_URL || !SB_KEY) return res.status(500).json({ error: 'Server is not configured yet.' });

  const result = await saveSubscriber(email, 'footer');
  if (result === 'duplicate') return res.status(409).json({ error: 'You are already subscribed.' });
  if (result === 'error') return res.status(500).json({ error: 'Could not subscribe. Try again.' });
  res.status(201).json({ ok: true });
});

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));