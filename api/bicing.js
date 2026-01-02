// Bicing proxy for Vercel — ensures CORS headers are always present
async function getJson(url, token) {
  try {
    // Create AbortController for timeout (more compatible than AbortSignal.timeout)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'OpenLocalMap-Proxy/1.0',
        'Accept': 'application/json',
        'X-Auth-Token': token
      },
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

// Vercel API endpoint for Bicing
export default async function (req, res) {
  // Set CORS headers first
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    const bicingUrl = 'https://opendata-ajuntament.barcelona.cat/data/dataset/6aa3416d-ce1a-494d-861b-7bd07f069600/resource/1b215493-9e63-4a12-8980-2d7e0fa19f85/download';
    const token = 'bacb0a6a4a847aa4ef512d28f9599f28e9e135d12ee6dc805fcae008a49844f8';

    const result = await getJson(bicingUrl, token);
    if (result.status && result.status >= 200 && result.status < 300) {
      return res.status(200).json(result.json);
    } else {
      return res.status(result.status || 502).json({ error: 'Bicing upstream error', status: result.status });
    }
  } catch (err) {
    console.error('Bicing proxy error:', err);
    return res.status(500).json({ error: 'Bicing proxy failed', message: err.message });
  }
};
