// Global variables
var currentSelectedRoute = null;
var routesCache = {}; // Cache for routes data
var currentRoutesData = { walking: [], biking: [], public_transport: [] }; // Store current routes
var routeLayer = null; // Layer to display route geometry on map

// Function to initialize routes for current location
function initializeRoutes() {
    // Check if a location has been selected
    if (typeof baseLocation === 'undefined' || !baseLocation.name) {
        // No location selected - hide routes completely
        document.getElementById('routes-title').textContent = 'Rutes';
        document.getElementById('routes-content').innerHTML = '';
        return;
    }

    var locationName = baseLocation.name;
    var locationBounds = baseLocation.bounds;

    // Update title
    document.getElementById('routes-title').textContent = 'Rutes a ' + locationName;

    // Load routes from Overpass API
    loadRoutesFromOverpass(locationBounds);
}

// Function to load routes from Overpass API
function loadRoutesFromOverpass(bounds) {
    // Show loading message
    document.getElementById('routes-content').innerHTML = '<p><i class="fa fa-spinner fa-spin"></i> Carregant rutes...</p>';

    // If no bounds available, use default area around Vilanova i la Geltrú
    if (!bounds) {
        bounds = L.latLngBounds([41.2, 1.7], [41.25, 1.75]);
    }

    // Build Overpass query for different route types
    var bbox = bounds.getSouth() + ',' + bounds.getWest() + ',' + bounds.getNorth() + ',' + bounds.getEast();

    // Debug: Log the bounds being used
    console.log('Querying routes for bounds:', bbox);

    // More comprehensive queries - use correct Overpass bbox syntax
    // Query for walking routes (hiking relations, foot paths, and any paths)
    var walkingQuery = '[out:json][timeout:30];' +
        '(relation(' + bbox + ')[type=route][route=hiking];' +
        'relation(' + bbox + ')[type=route][route=foot];' +
        'way(' + bbox + ')[highway=path];' +
        'way(' + bbox + ')[highway=footway];' +
        'way(' + bbox + ')[highway=track][tracktype=grade1];' +
        'way(' + bbox + ')[highway=steps];);' +
        'out tags;';

    // Query for cycling routes - more comprehensive
    var bikingQuery = '[out:json][timeout:30];' +
        '(relation(' + bbox + ')[type=route][route=bicycle];' +
        'relation(' + bbox + ')[type=route][route=mtb];' +
        'way(' + bbox + ')[highway=cycleway];' +
        'way(' + bbox + ')[cycleway];' +
        'way(' + bbox + ')[highway=path][bicycle=yes];);' +
        'out tags;';

    // Query for public transport routes - more comprehensive
    var transportQuery = '[out:json][timeout:30];' +
        '(relation(' + bbox + ')[type=route][route=bus];' +
        'relation(' + bbox + ')[type=route][route=tram];' +
        'relation(' + bbox + ')[type=route][route=subway];' +
        'relation(' + bbox + ')[type=route][route=train];' +
        'relation(' + bbox + ')[type=route][route=light_rail];);' +
        'out tags;';

    // Execute queries
    Promise.all([
        fetchOverpassData(walkingQuery),
        fetchOverpassData(bikingQuery),
        fetchOverpassData(transportQuery)
    ]).then(function(results) {
        var walkingRoutes = processWalkingRoutes(results[0]);
        var bikingRoutes = processBikingRoutes(results[1]);
        var transportRoutes = processTransportRoutes(results[2]);

        console.log('Routes found:', {
            walking: walkingRoutes.length,
            biking: bikingRoutes.length,
            transport: transportRoutes.length
        });

        // If no routes found, try expanding the search area
        if (walkingRoutes.length === 0 && bikingRoutes.length === 0 && transportRoutes.length === 0) {
            console.log('No routes found, trying expanded search...');
            // Expand bounds by 2x
            var expandedBounds = L.latLngBounds([
                [bounds.getSouth() - (bounds.getNorth() - bounds.getSouth()) * 0.5],
                [bounds.getWest() - (bounds.getEast() - bounds.getWest()) * 0.5]
            ], [
                [bounds.getNorth() + (bounds.getNorth() - bounds.getSouth()) * 0.5],
                [bounds.getEast() + (bounds.getEast() - bounds.getWest()) * 0.5]
            ]);

            loadRoutesFromOverpassExpanded(expandedBounds);
        } else {
            displayRoutes(walkingRoutes, bikingRoutes, transportRoutes);
        }
    }).catch(function(error) {
        console.error('Error loading routes:', error);

        // Handle specific Overpass API errors
        var errorMessage = '<p>Error carregant les rutes. ';

        if (error.message && error.message.includes('504')) {
            errorMessage += 'El servidor d\'OpenStreetMap està sobrecarregat. Proveu-ho més tard o amb una zona més petita.</p>';
        } else if (error.message && error.message.includes('429')) {
            errorMessage += 'Massa consultes. Espereu uns minuts abans de tornar-ho a intentar.</p>';
        } else {
            errorMessage += 'Torneu-ho a intentar.</p>';
        }

        errorMessage += '<p><button onclick="reloadRoutes()" style="background:#2a2a2a; color:white; padding:5px 10px; border:none; border-radius:3px; cursor:pointer;">Reintentar</button></p>';

        document.getElementById('routes-content').innerHTML = errorMessage;
    });
}

// Function to load routes with expanded search area
function loadRoutesFromOverpassExpanded(bounds) {
    console.log('Trying expanded search with bounds:', bounds.getSouth() + ',' + bounds.getWest() + ',' + bounds.getNorth() + ',' + bounds.getEast());

    // Build expanded queries
    var bbox = bounds.getSouth() + ',' + bounds.getWest() + ',' + bounds.getNorth() + ',' + bounds.getEast();

    // More inclusive queries for expanded search
    var walkingQuery = '[out:json][timeout:40];' +
        '(way(' + bbox + ')[highway=path];' +
        'way(' + bbox + ')[highway=footway];' +
        'way(' + bbox + ')[highway=track];' +
        'way(' + bbox + ')[highway=steps];);' +
        'out tags;';

    var bikingQuery = '[out:json][timeout:40];' +
        '(way(' + bbox + ')[highway=cycleway];' +
        'way(' + bbox + ')[cycleway];' +
        'way(' + bbox + ')[highway=path][bicycle=yes];);' +
        'out tags;';

    var transportQuery = '[out:json][timeout:40];' +
        '(node(' + bbox + ')[highway=bus_stop];' +
        'node(' + bbox + ')[public_transport=stop_position];);' +
        'out tags;';

    // Execute expanded queries
    Promise.all([
        fetchOverpassData(walkingQuery),
        fetchOverpassData(bikingQuery),
        fetchOverpassData(transportQuery)
    ]).then(function(results) {
        var walkingRoutes = processWalkingRoutes(results[0]);
        var bikingRoutes = processBikingRoutes(results[1]);
        var transportStops = processTransportStops(results[2]);

        console.log('Expanded search results:', {
            walking: walkingRoutes.length,
            biking: bikingRoutes.length,
            stops: transportStops.length
        });

        // Create mock transport routes from stops
        var transportRoutes = createTransportRoutesFromStops(transportStops);

        displayRoutes(walkingRoutes, bikingRoutes, transportRoutes);
    }).catch(function(error) {
        console.error('Error in expanded search:', error);
        displayRoutes([], [], []);
    });
}

