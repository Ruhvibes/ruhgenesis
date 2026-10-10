/* RuhGenesis Save — localStorage: universes, settings, last-universe. */
(function () {
  'use strict';

  var UKEY = 'ruhgenesis_universes_v1', SKEY = 'ruhgenesis_settings_v1';
  var dirty = false;

  function read(key, fb) {
    try {
      var v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fb;
    } catch (e) { return fb; }
  }
  function write(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); return true; }
    catch (e) { return false; }
  }

  function list() { return read(UKEY, []); }

  function saveUniverse(meta, data, thumb) {
    var arr = list(), now = Date.now(), found = false;
    for (var i = 0; i < arr.length; i++) {
      if (arr[i].id === meta.id) {
        arr[i] = { id: meta.id, name: data.name, seed: data.seed, data: data,
                   thumb: thumb || arr[i].thumb, lastPlayed: now };
        found = true; break;
      }
    }
    if (!found) arr.unshift({ id: meta.id || ('u' + now), name: data.name, seed: data.seed,
                              data: data, thumb: thumb || null, lastPlayed: now });
    dirty = false;
    return write(UKEY, arr);
  }

  function get(id) {
    var arr = list();
    for (var i = 0; i < arr.length; i++) if (arr[i].id === id) return arr[i];
    return null;
  }

  function remove(id) { return write(UKEY, list().filter(function (x) { return x.id !== id; })); }

  function rename(id, name) {
    var arr = list(), ok = false;
    arr.forEach(function (x) { if (x.id === id) { x.name = name; if (x.data) x.data.name = name; ok = true; } });
    if (ok) write(UKEY, arr);
    return ok;
  }

  function markDirty() { dirty = true; }
  function isDirty() { return dirty; }

  function getSettings() {
    return read(SKEY, { lang: 'en', quality: 'med', master: 0.8, music: 0.5, sfx: 0.7,
                        mute: false, camSens: 1, vibrate: true, tutorial: true });
  }
  function saveSettings(s) { return write(SKEY, s); }

  window.RL = window.RL || {};
  RL.Save = { list: list, saveUniverse: saveUniverse, get: get, remove: remove,
              rename: rename, markDirty: markDirty, isDirty: isDirty,
              getSettings: getSettings, saveSettings: saveSettings };
})();
