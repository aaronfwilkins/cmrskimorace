// Interactive race maps: OpenStreetMap base, Castle Mountain ski runs, and a race track.
// Any element with class "race-map" and a data-track="path/to/track.geojson" becomes a map.
(function () {
  if (!window.L) return;

  var RUN_COLORS = {
    easy: "#2e9e44",
    intermediate: "#1f6fd1",
    advanced: "#111111",
    expert: "#111111",
    unrated: "#8a94a3"
  };

  var runsPromise = null;
  function loadRuns() {
    if (!runsPromise) {
      runsPromise = fetch("files/castle-runs.geojson").then(function (r) { return r.json(); });
    }
    return runsPromise;
  }

  function runStyle(feature) {
    var p = feature.properties;
    if (p.kind === "lift") {
      return { color: "#7a2a2a", weight: 2, dashArray: "6 5", opacity: 0.85 };
    }
    return { color: RUN_COLORS[p.difficulty] || RUN_COLORS.unrated, weight: 2.5, opacity: 0.8 };
  }

  function label(text, left) {
    return L.divIcon({ className: "map-label" + (left ? " map-label-left" : ""), html: "<span>" + text + "</span>", iconSize: null });
  }

  function init(el) {
    // Start centred on Castle Mountain Resort so layers can be drawn in any order;
    // the view is refitted to the race route once it loads.
    var map = L.map(el, { scrollWheelZoom: false, zoomSnap: 0.5 }).setView([49.317, -114.422], 14);

    var osm = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    });
    var topo = L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", {
      maxNativeZoom: 17,
      maxZoom: 19,
      attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, SRTM | Style &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)'
    });
    topo.addTo(map); // topo (contour lines) is the default view; "Map" switches to standard OpenStreetMap

    var runsLayer = L.geoJSON(null, {
      style: runStyle,
      onEachFeature: function (f, layer) {
        if (f.properties.name) layer.bindTooltip(f.properties.name, { sticky: true });
      }
    }).addTo(map);

    var layersControl = L.control.layers({ "Map": osm, "Topo": topo }, { "Ski runs and lifts": runsLayer }, { collapsed: true }).addTo(map);
    L.control.scale({ imperial: false }).addTo(map);

    loadRuns().then(function (data) {
      runsLayer.addData(data);
      runsLayer.bringToBack();
    });

    fetch(el.getAttribute("data-track"))
      .then(function (r) { return r.json(); })
      .then(function (data) {
        // One or more routes. Each feature may carry its own name and colour;
        // earlier routes are drawn wider so a later route sharing the same trail stays visible on top.
        var bounds = L.latLngBounds([]);
        var multi = data.features.length > 1;
        data.features.forEach(function (f, i) {
          var pts = f.geometry.coordinates.map(function (c) { return [c[1], c[0]]; });
          var w = multi ? Math.max(4, 8 - i * 3) : 5;
          var line = L.polyline(pts, { color: f.properties.color || "#d8232a", weight: w });
          var group = L.layerGroup([L.polyline(pts, { color: "#ffffff", weight: w + 4, opacity: 0.9 }), line]).addTo(map);
          if (f.properties.name) {
            line.bindTooltip(f.properties.name, { sticky: true });
            if (multi) layersControl.addOverlay(group, f.properties.name + " course");
          }
          bounds.extend(line.getBounds());
        });
        var coords = data.features[0].geometry.coordinates.map(function (c) { return [c[1], c[0]]; });
        var route = { getBounds: function () { return bounds; } };
        var start = coords[0], end = coords[coords.length - 1];
        if (map.distance(start, end) < 40) {
          // Loop course: one shared start and finish
          L.circleMarker(start, { radius: 7, color: "#fff", weight: 2, fillColor: "#12233f", fillOpacity: 1 }).addTo(map);
          L.marker(start, { icon: label("Start / Finish"), interactive: false }).addTo(map);
        } else {
          L.circleMarker(start, { radius: 7, color: "#fff", weight: 2, fillColor: "#12233f", fillOpacity: 1 }).addTo(map);
          L.circleMarker(end, { radius: 7, color: "#fff", weight: 2, fillColor: "#d8232a", fillOpacity: 1 }).addTo(map);
          // Start and finish close together: put the Start label on the left so the two do not overlap
          L.marker(start, { icon: label("Start", map.distance(start, end) < 400), interactive: false }).addTo(map);
          L.marker(end, { icon: label("Finish"), interactive: false }).addTo(map);
        }
        map.invalidateSize();
        map.fitBounds(route.getBounds(), { padding: [50, 50], maxZoom: 17 });
      })
      .catch(function (err) {
        if (window.console) console.error("Race map failed:", err);
        el.classList.add("race-map-error");
        el.textContent = "The map could not be loaded.";
      });
  }

  document.querySelectorAll(".race-map[data-track]").forEach(init);
})();
