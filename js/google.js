// Google Haritalar entegrasyonu: toplu taşıma rotası (Routes), adres → koordinat (Geocoding), harita.
(function () {
  const cfg = window.APP_CONFIG || {};
  const G = { enabled: !!cfg.googleMapsApiKey, ready: false, failed: false, lastError: null };

  let loadPromise = null;
  G.load = function () {
    if (!G.enabled) return Promise.resolve(false);
    if (loadPromise) return loadPromise;
    loadPromise = new Promise(resolve => {
      window.__gmapsReady = () => { G.ready = true; resolve(true); };
      window.gm_authFailure = () => { G.failed = true; G.lastError = "Google API anahtarı reddedildi (anahtar kısıtlamalarını kontrol edin)."; resolve(false); if (G.onError) G.onError(G.lastError); };
      const s = document.createElement("script");
      s.src = "https://maps.googleapis.com/maps/api/js?" + new URLSearchParams({
        key: cfg.googleMapsApiKey, v: "weekly", language: "tr", region: "GB", loading: "async", callback: "__gmapsReady"
      });
      s.async = true;
      s.onerror = () => { G.failed = true; G.lastError = "Google Haritalar yüklenemedi."; resolve(false); };
      document.head.appendChild(s);
    });
    return loadPromise;
  };

  // Bir sonraki hafta içi günü Londra saatiyle 08:30
  function nextWeekdayMorning() {
    const d = new Date(Date.now() + 24 * 3600e3);
    while ([0, 6].includes(new Date(d.toLocaleString("en-US", { timeZone: "Europe/London" })).getDay())) d.setTime(d.getTime() + 24 * 3600e3);
    const ymd = d.toLocaleDateString("en-CA", { timeZone: "Europe/London" }); // YYYY-MM-DD
    // Londra'nın o günkü UTC farkı
    const probe = new Date(ymd + "T12:00:00Z");
    const londonNoon = new Date(probe.toLocaleString("en-US", { timeZone: "Europe/London" }));
    const utcNoon = new Date(probe.toLocaleString("en-US", { timeZone: "UTC" }));
    const offsetMin = Math.round((londonNoon - utcNoon) / 60000);
    return new Date(new Date(ymd + "T08:30:00Z").getTime() - offsetMin * 60000);
  }

  function money(m) {
    if (!m) return null;
    if (typeof m === "number") return m;
    if (m.units != null || m.nanos != null) return Number(m.units || 0) + Number(m.nanos || 0) / 1e9;
    if (m.value != null) return Number(m.value);
    if (m.amount != null) return Number(m.amount);
    return null;
  }
  const vehicleKind = t => { t = String(t || "").toUpperCase(); return t.includes("BUS") ? "bus" : t.includes("SUBWAY") || t.includes("METRO") ? "tube" : t.includes("TRAM") || t.includes("LIGHT") ? "dlr" : "rail"; };

  // Yeni Route sınıfı (Routes API)
  async function viaRouteClass(o, d) {
    const { Route } = await google.maps.importLibrary("routes");
    const { routes } = await Route.computeRoutes({
      origin: { lat: o.lat, lng: o.lng }, destination: { lat: d.lat, lng: d.lng },
      travelMode: "TRANSIT", departureTime: nextWeekdayMorning(), region: "gb", language: "tr",
      transitPreference: { allowedTransitModes: ["BUS", "SUBWAY", "TRAIN", "LIGHT_RAIL", "RAIL"] },
      fields: ["legs", "travelAdvisory", "durationMillis", "distanceMeters"]
    });
    if (!routes || !routes.length) return null;
    const r = routes[0]; const legs = []; let rides = 0;
    for (const L of r.legs || []) for (const s of L.steps || []) {
      const mode = String(s.travelMode || "").toUpperCase();
      const min = (s.staticDurationMillis || 0) / 60000;
      if (mode === "TRANSIT" && s.transitDetails) {
        const td = s.transitDetails; const line = td.transitLine || td.line || {};
        const sd = td.stopDetails || td;
        legs.push({ type: "ride", line: line.nameShort || line.shortName || line.name || "Hat", color: line.color || "#555",
          kind: vehicleKind(line.vehicle && (line.vehicle.type || line.vehicle.vehicleType)),
          from: (sd.departureStop && sd.departureStop.name) || "", to: (sd.arrivalStop && sd.arrivalStop.name) || "", stops: td.stopCount || 0 });
        rides++;
      } else {
        const last = legs[legs.length - 1];
        if (last && last.type === "walk") last.min += min; else legs.push({ type: "walk", min });
      }
    }
    legs.forEach(l => { if (l.type === "walk") l.min = Math.round(l.min); });
    const durMs = r.durationMillis || (r.legs || []).reduce((a, l) => a + (l.durationMillis || 0), 0);
    const fare = money(r.travelAdvisory && (r.travelAdvisory.transitFare || r.travelAdvisory.fare));
    return { source: "google", minutes: Math.round(durMs / 60000), changes: Math.max(0, rides - 1), km: +((r.distanceMeters || 0) / 1000).toFixed(1), fare, legs, mode: rides ? "transit" : "walk" };
  }

  // Eski DirectionsService (yeni API kapalıysa yedek)
  async function viaDirections(o, d) {
    const { DirectionsService } = await google.maps.importLibrary("routes");
    const svc = new DirectionsService();
    const res = await svc.route({ origin: { lat: o.lat, lng: o.lng }, destination: { lat: d.lat, lng: d.lng }, travelMode: "TRANSIT", transitOptions: { departureTime: nextWeekdayMorning() }, region: "gb" });
    const r = res.routes && res.routes[0]; if (!r) return null; const L = r.legs[0];
    const legs = []; let rides = 0;
    for (const s of L.steps) {
      if (s.travel_mode === "TRANSIT" && s.transit) {
        const t = s.transit; legs.push({ type: "ride", line: t.line.short_name || t.line.name, color: t.line.color || "#555", kind: vehicleKind(t.line.vehicle && t.line.vehicle.type), from: t.departure_stop.name, to: t.arrival_stop.name, stops: t.num_stops }); rides++;
      } else { const last = legs[legs.length - 1]; const m = s.duration.value / 60; if (last && last.type === "walk") last.min += m; else legs.push({ type: "walk", min: m }); }
    }
    legs.forEach(l => { if (l.type === "walk") l.min = Math.round(l.min); });
    return { source: "google", minutes: Math.round(L.duration.value / 60), changes: Math.max(0, rides - 1), km: +(L.distance.value / 1000).toFixed(1), fare: r.fare ? r.fare.value : null, legs, mode: rides ? "transit" : "walk" };
  }

  // Kuyruk: aynı anda en fazla 2 istek
  const queue = []; let active = 0; const pending = new Map();
  function pump() {
    while (active < 2 && queue.length) {
      const job = queue.shift(); active++;
      (async () => {
        try {
          let r = null, lastErr = null;
          // Yeni Routes API; geçici hatalarda 2 kez daha dene
          for (let attempt = 0; attempt < 3 && !r; attempt++) {
            try { r = await viaRouteClass(job.o, job.d); lastErr = null; }
            catch (e) {
              lastErr = e; console.warn("Google rota denemesi " + (attempt + 1) + " başarısız:", e);
              if (/PERMISSION_DENIED|API_KEY|REQUEST_DENIED/i.test(String(e))) break;
              await new Promise(res => setTimeout(res, 1500 * (attempt + 1)));
            }
          }
          if (lastErr) throw lastErr;
          job.resolve(r);
        } catch (e) { G.lastError = (e && e.message) || String(e); job.resolve(null); }
        finally { active--; pending.delete(job.key); setTimeout(pump, 150); }
      })();
    }
  }
  G.route = async function (key, o, d) {
    if (!(await G.load())) return null;
    if (pending.has(key)) return pending.get(key);
    const p = new Promise(resolve => queue.push({ key, o, d, resolve }));
    pending.set(key, p); pump(); return p;
  };

  G.geocode = async function (address) {
    if (!(await G.load())) return null;
    try {
      const { Geocoder } = await google.maps.importLibrary("geocoding");
      const { results } = await new Geocoder().geocode({ address, region: "gb", bounds: { north: 51.75, south: 51.25, east: 0.35, west: -0.55 } });
      if (!results || !results.length) return null;
      const loc = results[0].geometry.location; return { lat: loc.lat(), lng: loc.lng(), formatted: results[0].formatted_address };
    } catch (e) { console.warn("Geocode başarısız", e); return null; }
  };

  // Harita
  G.renderMap = async function (el, facilities, course, getRoute, colorFor, gmapsLink, gbp) {
    if (!(await G.load())) return false;
    const { Map, InfoWindow } = await google.maps.importLibrary("maps");
    const { AdvancedMarkerElement, PinElement } = await google.maps.importLibrary("marker");
    const map = new Map(el, { center: { lat: 51.505, lng: -0.12 }, zoom: 11, mapId: cfg.googleMapId || "DEMO_MAP_ID", streetViewControl: false, mapTypeControl: false });
    const info = new InfoWindow(); const bounds = new google.maps.LatLngBounds();
    const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    for (const f of facilities) {
      if (!f.lat) continue; const r = getRoute(f, course);
      const pin = new PinElement({ background: colorFor(r ? r.minutes : null), borderColor: "#fff", glyphColor: "#fff" });
      const m = new AdvancedMarkerElement({ map, position: { lat: f.lat, lng: f.lng }, title: f.name, content: pin.element });
      m.addListener("click", () => {
        info.setContent(`<div style="font:14px/1.4 'IBM Plex Sans',sans-serif;max-width:240px"><b>${esc(f.name)}</b><br>${gbp(f)}<br>${r ? `~${r.minutes} dk · ${r.changes === 0 ? "aktarmasız" : r.changes + " aktarma"}` : ""}<br>${course ? `<a href="${esc(gmapsLink(f, course))}" target="_blank" rel="noopener">Google Haritalar’da rota ↗</a>` : ""}</div>`);
        info.open({ map, anchor: m });
      });
      bounds.extend({ lat: f.lat, lng: f.lng });
    }
    if (course && course.lat) {
      const pin = new PinElement({ background: "#0a4d8c", borderColor: "#fff", glyph: "★", glyphColor: "#fff", scale: 1.3 });
      new AdvancedMarkerElement({ map, position: { lat: course.lat, lng: course.lng }, title: course.name, content: pin.element, zIndex: 999 });
      bounds.extend({ lat: course.lat, lng: course.lng });
    }
    if (!bounds.isEmpty()) map.fitBounds(bounds, 40);
    return true;
  };

  window.GMaps = G;
})();
