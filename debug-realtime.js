// Debug script to check what the real-time metro API actually returns
const https = require('https');

// Test the real-time endpoint for station 122 with detailed output
function testRealtimeData() {
  const realtimeUrl = 'https://api.tmb.cat/v1/itransit/metro/estacions/122?app_id=8029906b&app_key=73b5ad24d1db9fa24988bf134a1523d1';

  console.log('Testing real-time endpoint for station 122...');
  console.log('URL:', realtimeUrl);

  https.get(realtimeUrl, (res) => {
    let data = '';

    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      console.log('Status:', res.statusCode);
      console.log('Response headers:', res.headers);

      try {
        const jsonData = JSON.parse(data);
        console.log('\n=== FULL RESPONSE ===');
        console.log(JSON.stringify(jsonData, null, 2));

        console.log('\n=== STRUCTURE ANALYSIS ===');
        console.log('Keys:', Object.keys(jsonData));

        if (jsonData.linies) {
          console.log('Linies type:', typeof jsonData.linies);
          if (typeof jsonData.linies === 'object' && !Array.isArray(jsonData.linies)) {
            console.log('Linies keys:', Object.keys(jsonData.linies));

            if (jsonData.linies.estacions) {
              console.log('Estacions type:', typeof jsonData.linies.estacions);
              if (Array.isArray(jsonData.linies.estacions)) {
                console.log('Estacions length:', jsonData.linies.estacions.length);
                if (jsonData.linies.estacions.length > 0) {
                  console.log('First estacio keys:', Object.keys(jsonData.linies.estacions[0]));
                  console.log('First estacio:', JSON.stringify(jsonData.linies.estacions[0], null, 2));
                }
              }
            }
          }
        }

      } catch (error) {
        console.error('Error parsing JSON:', error.message);
        console.log('Raw response (first 1000 chars):', data.substring(0, 1000));
      }
    });
  }).on('error', (error) => {
    console.error('Request error:', error.message);
  });
}

// Also test what station IDs look like
function testStationsData() {
  const stationsUrl = 'https://api.tmb.cat/v1/transit/linies/metro/1/estacions?app_id=8029906b&app_key=73b5ad24d1db9fa24988bf134a1523d1';

  console.log('\n\nTesting stations data for line 1...');
  console.log('URL:', stationsUrl);

  https.get(stationsUrl, (res) => {
    let data = '';

    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      try {
        const jsonData = JSON.parse(data);
        console.log('Found', jsonData.features ? jsonData.features.length : 0, 'stations');

        if (jsonData.features && jsonData.features.length > 0) {
          const firstStation = jsonData.features[0];
          console.log('First station properties keys:', Object.keys(firstStation.properties));
          console.log('First station ID fields:');
          console.log('- CODI_ESTACIO:', firstStation.properties.CODI_ESTACIO);
          console.log('- ID_ESTACIO:', firstStation.properties.ID_ESTACIO);
          console.log('- id:', firstStation.id);
          console.log('- NOM_ESTACIO:', firstStation.properties.NOM_ESTACIO);
        }

      } catch (error) {
        console.error('Error parsing stations JSON:', error.message);
      }
    });
  }).on('error', (error) => {
    console.error('Stations request error:', error.message);
  });
}

testRealtimeData();
setTimeout(testStationsData, 1000);
