// TMB buses data proxy for Vercel — provides bus information
async function getJson(url) {
  try {
    // Create AbortController for timeout (more compatible than AbortSignal.timeout)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    const response = await fetch(url, {
      headers: { 'User-Agent': 'OpenLocalMap-Proxy/1.0', 'Accept': 'application/json' },
      signal: controller.signal
    });

    clearTimeout(timeoutId); // Clear timeout if request succeeds

    if (!response.ok) {
      return { status: response.status, json: null };
    }

    const json = await response.json();
    return { status: response.status, json };
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('Request timeout after 30 seconds');
    }
    throw new Error('Request failed: ' + err.message);
  }
}

// Vercel API endpoint for TMB buses
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
      return res.status(result.status || 502).json({ error: 'TMB stops upstream error', status: result.status });
    }
  } catch (err) {
    console.error('TMB stops proxy error:', err);
    return res.status(500).json({ error: 'TMB stops proxy failed', message: err.message });
  }
};