// Function to process transport stops (for expanded search)
function processTransportStops(data) {
    var stops = [];

    if (data && data.elements) {
        data.elements.forEach(function(element) {
            if (element.type === 'node') {
                stops.push({
                    name: getLocalizedName(element.tags) || 'Parada',
                    lat: element.lat,
                    lon: element.lon,
                    tags: element.tags
                });
            }
        });
    }

    return stops;
}

// Function to create transport routes from stops (for expanded search)
function createTransportRoutesFromStops(stops) {
    // Group stops by potential routes (this is a simplified approach)
    var routes = [];

    if (stops.length > 0) {
        // Create a generic bus route for the area
        routes.push({
            id: 'generated_bus_route',
            name: 'Línies d\'autobús locals',
            description: 'Parades d\'autobús trobades a la zona',
            frequency: 'Variable',
            type: 'public_transport',
            route_type: 'bus',
            osm_id: 'generated',
            osm_type: 'generated',
            stops: stops
        });
    }

    return routes;
}

// Function to fetch data from Overpass API
function fetchOverpassData(query) {
    console.log('Sending Overpass query:', query);

    return new Promise(function(resolve, reject) {
        var xhr = new XMLHttpRequest();
        xhr.open('POST', 'https://overpass-api.de/api/interpreter', true);
        xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                console.log('Overpass response status:', xhr.status);
                if (xhr.status === 200) {
                    try {
                        var data = JSON.parse(xhr.responseText);
                        console.log('Overpass response data:', data);
                        resolve(data);
                    } catch (e) {
                        console.error('JSON parse error:', e);
                        reject(e);
                    }
                } else {
                    console.error('Overpass error response:', xhr.responseText);
                    reject(new Error('HTTP ' + xhr.status + ': ' + xhr.responseText));
                }
            }
        };
        xhr.send('data=' + encodeURIComponent(query));
    });
}

// Process walking routes from Overpass response
function processWalkingRoutes(data) {
    var routes = [];

    if (data && data.elements) {
        // First, collect named routes (relations)
        var namedRoutes = data.elements.filter(function(element) {
            return element.type === 'relation' && (element.tags.name || element.tags.ref);
        });

        // If we have named routes, use them
        if (namedRoutes.length > 0) {
            namedRoutes.forEach(function(element) {
                var route = {
                    id: 'relation_' + element.id,
                    name: getLocalizedName(element.tags) || element.tags.ref || 'Ruta a peu',
                    description: element.tags.description || '',
                    distance: element.tags.distance || 'N/A',
                    elevation: element.tags.ele || '',
                    difficulty: element.tags.difficulty || '',
                    duration: element.tags.duration || '',
                    type: 'walking',
                    osm_id: element.id,
                    osm_type: element.type,
                    tags: element.tags // Store tags for color access
                };
                routes.push(route);
            });
        } else {
            // If no named routes, create a synthetic route from all found paths
            var pathCount = data.elements.filter(function(element) {
                return element.type === 'way';
            }).length;

            if (pathCount > 0) {
                routes.push({
                    id: 'walking_paths_synthetic',
                    name: 'Camins i senders locals',
                    description: 'Camins a peu trobats a la zona',
                    distance: 'Variable',
                    elevation: 'Variable',
                    difficulty: 'Variable',
                    duration: 'Variable',
                    type: 'walking',
                    osm_id: 'synthetic',
                    osm_type: 'synthetic',
                    tags: {} // Empty tags for synthetic routes
                });
            }
        }
    }

    return routes;
}

// Process biking routes from Overpass response
function processBikingRoutes(data) {
    var routes = [];

    if (data && data.elements) {
        // First, collect named routes (relations)
        var namedRoutes = data.elements.filter(function(element) {
            return element.type === 'relation' && (element.tags.name || element.tags.ref);
        });

        // If we have named routes, use them
        if (namedRoutes.length > 0) {
            namedRoutes.forEach(function(element) {
                var route = {
                    id: 'relation_' + element.id,
                    name: getLocalizedName(element.tags) || element.tags.ref || 'Ruta en bicicleta',
                    description: element.tags.description || '',
                    distance: element.tags.distance || 'N/A',
                    elevation: element.tags.ele || '',
                    difficulty: element.tags.difficulty || '',
                    duration: element.tags.duration || '',
                    type: 'biking',
                    osm_id: element.id,
                    osm_type: element.type,
                    tags: element.tags // Store tags for color access
                };
                routes.push(route);
            });
        } else {
            // If no named routes, create a synthetic route from all found cycling paths
            var pathCount = data.elements.filter(function(element) {
                return element.type === 'way';
            }).length;

            if (pathCount > 0) {
                routes.push({
                    id: 'cycling_paths_synthetic',
                    name: 'Carrils bici locals',
                    description: 'Carrils i vies ciclistes trobats a la zona',
                    distance: 'Variable',
                    elevation: 'Variable',
                    difficulty: 'Variable',
                    duration: 'Variable',
                    type: 'biking',
                    osm_id: 'synthetic',
                    osm_type: 'synthetic',
                    tags: {} // Empty tags for synthetic routes
                });
            }
        }
    }

    return routes;
}

// Process public transport routes from Overpass response
function processTransportRoutes(data) {
    var routes = [];

    if (data && data.elements) {
        // Process routes synchronously first
        data.elements.forEach(function(element) {
            if (element.type === 'relation') {
                var route = {
                    id: 'relation_' + element.id,
                    name: getLocalizedName(element.tags) || element.tags.ref || 'Línia sense nom',
                    description: element.tags.description || '',
                    frequency: element.tags.interval || '',
                    type: 'public_transport',
                    route_type: element.tags.route,
                    osm_id: element.id,
                    osm_type: element.type,
                    from: element.tags.from || '',
                    to: element.tags.to || '',
                    stops: [] // Will be populated later if we fetch stops
                };

                // Add to routes if it has a name
                if (route.name !== 'Línia sense nom') {
                    routes.push(route);
                }
            }
        });

        // Now asynchronously fetch stops for all routes (but don't wait for them)
        routes.forEach(function(route) {
            fetchRouteStops(route.id, route.osm_id).then(function(stops) {
                route.stops = stops;
                console.log('Loaded', stops.length, 'stops for route:', route.name);
            }).catch(function(error) {
                console.error('Failed to load stops for route:', route.name, error);
            });
        });
    }

    return routes;
}

