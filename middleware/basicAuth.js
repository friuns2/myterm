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

function isLocalhost(req) {
  const host = (req.headers && req.headers.host) || '';
  const remote = req.socket && (req.socket.remoteAddress || req.socket.remoteAddress === '' ? req.socket.remoteAddress : '');
  
  // Check if this is a tunnel URL (external domain)
  const isTunnelUrl = typeof host === 'string' && (
    host.includes('.pinggy.io') || 
    host.includes('.pinggy.link') || 
    host.includes('.ngrok.io') || 
    host.includes('.localtunnel.me') ||
    host.includes('.serveo.net') ||
    // Add other common tunnel domains as needed
    /\.[a-z]+\.(io|me|net|com|link)$/i.test(host)
  );
  
  // If it's a tunnel URL, require authentication
  if (isTunnelUrl) {
    return false;
  }
  
  // Accept typical localhost patterns
  const isLocalHostHeader = typeof host === 'string' && (/^(localhost|127\.0\.0\.1)(:\d+)?$/i).test(host.trim());
  const isLoopback = typeof remote === 'string' && (remote === '::1' || remote === '127.0.0.1');
  return isLocalHostHeader || isLoopback;
}

function basicAuthMiddleware(req, res, next) {
  // Bypass auth for localhost
  if (isLocalhost(req)) return next();

  if (isAuthorized(req.headers.authorization)) {
    return next();
  }
  res.setHeader('WWW-Authenticate', 'Basic realm="myshell", charset="UTF-8"');
  res.status(401).send('Authentication required');
}

function rejectUpgradeIfUnauthorized(req, socket) {
  // Bypass auth for localhost websocket upgrades
  try {
    if (isLocalhost(req)) {
      return false; // do not reject
    }
  } catch (_) {}

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


