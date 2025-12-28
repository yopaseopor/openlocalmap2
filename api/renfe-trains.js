// Vercel serverless function to proxy RENFE GTFS-RT JSON endpoint

const fetch = require('node-fetch');

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

    const response = await fetch(renfeUrl, {
      headers: {
        'User-Agent': 'OpenLocalMap-Vercel-Proxy/1.0',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.error('RENFE API error:', response.status, text);
      return res.status(response.status).json({
        error: 'RENFE API error',
        status: response.status,
        message: text
      });
    }

    const data = await response.json();
    res.status(200).json(data);
  } catch (err) {
    console.error('❌ RENFE proxy error:', err.message);
    res.status(500).json({
      error: 'RENFE proxy failed',
      message: err.message
    });
  }
};