// Function to fetch stops for a public transport route
function fetchRouteStops(routeId, osmId) {
    return new Promise(function(resolve, reject) {
        // Query to get the relation with its members (stops in order)
        var stopsQuery = '[out:json][timeout:20];' +
            'relation(' + osmId + ');' +
            'out;>;out;';

        console.log('Fetching ordered stops for route relation:', osmId);

        var xhr = new XMLHttpRequest();
        xhr.open('POST', 'https://overpass-api.de/api/interpreter', true);
        xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                if (xhr.status === 200) {
                    try {
                        var data = JSON.parse(xhr.responseText);
                        console.log('Route stops response for', osmId, ':', data);

                        var stops = [];
                        var stopNodes = {};

                        if (data && data.elements) {
                            // First, collect all node elements
                            data.elements.forEach(function(element) {
                                if (element.type === 'node') {
                                    stopNodes[element.id] = element;
                                }
                            });

                            // Then find the relation and extract stops in order
                            var relation = data.elements.find(function(element) {
                                return element.type === 'relation' && element.id == osmId;
                            });

                            if (relation && relation.members) {
                                console.log('Found', relation.members.length, 'relation members');

                                relation.members.forEach(function(member, index) {
                                    if (member.type === 'node' &&
                                        (member.role === 'stop' ||
                                         member.role === 'stop_entry_only' ||
                                         member.role === 'stop_exit_only' ||
                                         member.role === 'platform' ||
                                         member.role === 'platform_entry_only' ||
                                         member.role === 'platform_exit_only')) {

                                        var node = stopNodes[member.ref];
                                        if (node) {
                                            stops.push({
                                                name: getLocalizedName(node.tags) || 'Parada ' + (index + 1),
                                                lat: node.lat,
                                                lon: node.lon,
                                                order: index + 1,
                                                role: member.role,
                                                tags: node.tags
                                            });
                                            console.log('Added stop:', index + 1, node.tags ? getLocalizedName(node.tags) : 'Unnamed');
                                        }
                                    }
                                });
                            }

                            // If no ordered stops found, fall back to old method
                            if (stops.length === 0) {
                                console.log('No ordered stops found, falling back to unordered method');
                                data.elements.forEach(function(element) {
                                    if (element.type === 'node' &&
                                        (element.tags.public_transport === 'stop_position' ||
                                         element.tags.highway === 'bus_stop' ||
                                         element.tags.railway === 'tram_stop')) {
                                        stops.push({
                                            name: getLocalizedName(element.tags) || 'Parada sense nom',
                                            lat: element.lat,
                                            lon: element.lon,
                                            tags: element.tags
                                        });
                                    }
                                });
                            }
                        }

                        console.log('Returning', stops.length, 'stops for route', osmId);
                        resolve(stops);
                    } catch (e) {
                        console.error('Error parsing route stops response:', e);
                        reject(e);
                    }
                } else {
                    console.error('HTTP error fetching route stops:', xhr.status);
                    reject(new Error('HTTP ' + xhr.status));
                }
            }
        };
        xhr.send('data=' + encodeURIComponent(stopsQuery));
    });
}

// Function to display routes in the interface
function displayRoutes(walkingRoutes, bikingRoutes, transportRoutes) {
    // Store routes data globally
    currentRoutesData = {
        walking: walkingRoutes || [],
        biking: bikingRoutes || [],
        public_transport: transportRoutes || []
    };

    var contentHtml = '';

    // Walking routes
    if (walkingRoutes && walkingRoutes.length > 0) {
        contentHtml += '<h3><i class="fa fa-walking"></i> Rutes a peu (' + walkingRoutes.length + ')</h3>';
        contentHtml += '<div class="routes-list">';
        walkingRoutes.slice(0, 10).forEach(function(route) { // Limit to 10 routes
            contentHtml += createRouteItem(route);
        });
        contentHtml += '</div>';
    }

    // Biking routes
    if (bikingRoutes && bikingRoutes.length > 0) {
        contentHtml += '<h3><i class="fa fa-bicycle"></i> Rutes en bicicleta (' + bikingRoutes.length + ')</h3>';
        contentHtml += '<div class="routes-list">';
        bikingRoutes.slice(0, 10).forEach(function(route) {
            contentHtml += createRouteItem(route);
        });
        contentHtml += '</div>';
    }

    // Public transport
    if (transportRoutes && transportRoutes.length > 0) {
        contentHtml += '<h3><i class="fa fa-bus"></i> Transport públic (' + transportRoutes.length + ')</h3>';
        contentHtml += '<div class="routes-list">';
        transportRoutes.slice(0, 10).forEach(function(route) {
            contentHtml += createRouteItem(route);
        });
        contentHtml += '</div>';
    }

    // If no routes available, show a helpful message
    if (contentHtml === '') {
        contentHtml = '<div class="no-routes-message">' +
            '<p><i class="fa fa-info-circle"></i> No s\'han trobat rutes etiquetades específicament per aquesta ubicació.</p>' +
            '<p>Això pot ser degut a:</p>' +
            '<ul>' +
            '<li>La zona seleccionada és massa petita</li>' +
            '<li>Les rutes no estan etiquetades correctament a OpenStreetMap</li>' +
            '<li>Les rutes existeixen però amb etiquetes diferents</li>' +
            '</ul>' +
            '<p>Proveu amb una ciutat més gran o amb més zones turístiques.</p>' +
            '</div>';
    }

    document.getElementById('routes-content').innerHTML = contentHtml;
}

// Function to create HTML for a single route item
function createRouteItem(route) {
    var iconClass = getRouteIcon(route.type);
    var typeName = getRouteTypeName(route.type);

    var html = '<div class="route-item" onclick="showRouteDetails(\'' + route.id + '\')">';
    html += '<div class="route-header">';
    html += '<i class="fa ' + iconClass + '"></i>';
    html += '<span class="route-name">' + route.name + '</span>';
    html += '<span class="route-type">' + typeName + '</span>';
    html += '</div>';
    html += '<div class="route-summary">';
    html += '<span class="route-distance"><i class="fa fa-route"></i> ' + route.distance + '</span>';
    if (route.elevation) {
        html += '<span class="route-elevation"><i class="fa fa-mountain"></i> ' + route.elevation + '</span>';
    }
    if (route.frequency) {
        html += '<span class="route-frequency"><i class="fa fa-clock-o"></i> ' + route.frequency + '</span>';
    }
    html += '</div>';
    html += '</div>';

    return html;
}

