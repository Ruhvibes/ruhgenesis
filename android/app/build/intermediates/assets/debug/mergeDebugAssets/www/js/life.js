/* RuhGenesis Life — 9-stage life/civilization evolution.
   Stages: 0 microbes → 1 simple → 2 complex → 3 intelligent → 4 primitive civ →
   5 settlements → 6 science/tech → 7 spacefaring → 8 interplanetary.
   Needs-based: population grows when temp/water/atmo in range; stage advances on
   population threshold + stability time; extinction on climate collapse. */
(function () {
  'use strict';

  // pop threshold + required stable years per stage
  var STAGE_REQ = [
    { pop: 0,       years: 0   },  // 0 microbes (entry)
    { pop: 50000,   years: 120 },  // 1 simple
    { pop: 400000,  years: 300 },  // 2 complex
    { pop: 2000000, years: 600 },  // 3 intelligent
    { pop: 8000000, years: 900 },  // 4 primitive civ
    { pop: 20000000,years: 700 },  // 5 settlements
    { pop: 60000000,years: 600 },  // 6 science/tech
    { pop: 150000000, years: 800 },// 7 spacefaring
    { pop: 400000000, years: 1000 }// 8 interplanetary
  ];
  var MAX_POP = 900000000;

  function habitability(p) {
    // 0..1 from temp/water/atmo
    var tScore;
    if (p.temp < -10 || p.temp > 50) tScore = 0;
    else if (p.temp >= 0 && p.temp <= 40) tScore = 1;
    else tScore = 0.5;
    var wScore = p.water / 100, aScore = p.atmo / 100;
    return Math.max(0, Math.min(1, tScore * 0.45 + wScore * 0.3 + aScore * 0.25));
  }

  function ensureCiv(p) {
    if (p.life.stage >= 4 && !p.civ) {
      p.civ = { pop: 50, tech: 5, resources: 30, events: [] };
    }
  }

  function tick(p, dtYears, U) {
    var L = p.life; if (!L) return;
    // deterministic-ish runtime rng from stored state
    var rs = L.rngState || 1;
    function rnd() { rs = (Math.imul(rs, 1664525) + 1013904223) >>> 0; L.rngState = rs; return rs / 4294967296; }

    var hab = habitability(p);
    var carrying = MAX_POP * (0.15 + hab * 0.85);

    if (hab < 0.12) {
      // collapse pressure
      L.stabilityYears = 0;
      L.pop *= Math.pow(0.5, dtYears / 60); // halves every ~60 years
      if (L.pop < 500) {
        var nm = p.name;
        p.life = null; p.civ = null;
        RL.Universe.pushEvent('ev_extinct', { name: nm });
        if (RL.UI && RL.UI.onExtinct) RL.UI.onExtinct(nm);
        return;
      }
    } else {
      // logistic growth
      var growth = 0.02 * hab * dtYears * (1 - L.pop / carrying);
      L.pop = Math.min(carrying, Math.max(1000, L.pop * (1 + growth)));
      if (hab > 0.55) L.stabilityYears += dtYears; else L.stabilityYears = Math.max(0, L.stabilityYears - dtYears);
      L.adaptation = Math.max(0, Math.min(100, L.adaptation + (hab - 0.5) * dtYears * 0.05));
    }

    // stage advancement
    if (L.stage < 8) {
      var req = STAGE_REQ[L.stage + 1];
      if (L.pop >= req.pop && L.stabilityYears >= req.years) {
        L.stage++;
        L.stabilityYears = 0;
        ensureCiv(p);
        RL.Universe.pushEvent('ev_evolved', { name: p.name, stage: RL.stageName(L.stage) });
        if (L.stage >= 4) RL.Universe.pushEvent('ev_civ', { name: p.name, stage: RL.stageName(L.stage) });
        if (RL.UI && RL.UI.onEvolved) RL.UI.onEvolved(p);
        if (RL.Audio) RL.Audio.stinger();
      }
    }

    // civilization sim
    if (L.stage >= 4) {
      ensureCiv(p);
      var cv = p.civ;
      cv.pop = Math.min(9000, cv.pop * (1 + 0.004 * hab * dtYears)); // thousands
      cv.tech = Math.min(100, cv.tech + dtYears * (0.02 + L.stage * 0.012) * (0.4 + hab * 0.6));
      cv.resources = Math.max(0, Math.min(100, cv.resources + (hab - 0.45) * dtYears * 0.03));
      // stage 7: panspermia — seed nearest habitable lifeless planet
      if (L.stage >= 7 && !p._seededNeighbor && cv.tech > 55) {
        var target = nearestHabitable(U, p);
        if (target) {
          p._seededNeighbor = true;
          target.life = { stage: 0, pop: 1000, adaptation: 40, stabilityYears: 0,
                          rngState: Math.floor(rnd() * 1e9) + 1 };
          RL.Universe.pushEvent('ev_panspermia', { name: p.name, target: target.name });
          if (RL.UI && RL.UI.onPanspermia) RL.UI.onPanspermia(p, target);
        }
      }
    }
  }

  function nearestHabitable(U, from) {
    var best = null, bestD = 1e9;
    U.planets.forEach(function (q) {
      if (q.id === from.id || q.life) return;
      if (!RL.Universe.habitable(q)) return;
      var d = Math.abs(q.orbitR - from.orbitR);
      if (d < bestD) { bestD = d; best = q; }
    });
    return best;
  }

  // Manual seed-neighbor action (button): needs a stage>=7 civ planet selected
  function seedNeighbor(U, fromId) {
    var from = RL.Universe.getPlanet(fromId);
    if (!from || !from.life || from.life.stage < 7) return { ok: false };
    var target = nearestHabitable(U, from);
    if (!target) return { ok: false, key: 'no_neighbor' };
    target.life = { stage: 0, pop: 1000, adaptation: 40, stabilityYears: 0,
                    rngState: Math.floor(Math.random() * 1e9) + 1 };
    RL.Universe.pushEvent('ev_panspermia', { name: from.name, target: target.name });
    return { ok: true, target: target.name };
  }

  window.RL = window.RL || {};
  RL.Life = { tick: tick, habitability: habitability, seedNeighbor: seedNeighbor,
              STAGE_REQ: STAGE_REQ };
})();
