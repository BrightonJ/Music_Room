const express = require('express');
const helmet = require('helmet');
const swaggerUi = require('swagger-ui-express');
const openapi = require('./docs/openapi');
const { globalLimiter } = require('./utils/rateLimiters');
const { activityLogger } = require('./middleware/activityLogger');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

if (process.env.TRUST_PROXY) {
  const value = process.env.TRUST_PROXY;
  app.set('trust proxy', /^\d+$/.test(value) ? Number(value) : value);
}

// API reference (subject V.4), mounted before helmet's API-oriented headers
app.get('/api-docs.json', (req, res) => res.json(openapi));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openapi, { customSiteTitle: 'Music Room API' }));

app.use(helmet());
app.use(express.json({ limit: '20kb' }));
app.use(globalLimiter);
app.use('/api', activityLogger);

app.use('/api', require('./routes/health'));
app.use('/api', require('./routes/auth'));
app.use('/api', require('./routes/profile'));
app.use('/api', require('./routes/friends'));
app.use('/api', require('./routes/events'));
app.use('/api', require('./routes/invitations'));
app.use('/api', require('./routes/devices'));
app.use('/api', require('./routes/search'));

app.use('/api', notFound);
app.use(errorHandler);

module.exports = { app };
