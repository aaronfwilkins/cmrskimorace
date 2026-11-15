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

  function label(text) {
    return L.divIcon({ className: "map-label", html: "<span>" + text + "</span>", iconSize: null });
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
      maxZoom: 17,
      attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, SRTM | Style &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)'
    });
    osm.addTo(map);

    var runsLayer = L.geoJSON(null, {
      style: runStyle,
      onEachFeature: function (f, layer) {
        if (f.properties.name) layer.bindTooltip(f.properties.name, { sticky: true });
      }
    }).addTo(map);

    L.control.layers({ "Map": osm, "Topo": topo }, { "Ski runs and lifts": runsLayer }, { collapsed: true }).addTo(map);
    L.control.scale({ imperial: false }).addTo(map);

    loadRuns().then(function (data) {
      runsLayer.addData(data);
      runsLayer.bringToBack();
    });

    fetch(el.getAttribute("data-track"))
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var coords = data.features[0].geometry.coordinates.map(function (c) { return [c[1], c[0]]; });
        L.polyline(coords, { color: "#ffffff", weight: 9, opacity: 0.9 }).addTo(map);
        var route = L.polyline(coords, { color: "#d8232a", weight: 5 }).addTo(map);
        L.circleMarker(coords[0], { radius: 7, color: "#fff", weight: 2, fillColor: "#12233f", fillOpacity: 1 }).addTo(map);
        L.circleMarker(coords[coords.length - 1], { radius: 7, color: "#fff", weight: 2, fillColor: "#d8232a", fillOpacity: 1 }).addTo(map);
        L.marker(coords[0], { icon: label("Start"), interactive: false }).addTo(map);
        L.marker(coords[coords.length - 1], { icon: label("Finish"), interactive: false }).addTo(map);
        map.invalidateSize();
        map.fitBounds(route.getBounds(), { padding: [50, 50] });
      })
      .catch(function (err) {
        if (window.console) console.error("Race map failed:", err);
        el.classList.add("race-map-error");
        el.textContent = "The map could not be loaded.";
      });
  }

  document.querySelectorAll(".race-map[data-track]").forEach(init);
})();
