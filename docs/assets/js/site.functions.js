// Query control
var isQueryRunning = false;
var currentOverPassLayer = null; // Reference to current OverPassLayer for cancellation

function get_poi(element) {
    if ($('#expert-mode').is(':checked'))
	return {
	    name: 'Custom Query',
	    iconName: 'notvisited'
	}

    // TODO: improve this
    var type = ''
    if (e.tags.internet_access) type = 'internet_access';
    if (e.tags.highway) {
        if (type == '') type = e.tags.highway;
    }
    if (e.tags.amenity) {
        if (type == '') type = e.tags.amenity;
    }
    if (e.tags.tourism) {
        if (type == '') type = e.tags.tourism;
    }
    if (e.tags.shop) {
	if (e.tags.car_repair == 'wheel_repair') type = 'wheel_repair';
	if (type == '') type = e.tags.shop;
    }
    if (e.tags.sport) {
	if (e.tags.shooting == 'paintball') type = 'paintball';
	if (type == '') type = e.tags.shooting;
    }
    if (e.tags.leisure) {
	if (type == '') type = e.tags.leisure;
    }
    if (e.tags.office) {
	if (type == '') type = e.tags.office;
    }
    if (e.tags.craft) {
	if (type == '') type = e.tags.craft;
    }
    if (e.tags.historic) {
	if (type == '') type = e.tags.historic;
    }

    var poi = pois[type];
    return poi;
}


// https://github.com/kartenkarsten/leaflet-layer-overpass
function callback(data) {
    // Only process results if query is still running (not manually cancelled)
    if (!isQueryRunning) {
        // Query was cancelled, don't process results
        return;
    }

    // When first results arrive, abort all remaining requests to prevent 429 errors
    // but keep processing these results
    if (currentOverPassLayer && typeof currentOverPassLayer.abortActiveRequests === 'function') {
        currentOverPassLayer.abortActiveRequests();
    }

    // Process results and ensure spinner stops
    if (spinner > 0) spinner -= 1;

    // Always hide spinner and reset state when results are received
    // This ensures spinner stops even if counter logic is off
    $('#spinner').hide();
    isQueryRunning = false;
    updateQueryButton();

    // Clear timeout since query completed successfully
    if (window.queryTimeout) {
        clearTimeout(window.queryTimeout);
        window.queryTimeout = null;
    }

    for(i=0; i < data.elements.length; i++) {
	e = data.elements[i];

	if (e.id in this.instance._ids) return;
	this.instance._ids[e.id] = true;

	var pos = (e.type == 'node') ?
	    new L.LatLng(e.lat, e.lon) :
	    new L.LatLng(e.center.lat, e.center.lon);

	var poi = get_poi(e)
	// skip this undefined icon
	if (!poi) {
	    console.info('Skipping undefined icon: "' + type + '"');
	    continue;
	}

	var markerIcon  = L.icon({
	    iconUrl: 'assets/img/icons/' + poi.iconName + '.png',
	    iconSize: [32, 37],
	    iconAnchor: [18.5, 35],
	    popupAnchor: [0, -27]
	});
	var marker = L.marker(pos, {
	    icon: markerIcon,
	    keyboard: false
	})

	// show a label next to the icon on mouse hover
	if (e.tags.name || e.tags['name:en'] || e.tags['name:es'] || e.tags['name:ca']) {
	    marker.bindLabel(
		getLocalizedName(e.tags),
		{direction: 'auto', offset: [27, -32]}
	    );
	}

	// used to show the expert mode panel side
	marker._element = e;
	marker.on('click', function(e) {
	    var element = e.target._element;
	    $('#developer > .tags').html(develop_parser(element));
	});

	if (poi.tagParser) var markerPopup = poi.tagParser(e);
	else var markerPopup = generic_poi_parser(e, poi.name);

	marker.bindPopup(markerPopup);
	marker.addTo(this.instance);
    }
}

