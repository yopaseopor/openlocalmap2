// RENFE proxy for Vercel (CommonJS) — ensures CORS headers are always present
module.exports = async function (req, res) {
  // Quick health-check handler for debugging Vercel invocation and CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    // Return a minimal JSON to verify function invocation and headers
    return res.status(200).json({ ok: true, proxy: 'renfe', timestamp: new Date().toISOString() });
  } catch (err) {
    console.error('RENFE health-check error:', err);
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(500).json({ error: 'RENFE health-check failed', message: err.message });
  }
};
