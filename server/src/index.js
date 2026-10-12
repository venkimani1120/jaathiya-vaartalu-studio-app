require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const connectDB = require('./config/db');

const app = express();
app.set('trust proxy', 1); // behind Render/Koyeb proxy, needed for rate limiting
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: { directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'"],
    styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    fontSrc: ["'self'", 'https://fonts.gstatic.com'],
    imgSrc: ["'self'", 'data:', 'https://res.cloudinary.com'],
    connectSrc: ["'self'"]
  } }
}));
const origins = (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({ origin: (o, cb) => cb(null, !o || origins.includes(o)) }));
app.use(express.json({ limit: '2mb' }));

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/news', require('./routes/news'));
app.use('/api/uploads', require('./routes/uploads'));
app.use('/api/epapers', require('./routes/epapers'));
app.use('/api/public', require('./routes/public'));
app.use('/uploads', express.static(path.join(__dirname, '../uploads'), { maxAge: '7d' }));

// E-paper studio (editors) and public reader share one page; the server tells it where the API is.
const studioFile = path.join(__dirname, '../public/epaper-studio.html');
const studio = () => fs.readFileSync(studioFile, 'utf8').replace('<!--JV_CONFIG-->', '<script>window.JV_CONFIG={apiBase:"/api"}</script>');
app.get(['/studio', '/e/:slug'], (_req, res) => res.type('html').send(studio()));
app.get('/', (_req, res) => res.redirect('/studio'));

app.use((req, res) => res.status(404).json({ message: `Not found: ${req.method} ${req.path}` }));
app.use((err, _req, res, _next) => {
  if (err.name === 'ValidationError') return res.status(400).json({ message: Object.values(err.errors).map(e => e.message).join(' ') });
  if (err.name === 'CastError') return res.status(400).json({ message: 'Invalid id.' });
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ message: 'Each image must be under 6 MB.' });
  if (!err.status) console.error(err);
  res.status(err.status || 500).json({ message: err.status ? err.message : 'Server error. Try again.' });
});

const port = process.env.PORT || 4000;
connectDB().then(() => app.listen(port, () => console.log(`API on :${port}`)))
  .catch(e => { console.error('Startup failed:', e.message); process.exit(1); });