// Function to show detailed information for a selected route
function showRouteDetails(routeId) {
    var allRoutes = [...currentRoutesData.walking, ...currentRoutesData.biking, ...currentRoutesData.public_transport];
    var route = allRoutes.find(r => r.id === routeId);

    if (!route) return;

    currentSelectedRoute = route;

    // For public transport routes, show stops if available
    if (route.type === 'public_transport' && route.stops && route.stops.length > 0) {
        // Show stops that were already loaded during route creation
        document.getElementById('route-stops').style.display = 'block';
        updateRouteStopsDisplay(route);
    } else if (route.type === 'public_transport' && route.osm_type !== 'generated') {
        // For real OSM routes, try to fetch stops dynamically
        document.getElementById('route-stops').style.display = 'block';
        document.getElementById('route-stops-list').innerHTML = '<li><i class="fa fa-spinner fa-spin"></i> Carregant parades...</li>';

        fetchRouteStops(route.id, route.osm_id).then(function(stops) {
            route.stops = stops;
            updateRouteStopsDisplay(route);
        }).catch(function(error) {
            console.error('Error loading stops:', error);
            document.getElementById('route-stops-list').innerHTML = '<li>Error carregant parades</li>';
        });
    }

    // Update route details
    document.getElementById('route-detail-title').textContent = route.name;
    document.getElementById('route-detail-description').textContent = route.description || 'Sense descripció';

    // Update route info
    document.getElementById('route-distance').textContent = route.distance || 'N/A';
    document.getElementById('route-elevation').textContent = route.elevation || '';
    document.getElementById('route-difficulty').textContent = route.difficulty || '';
    document.getElementById('route-duration').textContent = route.duration || '';
    document.getElementById('route-frequency').textContent = route.frequency || '';
    document.getElementById('route-first-service').textContent = route.first_bus || route.first_metro || '';
    document.getElementById('route-last-service').textContent = route.last_bus || route.last_metro || '';

    // Hide/show fields based on route type
    var infoItems = document.querySelectorAll('.route-info-item');
    infoItems.forEach(function(item) {
        item.style.display = 'block';
    });

    // Hide irrelevant fields for different route types
    if (route.type === 'public_transport') {
        document.querySelector('.route-info-item:nth-child(2)').style.display = 'none'; // elevation
        document.querySelector('.route-info-item:nth-child(3)').style.display = 'none'; // difficulty
        document.querySelector('.route-info-item:nth-child(4)').style.display = 'none'; // duration
    } else {
        document.querySelector('.route-info-item:nth-child(5)').style.display = 'none'; // frequency
        document.querySelector('.route-info-item:nth-child(6)').style.display = 'none'; // first service
        document.querySelector('.route-info-item:nth-child(7)').style.display = 'none'; // last service
    }

    // Show stops if available (or loading for public transport)
    if (route.type === 'public_transport') {
        document.getElementById('route-stops').style.display = 'block';
        if (route.stops && route.stops.length > 0) {
            updateRouteStopsDisplay(route);
        }
        // Loading message is already shown above
    } else {
        document.getElementById('route-stops').style.display = 'none';
    }

    // Update show route button
    var showBtn = document.getElementById('show-route-btn');
    if (route.type === 'public_transport') {
        if (route.stops && route.stops.length > 0) {
            showBtn.textContent = 'Mostra parades i ruta';
            showBtn.onclick = function() { showPublicTransportRoute(route); };
            showBtn.style.display = 'inline-block';
        } else {
            showBtn.textContent = 'Mostra ruta';
            showBtn.onclick = function() { showSelectedRoute(); };
            showBtn.style.display = 'inline-block';
        }
    } else if (route.osm_type !== 'synthetic') {
        showBtn.textContent = 'Mostra ruta';
        showBtn.onclick = function() { showSelectedRoute(); };
        showBtn.style.display = 'inline-block';
    } else {
        // Hide button for synthetic routes without geometry
        showBtn.style.display = 'none';
    }

    // Show download link for walking/biking routes
    var downloadLink = document.getElementById('route-download-link');
    if (route.type !== 'public_transport' && route.id.startsWith('track')) {
        downloadLink.innerHTML = '<a href="assets/gpx/' + route.id + '.gpx" target="_blank"><i class="fa fa-download"></i> Descarrega GPX</a>';
        downloadLink.style.display = 'block';
    } else {
        downloadLink.style.display = 'none';
    }

    // Show details, hide list
    document.getElementById('routes-content').style.display = 'none';
    document.getElementById('route-details').style.display = 'block';
}

// Function to update stops display for a route
function updateRouteStopsDisplay(route) {
    var stopsList = document.getElementById('route-stops-list');

    if (route.stops && route.stops.length > 0) {
        stopsList.innerHTML = '';
        route.stops.forEach(function(stop) {
            var li = document.createElement('li');
            li.textContent = stop.name;
            stopsList.appendChild(li);
        });
    } else {
        stopsList.innerHTML = '<li>No hi ha parades disponibles</li>';
    }
}

// Function to show public transport stops on map
function showPublicTransportStops(route) {
    if (!route.stops || route.stops.length === 0) return;

    // Clear existing markers
    if (typeof iconLayer !== 'undefined') {
        iconLayer.clearLayers();
    }

    // Filter stops with valid coordinates
    var validStops = route.stops.filter(function(stop) {
        return stop && typeof stop.lat === 'number' && typeof stop.lon === 'number' && !isNaN(stop.lat) && !isNaN(stop.lon);
    });

    if (validStops.length === 0) {
        alert('No hi ha parades amb coordenades vàlides per mostrar al mapa.');
        return;
    }

    // Add markers for each valid stop
    validStops.forEach(function(stop) {
        var marker = L.marker([stop.lat, stop.lon]).addTo(iconLayer);
        marker.bindPopup('<b>' + stop.name + '</b><br/>Parada de ' + route.name);
    });

    // Fit map to show all valid stops
    var bounds = L.latLngBounds(validStops.map(stop => [stop.lat, stop.lon]));
    if (typeof map !== 'undefined') {
        map.fitBounds(bounds, { padding: [20, 20] });
    }

    // Close sidebar
    if (typeof sidebar !== 'undefined') {
        sidebar.close();
    }
}

// Function to hide route details and show list
function hideRouteDetails() {
    document.getElementById('route-details').style.display = 'none';
    document.getElementById('routes-content').style.display = 'block';
    currentSelectedRoute = null;
}

// Function to initialize route layer
function initializeRouteLayer() {
    if (!routeLayer) {
        routeLayer = L.layerGroup().addTo(map);
    }
}

// Function to fetch route geometry and display on map
function fetchAndDisplayRouteGeometry(route) {
    if (!route) return;

    // Clear existing route layer
    if (routeLayer) {
        routeLayer.clearLayers();
    }

    // For relations, fetch the geometry of all ways in the relation
    if (route.osm_type === 'relation') {
        fetchRouteGeometry(route.osm_id).then(function(geometry) {
            if (geometry && geometry.length > 0) {
                displayRouteGeometry(geometry, route);
            } else {
                console.log('No geometry found for route:', route.name);
                // Try alternative geometry fetching for relations
                fetchRouteGeometryAlternative(route.osm_id, route).then(function(geometry) {
                    if (geometry && geometry.length > 0) {
                        displayRouteGeometry(geometry, route);
                    } else {
                        alert('No s\'ha pogut carregar la geometria d\'aquesta ruta.');
                    }
                }).catch(function(error) {
                    console.error('Error in alternative geometry fetch:', error);
                    alert('Error carregant la geometria de la ruta.');
                });
            }
        }).catch(function(error) {
            console.error('Error fetching route geometry:', error);
            alert('Error carregant la geometria de la ruta.');
        });
    } else if (route.osm_type === 'way') {
        // For direct ways, fetch the way geometry
        fetchWayGeometry(route.osm_id).then(function(geometry) {
            if (geometry && geometry.length > 0) {
                displayRouteGeometry([geometry], route);
            } else {
                alert('No s\'ha pogut carregar la geometria d\'aquesta ruta.');
            }
        }).catch(function(error) {
            console.error('Error fetching way geometry:', error);
            alert('Error carregant la geometria de la ruta.');
        });
    } else {
        // For synthetic routes, try to find ways with matching tags
        if (route.type === 'walking' || route.type === 'biking') {
            fetchSyntheticRouteGeometry(route).then(function(geometry) {
                if (geometry && geometry.length > 0) {
                    displayRouteGeometry(geometry, route);
                } else {
                    alert('No s\'ha pogut carregar la geometria d\'aquesta ruta.');
                }
            }).catch(function(error) {
                console.error('Error fetching synthetic route geometry:', error);
                alert('Error carregant la geometria de la ruta.');
            });
        } else {
            alert('Aquesta ruta no té geometria disponible per mostrar al mapa.');
        }
    }
}

