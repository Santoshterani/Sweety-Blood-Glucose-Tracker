const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const config = require('./config');
const { SLOTS } = require('./utils/slots');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

app.use(helmet());
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Lets the frontend build its dropdown from one source of truth.
app.get('/api/slots', (req, res) => res.json({ slots: SLOTS }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/readings', require('./routes/readings'));
app.use('/api/reports', require('./routes/reports'));

app.use(notFound);
app.use(errorHandler);

module.exports = app;
