// RENFE proxy for Vercel (CommonJS) — ensures CORS headers are always present
module.exports = async function (req, res) {
  // Always set CORS headers early
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const renfeUrl = 'https://gtfsrt.renfe.com/vehicle_positions.json';
    const response = await fetch(renfeUrl, {
      headers: { 'User-Agent': 'OpenLocalMap-Vercel-Proxy/1.0', 'Accept': 'application/json' }
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      return res.status(response.status).json({ error: 'RENFE API error', status: response.status, message: text });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (err) {
    console.error('RENFE proxy error:', err);
    // Ensure CORS on error responses
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(500).json({ error: 'RENFE proxy failed', message: err.message });
  }
};
