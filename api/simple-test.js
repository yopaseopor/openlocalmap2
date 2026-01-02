// Simple CORS test endpoint - no external dependencies
module.exports = async function (req, res) {
  // Set CORS headers immediately
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST,PUT,DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  return res.status(200).json({ 
    message: 'CORS test successful',
    timestamp: new Date().toISOString(),
    method: req.method,
    headers: req.headers
  });
};
