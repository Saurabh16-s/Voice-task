const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const { requireAuth } = require('./middleware/auth');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const skipInTests = () => config.env === 'test';
const apiLimiter = rateLimit({ windowMs: 60 * 1000, limit: 100, standardHeaders: true, legacyHeaders: false, skip: skipInTests });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false, skip: skipInTests });

const app = express();
app.use(helmet());
app.use(cors({ origin: config.clientOrigins }));
app.use(express.json({ limit: '100kb' }));

app.get('/health', (req, res) => res.json({ ok: true }));
app.use('/api', apiLimiter);
app.use('/api/auth', authLimiter, require('./routes/auth'));
app.use('/api/tasks', requireAuth, require('./routes/tasks'));

app.use(notFound);
app.use(errorHandler);

module.exports = app;
