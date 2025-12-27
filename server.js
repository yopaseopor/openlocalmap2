const express = require('express');
const path = require('path');
const app = express();

// Enable CORS for all routes (must run before all other middleware)
app.use((req, res, next) => {
  // IMPORTANT: Set CORS headers immediately on every request
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.header('Access-Control-Max-Age', '86400');
  
  // Respond to preflight requests
  if (req.method === 'OPTIONS') {
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

    const response = await fetch(renfeUrl, {
      headers: {
        'User-Agent': 'OpenLocalMap-Proxy/1.0',
        'Accept': 'application/json'
      },
      timeout: 30000 // 30 second timeout for Vercel
    });

    if (!response.ok) {
      console.warn(`⚠️ RENFE API returned ${response.status}: ${response.statusText}`);
      return res.status(response.status).json({
        error: 'RENFE API error',
        status: response.status,
        message: response.statusText,
        timestamp: new Date().toISOString()
      });
    }

    const data = await response.json();
    console.log('✅ Successfully fetched RENFE data:', data.entity ? data.entity.length : 0, 'trains');
    
    res.json(data);
  } catch (error) {
    console.error('❌ Error fetching RENFE data:', error.message);
    
    // Return error response with explicit CORS headers
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

    const response = await fetch(fgcUrl, {
      headers: {
        'User-Agent': 'OpenLocalMap-Proxy/1.0',
        'Accept': 'application/json'
      },
      timeout: 30000 // 30 second timeout for Vercel
    });

    if (!response.ok) {
      console.warn(`⚠️ FGC API returned ${response.status}: ${response.statusText}`);
      return res.status(response.status).json({
        error: 'FGC API error',
        status: response.status,
        message: response.statusText,
        timestamp: new Date().toISOString()
      });
    }

    const data = await response.json();
    console.log('✅ Successfully fetched FGC data:', data.results ? data.results.length : 0, 'trains');
    
    res.json(data);
  } catch (error) {
    console.error('❌ Error fetching FGC data:', error.message);

    // Return error response with explicit CORS headers
    res.status(500).json({
      error: 'Failed to fetch FGC data',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Handle all routes by serving index.html (for SPA routing)
app.get('*', (req, res) => {
  // Skip API routes
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({error: 'API endpoint not found'});
  }
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
app.listen(PORT, () => {
  console.log(`🚀 OpenLocalMap server running on http://localhost:${PORT}`);
  console.log(`🔗 RENFE API proxy: http://localhost:${PORT}/api/renfe-trains`);
  console.log(`🔗 FGC API proxy: http://localhost:${PORT}/api/fgc-trains`);
});
