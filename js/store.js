// Veri katmanı: Supabase (gerçek, paylaşılan) veya Demo (tarayıcıda yerel).
// İkisi de aynı arayüzü sunar.
(function () {
  const cfg = window.APP_CONFIG || {};
  const listeners = new Set();
  const emit = () => listeners.forEach(fn => fn());

  // ---- satır dönüşümleri (veritabanı snake_case ↔ uygulama camelCase)
  const facFromRow = r => ({
    id: r.id, name: r.name, address: r.address, lat: r.lat, lng: r.lng, type: r.type, gender: r.gender,
    occupants: r.occupants, unit: r.unit, price: Number(r.price), bills: r.bills, kitchen: r.kitchen,
    bathroom: r.bathroom, minStay: r.min_stay, notes: r.notes, url: r.url, verified: r.verified,
    createdBy: r.created_by, createdAt: r.created_at
  });
  const facToRow = f => ({
    name: f.name, address: f.address, lat: f.lat, lng: f.lng, type: f.type, gender: f.gender,
    occupants: f.occupants, unit: f.unit, price: f.price, bills: f.bills || null, kitchen: f.kitchen,
    bathroom: f.bathroom, min_stay: f.minStay || null, notes: f.notes || null, url: f.url || null
  });
  const courseFromRow = r => ({ id: r.id, name: r.name, address: r.address, lat: r.lat, lng: r.lng, order: r.sort, createdBy: r.created_by });

  // =================== SUPABASE ===================
  function SupaStore() {
    const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
    const S = { mode: "supabase", facilities: [], courses: [], favs: [], routes: {}, names: {}, user: null, profile: null };

    async function loadTable(t) {
      if (t === "facilities") {
        const { data, error } = await sb.from("facilities").select("*").order("created_at");
        if (error) throw error; S.facilities = data.map(facFromRow);
      } else if (t === "courses") {
        const { data, error } = await sb.from("courses").select("*").order("sort");
        if (error) throw error; S.courses = data.map(courseFromRow);
      } else if (t === "favorites") {
        const { data, error } = await sb.from("favorites").select("user_id,facility_id");
        if (error) throw error; S.favs = data;
      } else if (t === "route_cache") {
        const { data, error } = await sb.from("route_cache").select("*");
        if (error) throw error; S.routes = {};
        for (const r of data) S.routes[r.facility_id + "|" + r.course_id] = { ...r.data, updatedAt: r.updated_at };
      } else if (t === "profiles") {
        const { data } = await sb.from("profiles").select("id,display_name");
        S.names = {}; for (const p of data || []) S.names[p.id] = p.display_name;
      }
    }
    async function refreshUser(session) {
      S.user = session ? session.user : null; S.profile = null;
      if (S.user) {
        const { data } = await sb.from("profiles").select("*").eq("id", S.user.id).maybeSingle();
        S.profile = data;
      }
    }
    const timers = {};
    function reloadSoon(t) { clearTimeout(timers[t]); timers[t] = setTimeout(async () => { try { await loadTable(t); emit(); } catch (e) { console.error(e); } }, 300); }

    return Object.assign(S, {
      async init() {
        const { data: { session } } = await sb.auth.getSession();
        await refreshUser(session);
        await Promise.all(["facilities", "courses", "favorites", "route_cache", "profiles"].map(loadTable));
        sb.auth.onAuthStateChange(async (_e, session) => { await refreshUser(session); emit(); });
        sb.channel("public-changes")
          .on("postgres_changes", { event: "*", schema: "public", table: "facilities" }, () => { reloadSoon("facilities"); reloadSoon("profiles"); })
          .on("postgres_changes", { event: "*", schema: "public", table: "courses" }, () => reloadSoon("courses"))
          .on("postgres_changes", { event: "*", schema: "public", table: "favorites" }, () => reloadSoon("favorites"))
          .subscribe();
        emit();
      },
      isAdmin() { return !!(S.profile && S.profile.is_admin); },
      async signInEmail(email) {
        const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } });
        if (error) throw error;
      },
      async signInGoogle() {
        const { error } = await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: location.origin + location.pathname } });
        if (error) throw error;
      },
      async signOut() { await sb.auth.signOut(); },
      async addFacility(f) {
        const { data, error } = await sb.from("facilities").insert({ ...facToRow(f), created_by: S.user.id }).select().single();
        if (error) throw error; S.facilities.push(facFromRow(data)); emit(); return data.id;
      },
      async deleteFacility(id) {
        const { error } = await sb.from("facilities").delete().eq("id", id);
        if (error) throw error; S.facilities = S.facilities.filter(f => f.id !== id); emit();
      },
      async addCourse(c) {
        const { data, error } = await sb.from("courses").insert({ name: c.name, address: c.address, lat: c.lat, lng: c.lng, sort: 100 + S.courses.length, created_by: S.user.id }).select().single();
        if (error) throw error; S.courses.push(courseFromRow(data)); emit(); return data.id;
      },
      async toggleFav(fid) {
        const uid = S.user.id; const has = S.favs.some(x => x.user_id === uid && x.facility_id === fid);
        if (has) {
          S.favs = S.favs.filter(x => !(x.user_id === uid && x.facility_id === fid)); emit();
          const { error } = await sb.from("favorites").delete().eq("user_id", uid).eq("facility_id", fid);
          if (error) { await loadTable("favorites"); emit(); throw error; }
        } else {
          S.favs = [...S.favs, { user_id: uid, facility_id: fid }]; emit();
          const { error } = await sb.from("favorites").insert({ user_id: uid, facility_id: fid });
          if (error) { await loadTable("favorites"); emit(); throw error; }
        }
      },
      async saveRoute(fid, cid, data) {
        S.routes[fid + "|" + cid] = { ...data, updatedAt: new Date().toISOString() };
        if (!S.user) { try { localStorage.setItem("rt:" + fid + "|" + cid, JSON.stringify(S.routes[fid + "|" + cid])); } catch (e) {} return; }
        const { error } = await sb.from("route_cache").upsert({ facility_id: fid, course_id: cid, data, updated_at: new Date().toISOString() });
        if (error) console.warn("Rota önbelleğe yazılamadı", error);
      },
      cachedRoute(fid, cid) {
        const k = fid + "|" + cid; if (S.routes[k]) return S.routes[k];
        try { const v = localStorage.getItem("rt:" + k); if (v) return JSON.parse(v); } catch (e) {}
        return null;
      },
      onChange(fn) { listeners.add(fn); }
    });
  }

  // =================== DEMO (yerel) ===================
  function DemoStore() {
    const KEY = "lk_demo_v1";
    const S = { mode: "demo", facilities: [], courses: [], favs: [], routes: {}, names: { demo: "Siz (demo)" }, user: null, profile: null };
    function save() { try { localStorage.setItem(KEY, JSON.stringify({ facilities: S.facilities, courses: S.courses, favs: S.favs, routes: S.routes, user: S.user })); } catch (e) {} }
    return Object.assign(S, {
      async init() {
        let st = null; try { st = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) {}
        if (st) Object.assign(S, st);
        else {
          const seed = window.DEMO_SEED || { facilities: [], courses: [] };
          S.facilities = seed.facilities.map(f => ({ ...f, createdBy: null }));
          S.courses = seed.courses.map(c => ({ ...c }));
          S.favs = [{ user_id: "x1", facility_id: "lee-abbey" }, { user_id: "x2", facility_id: "lee-abbey" }, { user_id: "x1", facility_id: "dinwiddy" }];
        }
        emit();
      },
      isAdmin() { return !!S.user; },
      async signInEmail() { S.user = { id: "demo", email: "demo@ornek.com" }; save(); emit(); },
      async signInGoogle() { return this.signInEmail(); },
      async signOut() { S.user = null; save(); emit(); },
      async addFacility(f) { const id = "f" + Date.now().toString(36); S.facilities.push({ ...f, id, createdBy: S.user.id, createdAt: new Date().toISOString() }); save(); emit(); return id; },
      async deleteFacility(id) { S.facilities = S.facilities.filter(f => f.id !== id); save(); emit(); },
      async addCourse(c) { const id = "c" + Date.now().toString(36); S.courses.push({ ...c, id, order: 100 + S.courses.length, createdBy: S.user.id }); save(); emit(); return id; },
      async toggleFav(fid) {
        const uid = S.user.id; const has = S.favs.some(x => x.user_id === uid && x.facility_id === fid);
        S.favs = has ? S.favs.filter(x => !(x.user_id === uid && x.facility_id === fid)) : [...S.favs, { user_id: uid, facility_id: fid }];
        save(); emit();
      },
      async saveRoute(fid, cid, data) { S.routes[fid + "|" + cid] = { ...data, updatedAt: new Date().toISOString() }; save(); },
      cachedRoute(fid, cid) { return S.routes[fid + "|" + cid] || null; },
      onChange(fn) { listeners.add(fn); }
    });
  }

  const configured = cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase;
  window.Store = configured ? SupaStore() : DemoStore();
})();
