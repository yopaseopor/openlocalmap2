// TMB stops data proxy for Vercel — provides stops information
async function getJson(url) {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'OpenLocalMap-Proxy/1.0', 'Accept': 'application/json' }
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

// Vercel API endpoint for TMB stops
export default async function (req, res) {
  // Set CORS headers first
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    const appId = process.env.TMB_APP_ID || '8029906b';
    const appKey = process.env.TMB_APP_KEY || '73b5ad24d1db9fa24988bf134a1523d1';

    // Use TMB transit parades endpoint for stops information
    const tmbUrl = `https://api.tmb.cat/v1/transit/parades?app_id=${appId}&app_key=${appKey}`;

    console.log('TMB stops API URL:', tmbUrl);

    const result = await getJson(tmbUrl);
    if (result.status && result.status >= 200 && result.status < 300) {
      return res.status(200).json(result.json);
    } else {
      // Return 200 even for upstream errors to avoid CORS issues with error responses
      return res.status(200).json({ error: 'TMB stops upstream error', status: result.status, upstreamError: true });
    }
  } catch (err) {
    console.error('TMB stops proxy error:', err);
    // Return 200 even for proxy errors to avoid CORS issues with error responses
    return res.status(200).json({ error: 'TMB stops proxy failed', message: err.message, proxyError: true });
  }
};
