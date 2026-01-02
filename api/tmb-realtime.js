// TMB real-time bus arrivals proxy for Vercel — provides real-time bus arrival data at stops
async function getJson(url) {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'OpenLocalMap-Proxy/1.0', 'Accept': 'application/json' },
      signal: AbortSignal.timeout(30000) // 30 second timeout
    });

    if (!response.ok) {
      return { status: response.status, json: null };
    }

    const json = await response.json();
    return { status: response.status, json };
  } catch (err) {
    throw new Error('Request failed: ' + err.message);
  }
}

// Vercel API endpoint for TMB real-time bus data
export default async function (req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    // Use TMB iTransit API for real-time bus arrivals at stops
    const appId = process.env.TMB_APP_ID || '8029906b';
    const appKey = process.env.TMB_APP_KEY || '73b5ad24d1db9fa24988bf134a1523d1';

    // Get stop ID from query or use Pl. Catalunya (108) as default
    const stopId = req.query.stopId || '108';

    // Use the TMB iTransit endpoint for bus stop arrivals as specified
    const tmbUrl = `https://api.tmb.cat/v1/itransit/bus/parades/${stopId}?app_id=${appId}&app_key=${appKey}`;

    console.log('TMB API URL:', tmbUrl); // Debug logging

    const result = await getJson(tmbUrl);
    if (result.status && result.status >= 200 && result.status < 300) {
      return res.status(200).json(result.json);
    } else {
      return res.status(result.status || 502).json({ error: 'TMB iTransit upstream error', status: result.status });
    }
  } catch (err) {
    console.error('TMB iTransit proxy error:', err);
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(500).json({ error: 'TMB iTransit proxy failed', message: err.message });
  }
};