// Function to fetch route geometry from Overpass API
function fetchRouteGeometry(osmId) {
    return new Promise(function(resolve, reject) {
        // Get all ways that are members of the route relation with geometry
        var geometryQuery = '[out:json][timeout:30];' +
            'relation(' + osmId + ');' +
            'way(r);' +
            'out geom;';

        console.log('Fetching route geometry for relation:', osmId);
        console.log('Query:', geometryQuery);

        var xhr = new XMLHttpRequest();
        xhr.open('POST', 'https://overpass-api.de/api/interpreter', true);
        xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                if (xhr.status === 200) {
                    try {
                        var data = JSON.parse(xhr.responseText);
                        console.log('Route geometry response for', osmId, ':', data);

                        if (data && data.elements) {
                            // Filter to get only ways (not the relation itself)
                            var ways = data.elements.filter(function(element) {
                                return element.type === 'way';
                            });

                            console.log('Found', ways.length, 'ways in route relation', osmId);

                            if (ways.length > 0) {
                                // Extract coordinates directly from the ways
                                var coordinates = [];
                                ways.forEach(function(way) {
                                    if (way.geometry && way.geometry.length > 0) {
                                        // Convert geometry to lat/lng pairs
                                        var wayCoords = way.geometry.map(function(geom) {
                                            return [geom.lat, geom.lon];
                                        });
                                        if (wayCoords.length > 1) {
                                            coordinates.push(wayCoords);
                                            console.log('Added way geometry with', wayCoords.length, 'points');
                                        }
                                    }
                                });

                                if (coordinates.length > 0) {
                                    console.log('Returning', coordinates.length, 'way geometries for route', osmId);
                                    resolve(coordinates);
                                } else {
                                    console.log('No valid coordinates found, trying alternative approach for route', osmId);
                                    // Try alternative approach for public transport routes
                                    fetchPublicTransportGeometryAlternative(osmId).then(function(altCoordinates) {
                                        resolve(altCoordinates);
                                    }).catch(function(error) {
                                        console.error('Alternative geometry fetch also failed:', error);
                                        resolve([]);
                                    });
                                }
                            } else {
                                console.log('No ways found in route relation', osmId, '- trying alternative approach');
                                // Try alternative approach for public transport routes
                                fetchPublicTransportGeometryAlternative(osmId).then(function(altCoordinates) {
                                    resolve(altCoordinates);
                                }).catch(function(error) {
                                    console.error('Alternative geometry fetch also failed:', error);
                                    resolve([]);
                                });
                            }
                        } else {
                            console.log('No elements in response for route', osmId);
                            resolve([]);
                        }
                    } catch (e) {
                        console.error('Error parsing route geometry response:', e);
                        reject(e);
                    }
                } else {
                    console.error('HTTP error fetching route geometry:', xhr.status, xhr.responseText);
                    reject(new Error('HTTP ' + xhr.status));
                }
            }
        };
        xhr.send('data=' + encodeURIComponent(geometryQuery));
    });
}

// Alternative geometry fetching for public transport routes
function fetchPublicTransportGeometryAlternative(osmId) {
    return new Promise(function(resolve, reject) {
        console.log('Trying alternative geometry fetch for public transport route:', osmId);

        // For public transport routes, get the stops and create a route connecting them
        var altQuery = '[out:json][timeout:25];' +
            'relation(' + osmId + ');' +
            'node(r);' +
            'out;';

        console.log('Alternative query for PT route:', altQuery);

        var xhr = new XMLHttpRequest();
        xhr.open('POST', 'https://overpass-api.de/api/interpreter', true);
        xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                if (xhr.status === 200) {
                    try {
                        var data = JSON.parse(xhr.responseText);
                        console.log('Alternative PT geometry response:', data);

                        if (data && data.elements) {
                            // Find the relation and its stop nodes
                            var relation = data.elements.find(function(el) {
                                return el.type === 'relation' && el.id == osmId;
                            });

                            if (relation && relation.members) {
                                var stopNodes = [];
                                data.elements.forEach(function(element) {
                                    if (element.type === 'node') {
                                        stopNodes[element.id] = element;
                                    }
                                });

                                // Collect stop coordinates in order
                                var stopCoords = [];
                                relation.members.forEach(function(member) {
                                    if (member.type === 'node' &&
                                        (member.role === 'stop' ||
                                         member.role === 'stop_entry_only' ||
                                         member.role === 'stop_exit_only' ||
                                         member.role === 'platform' ||
                                         member.role === 'platform_entry_only' ||
                                         member.role === 'platform_exit_only') &&
                                        stopNodes[member.ref]) {
                                        var node = stopNodes[member.ref];
                                        stopCoords.push([node.lat, node.lon]);
                                    }
                                });

                                console.log('Found', stopCoords.length, 'ordered stop coordinates for route', osmId);

                                if (stopCoords.length >= 2) {
                                    // Create a route connecting the stops in order
                                    console.log('Creating route from stop coordinates:', stopCoords);
                                    resolve([stopCoords]);
                                } else if (stopCoords.length === 1) {
                                    // Only one stop, can't create a route
                                    console.log('Only one stop found, cannot create route');
                                    resolve([]);
                                } else {
                                    console.log('No valid stop coordinates found for route', osmId);
                                    resolve([]);
                                }
                            } else {
                                console.log('No relation or members found for', osmId);
                                resolve([]);
                            }
                        } else {
                            console.log('No data elements in response for', osmId);
                            resolve([]);
                        }
                    } catch (e) {
                        console.error('Error in alternative PT geometry:', e);
                        reject(e);
                    }
                } else {
                    console.error('HTTP error in PT geometry fetch:', xhr.status);
                    reject(new Error('HTTP ' + xhr.status));
                }
            }
        };
        xhr.send('data=' + encodeURIComponent(altQuery));
    });
}

// Fetch nearby ways with public transport tags
function fetchNearbyPublicTransportWays(stopCoords) {
    return new Promise(function(resolve, reject) {
        if (!stopCoords || stopCoords.length === 0) {
            resolve([]);
            return;
        }

        // Calculate center of stops
        var centerLat = 0, centerLon = 0;
        stopCoords.forEach(function(coord) {
            centerLat += coord[0];
            centerLon += coord[1];
        });
        centerLat /= stopCoords.length;
        centerLon /= stopCoords.length;

        console.log('Searching for PT ways around center:', centerLat, centerLon);

        // Search for ways with public transport tags around the center
        var nearbyQuery = '[out:json][timeout:25];' +
            'way(around:500,' + centerLat + ',' + centerLon + ')[highway];' +
            'way(around:500,' + centerLat + ',' + centerLon + ')[railway];' +
            'node(w);' +
            'out geom;';

        var xhr = new XMLHttpRequest();
        xhr.open('POST', 'https://overpass-api.de/api/interpreter', true);
        xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                if (xhr.status === 200) {
                    try {
                        var data = JSON.parse(xhr.responseText);
                        console.log('Nearby PT ways response:', data);

                        if (data && data.elements) {
                            var coordinates = [];

                            // Extract coordinates from nodes
                            var nodes = {};
                            data.elements.forEach(function(element) {
                                if (element.type === 'node') {
                                    nodes[element.id] = [element.lat, element.lon];
                                }
                            });

                            // Build polylines from ways
                            data.elements.forEach(function(element) {
                                if (element.type === 'way' && element.nodes) {
                                    var wayCoords = [];
                                    element.nodes.forEach(function(nodeId) {
                                        if (nodes[nodeId]) {
                                            wayCoords.push(nodes[nodeId]);
                                        }
                                    });
                                    if (wayCoords.length > 1) {
                                        coordinates.push(wayCoords);
                                    }
                                }
                            });

                            console.log('Found', coordinates.length, 'nearby transport ways');
                            resolve(coordinates);
                        } else {
                            resolve([]);
                        }
                    } catch (e) {
                        console.error('Error parsing nearby PT ways:', e);
                        reject(e);
                    }
                } else {
                    reject(new Error('HTTP ' + xhr.status));
                }
            }
        };
        xhr.send('data=' + encodeURIComponent(nearbyQuery));
    });
}

