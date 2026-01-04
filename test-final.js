// Quick test to verify the fixed metro API works
const api = require('./api/tmb-metro.js');

console.log('Testing fixed metro API...');

// Create a mock request/response
const mockReq = {
  method: 'GET'
};

const mockRes = {
  setHeader: (key, value) => console.log(`Setting header: ${key} = ${value}`),
  status: (code) => ({
    json: (data) => {
      console.log(`Response status: ${code}`);
      console.log('Response data keys:', Object.keys(data));
      if (data.features && data.features.length > 0) {
        console.log('Number of stations:', data.features.length);
        const firstStation = data.features[0];
        console.log('First station has nextTrains:', !!firstStation.properties.nextTrains);
        if (firstStation.properties.nextTrains && firstStation.properties.nextTrains.length > 0) {
          console.log('First station nextTrains length:', firstStation.properties.nextTrains.length);
          console.log('First train:', JSON.stringify(firstStation.properties.nextTrains[0], null, 2));
        }
      }
      return mockRes;
    }
  })
};

// Call the API (this will take time due to multiple HTTP requests)
api.default(mockReq, mockRes).catch(err => {
  console.error('API test failed:', err.message);
});
