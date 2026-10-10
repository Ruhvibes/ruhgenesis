/* RuhGenesis share codes — pure local, ALWAYS works (no backend).
   Format: RG-XXXX-XXXX-...  (base36 pairs of UTF-8 bytes + checksum char)
   Encodes: {v, seed, name, t (simTime), life: [[planetIdx, stage], ...]} */
(function () {
  'use strict';

  var B36 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  function encode(universe) {
    try {
      var life = [];
      universe.planets.forEach(function (p, i) {
        if (p.life) life.push([i, p.life.stage]);
      });
      var payload = { v: 1, seed: universe.seed, name: (universe.name || '').slice(0, 24),
                      t: Math.round(universe.simTime), life: life };
      var json = JSON.stringify(payload);
      var bytes = [];
      for (var i = 0; i < json.length; i++) {
        var c = json.charCodeAt(i);
        if (c < 128) bytes.push(c);
        else if (c < 2048) { bytes.push(192 | (c >> 6), 128 | (c & 63)); }
        else { bytes.push(224 | (c >> 12), 128 | ((c >> 6) & 63), 128 | (c & 63)); }
      }
      var sum = 0, out = '';
      for (var j = 0; j < bytes.length; j++) {
        sum = (sum + bytes[j]) % 36;
        out += B36[Math.floor(bytes[j] / 36)] + B36[bytes[j] % 36];
      }
      out += B36[sum];
      var groups = [];
      for (var k = 0; k < out.length; k += 4) groups.push(out.slice(k, k + 4));
      return 'RG-' + groups.join('-');
    } catch (e) { return null; }
  }

  function decode(code) {
    try {
      var s = (code || '').trim().toUpperCase().replace(/^RG-/, '').replace(/-/g, '');
      if (s.length < 6 || s.length % 2 !== 1) return null;
      var check = s.slice(-1), body = s.slice(0, -1);
      var bytes = [], sum = 0;
      for (var i = 0; i < body.length; i += 2) {
        var v = B36.indexOf(body[i]) * 36 + B36.indexOf(body[i + 1]);
        if (v < 0 || v > 255) return null;
        bytes.push(v); sum = (sum + v) % 36;
      }
      if (B36[sum] !== check) return null;
      var json = '', k = 0;
      while (k < bytes.length) {
        var b = bytes[k];
        if (b < 128) { json += String.fromCharCode(b); k++; }
        else if ((b & 224) === 192) { json += String.fromCharCode(((b & 31) << 6) | (bytes[k+1] & 63)); k += 2; }
        else { json += String.fromCharCode(((b & 15) << 12) | ((bytes[k+1] & 63) << 6) | (bytes[k+2] & 63)); k += 3; }
      }
      var p = JSON.parse(json);
      if (!p || p.v !== 1 || !p.seed) return null;
      return p;
    } catch (e) { return null; }
  }

  // Apply decoded params to a freshly generated universe
  function applyToUniverse(p) {
    var U = RL.Universe.generate(p.seed, { name: p.name, size: 'm' });
    U.simTime = p.t || 0;
    (p.life || []).forEach(function (ls) {
      var pl = U.planets[ls[0]];
      if (pl && RL.Universe.habitable(pl)) {
        pl.life = { stage: ls[1], pop: 1000000, adaptation: 60, stabilityYears: 0, rngState: 12345 };
        if (ls[1] >= 4) pl.civ = { pop: 100, tech: 20, resources: 50, events: [] };
      }
    });
    return U;
  }

  window.RL = window.RL || {};
  RL.Codes = { encode: encode, decode: decode, applyToUniverse: applyToUniverse };
})();
