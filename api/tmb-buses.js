// Vercel serverless function to proxy TMB iBus API requests
// Supports using environment variables TMB_APP_ID and TMB_APP_KEY

const https = require('https');

const makeRequest = (url) => {
  return new Promise((resolve, reject) => {
    https.get(url, { timeout: 10000 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    }).on('error', reject);
  });
};

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const appId = process.env.TMB_APP_ID || '8029906b';
    const appKey = process.env.TMB_APP_KEY || '73b5ad24d1db9fa24988bf134a1523d1';
    const radius = req.query.radius || '1000';
    const lat = req.query.lat;
    const lon = req.query.lon;

    // If lat/lon provided, use nearby endpoint; otherwise use a stable parades endpoint
    let tmbUrl;
    if (lat && lon) {
      tmbUrl = `https://api.tmb.cat/v1/ibus/stops/nearby?app_id=${appId}&app_key=${appKey}&radius=${radius}&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`;
    } else {
      // Default to a known stop endpoint (parades/108) which does not require lat/lon
      tmbUrl = `https://api.tmb.cat/v1/itransit/bus/parades/108?app_id=${appId}&app_key=${appKey}`;
    }

    console.log('🚍 TMB proxy request to:', tmbUrl);

    const response = await makeRequest(tmbUrl);

    if (response.status !== 200) {
      console.error('TMB API error:', response.status, response.data);
      return res.status(response.status).json({
        error: 'TMB API error',
        status: response.status,
        message: response.data
      });
    }

    const data = JSON.parse(response.data);
    res.status(200).json(data);
  } catch (err) {
    console.error('❌ TMB proxy error:', err && err.message ? err.message : err);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(500).json({
      error: 'TMB proxy failed',
      message: err && err.message ? err.message : String(err)
    });
  }
};