// Function to fetch geometry for multiple ways
function fetchWaysGeometry(wayIds) {
    return new Promise(function(resolve, reject) {
        if (wayIds.length === 0) {
            resolve([]);
            return;
        }

        // Build query for all ways
        var waysQuery = '[out:json][timeout:25];';
        wayIds.forEach(function(wayId) {
            waysQuery += 'way(' + wayId + ');';
        });
        waysQuery += 'node(w);out geom;';

        console.log('Fetching geometry for ways:', wayIds.length, 'ways');

        var xhr = new XMLHttpRequest();
        xhr.open('POST', 'https://overpass-api.de/api/interpreter', true);
        xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                if (xhr.status === 200) {
                    try {
                        var data = JSON.parse(xhr.responseText);
                        var coordinates = [];

                        if (data && data.elements) {
                            // Extract coordinates from nodes
                            var nodes = {};
                            data.elements.forEach(function(element) {
                                if (element.type === 'node') {
                                    nodes[element.id] = [element.lat, element.lon];
                                }
                            });

                            console.log('Found', Object.keys(nodes).length, 'nodes');

                            // Build polylines from ways
                            data.elements.forEach(function(element) {
                                if (element.type === 'way' && element.nodes) {
                                    var wayCoords = [];
                                    element.nodes.forEach(function(nodeId) {
                                        if (nodes[nodeId]) {
                                            wayCoords.push(nodes[nodeId]);
                                        }
                                    });
                                    if (wayCoords.length > 1) {
                                        coordinates.push(wayCoords);
                                        console.log('Added way with', wayCoords.length, 'coordinates');
                                    }
                                }
                            });
                        }

                        console.log('Returning', coordinates.length, 'way geometries');
                        resolve(coordinates);
                    } catch (e) {
                        console.error('Error parsing ways geometry response:', e);
                        reject(e);
                    }
                } else {
                    console.error('HTTP error fetching ways geometry:', xhr.status);
                    reject(new Error('HTTP ' + xhr.status));
                }
            }
        };
        xhr.send('data=' + encodeURIComponent(waysQuery));
    });
}

// Alternative geometry fetching for relations that might have different structures
function fetchRouteGeometryAlternative(osmId, route) {
    return new Promise(function(resolve, reject) {
        // Try fetching ways that have route-related tags
        var routeType = route.type === 'walking' ? 'hiking' : (route.type === 'biking' ? 'bicycle' : 'bus');
        var alternativeQuery = '[out:json][timeout:25];' +
            'way(around:1000,' + baseLocation.lat + ',' + baseLocation.lng + ')[route=' + routeType + '];' +
            'way(around:1000,' + baseLocation.lat + ',' + baseLocation.lng + ')[highway=path];' +
            'way(around:1000,' + baseLocation.lat + ',' + baseLocation.lng + ')[highway=footway];' +
            'way(around:1000,' + baseLocation.lat + ',' + baseLocation.lng + ')[highway=cycleway];' +
            'node(w);' +
            'out geom;';

        var xhr = new XMLHttpRequest();
        xhr.open('POST', 'https://overpass-api.de/api/interpreter', true);
        xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                if (xhr.status === 200) {
                    try {
                        var data = JSON.parse(xhr.responseText);
                        var coordinates = [];

                        if (data && data.elements) {
                            // Extract coordinates from nodes
                            var nodes = {};
                            data.elements.forEach(function(element) {
                                if (element.type === 'node') {
                                    nodes[element.id] = [element.lat, element.lon];
                                }
                            });

                            // Build polylines from ways
                            data.elements.forEach(function(element) {
                                if (element.type === 'way' && element.nodes) {
                                    var wayCoords = [];
                                    element.nodes.forEach(function(nodeId) {
                                        if (nodes[nodeId]) {
                                            wayCoords.push(nodes[nodeId]);
                                        }
                                    });
                                    if (wayCoords.length > 1) {
                                        coordinates.push(wayCoords);
                                    }
                                }
                            });
                        }

                        resolve(coordinates);
                    } catch (e) {
                        reject(e);
                    }
                } else {
                    reject(new Error('HTTP ' + xhr.status));
                }
            }
        };
        xhr.send('data=' + encodeURIComponent(alternativeQuery));
    });
}

// Function to fetch geometry for a single way
function fetchWayGeometry(wayId) {
    return new Promise(function(resolve, reject) {
        var wayQuery = '[out:json][timeout:15];' +
            'way(' + wayId + ');' +
            'node(w);' +
            'out geom;';

        var xhr = new XMLHttpRequest();
        xhr.open('POST', 'https://overpass-api.de/api/interpreter', true);
        xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                if (xhr.status === 200) {
                    try {
                        var data = JSON.parse(xhr.responseText);
                        var coordinates = [];

                        if (data && data.elements) {
                            // Extract coordinates from nodes
                            var nodes = {};
                            data.elements.forEach(function(element) {
                                if (element.type === 'node') {
                                    nodes[element.id] = [element.lat, element.lon];
                                }
                            });

                            // Build polyline from the way
                            data.elements.forEach(function(element) {
                                if (element.type === 'way' && element.nodes) {
                                    var wayCoords = [];
                                    element.nodes.forEach(function(nodeId) {
                                        if (nodes[nodeId]) {
                                            wayCoords.push(nodes[nodeId]);
                                        }
                                    });
                                    if (wayCoords.length > 1) {
                                        coordinates = wayCoords;
                                    }
                                }
                            });
                        }

                        resolve(coordinates);
                    } catch (e) {
                        reject(e);
                    }
                } else {
                    reject(new Error('HTTP ' + xhr.status));
                }
            }
        };
        xhr.send('data=' + encodeURIComponent(wayQuery));
    });
}

// Function to fetch geometry for synthetic routes
function fetchSyntheticRouteGeometry(route) {
    return new Promise(function(resolve, reject) {
        var bounds = baseLocation.bounds;
        if (!bounds) {
            resolve([]);
            return;
        }

        var bbox = bounds.getSouth() + ',' + bounds.getWest() + ',' + bounds.getNorth() + ',' + bounds.getEast();
        var syntheticQuery = '[out:json][timeout:20];';

        if (route.type === 'walking') {
            syntheticQuery += '(way(' + bbox + ')[highway=path];way(' + bbox + ')[highway=footway];);';
        } else if (route.type === 'biking') {
            syntheticQuery += '(way(' + bbox + ')[highway=cycleway];way(' + bbox + ')[cycleway];);';
        }

        syntheticQuery += 'node(w);out geom;';

        var xhr = new XMLHttpRequest();
        xhr.open('POST', 'https://overpass-api.de/api/interpreter', true);
        xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                if (xhr.status === 200) {
                    try {
                        var data = JSON.parse(xhr.responseText);
                        var coordinates = [];

                        if (data && data.elements) {
                            // Extract coordinates from nodes
                            var nodes = {};
                            data.elements.forEach(function(element) {
                                if (element.type === 'node') {
                                    nodes[element.id] = [element.lat, element.lon];
                                }
                            });

                            // Build polylines from ways
                            data.elements.forEach(function(element) {
                                if (element.type === 'way' && element.nodes) {
                                    var wayCoords = [];
                                    element.nodes.forEach(function(nodeId) {
                                        if (nodes[nodeId]) {
                                            wayCoords.push(nodes[nodeId]);
                                        }
                                    });
                                    if (wayCoords.length > 1) {
                                        coordinates.push(wayCoords);
                                    }
                                }
                            });
                        }

                        resolve(coordinates);
                    } catch (e) {
                        reject(e);
                    }
                } else {
                    reject(new Error('HTTP ' + xhr.status));
                }
            }
        };
        xhr.send('data=' + encodeURIComponent(syntheticQuery));
    });
}

