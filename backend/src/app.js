const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const env = require('./config/env');
const AppError = require('./utils/AppError');
const routes = require('./routes');
const notFound = require('./middlewares/notFound');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

// Nginx proxies to the backend over loopback and supplies X-Forwarded-For.
app.set('trust proxy', 'loopback');

app.use(helmet());
app.use(cors({
  credentials: true,
  origin(origin, callback) {
    if (!origin || env.auth.allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new AppError('Origin is not allowed.', 403, 'CORS_ORIGIN_NOT_ALLOWED'));
  }
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.use('/api/v1', routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
