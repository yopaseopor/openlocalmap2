// TMB stops data proxy for Vercel — provides stops information
module.exports = async function (req, res) {
  try {
    // Set CORS headers first
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }

    console.log('TMB stops API called successfully');

    const appId = process.env.TMB_APP_ID || '8029906b';
    const appKey = process.env.TMB_APP_KEY || '73b5ad24d1db9fa24988bf134a1523d1';

    // Use TMB transit parades endpoint for stops information
    const tmbUrl = `https://api.tmb.cat/v1/transit/parades?app_id=${appId}&app_key=${appKey}`;

    console.log('TMB stops API URL:', tmbUrl);

    const response = await fetch(tmbUrl, {
      headers: { 'User-Agent': 'OpenLocalMap-Proxy/1.0', 'Accept': 'application/json' }
    });

    console.log('TMB API response status:', response.status);

    if (!response.ok) {
      // Set CORS headers again for error response
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(response.status).json({ 
        error: 'TMB stops upstream error', 
        status: response.status, 
        upstreamError: true 
      });
    }

    const jsonData = await response.json();
    console.log('TMB API response received successfully');

    // Set CORS headers again for success response
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json(jsonData);

  } catch (err) {
    console.error('TMB stops proxy error:', err);
    // Set CORS headers for error response
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(500).json({ 
      error: 'TMB stops proxy failed', 
      message: err.message, 
      proxyError: true 
    });
  }
};
