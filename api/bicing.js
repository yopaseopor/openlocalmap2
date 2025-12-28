// Bicing proxy for Vercel (CommonJS) — ensures CORS headers are always present
const https = require('https');

function getJson(url, token) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'OpenLocalMap-Proxy/1.0',
        'Accept': 'application/json',
        'X-Auth-Token': token
      }
    };

    const req = https.get(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, json });
        } catch (err) {
          reject(new Error('Invalid JSON from upstream: ' + err.message));
        }
      });
    });
    req.on('error', (err) => reject(err));
    req.setTimeout(30000, () => { req.abort(); reject(new Error('Upstream timeout')); });
  });
}

module.exports = async function (req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const bicingUrl = 'https://opendata-ajuntament.barcelona.cat/data/dataset/6aa3416d-ce1a-494d-861b-7bd07f069600/resource/1b215493-9e63-4a12-8980-2d7e0fa19f85/download';
    const token = 'bacb0a6a4a847aa4ef512d28f9599f28e9e135d12ee6dc805fcae008a49844f8';

    const result = await getJson(bicingUrl, token);
    if (result.status && result.status >= 200 && result.status < 300) {
      return res.status(200).json(result.json);
    } else {
      return res.status(result.status || 502).json({ error: 'Bicing upstream error', status: result.status });
    }
  } catch (err) {
    console.error('Bicing proxy error:', err);
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(500).json({ error: 'Bicing proxy failed', message: err.message });
  }
};
