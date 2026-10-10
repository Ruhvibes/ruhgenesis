/* RuhGenesis Timeline — snapshots, branches, compare, restore.
   Snapshots live on the current universe object (U.timelines) and persist via save. */
(function () {
  'use strict';

  function U() { return RL.Universe.getU(); }
  function ensure() { var u = U(); if (u && !u.timelines) u.timelines = []; return u; }

  function snapshot(label) {
    var u = ensure(); if (!u) return null;
    var data = RL.Universe.serialize();
    var s = { id: 'tl' + Date.now() + Math.floor(Math.random() * 999),
              label: label || ('Snapshot ' + (u.timelines.length + 1)),
              simTime: Math.round(u.simTime), createdAt: Date.now(), data: data };
    u.timelines.push(s);
    if (RL.Save) RL.Save.markDirty();
    return s;
  }

  function list() { var u = U(); return u && u.timelines ? u.timelines.slice().reverse() : []; }

  function get(id) {
    var u = U(); if (!u || !u.timelines) return null;
    for (var i = 0; i < u.timelines.length; i++) if (u.timelines[i].id === id) return u.timelines[i];
    return null;
  }

  function restore(id) {
    var u = ensure(); if (!u) return false;
    var s = get(id); if (!s) return false;
    // auto-snapshot current state first
    snapshot(RL.t('tl_prerestore'));
    // keep timelines across restore
    var tls = u.timelines;
    RL.Universe.loadData(rehydrate(s.data));
    RL.Universe.getU().timelines = tls;
    if (RL.Save) RL.Save.markDirty();
    return true;
  }

  // loadData expects a live universe object; rebuild meshes need plain data — reuse generate-shaped object
  function rehydrate(data) {
    // data is the serialize() output; loadData builds scene from it directly
    var u = data;
    if (!u.timelines) u.timelines = [];
    return u;
  }

  // Branch: create a NEW saved universe from a snapshot
  function branch(id, newName) {
    var s = get(id); if (!s) return null;
    var data = JSON.parse(JSON.stringify(s.data));
    data.name = newName || (data.name + ' (branch)');
    data.timelines = [];
    return data; // caller saves via RL.Save
  }

  function summarize(data) {
    var life = 0, techSum = 0, techN = 0;
    data.planets.forEach(function (p) {
      if (p.life) life++;
      if (p.civ) { techSum += p.civ.tech; techN++; }
    });
    return { simTime: Math.round(data.simTime), planets: data.planets.length,
             life: life, avgTech: techN ? Math.round(techSum / techN) : 0,
             events: (data.events || []).length };
  }

  function compare(aId, bId) {
    var a = get(aId), b = get(bId);
    if (!a || !b) return null;
    var sa = summarize(a.data), sb = summarize(b.data);
    return {
      a: a, b: b,
      dTime: sb.simTime - sa.simTime,
      dLife: sb.life - sa.life,
      dTech: sb.avgTech - sa.avgTech,
      dPlanets: sb.planets - sa.planets
    };
  }

  window.RL = window.RL || {};
  RL.Timeline = { snapshot: snapshot, list: list, get: get, restore: restore,
                  branch: branch, compare: compare, summarize: summarize };
})();
