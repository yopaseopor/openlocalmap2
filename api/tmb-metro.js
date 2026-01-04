// TMB metro stations proxy for Vercel — provides metro station data
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

// Helper function to get proper display names for metro lines
export function getMetroLineDisplayName(lineCode, apiName) {
  // Map line codes to proper display names
  const lineNameMappings = {
    '1': 'L1 - Vermella',
    '2': 'L2 - Lila',
    '3': 'L3 - Verda',
    '4': 'L4 - Groga',
    '5': 'L5 - Blava',
    '11': 'L11 - Trinitat Nova',
    '99': 'FM - Funicular de Montjuïc',
    '94': 'L9N - Nord',
    '91': 'L9S - Sud',
    '101': 'L10S - Sud',
    '104': 'L10N - Nord'
  };

  // First try to match by the numeric code
  if (lineNameMappings[lineCode]) {
    return lineNameMappings[lineCode];
  }

  // If not found, try to extract from API name and format to 1-2 lines
  if (apiName) {
    // Clean up the API name and ensure it's 1-2 lines
    let displayName = apiName.trim();

    // Replace long names with shorter versions
    if (displayName.includes('Barcelona Metro')) {
      displayName = displayName.replace('Barcelona Metro', '').trim();
    }

    // Ensure proper line formatting
    if (displayName.match(/^L\d+/)) {
      const lineMatch = displayName.match(/^L(\d+)/);
      if (lineMatch) {
        const lineNum = lineMatch[1];
        // Add color name if available
        const colorNames = {
          '1': 'Vermella',
          '2': 'Lila',
          '3': 'Verda',
          '4': 'Groga',
          '5': 'Blava'
        };
        if (colorNames[lineNum]) {
          displayName = `L${lineNum} - ${colorNames[lineNum]}`;
        }
      }
    }

    // Limit to reasonable length and ensure 1-2 lines max
    if (displayName.length > 25) {
      displayName = displayName.substring(0, 22) + '...';
    }

    return displayName;
  }

  // Fallback
  return `Línia ${lineCode}`;
}

// Vercel API endpoint for TMB metro stations
export default async function (req, res) {
  // Set CORS headers first
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    const appId = process.env.TMB_APP_ID || '8029906b';
    const appKey = process.env.TMB_APP_KEY || '73b5ad24d1db9fa24988bf134a1523d1';

    // First get all metro lines
    const linesUrl = `https://api.tmb.cat/v1/transit/linies/metro?app_id=${appId}&app_key=${appKey}`;
    console.log('TMB metro lines URL:', linesUrl);

    const linesResult = await getJson(linesUrl);
    if (linesResult.status !== 200) {
      return res.status(linesResult.status || 502).json({ error: 'TMB metro lines upstream error', status: linesResult.status });
    }

    const lines = linesResult.json.features || [];
    console.log(`Found ${lines.length} metro lines`);

    // Get stations for each line
    const allStations = [];

    for (const line of lines) {
      const lineCode = line.properties.CODI_LINIA;
      const stationsUrl = `https://api.tmb.cat/v1/transit/linies/metro/${lineCode}/estacions?app_id=${appId}&app_key=${appKey}`;
      console.log(`Fetching stations for line ${lineCode}:`, stationsUrl);

      try {
        const stationsResult = await getJson(stationsUrl);
        if (stationsResult.status === 200 && stationsResult.json.features) {
          // Get proper display name for the line
          const displayName = getMetroLineDisplayName(lineCode, line.properties.NOM_LINIA);

          // Add line information to each station
          const stationsWithLine = stationsResult.json.features.map(station => ({
            ...station,
            properties: {
              ...station.properties,
              LINE_CODE: lineCode,
              LINE_NAME: displayName,
              LINE_COLOR: line.properties.COLOR_LINIA
            }
          }));
          allStations.push(...stationsWithLine);
        }
      } catch (err) {
        console.error(`Error fetching stations for line ${lineCode}:`, err.message);
        // Continue with other lines
      }
    }

    console.log(`Total stations collected: ${allStations.length}`);

    // Fetch real-time data for each station
    console.log('Fetching real-time train data for all metro stations...');

    const stationsWithRealtime = [];
    for (const station of allStations) {
      try {
        const stationId = station.properties.CODI_ESTACIO || station.properties.ID_ESTACIO || station.id;
        if (stationId) {
          const realtimeUrl = `https://api.tmb.cat/v1/itransit/metro/estacions/${stationId}?app_id=${appId}&app_key=${appKey}`;
          console.log(`Fetching real-time data for station ${stationId}:`, realtimeUrl);

          const realtimeResult = await getJson(realtimeUrl);
          if (realtimeResult.status === 200 && realtimeResult.json && realtimeResult.json.linies) {
            // Extract train data from the linies array structure
            const liniesArray = realtimeResult.json.linies;

            let nextTrains = [];
            if (Array.isArray(liniesArray)) {
              // Flatten all trains from all lines and directions for this station
              liniesArray.forEach(linia => {
                if (linia.estacions && Array.isArray(linia.estacions)) {
                  linia.estacions.forEach(estacio => {
                    if (estacio.codi_estacio == stationId && estacio.linies_trajectes) {
                      // This station matches, collect all its trains
                      estacio.linies_trajectes.forEach(trajecte => {
                        if (trajecte.propers_trens && Array.isArray(trajecte.propers_trens)) {
                          trajecte.propers_trens.forEach(tren => {
                            nextTrains.push({
                              codi_servei: tren.codi_servei,
                              temps_arribada: tren.temps_arribada,
                              linia: trajecte.codi_linia,
                              nom_linia: trajecte.nom_linia,
                              color_linia: trajecte.color_linia,
                              desti: trajecte.desti_trajecte,
                              codi_trajecte: trajecte.codi_trajecte
                            });
                          });
                        }
                      });
                    }
                  });
                }
              });
            }

            // Sort trains by arrival time
            nextTrains.sort((a, b) => a.temps_arribada - b.temps_arribada);

            // Add real-time data to station properties
            station.properties.nextTrains = nextTrains;
            station.properties.realtimeTimestamp = realtimeResult.json.timestamp;
            console.log(`✅ Added real-time data for station ${stationId}: ${nextTrains.length} trains`);
          } else {
            station.properties.nextTrains = [];
            console.log(`⚠️ No real-time data available for station ${stationId}`);
          }
        } else {
          station.properties.nextTrains = [];
          console.log(`⚠️ No station ID found for station, skipping real-time data`);
        }
      } catch (err) {
        console.error(`Error fetching real-time data for station:`, err.message);
        station.properties.nextTrains = [];
      }

      stationsWithRealtime.push(station);
    }

    console.log(`✅ Completed fetching real-time data for ${stationsWithRealtime.length} stations`);

    // Return all stations with real-time data as GeoJSON
    const geoJsonResponse = {
      type: "FeatureCollection",
      features: stationsWithRealtime
    };

    return res.status(200).json(geoJsonResponse);

  } catch (err) {
    console.error('TMB metro stations proxy error:', err);
    return res.status(500).json({ error: 'TMB metro stations proxy failed', message: err.message });
  }
};
