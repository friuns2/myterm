const { URL } = require('url');

function isAuthConfigured() {
  return Boolean(
    process.env.MYSHELL_API_KEY ||
      (process.env.MYSHELL_USERNAME && process.env.MYSHELL_PASSWORD)
  );
}

function getBasicAuthHeaderParts(authorizationHeader) {
  if (!authorizationHeader || typeof authorizationHeader !== 'string') {
    return null;
  }
  const [scheme, encoded] = authorizationHeader.split(' ');
  if (!scheme || scheme.toLowerCase() !== 'basic' || !encoded) {
    return null;
  }
  try {
    const decoded = Buffer.from(encoded, 'base64').toString('utf8');
    const idx = decoded.indexOf(':');
    if (idx === -1) return null;
    const username = decoded.slice(0, idx);
    const password = decoded.slice(idx + 1);
    return { username, password };
  } catch (_e) {
    return null;
  }
}

function checkBasicAuth(headers) {
  const configuredUsername = process.env.MYSHELL_USERNAME;
  const configuredPassword = process.env.MYSHELL_PASSWORD;
  if (!configuredUsername || !configuredPassword) {
    return false;
  }
  const creds = getBasicAuthHeaderParts(headers.authorization || headers.Authorization);
  if (!creds) return false;
  return creds.username === configuredUsername && creds.password === configuredPassword;
}

function extractBearerToken(headers) {
  const auth = headers.authorization || headers.Authorization;
  if (!auth || typeof auth !== 'string') return null;
  const [scheme, token] = auth.split(' ');
  if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) return null;
  return token.trim();
}

function checkApiKey(headers, urlString) {
  const configuredKey = process.env.MYSHELL_API_KEY;
  if (!configuredKey) return false;

  // Priority: explicit header, then bearer token, then URL "token" query param
  const headerKey = headers['x-api-key'] || headers['X-API-Key'] || headers['x-apiKey'];
  if (headerKey && String(headerKey).trim() === configuredKey) return true;

  const bearer = extractBearerToken(headers);
  if (bearer && bearer === configuredKey) return true;

  if (urlString) {
    try {
      const u = new URL(urlString, 'http://localhost');
      const qp = u.searchParams.get('token');
      if (qp && qp === configuredKey) return true;
    } catch (_e) {
      // ignore URL parse errors
    }
  }

  return false;
}

function isAuthorized(headers, urlString) {
  if (!isAuthConfigured()) return true; // auth disabled
  return checkApiKey(headers, urlString) || checkBasicAuth(headers);
}

function authMiddleware(req, res, next) {
  if (!isAuthConfigured()) return next();
  if (isAuthorized(req.headers, req.url)) return next();
  res.setHeader('WWW-Authenticate', 'Basic realm="myshell"');
  return res.status(401).json({ error: 'Unauthorized' });
}

function isAuthorizedWebsocket(req) {
  // For websockets, we only have headers and the request URL (which may include a token query param)
  return isAuthorized(req.headers, req.url);
}

module.exports = {
  authMiddleware,
  isAuthorizedWebsocket,
  isAuthConfigured,
};