function build_overpass_query() {
    query = '';

    // Collect all selected POI queries
    var selectedQueries = [];
    $('#pois input:checked').each(function(i, element) {
        selectedQueries.push(pois[element.dataset.key].query);
    });

    // Check if we have a base location with OSM relation ID (for areas/regions)
    if (typeof baseLocation !== 'undefined' && baseLocation.osm_id && baseLocation.osm_type === 'relation') {
        // Use area query for relations - area ID is relation ID + 3600000000
        var areaId = parseInt(baseLocation.osm_id) + 3600000000;
        query = '(area(' + areaId + ');';
        // Use separate nwr statements for each POI type
        if (selectedQueries.length > 0) {
            selectedQueries.forEach(function(q) {
                query += 'nwr(area)' + q + ';';
            });
        }
        query += ');out center;';
    } else if (typeof baseLocation !== 'undefined' && baseLocation.bounds) {
        // Use bbox query for selected locations (cities, towns, etc.)
        var bounds = baseLocation.bounds;
        var bboxString = bounds.getSouth() + ',' + bounds.getWest() + ',' + bounds.getNorth() + ',' + bounds.getEast();
        query = '(';
        // Use separate nwr statements for each POI type
        if (selectedQueries.length > 0) {
            selectedQueries.forEach(function(q) {
                query += 'nwr(' + bboxString + ')' + q + ';';
            });
        }
        query += ');out center;';
    } else {
        // Fall back to current map view bbox when no location is selected
        query = '(';
        // Use separate nwr statements for each POI type
        if (selectedQueries.length > 0) {
            selectedQueries.forEach(function(q) {
                query += 'nwr(BBOX)' + q + ';';
            });
        }
        query += ');out center;';
    }
}

function setting_changed() {
    // remove pois from current map
    iconLayer.clearLayers();
    // uncheck the expert mode
    $('#expert-mode').attr('checked', false);
    $('#expert-form').hide();

    // Only make queries if POIs are actually selected
    var checkedPois = $('#pois input:checked');
    if (checkedPois.length > 0) {
        build_overpass_query();
        show_overpass_layer();
    }
}

function show_pois_checkboxes() {
    // build the content for the "Home" sidebar pane
    var i = 0;
    var content = '';
    content += '<table>';
    for (poi in pois) {
	if (i % 2 == 0) content += '<tr>';
	content += '<td>';
	var checkbox = Mustache.render(
	    '<div class="poi-checkbox"> \
		<label> \
		    <img src="assets/img/icons/{{icon}}.png"></img> \
		    <input type="checkbox" data-key="{{key}}"><span>{{name}}</span> \
		</label> \
	    </div>',
	    {key: poi, name: pois[poi].name, icon: pois[poi].iconName}
	);
	content += checkbox;
	content += '</td>';
	i++;
	if (i % 2 == 0) content += '</tr>';
    }
    content += '</table>';
    $('#pois').html(content); // Use .html() instead of .append() to replace content
}

function show_overpass_layer() {
    // remove tags from expert mode
    $('#develop p.tags').html('');

    if (query == '' || query == '();out center;') {
	console.debug('There is nothing selected to filter by.');
	return;
    }

    // Create custom error callback
    var errorCallback = function(error) {
        console.warn('Overpass query error:', error);
        // Stop spinner and reset state on error
        $('#spinner').hide();
        isQueryRunning = false;
        updateQueryButton();

        // Clear timeout if it exists
        if (window.queryTimeout) {
            clearTimeout(window.queryTimeout);
            window.queryTimeout = null;
        }
    };

    var opl = new L.OverPassLayer({
	query: query,
	callback: callback,
	minzoom: 14,
	autoQuery: false, // Disable automatic queries, only manual
	queryTimeout: 2000, // 2 second timeout between queries
	errorCallback: errorCallback // Add error handling
    });

    // Store reference to current OverPassLayer for cancellation
    currentOverPassLayer = opl;

    iconLayer.addLayer(opl);

    // Manually trigger the query execution since autoQuery is disabled
    opl.onMoveEnd();
}

function get_permalink() {
    var uri = URI(window.location.href);
    var selectedPois = [];
    $('#pois input:checked').each(function(i, element) {
	selectedPois.push(element.dataset.key);
    });

    uri.query({'pois': selectedPois, 'norestoreview': true});
    return uri.href();
}

function update_permalink() {
    var link = get_permalink();
    $('#permalink').attr('href', link);
}

