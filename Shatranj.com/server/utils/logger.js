/**
 * Structured logging — single place to swap Winston/Pino later.
 */

const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };

function getLevel() {
  const env = (process.env.LOG_LEVEL || 'info').toLowerCase();
  return LOG_LEVELS[env] ?? LOG_LEVELS.info;
}

function formatMessage(level, message, meta) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    message,
    ...(meta && Object.keys(meta).length ? { meta } : {}),
  };
  return JSON.stringify(entry);
}

function log(level, message, meta) {
  if (LOG_LEVELS[level] > getLevel()) return;
  const line = formatMessage(level, message, meta);
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

module.exports = {
  error: (message, meta) => log('error', message, meta),
  warn: (message, meta) => log('warn', message, meta),
  info: (message, meta) => log('info', message, meta),
  debug: (message, meta) => log('debug', message, meta),
};
