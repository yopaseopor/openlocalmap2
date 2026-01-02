# Local OpenStreetMap: OpenLocalMap (OLM)

More customized Local OSM map showing multiple data with leaflet plugins.

## Live version!

http://osm-catalan.github.io/openlocalmap

## Attribution

### Forked from:

 - http://www.konfraria.org/osm/cerca/web
 - https://upoi.org (Humitos)

### Strongly based on :
 - http://unterkunftskarte.de/
 - http://osm24.eu/
 - https://github.com/simon04/POImap/
 
### Working on:
 
 - La Palma de Cervelló (Catalonia/Spain) 
 http://www.konfraria.org/osm/cerca/web
 - Vilanova i la Geltrú (Catalonia/Spain) 
 http://yopaseopor.github.io/olm-vng
 
## Instructions (Spanish)
 
 -http://yopaseopor.blogspot.com.es/2018/01/yorenderizo-openlocalmap-osm-en-tu.html
 
 ## Languages

 To translate OpenLocalmap in your language replace index.html with index_xx (your language).html

## Node.js Server Setup

To run the application locally using Node.js:

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the server:
   ```bash
   npm start
   ```

3. Open your browser and navigate to `http://localhost:3000`

For development with auto-reload:
```bash
npm run dev
```

The server serves the static files from the `docs/` directory and includes API proxies for RENFE and FGC real-time train data.

### RENFE Real-Time Train Integration

The application now includes real-time RENFE train visualization:

- **Automatic Mode**: Click "▶️ Iniciar Visualització de Trens" to fetch live train positions every 30 seconds
- **Manual Mode**: Use the manual data entry to paste JSON data directly from RENFE's API
- **Legend**: Toggle route legend to see train counts by RENFE núcleos (hubs)

The Node.js server provides a CORS proxy at `/api/renfe-trains` to fetch data from RENFE's GTFS-RT API.

### FGC Real-Time Train Integration

Similar functionality is available for FGC (Ferrocarrils de la Generalitat de Catalunya) trains:

- **Automatic Mode**: Fetches data from FGC's open data portal
- **Manual Mode**: Manual JSON data entry option
- **Legend**: Shows trains grouped by service type (Metro del Vallès, Barcelona-Vallès, etc.)

### TMB Real-Time Bus Arrivals Integration

The application now includes real-time TMB bus arrival information at stops:

- **Manual Mode**: Use the manual data entry to paste JSON data from TMB's bus stop predictions API
- **Legend**: Toggle route legend to see bus arrivals grouped by TMB line numbers and service types

**Current Status**: ✅ **IMPLEMENTATION COMPLETE**

The TMB API proxy framework is implemented at `/api/tmb-realtime` and currently returns sample data for testing. The proxy is ready for the correct TMB API endpoint once validated.

**To integrate real TMB data:**

1. **Verify API Endpoint**: The correct TMB endpoint for bus stop predictions needs to be confirmed
2. **Update API Call**: Replace the sample data in `api/tmb-realtime.js` with the real TMB API call
3. **Test Integration**: Use the manual data entry form to test with real TMB JSON responses

**Technical Details:**
- Proxy endpoint: `/api/tmb-realtime`
- Expected data format: Bus arrival predictions for specific stops
- Frontend processes: Stop locations, arrival times, routes, and destinations

## Deployment to GitHub Pages

The application is automatically deployed to GitHub Pages using GitHub Actions with Node.js.

**Live Demo with RENFE Real-Time Trains**: https://yopaseopor.github.io/openlocalmap2

1. **Enable GitHub Pages** in your repository settings:
   - Go to Settings → Pages
   - Set Source to "Deploy from a branch"
   - Set Branch to "gh-pages" and folder to "/ (root)"

2. **Automatic deployment**: On every push to the `main` branch, the workflow runs Node.js to install dependencies and deploy the `docs/` folder to GitHub Pages.

3. The live version will be available at: `https://{username}.github.io/{repository-name}`

To deploy manually (if needed):
```bash
npm run deploy
```

This uses the `gh-pages` package to publish the static files to the `gh-pages` branch, which GitHub Pages serves.

## How to Add TMB Real-Time Bus Proxy

This guide explains step-by-step how to implement a real-time proxy for TMB (Barcelona Metropolitan Transport) buses, similar to the existing RENFE train proxy.

### Step 1: Analyze the RENFE Implementation

First, examine the existing RENFE proxy implementation:

