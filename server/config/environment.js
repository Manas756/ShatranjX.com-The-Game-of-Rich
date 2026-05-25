/**
 * Validates and normalizes environment variables at boot — fail fast in production.
 */

const logger = require('../utils/logger');

const defaults = {
  NODE_ENV: 'development',
  PORT: '3000',
  CLIENT_URL: 'http://localhost:3000',
  SESSION_SECRET: 'dev-only-change-in-production',
  MAX_ROOMS: '10000',
  CORS_ORIGINS: 'http://localhost:3000',
};

function parseOrigins(value) {
  return value
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

function loadEnvironment() {
  const env = { ...defaults, ...process.env };

  const config = {
    nodeEnv: env.NODE_ENV,
    port: Number.parseInt(env.PORT, 10),
    clientUrl: env.CLIENT_URL,
    sessionSecret: env.SESSION_SECRET,
    maxRooms: Number.parseInt(env.MAX_ROOMS, 10),
    corsOrigins: parseOrigins(env.CORS_ORIGINS || env.CLIENT_URL),
    isProduction: env.NODE_ENV === 'production',
  };

  if (Number.isNaN(config.port) || config.port < 1 || config.port > 65535) {
    throw new Error(`Invalid PORT: ${env.PORT}`);
  }

  if (Number.isNaN(config.maxRooms) || config.maxRooms < 1) {
    throw new Error(`Invalid MAX_ROOMS: ${env.MAX_ROOMS}`);
  }

  if (config.isProduction && config.sessionSecret === defaults.SESSION_SECRET) {
    logger.warn('SESSION_SECRET is using default value in production');
  }

  return config;
}

let cached = null;

function getConfig() {
  if (!cached) {
    cached = loadEnvironment();
  }
  return cached;
}

module.exports = {
  loadEnvironment,
  getConfig,
};
