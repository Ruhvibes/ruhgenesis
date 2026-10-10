/* RuhGenesis Online — DUAL community backend.
   1) Firebase (tried FIRST, only when window.RL_FIREBASE_CONFIG is set):
      anonymous auth + Firestore `universes` collection.
   2) GitHub (always available, no config): public registry JSON on
      raw.githubusercontent.com for browse; publish opens a pre-filled GitHub
      issue (label `universe`) whose repo Action validates the ```universe
      fenced JSON block and merges it into the registry.
   Browse merges both sources (dedupe by namespaced id). Publish tries Firebase
   first and falls back to the GitHub issue flow. available() is always true —
   the GitHub path needs no setup. NEVER fake uploads or mock lists. */
(function () {
  'use strict';

  var REGISTRY_URL = 'https://raw.githubusercontent.com/Ruhvibes/ruhgenesis-universes/main/universes.json';
  var ISSUE_URL = 'https://github.com/Ruhvibes/ruhgenesis-universes/issues/new';

  var ghCache = null;      // last GitHub browse result (normalized)
  var mergedCache = null;  // last merged browse result (normalized)

  /* ---------------- Firebase (optional) ---------------- */
  var fbInited = false, fbDb = null;

  function fbConfig() {
    try { return window.RL_FIREBASE_CONFIG || null; } catch (e) { return null; }
  }

  // Lazy init; safe to call repeatedly. True only when usable.
  function fbAvailable() {
    if (fbInited) return !!fbDb;
    var cfg = fbConfig();
    if (!cfg || typeof firebase === 'undefined') return false;
    try {
      if (!firebase.apps || !firebase.apps.length) firebase.initializeApp(cfg);
      fbDb = firebase.firestore();
      try { firebase.auth().signInAnonymously().catch(function () {}); } catch (e) {}
      fbInited = true;
      return true;
    } catch (e) { fbInited = false; fbDb = null; return false; }
  }

  // FIX: anonymous sign-in is fire-and-forget at boot; a publish tap racing it
  // used to fail straight into the GitHub fallback. Wait briefly for auth.
  function authReady() {
    return new Promise(function (res) {
      try {
        var au = firebase.auth();
        if (au.currentUser) return res(true);
        var done = false;
        var to = setTimeout(function () { if (!done) { done = true; res(!!au.currentUser); } }, 2500);
        var un = au.onAuthStateChanged(function (u) {
          if (!done) { done = true; clearTimeout(to); try { un && un(); } catch (e) {} res(!!u); }
        });
      } catch (e) { res(false); }
    });
  }

  function fbPublish(u) {
    return authReady().then(function () {
      return new Promise(function (resolve) {
        try {
          var st = (u && u.stats) || {};
          var doc = {
            // FIX: rules require keys ['id','name','seed'] — id was missing → PERMISSION_DENIED
            id: String((u && u.id) || ('u' + Date.now())),
            name: String((u && u.name) || 'Untitled Universe').slice(0, 60),
            seed: String((u && u.seed) || ''),
            author: String((u && u.author) || 'anonymous').slice(0, 40),
            // FIX: publish universe size so visitors regenerate the same layout
            stats: { planets: st.planets || 0, life: st.life || 0,
                     avgTech: st.avgTech || 0, simTime: st.simTime || 0,
                     size: (u && u.size) || 'm' }
          };
          try { doc.createdAt = firebase.firestore.FieldValue.serverTimestamp(); } catch (e) { doc.createdAt = null; }
          try { if (u && u.universe && typeof RL !== 'undefined' && RL.Codes) doc.code = RL.Codes.encode(u.universe); } catch (e) {}
          fbDb.collection('universes').add(doc).then(function () { resolve('firebase'); })
            .catch(function () { resolve(false); });
        } catch (e) { resolve(false); }
      });
    });
  }

  function fbBrowse() {
    if (!fbAvailable()) return Promise.resolve([]);
    return new Promise(function (resolve) {
      try {
        fbDb.collection('universes').orderBy('createdAt', 'desc').limit(30).get()
          .then(function (snap) {
            var out = [];
            snap.forEach(function (d) {
              var v = d.data() || {};
              v._docId = d.id;
              out.push(normEntry(v, 'firebase'));
            });
            resolve(out);
          }).catch(function () { resolve([]); });
      } catch (e) { resolve([]); }
    });
  }

  /* ---------------- GitHub ---------------- */
  function ghPublish(u) {
    try {
      u = u || {};
      if (!u.seed) return false;
      var st = u.stats || {};
      var entry = {
        id: u.id || ('u' + Date.now()),
        name: String(u.name || 'Untitled Universe').slice(0, 60),
        seed: String(u.seed),
        author: String(u.author || 'anonymous').slice(0, 40),
        createdAt: u.createdAt || new Date().toISOString(),
        // FIX: include size so visitors regenerate the same layout
        stats: { planets: st.planets || 0, life: st.life || 0,
                 avgTech: st.avgTech || 0, simTime: st.simTime || 0,
                 size: u.size || 'm' }
      };
      var title = 'Universe: ' + entry.name;
      var body = 'Publishing my RuhGenesis universe! \uD83D\uDE80\n\n```universe\n' +
                 JSON.stringify(entry) + '\n```';
      var url = ISSUE_URL + '?labels=universe' +
                '&title=' + encodeURIComponent(title) +
                '&body=' + encodeURIComponent(body);
      try { window.open(url, '_blank'); } catch (e) { return false; }
      return true;
    } catch (e) { return false; }
  }

  function ghBrowse() {
    var p;
    try { p = fetch(REGISTRY_URL + '?t=' + Date.now(), { cache: 'no-store' }); }
    catch (e) { return Promise.resolve([]); }
    return p.then(function (r) {
      if (!r || !r.ok) throw new Error('http ' + (r && r.status));
      return r.json();
    }).then(function (json) {
      ghCache = parseRegistry(json);
      return ghCache;
    }).catch(function () { return []; });
  }

  function parseRegistry(json) {
    if (!json || Object.prototype.toString.call(json.universes) !== '[object Array]') return [];
    var out = [];
    for (var i = 0; i < json.universes.length; i++) {
      var v = json.universes[i];
      if (v && typeof v.seed === 'string' && v.seed.length > 0 &&
          typeof v.name === 'string' && v.name.length > 0) out.push(normEntry(v, 'github'));
    }
    return out;
  }

  /* ---------------- shared ---------------- */
  // Normalized entry: {_id (namespaced), _src, id, name, seed, author,
  //                    createdAt, code|null, stats{planets,life,avgTech,simTime,size}}
  function normEntry(v, src) {
    var st = v.stats || {};
    var rawId = src === 'firebase' ? ('fb:' + (v._docId || v.id || '')) : String(v.id || '');
    return {
      _id: rawId, _src: src,
      id: v.id || v._docId || rawId,
      name: String(v.name || 'Untitled Universe').slice(0, 60),
      seed: String(v.seed || ''),
      author: String(v.author || 'anonymous').slice(0, 40),
      createdAt: v.createdAt || '',
      code: (typeof v.code === 'string' && v.code) ? v.code : null,
      stats: { planets: st.planets || 0, life: st.life || 0,
               avgTech: st.avgTech || 0, simTime: st.simTime || 0,
               size: st.size || 'm' }
    };
  }

  function available() { return true; } // GitHub path needs no config

  function init() { try { fbAvailable(); } catch (e) {} return true; } // compat + eager Firebase init

  function backends() {
    var b = [];
    if (fbAvailable()) b.push('firebase');
    b.push('github');
    return b;
  }

  // FIX: publishUniverse now resolves 'firebase' | 'github' | false so the UI
  // can show the correct toast (was: boolean, Firebase success showed the
  // GitHub "opening publish flow" message).
  function publishUniverse(u) {
    u = u || {};
    if (!u.seed) return Promise.resolve(false);
    if (fbAvailable()) {
      return fbPublish(u).then(function (r) {
        return r === 'firebase' ? 'firebase' : (ghPublish(u) ? 'github' : false);
      });
    }
    return Promise.resolve(ghPublish(u) ? 'github' : false);
  }

  function browseUniverses() {
    return Promise.all([fbBrowse(), ghBrowse()]).then(function (parts) {
      var seen = {}, out = [];
      var all = parts[0].concat(parts[1]);
      for (var i = 0; i < all.length; i++) {
        var k = all[i]._src + '|' + all[i]._id;
        if (!seen[k]) { seen[k] = 1; out.push(all[i]); }
      }
      mergedCache = out;
      return out;
    });
  }

  function fetchUniverse(nsid) {
    function find(arr) {
      for (var i = 0; i < arr.length; i++) if (arr[i]._id === nsid) return arr[i];
      return null;
    }
    if (mergedCache) {
      var hit = find(mergedCache);
      if (hit) return Promise.resolve(hit);
    }
    return browseUniverses().then(function (arr) { return find(arr); });
  }

  window.RL = window.RL || {};
  RL.Online = { init: init, available: available, backends: backends,
                publishUniverse: publishUniverse,
                browseUniverses: browseUniverses, fetchUniverse: fetchUniverse };
})();