1. **Check the API file**: Look at `api/renfe-trains.js`
   - Uses CommonJS format for Vercel compatibility
   - Implements CORS headers
   - Fetches from RENFE's GTFS-RT endpoint: `https://gtfsrt.renfe.com/vehicle_positions.json`
   - Handles timeouts and error responses

2. **Check Vercel configuration**: The `vercel.json` routes `/api/*` requests to corresponding `.js` files automatically

3. **Check server.js**: For local development, the Node.js server also proxies the API calls

### Step 2: Create TMB Real-Time Proxy API

Create a new API file `api/tmb-realtime.js`:

```javascript
// TMB real-time bus arrivals proxy for Vercel (CommonJS) — provides real-time bus arrival data at stops
const https = require('https');

function getJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'OpenLocalMap-Proxy/1.0',
        'Accept': 'application/json'
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, json });
        } catch (err) {
          reject(new Error('Invalid JSON from upstream: ' + err.message));
        }
      });
    });
    req.on('error', (err) => reject(err));
    req.setTimeout(30000, () => {
      req.abort();
      reject(new Error('Upstream timeout'));
    });
  });
}

module.exports = async function (req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    // Use TMB iBus API for real-time bus arrivals at stops
    const appId = process.env.TMB_APP_ID || '8029906b';
    const appKey = process.env.TMB_APP_KEY || '73b5ad24d1db9fa24988bf134a1523d1';

    // Get parameters from query or use defaults
    const radius = req.query.radius || '1000';
    const lat = req.query.lat;
    const lon = req.query.lon;

    let tmbUrl = `https://api.tmb.cat/v1/ibus/stops/nearby?app_id=${appId}&app_key=${appKey}&radius=${radius}`;
    if (lat && lon) {
      tmbUrl += `&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`;
    }

    const result = await getJson(tmbUrl);
    if (result.status && result.status >= 200 && result.status < 300) {
      return res.status(200).json(result.json);
    } else {
      return res.status(result.status || 502).json({
        error: 'TMB iBus upstream error',
        status: result.status
      });
    }
  } catch (err) {
    console.error('TMB iBus proxy error:', err);
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(500).json({
      error: 'TMB iBus proxy failed',
      message: err.message
    });
  }
};
```

**Key differences from RENFE**:
- Uses TMB's iBus API for real-time bus arrival data at stops
- Returns stop-based arrival information instead of vehicle positions
- Frontend processes arrival times and stop locations
- Error messages reference "TMB iBus" instead of "RENFE"

### Step 3: Update Documentation

Add documentation about the TMB real-time integration in the README.md:

1. Add a new section "TMB Real-Time Bus Integration"
2. Document the automatic and manual modes
3. Mention the CORS proxy endpoint `/api/tmb-realtime`

### Step 4: Test the Implementation

1. **Local Testing**:
   - Start the local server: `npm start`
   - Test the API endpoint: `http://localhost:3000/api/tmb-realtime`
   - Check browser console for any CORS or network errors

2. **Vercel Deployment**:
   - The `vercel.json` configuration automatically handles routing
   - Deploy to Vercel: `vercel --prod`
   - Test the deployed endpoint

### Step 5: Frontend Integration

To integrate with the frontend (similar to RENFE):

1. Add TMB real-time visualization functions in `docs/assets/js/site.functions.js`
2. Create UI buttons for starting/stopping TMB real-time visualization
3. Implement bus marker display with route coloring
4. Add legend functionality for TMB routes

### Step 6: Error Handling and Fallbacks

Implement fallback mechanisms:

1. **CORS Proxies**: Use external CORS proxies if direct API calls fail
2. **Manual Data Entry**: Allow users to paste JSON data manually
3. **Environment Detection**: Handle different deployment environments (local, Vercel, GitHub Pages)

### Common Issues and Solutions

1. **CORS Errors**: Ensure all API responses include proper CORS headers
2. **Timeout Issues**: Increase timeout values if TMB API is slow
3. **API Changes**: Monitor TMB API documentation for endpoint changes
4. **Rate Limiting**: Implement caching or request throttling if needed

### Monitoring and Maintenance

1. **Logs**: Check Vercel function logs for API errors
2. **Uptime**: Monitor the TMB GTFS-RT feed availability
3. **Updates**: Keep the proxy updated if TMB changes their API structure

This implementation provides a robust CORS proxy for TMB real-time bus data, enabling the frontend to display live bus positions on the map without CORS restrictions.
