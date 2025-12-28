// TMB proxy for Vercel (CommonJS) — ensures CORS headers are always present
module.exports = async function (req, res) {
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

    let tmbUrl = `https://api.tmb.cat/v1/ibus/stops/nearby?app_id=${appId}&app_key=${appKey}&radius=${radius}`;
    if (lat && lon) tmbUrl += `&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`;

    const response = await fetch(tmbUrl, {
      headers: { 'User-Agent': 'OpenLocalMap-Vercel-Proxy/1.0', 'Accept': 'application/json' }
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      return res.status(response.status).json({ error: 'TMB API error', status: response.status, message: text });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (err) {
    console.error('TMB proxy error:', err);
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(500).json({ error: 'TMB proxy failed', message: err.message });
  }
};