// Function to display route geometry on map
function displayRouteGeometry(coordinates, route) {
    if (!routeLayer || !coordinates || coordinates.length === 0) return;

    // Clear existing route
    routeLayer.clearLayers();

    console.log('Displaying route geometry for:', route.name);
    console.log('Route tags:', route.tags);
    console.log('Route color will be:', getRouteColor(route.type, route));

    // Add polylines for each way in the route
    coordinates.forEach(function(wayCoords, index) {
        if (wayCoords.length > 1) {
            var color = getRouteColor(route.type, route);
            var polyline = L.polyline(wayCoords, {
                color: color,
                weight: 5,
                opacity: 0.8
            }).addTo(routeLayer);

            // Create popup with route information
            var popupContent = '<b>' + route.name + '</b><br/>';
            popupContent += '<small>' + getRouteTypeName(route.type) + '</small><br/>';

            if (route.tags) {
                if (route.tags.ref) {
                    popupContent += '<small>Ref: ' + route.tags.ref + '</small><br/>';
                }
                if (route.tags.colour || route.tags.color) {
                    var routeColor = route.tags.colour || route.tags.color;
                    popupContent += '<small>Color: ' + routeColor + '</small><br/>';
                }
            }

            // Add expert mode link like POIs have
            popupContent += '<br/><a href="#" onclick="javascript: showRouteExpertInfo(\'' + route.id + '\'); return false;" data-i18n="[title]route_detailed_info">Informació al detall (expert)</a>';

            polyline.bindPopup(popupContent);
            console.log('Added polyline', index + 1, 'with', wayCoords.length, 'points and color', color);
        }
    });

    // Fit map to show the entire route
    if (coordinates.length > 0) {
        var allCoords = coordinates.flat();
        var bounds = L.latLngBounds(allCoords);
        map.fitBounds(bounds, { padding: [20, 20] });
    }

    console.log('Successfully displayed route geometry for:', route.name, 'with', coordinates.length, 'segments');
}

// Function to get route color based on type and OSM tags
function getRouteColor(type, route) {
    // Check if route has a specific color defined in OSM tags
    if (route && route.tags) {
        if (route.tags.colour) return route.tags.colour;
        if (route.tags.color) return route.tags.color;
    }

    // Default colors based on route type
    switch(type) {
        case 'walking': return '#FF6B35'; // Orange for walking
        case 'biking': return '#4ECDC4'; // Teal for biking
        case 'public_transport': return '#45B7D1'; // Blue for transport
        default: return '#666';
    }
}

// Function to show public transport route (stops + geometry)
function showPublicTransportRoute(route) {
    if (!route) return;

    console.log('Showing public transport route:', route.name, 'ID:', route.id);
    console.log('Route has', route.stops ? route.stops.length : 0, 'stops');

    // Initialize route layer if needed
    initializeRouteLayer();

    // Clear existing markers and routes
    if (typeof iconLayer !== 'undefined') {
        iconLayer.clearLayers();
    }
    if (routeLayer) {
        routeLayer.clearLayers();
    }

    // First show the stops
    if (route.stops && route.stops.length > 0) {
        console.log('Showing', route.stops.length, 'stops for route:', route.name);
        showPublicTransportStops(route);
    } else {
        console.log('No stops available for route:', route.name);
    }

    // For public transport routes, directly create geometry from stops
    if (route.stops && route.stops.length >= 2) {
        console.log('Creating route geometry directly from', route.stops.length, 'stops');

        // Extract coordinates from stops in order
        var stopCoords = route.stops.map(function(stop) {
            return [stop.lat, stop.lon];
        });

        console.log('Stop coordinates for route:', stopCoords);

        // Display the route geometry directly
        displayRouteGeometry([stopCoords], route);
        console.log('Route geometry displayed from stops');
    } else {
        console.log('Not enough stops to create route geometry, trying Overpass query');

        // Fallback to Overpass query method
        fetchAndDisplayRouteGeometry(route).then(function(success) {
            console.log('Route geometry display completed via Overpass for:', route.name);
        }).catch(function(error) {
            console.error('Error displaying route geometry via Overpass:', error);
        });
    }

    // Close sidebar
    if (typeof sidebar !== 'undefined') {
        sidebar.close();
    }
}

// Function to show selected route on map
function showSelectedRoute() {
    if (!currentSelectedRoute) return;

    // Initialize route layer if needed
    initializeRouteLayer();

    // For walking/biking routes, fetch and display geometry
    if (currentSelectedRoute.type !== 'public_transport') {
        fetchAndDisplayRouteGeometry(currentSelectedRoute);
    }

    // For GPX routes (fallback), load the GPX file
    if (currentSelectedRoute.type !== 'public_transport' && currentSelectedRoute.id.startsWith('track')) {
        var gpxUrl = 'assets/gpx/' + currentSelectedRoute.id + '.gpx';
        addgpx(gpxUrl);
    }

    // Close the sidebar to show the map
    if (typeof sidebar !== 'undefined') {
        sidebar.close();
    }
}

// Function to clear current route
function clearRoute() {
    cleargpx(); // Clear GPX layers
    if (routeLayer) {
        routeLayer.clearLayers(); // Clear route geometry
    }
    if (typeof sidebar !== 'undefined') {
        sidebar.close();
    }
}

// Function to get route icon based on type
function getRouteIcon(type) {
    switch(type) {
        case 'walking': return 'fa-walking';
        case 'biking': return 'fa-bicycle';
        case 'public_transport': return 'fa-bus';
        default: return 'fa-route';
    }
}

// Function to get route type name
function getRouteTypeName(type) {
    switch(type) {
        case 'walking': return 'Ruta a peu';
        case 'biking': return 'Ruta en bicicleta';
        case 'public_transport': return 'Transport públic';
        default: return 'Ruta';
    }
}

// Function to manually reload routes
function reloadRoutes() {
    console.log('Manually reloading routes for location:', baseLocation.name);
    initializeRoutes();
}

// Function to update routes when location changes
function updateRoutesForNewLocation() {
    // This will be called when baseLocation changes
    setTimeout(function() {
        initializeRoutes();
    }, 100); // Small delay to ensure location is set
}