function expert_call() {
    // Prevent multiple concurrent queries
    if (isQueryRunning) {
        alert('Ja hi ha una consulta en curs. Espera que acabi abans de fer-ne una altra.');
        return;
    }

    var value = $('input[name=query]').attr('value');

    query = '(';
    query += 'node(BBOX){{value}};';
    query += 'way(BBOX){{value}};';
    query += 'relation(BBOX){{value}};';
    query += ');out center;';
    query = Mustache.render(
	query,
	{value: value}
    )
    console.debug(query);

    // Set query running flag
    isQueryRunning = true;

    // uncheck all the POIs to avoid confusion
    // $('#pois input').attr('checked', false);
    iconLayer.clearLayers();
    show_overpass_layer();
}

function manualPoiQuery() {
    // Only start queries - stopping is handled by separate stopQuery() function

    // Only make queries if POIs are actually selected
    var checkedPois = $('#pois input:checked');
    if (checkedPois.length === 0) {
        alert(getTranslation('poi_select_at_least_one') || 'Selecciona almenys un punt d\'interès abans de fer la consulta.');
        return;
    }

    // If too many POIs selected, automatically deselect some to avoid query failures
    if (checkedPois.length > 5) {
        // Keep only the first 5 selected POIs
        $('#pois input:checked').slice(5).prop('checked', false);
        alert(getTranslation('poi_too_many_selected') || 'S\'han seleccionat massa punts d\'interès. S\'han desmarcat alguns automàticament per evitar errors de consulta.');
        checkedPois = $('#pois input:checked');
    }

    // Cancel any existing query first
    if (isQueryRunning && currentOverPassLayer && typeof currentOverPassLayer.abortActiveRequests === 'function') {
        currentOverPassLayer.abortActiveRequests();
    }

    // Reset spinner counter and set timeout to force stop if needed
    spinner = 0;
    $('#spinner').show();

    // Set a timeout to force stop the spinner after 30 seconds (in case of hanging queries)
    if (window.queryTimeout) {
        clearTimeout(window.queryTimeout);
    }
    window.queryTimeout = setTimeout(function() {
        if (isQueryRunning) {
            console.warn('Query timeout - forcing stop');
            $('#spinner').hide();
            isQueryRunning = false;
            updateQueryButton();
            if (currentOverPassLayer && typeof currentOverPassLayer.abortActiveRequests === 'function') {
                currentOverPassLayer.abortActiveRequests();
            }
        }
    }, 30000); // 30 second timeout

    // Set query running flag
    isQueryRunning = true;
    updateQueryButton();

    // Clear existing POIs and make new query
    iconLayer.clearLayers();
    build_overpass_query();
    show_overpass_layer();
}

function stopQuery() {
    // Stop the current query and abort active requests
    isQueryRunning = false;
    $('#spinner').hide();
    updateQueryButton();

    // Clear the timeout if it's still active
    if (window.queryTimeout) {
        clearTimeout(window.queryTimeout);
        window.queryTimeout = null;
    }

    // Abort any ongoing requests in the current OverPassLayer
    if (currentOverPassLayer && typeof currentOverPassLayer.abortActiveRequests === 'function') {
        currentOverPassLayer.abortActiveRequests();
    }
}

function updateQueryButton() {
    // Handle both query buttons (top and bottom)
    var startBtns = document.querySelectorAll('.manual-query-btn');
    var stopBtns = document.querySelectorAll('.manual-stop-btn');

    if (isQueryRunning) {
        // Show stop buttons when query is running
        stopBtns.forEach(function(btn) {
            btn.style.display = "inline-block";
            btn.textContent = getTranslation("poi_stop_search") || "Atura consulta";
        });
        // Disable and hide start buttons
        startBtns.forEach(function(btn) {
            btn.disabled = true;
            btn.style.opacity = "0.5";
            btn.style.cursor = "not-allowed";
            btn.style.display = "none";
        });
    } else {
        // Hide stop buttons when no query is running
        stopBtns.forEach(function(btn) {
            btn.style.display = "none";
        });
        // Enable and show start buttons
        startBtns.forEach(function(btn) {
            btn.disabled = false;
            btn.style.opacity = "1";
            btn.style.cursor = "pointer";
            btn.style.display = "inline-block";
            btn.textContent = getTranslation("poi_manual_search") || "Carrega punts d'interès";
        });
    }
}

function expert_mode_init() {
    $('#expert-form').submit(function (e) {
	e.preventDefault();
	expert_call();
    });

    $('#expert-mode').attr('checked', false);
    $('#expert-mode').click(function (e) {
	$('#expert-form').toggle();
    });

}
