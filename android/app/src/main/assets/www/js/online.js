/* RuhGenesis Online — Firebase community features (anonymous auth + Firestore).
   FULLY graceful: if RL_FIREBASE_CONFIG is null/undefined OR the firebase SDK
   failed to load, available() is false and UI shows an honest "not configured"
   notice. NEVER fake uploads or mock lists. */
(function () {
  'use strict';

  var inited = false, db = null, user = null;

  function config() {
    try { return window.RL_FIREBASE_CONFIG || null; } catch (e) { return null; }
  }

  function available() { return inited && !!db; }

  function init() {
    var cfg = config();
    if (!cfg || typeof firebase === 'undefined') { inited = false; return false; }
    try {
      if (!firebase.apps || !firebase.apps.length) firebase.initializeApp(cfg);
      var auth = firebase.auth();
      db = firebase.firestore();
      auth.signInAnonymously().then(function (cred) { user = cred.user; })
        .catch(function () { user = null; });
      inited = true;
      return true;
    } catch (e) { inited = false; db = null; return false; }
  }

  function notConfigured() {
    if (RL.UI) RL.UI.toast(RL.t('online_not_configured'));
    else try { alert('Community features need setup'); } catch (e) {}
  }

  function publish(universe, cb) {
    if (!available()) { notConfigured(); if (cb) cb(false); return; }
    try {
      var code = RL.Codes.encode(universe);
      var st = RL.Universe.stats() || {};
      db.collection('universes').add({
        code: code, name: universe.name, seed: universe.seed,
        planets: st.planets || 0, life: st.life || 0, avgTech: st.avgTech || 0,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        author: 'anonymous'
      }).then(function () { if (cb) cb(true); })
        .catch(function () { if (cb) cb(false); });
    } catch (e) { if (cb) cb(false); }
  }

  function browse(cb) {
    if (!available()) { notConfigured(); if (cb) cb(null); return; }
    try {
      db.collection('universes').orderBy('createdAt', 'desc').limit(30).get()
        .then(function (snap) {
          var out = [];
          snap.forEach(function (d) {
            var v = d.data(); v.id = d.id; out.push(v);
          });
          cb(out);
        }).catch(function () { cb([]); });
    } catch (e) { cb([]); }
  }

  window.RL = window.RL || {};
  RL.Online = { init: init, available: available, publish: publish, browse: browse,
                notConfigured: notConfigured };
})();