// Function to parse OSMC symbol format
function parseOsmcSymbol(symbol) {
    if (!symbol || typeof symbol !== 'string') {
        return symbol;
    }

    // OSMC symbol format: background:text:text_rotation:additional_text
    // Example: yellow:white:yellow_lower:143.1:black
    var parts = symbol.split(':');

    try {
        var backgroundColor = parts[0] || '';
        var textColor = parts[1] || '';
        var backgroundLower = parts[2] || '';
        var textRotation = parts[3] || '';
        var additionalText = parts[4] || '';

        // Create visual representation
        var visualHtml = createOsmcSymbolVisual(symbol, backgroundColor, textColor, backgroundLower, textRotation, additionalText);

        return visualHtml;

    } catch (error) {
        console.error('Error parsing OSMC symbol:', symbol, error);
        return symbol + ' (error parsing)';
    }
}

// Function to create visual representation of OSMC symbol
function createOsmcSymbolVisual(symbol, backgroundColor, textColor, backgroundLower, textRotation, additionalText) {
    var bgHex = getOsmcHexColor(backgroundColor);
    var textHex = getOsmcHexColor(textColor);
    var lowerHex = backgroundLower.includes('_lower') ? getOsmcHexColor(backgroundLower.replace('_lower', '')) : bgHex;

    var visualHtml = '<div style="display: inline-block; margin-right: 10px; vertical-align: middle;" title="' + symbol + '">';
    visualHtml += '<svg width="60" height="30" viewBox="0 0 60 30" xmlns="http://www.w3.org/2000/svg">';

    // Background rectangle (upper part)
    visualHtml += '<rect x="0" y="0" width="60" height="15" fill="' + bgHex + '" stroke="#000" stroke-width="1"/>';

    // Lower background rectangle
    visualHtml += '<rect x="0" y="15" width="60" height="15" fill="' + lowerHex + '" stroke="#000" stroke-width="1"/>';

    // Add rotation angle text if present
    if (textRotation && textRotation !== '') {
        visualHtml += '<text x="55" y="12" font-family="Arial" font-size="6" fill="#000" text-anchor="end">' + textRotation + '°</text>';
    }

    // Text/symbol (simplified as a symbol)
    if (additionalText && additionalText !== '') {
        // Add rotated text
        var rotation = textRotation ? parseFloat(textRotation) : 0;
        visualHtml += '<text x="30" y="22" font-family="Arial" font-size="8" fill="' + textHex + '" text-anchor="middle" transform="rotate(' + rotation + ' 30 22)">' + additionalText.charAt(0).toUpperCase() + '</text>';
    } else {
        // Default symbol (arrow or similar)
        visualHtml += '<polygon points="25,8 35,15 25,22" fill="' + textHex + '"/>';
    }

    visualHtml += '</svg>';
    visualHtml += '</div>';

    return visualHtml;
}

// Function to create text interpretation of OSMC symbol
function createOsmcSymbolText(symbol, backgroundColor, textColor, backgroundLower, textRotation, additionalText) {
    var interpretation = '<small>' + symbol + ' → ';

    // Interpret background color
    var bgDescription = getOsmcColorDescription(backgroundColor);
    interpretation += 'Fons: ' + bgDescription;

    // Interpret text/symbol color
    if (textColor) {
        var textDescription = getOsmcColorDescription(textColor);
        interpretation += ', Text/Símbol: ' + textDescription;
    }

    // Interpret lower background
    if (backgroundLower && backgroundLower !== backgroundColor) {
        if (backgroundLower.includes('_lower')) {
            var lowerColor = backgroundLower.replace('_lower', '');
            var lowerDescription = getOsmcColorDescription(lowerColor);
            interpretation += ', Part inferior: ' + lowerDescription;
        } else {
            var lowerDescription = getOsmcColorDescription(backgroundLower);
            interpretation += ', Part inferior: ' + lowerDescription;
        }
    }

    // Add rotation if present
    if (textRotation && textRotation !== '') {
        interpretation += ', Rotació: ' + textRotation + '°';
    }

    // Add additional text if present
    if (additionalText && additionalText !== '') {
        interpretation += ', Text addicional: ' + additionalText;
    }

    interpretation += '</small>';
    return interpretation;
}

// Function to get human-readable description of OSMC colors
function getOsmcColorDescription(color) {
    var colorMap = {
        'white': 'Blanc',
        'yellow': 'Groc',
        'orange': 'Taronja',
        'red': 'Vermell',
        'blue': 'Blau',
        'green': 'Verd',
        'brown': 'Marró',
        'black': 'Negre',
        'gray': 'Gris',
        'purple': 'Lila',
        'pink': 'Rosa'
    };

    return colorMap[color] || color;
}

// Function to get hex color values for OSMC colors
function getOsmcHexColor(color) {
    var hexMap = {
        'white': '#FFFFFF',
        'yellow': '#FFFF00',
        'orange': '#FFA500',
        'red': '#FF0000',
        'blue': '#0000FF',
        'green': '#008000',
        'brown': '#8B4513',
        'black': '#000000',
        'gray': '#808080',
        'purple': '#800080',
        'pink': '#FFC0CB'
    };

    return hexMap[color] || '#FFFFFF'; // Default to white if unknown
}

// Function to show route information in expert mode
function showRouteExpertInfo(routeId) {
    var allRoutes = [...currentRoutesData.walking, ...currentRoutesData.biking, ...currentRoutesData.public_transport];
    var route = allRoutes.find(r => r.id === routeId);

    if (!route) {
        console.error('Route not found for expert info:', routeId);
        return;
    }

    // Create expert mode content similar to POIs
    var expertContent = '<h2>Etiquetes de la ruta</h2>';
    expertContent += '<h3>' + route.name + '</h3>';
    expertContent += '<table>';

    // Add basic route information
    expertContent += '<tr><td><strong>OSM ID</strong></td><td>' + route.osm_id + '</td></tr>';
    expertContent += '<tr><td><strong>OSM Type</strong></td><td>' + route.osm_type + '</td></tr>';
    expertContent += '<tr><td><strong>Route Type</strong></td><td>' + route.type + '</td></tr>';

    // Add all tags from the route
    if (route.tags) {
        for (var tag in route.tags) {
            if (route.tags.hasOwnProperty(tag)) {
                var tagValue = route.tags[tag];
                var displayValue = tagValue;

                // Special handling for osmc:symbol
                if (tag === 'osmc:symbol') {
                    displayValue = parseOsmcSymbol(tagValue);
                }

                expertContent += '<tr><td><strong>' + tag + '</strong></td><td>' + displayValue + '</td></tr>';
            }
        }
    }

    expertContent += '</table>';

    // Add action links
    expertContent += '<h2>Accions</h2>';

    if (route.osm_type === 'relation') {
        // View in OpenStreetMap
        var viewLink = 'http://www.openstreetmap.org/relation/' + route.osm_id;
        expertContent += '<a href="' + viewLink + '" target="_blank">Visualitza a OpenStreetMap</a><br/>';

        // Edit in OpenStreetMap
        var editLink = 'http://www.openstreetmap.org/edit?editor=id&relation=' + route.osm_id;
        expertContent += '<a href="' + editLink + '" target="_blank">Edita a OpenStreetMap</a><br/>';
    }

    // Update the developer panel content
    $('#developer p.tags').html(expertContent);

    // Open the developer sidebar
    if (typeof sidebar !== 'undefined') {
        sidebar.open('developer');
    }

    console.log('Displayed expert info for route:', route.name, 'with OSM ID:', route.osm_id);
}

// Routes will be initialized when a location is selected via updateRoutesForNewLocation()
