// Configurable CORS proxy for Vercel (ES modules) — allows proxying to whitelisted URLs
import https from 'https';
import http from 'http';
import { URL } from 'node:url';

// Whitelist of allowed domains/URLs (configurable)
const ALLOWED_DOMAINS = [
  // Add your allowed domains here
  'gtfsrt.renfe.com',
  'api.tmb.cat',
  'www.bicing.cat',
  // Add more domains as needed
];

// Function to check if URL is allowed
function isUrlAllowed(targetUrl) {
  try {
    const parsedUrl = new URL(targetUrl);
    const hostname = parsedUrl.hostname.toLowerCase();

    // Check if hostname is in allowed domains
    return ALLOWED_DOMAINS.some(domain => {
      return hostname === domain || hostname.endsWith('.' + domain);
    });
  } catch (err) {
    return false;
  }
}

// Function to proxy request
function proxyRequest(targetUrl, req, res) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(targetUrl);
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: req.method,
      headers: {
        'User-Agent': 'OpenLocalMap-CORS-Proxy/1.0',
        ...req.headers
      }
    };

    // Remove host header to avoid conflicts
    delete options.headers.host;

    const client = parsedUrl.protocol === 'https:' ? https : http;
    const proxyReq = client.request(options, (proxyRes) => {
      // Copy response headers
      Object.keys(proxyRes.headers).forEach(header => {
        if (header !== 'set-cookie' && header !== 'connection') {
          res.setHeader(header, proxyRes.headers[header]);
        }
      });

      // Set CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

      // Set status code
      res.status(proxyRes.statusCode);

      // Pipe response
      proxyRes.pipe(res);

      proxyRes.on('end', () => resolve());
    });

    proxyReq.on('error', (err) => {
      reject(err);
    });

    proxyReq.setTimeout(30000, () => {
      proxyReq.abort();
      reject(new Error('Upstream timeout'));
    });

    // Pipe request body if present
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      req.pipe(proxyReq);
    } else {
      proxyReq.end();
    }
  });
}

export default async function (req, res) {
  // Set CORS headers for all responses
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    // Get target URL from query parameter
    const { url: targetUrl } = req.query;

    if (!targetUrl) {
      return res.status(400).json({
        error: 'Missing URL parameter',
        message: 'Please provide a URL to proxy via ?url=<target-url>'
      });
    }

    // Validate URL format
    let parsedUrl;
    try {
      parsedUrl = new URL(targetUrl);
    } catch (err) {
      return res.status(400).json({
        error: 'Invalid URL format',
        message: 'The provided URL is not valid'
      });
    }

    // Check if URL is allowed
    if (!isUrlAllowed(targetUrl)) {
      return res.status(403).json({
        error: 'URL not allowed',
        message: 'The requested URL is not in the whitelist of allowed domains',
        allowedDomains: ALLOWED_DOMAINS
      });
    }

    // Proxy the request
    await proxyRequest(targetUrl, req, res);

  } catch (err) {
    console.error('CORS proxy error:', err);
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(500).json({
      error: 'Proxy failed',
      message: err.message
    });
  }
};
