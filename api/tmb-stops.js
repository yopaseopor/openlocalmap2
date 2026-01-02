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
  // Set CORS headers IMMEDIATELY - before any other logic
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,OPTIONS,POST,PUT,DELETE',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With'
  };
  
  // Set each header individually to ensure they're applied
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  // Handle preflight requests
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
      // Ensure CORS headers are set again before sending success response
      Object.entries(corsHeaders).forEach(([key, value]) => {
        res.setHeader(key, value);
      });
      return res.status(200).json(result.json);
    } else {
      // Ensure CORS headers are set again before sending error response
      Object.entries(corsHeaders).forEach(([key, value]) => {
        res.setHeader(key, value);
      });
      return res.status(result.status || 500).json({ 
        error: 'TMB stops upstream error', 
        status: result.status, 
        upstreamError: true 
      });
    }
  } catch (err) {
    console.error('TMB stops proxy error:', err);
    // Ensure CORS headers are set again before sending error response
    Object.entries(corsHeaders).forEach(([key, value]) => {
      res.setHeader(key, value);
    });
    return res.status(500).json({ 
      error: 'TMB stops proxy failed', 
      message: err.message, 
      proxyError: true 
    });
  }
};
