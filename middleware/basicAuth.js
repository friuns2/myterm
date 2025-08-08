const crypto = require('crypto');

const USERNAME = 'friuns';
const PASSWORD = 'er54s4';

function isAuthorized(authHeader) {
  if (!authHeader || typeof authHeader !== 'string') return false;
  const [scheme, credentials] = authHeader.split(' ');
  if (!scheme || scheme.toLowerCase() !== 'basic' || !credentials) return false;
  let decoded;
  try {
    decoded = Buffer.from(credentials, 'base64').toString('utf8');
  } catch (_) {
    return false;
  }
  const expected = `${USERNAME}:${PASSWORD}`;

  // Use timing-safe comparison
  const a = Buffer.from(decoded);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function basicAuthMiddleware(req, res, next) {
  if (isAuthorized(req.headers.authorization)) {
    return next();
  }
  res.setHeader('WWW-Authenticate', 'Basic realm="myshell", charset="UTF-8"');
  res.status(401).send('Authentication required');
}

function rejectUpgradeIfUnauthorized(req, socket) {
  if (isAuthorized(req.headers['authorization'])) {
    return false; // do not reject
  }
  try {
    socket.write(
      'HTTP/1.1 401 Unauthorized\r\n' +
        'Connection: close\r\n' +
        'WWW-Authenticate: Basic realm="myshell", charset="UTF-8"\r\n' +
        '\r\n'
    );
  } catch (_) {
    // ignore
  } finally {
    try { socket.destroy(); } catch (_) {}
  }
  return true; // rejected
}

module.exports = { basicAuthMiddleware, rejectUpgradeIfUnauthorized };


