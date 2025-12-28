// Vercel serverless function to proxy RENFE GTFS-RT JSON endpoint

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
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    const renfeUrl = 'https://gtfsrt.renfe.com/vehicle_positions.json';

    console.log('🚂 RENFE proxy request to:', renfeUrl);

    const response = await makeRequest(renfeUrl);

    if (response.status !== 200) {
      console.error('RENFE API error:', response.status, response.data);
      return res.status(response.status).json({
        error: 'RENFE API error',
        status: response.status,
        message: response.data
      });
    }

    const data = JSON.parse(response.data);
    res.status(200).json(data);
  } catch (err) {
    console.error('❌ RENFE proxy error:', err.message);
    res.status(500).json({
      error: 'RENFE proxy failed',
      message: err.message
    });
  }
};
