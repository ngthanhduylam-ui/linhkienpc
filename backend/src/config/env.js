const path = require('path');
const dotenv = require('dotenv');

const envPath = path.resolve(__dirname, '../../.env');
const backendRoot = path.resolve(__dirname, '../..');
dotenv.config({ path: envPath });

const required = [
  'PORT',
  'DB_HOST',
  'DB_PORT',
  'DB_NAME',
  'DB_USER',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET'
];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  host: process.env.HOST || '127.0.0.1',
  port: Number(process.env.PORT || 3000),
  timezone: process.env.APP_TIMEZONE || 'Asia/Ho_Chi_Minh',
  productUploads: {
    root: path.resolve(backendRoot, process.env.PRODUCT_UPLOAD_ROOT || 'uploads/products'),
    maxFileBytes: Number(process.env.PRODUCT_IMAGE_MAX_BYTES || 15 * 1024 * 1024),
    maxImages: Math.min(3, Number(process.env.PRODUCT_IMAGE_MAX_COUNT || 3))
  },
  db: {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    name: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || '',
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10)
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d'
  },
  seed: {
    adminUsername: process.env.DEFAULT_ADMIN_USERNAME || 'admin',
    adminPassword: process.env.DEFAULT_ADMIN_PASSWORD,
    adminDisplayName: process.env.DEFAULT_ADMIN_DISPLAY_NAME || 'System Admin'
  }
};
