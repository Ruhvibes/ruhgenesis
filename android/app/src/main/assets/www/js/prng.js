/* RuhGenesis — deterministic PRNG (mulberry32 + string hash).
   ALL procedural universe generation must derive from this.
   Same seed => identical universe. Never use Math.random() for world-gen. */
(function () {
  'use strict';

  // FNV-1a 32-bit string hash -> uint32
  function hash(str) {
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }

  // mulberry32 seeded rng -> function() in [0,1)
  function rng(seed) {
    var a = (typeof seed === 'string') ? hash(seed) : (seed >>> 0);
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function int(r, min, max) { return min + Math.floor(r() * (max - min + 1)); }
  function range(r, min, max) { return min + r() * (max - min); }
  function pick(r, arr) { return arr[Math.floor(r() * arr.length)]; }

  // New base36 seed string, e.g. "K7Q2M9XD"
  function newSeed(r) {
    var chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    var s = '';
    for (var i = 0; i < 8; i++) s += chars[Math.floor((r || Math.random)() * 36)];
    return s;
  }

  window.RL = window.RL || {};
  RL.PRNG = { hash: hash, rng: rng, int: int, range: range, pick: pick, newSeed: newSeed };
})();
