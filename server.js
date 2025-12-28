const express = require('express');
const path = require('path');
const app = express();
const https = require('https');
const { URL } = require('url');

// Helper to perform HTTPS GET and return { status, data }
function makeRequest(url, headers) {
  return new Promise((resolve, reject) => {
    try {
      const u = new URL(url);
      const options = {
        hostname: u.hostname,
        path: u.pathname + (u.search || ''),
        method: 'GET',
        headers: headers || {},
        timeout: 30000
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, data }));
      });

      req.on('error', (err) => reject(err));
      req.on('timeout', () => {
        req.destroy(new Error('Request timed out'));
      });
      req.end();
    } catch (err) {
      reject(err);
    }
  });
}

// Helper to set CORS headers on any response
function setCorsHeaders(res) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.header('Access-Control-Max-Age', '86400');
}

// Enable CORS for all routes (must run before all other middleware)
app.use((req, res, next) => {
  // IMPORTANT: Set CORS headers immediately on every request
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.header('Access-Control-Max-Age', '86400');
  
  // Respond to preflight requests
  if (req.method === 'OPTIONS') {
    setCorsHeaders(res);
    return res.sendStatus(204);
  }
  next();
});

// Serve static files from the docs directory
app.use(express.static(path.join(__dirname, 'docs')));

// RENFE API proxy endpoint
app.get('/api/renfe-trains', async (req, res) => {
  try {
    console.log('🚂 Fetching RENFE train data from API...');

    // RENFE GTFS-RT JSON endpoint
    const renfeUrl = 'https://gtfsrt.renfe.com/vehicle_positions.json';

    const resp = await makeRequest(renfeUrl, {
      'User-Agent': 'OpenLocalMap-Proxy/1.0',
      'Accept': 'application/json'
    });

    if (resp.status !== 200) {
      console.warn(`⚠️ RENFE API returned ${resp.status}`);
      setCorsHeaders(res);
      return res.status(resp.status).json({
        error: 'RENFE API error',
        status: resp.status,
        message: resp.data,
        timestamp: new Date().toISOString()
      });
    }

    let data;
    try {
      data = JSON.parse(resp.data);
    } catch (e) {
      console.error('❌ Error parsing RENFE response:', e.message);
      setCorsHeaders(res);
      return res.status(500).json({ error: 'Invalid RENFE JSON', message: e.message });
    }
    console.log('✅ Successfully fetched RENFE data:', data.entity ? data.entity.length : 0, 'trains');
    
    setCorsHeaders(res);
    res.json(data);
  } catch (error) {
    console.error('❌ Error fetching RENFE data:', error.message);
    
    // Return error response with explicit CORS headers
    setCorsHeaders(res);
    res.status(500).json({
      error: 'Failed to fetch RENFE data',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// FGC API proxy endpoint
app.get('/api/fgc-trains', async (req, res) => {
  try {
    console.log('🚆 Fetching FGC train data from API...');

    // FGC Open Data API endpoint
    const fgcUrl = 'https://dadesobertes.fgc.cat/api/explore/v2.1/catalog/datasets/posicionament-dels-trens/records?limit=100';

    const resp = await makeRequest(fgcUrl, {
      'User-Agent': 'OpenLocalMap-Proxy/1.0',
      'Accept': 'application/json'
    });

    if (resp.status !== 200) {
      console.warn(`⚠️ FGC API returned ${resp.status}`);
      setCorsHeaders(res);
      return res.status(resp.status).json({
        error: 'FGC API error',
        status: resp.status,
        message: resp.data,
        timestamp: new Date().toISOString()
      });
    }

    let data;
    try {
      data = JSON.parse(resp.data);
    } catch (e) {
      console.error('❌ Error parsing FGC response:', e.message);
      setCorsHeaders(res);
      return res.status(500).json({ error: 'Invalid FGC JSON', message: e.message });
    }
    console.log('✅ Successfully fetched FGC data:', data.results ? data.results.length : 0, 'trains');

    setCorsHeaders(res);
    res.json(data);
  } catch (error) {
    console.error('❌ Error fetching FGC data:', error.message);

    // Return error response with explicit CORS headers
    setCorsHeaders(res);
    res.status(500).json({
      error: 'Failed to fetch FGC data',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// TMB API proxy endpoint
app.get('/api/tmb-buses', async (req, res) => {
  try {
    console.log('🚇 Fetching TMB metro data from API...');

    // TMB iTransit API endpoint - same proxy structure as RENFE/FGC
    const tmbUrl = 'https://api.tmb.cat/v1/itransit/bus/parades/108?app_id=8029906b&app_key=73b5ad24d1db9fa24988bf134a1523d1';

    const resp = await makeRequest(tmbUrl, {
      'User-Agent': 'OpenLocalMap-Proxy/1.0',
      'Accept': 'application/json'
    });

    if (resp.status !== 200) {
      console.warn(`⚠️ TMB API returned ${resp.status}`);
      setCorsHeaders(res);
      return res.status(resp.status).json({
        error: 'TMB API error',
        status: resp.status,
        message: resp.data,
        timestamp: new Date().toISOString()
      });
    }

    let data;
    try {
      data = JSON.parse(resp.data);
    } catch (e) {
      console.error('❌ Error parsing TMB response:', e.message);
      setCorsHeaders(res);
      return res.status(500).json({ error: 'Invalid TMB JSON', message: e.message });
    }
    console.log('✅ Successfully fetched TMB data for bus stop 108');

    setCorsHeaders(res);
    res.json(data);
  } catch (error) {
    console.error('❌ Error fetching TMB data:', error.message);

    // Return error response with explicit CORS headers
    setCorsHeaders(res);
    res.status(500).json({
      error: 'Failed to fetch TMB data',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Handle all routes by serving index.html (for SPA routing)
// API routes are handled above, so this only handles non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'docs', 'index.html'));
});

// Error handler MUST be defined last (with 4 parameters)
app.use((err, req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 OpenLocalMap server running on http://localhost:${PORT}`);
    console.log(`🔗 RENFE API proxy: http://localhost:${PORT}/api/renfe-trains`);
    console.log(`🔗 FGC API proxy: http://localhost:${PORT}/api/fgc-trains`);
    console.log(`🚍 TMB API proxy: http://localhost:${PORT}/api/tmb-buses`);
  });
} else {
  // Export the Express app for serverless environments (Vercel)
  module.exports = app;
}
