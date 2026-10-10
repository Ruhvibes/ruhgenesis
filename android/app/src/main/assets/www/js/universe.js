/* RuhGenesis Universe — Three.js r128 3D space scene + deterministic simulation.
   All generation uses RL.PRNG (same seed => same universe). */
(function () {
  'use strict';

  var E = {
    scene: null, camera: null, renderer: null, canvas: null,
    quality: 'med', running: false, raf: 0, lastT: 0,
    U: null,           // universe data object
    planetMeshes: {},  // id -> {group, mesh, moons:[...], ring}
    starMesh: null, beltMesh: null,
    selCb: null, selectedId: null,
    cam: { theta: 0.6, phi: 1.05, dist: 60, tx: 0, ty: 0, tz: 0, sens: 1 },
    _bound: false, tmpV: null
  };

  var TYPES = ['rocky', 'ice', 'gas', 'ocean', 'desert', 'earthlike'];
  var SYL1 = ['ze', 'xo', 'ka', 'mi', 'ta', 'ru', 've', 'or', 'qu', 'ly', 'da', 'ne'];
  var SYL2 = ['rath', 'lon', 'mar', 'thos', 'dune', 'phir', 'gant', 'vel', 'mor', 'sis'];

  function planetName(r) {
    var n = RL.PRNG.pick(r, SYL1) + RL.PRNG.pick(r, SYL2);
    return n.charAt(0).toUpperCase() + n.slice(1) + '-' + RL.PRNG.int(r, 1, 9) + 'b';
  }

  /* ---------- canvas texture generation (deterministic per planet) ---------- */
  function makeTexture(type, seedStr) {
    var r = RL.PRNG.rng('tex' + seedStr);
    var S = 128, cv = document.createElement('canvas');
    cv.width = S; cv.height = S;
    var g = cv.getContext('2d');
    var base = { rocky: [120, 100, 85], ice: [200, 225, 245], gas: [210, 170, 120],
                 ocean: [40, 110, 200], desert: [215, 185, 130], earthlike: [60, 130, 200] }[type];
    g.fillStyle = 'rgb(' + base[0] + ',' + base[1] + ',' + base[2] + ')';
    g.fillRect(0, 0, S, S);
    var i, x, y, rad, c;
    if (type === 'gas') {
      for (i = 0; i < 14; i++) {
        y = Math.floor(r() * S); rad = 4 + r() * 10;
        c = 150 + Math.floor(r() * 80);
        g.fillStyle = 'rgba(' + c + ',' + (c - 30) + ',' + (c - 70) + ',0.55)';
        g.fillRect(0, y - rad / 2, S, rad);
      }
    } else {
      var n = type === 'earthlike' ? 26 : 40;
      var cols = type === 'earthlike' ? [[70, 160, 90], [150, 130, 100], [50, 120, 190]] :
                 type === 'ocean' ? [[60, 170, 120], [40, 110, 200]] :
                 type === 'ice' ? [[255, 255, 255], [180, 210, 240]] :
                 type === 'desert' ? [[235, 205, 150], [195, 160, 110]] :
                 [[90, 75, 60], [150, 130, 110]];
      for (i = 0; i < n; i++) {
        x = r() * S; y = r() * S; rad = 3 + r() * 14;
        c = cols[Math.floor(r() * cols.length)];
        g.fillStyle = 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',0.7)';
        g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill();
      }
    }
    // polar caps for ice/earthlike
    if (type === 'ice' || type === 'earthlike') {
      g.fillStyle = 'rgba(255,255,255,0.85)';
      g.fillRect(0, 0, S, 8); g.fillRect(0, S - 8, S, 8);
    }
    var tex = new THREE.CanvasTexture(cv);
    return tex;
  }

  function glowSprite(color1, color2, size) {
    var S = 128, cv = document.createElement('canvas');
    cv.width = S; cv.height = S;
    var g = cv.getContext('2d');
    var gr = g.createRadialGradient(S/2, S/2, 4, S/2, S/2, S/2);
    gr.addColorStop(0, color1); gr.addColorStop(0.35, color2); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
    var tex = new THREE.CanvasTexture(cv);
    var m = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    var sp = new THREE.Sprite(m);
    sp.scale.set(size, size, 1);
    return sp;
  }

  /* ---------- deterministic universe generation ---------- */
  function generate(seedStr, opts) {
    opts = opts || {};
    var r = RL.PRNG.rng('uni' + seedStr);
    var sizeKey = opts.size || 'm';
    var planetCount = sizeKey === 's' ? RL.PRNG.int(r, 4, 5) : sizeKey === 'l' ? RL.PRNG.int(r, 7, 8) : RL.PRNG.int(r, 5, 7);
    var starColors = [0xffd27a, 0xfff3c4, 0xff9a5c, 0x9ecfff];
    var starColor = RL.PRNG.pick(r, starColors);
    var U = {
      seed: seedStr, name: opts.name || 'My Universe',
      createdAt: Date.now(), simTime: 0, speed: 1,
      size: sizeKey,
      star: { color: starColor, name: 'Sol-' + seedStr.slice(0, 4).toUpperCase() },
      planets: [], events: [],
      rngState: Math.floor(r() * 1e9)  // runtime drift rng state (serialized)
    };
    var orbitR = 14;
    for (var i = 0; i < planetCount; i++) {
      var type = RL.PRNG.pick(r, TYPES);
      // habitability-leaning stats by type
      var temp, water, atmo;
      if (type === 'earthlike') { temp = RL.PRNG.range(r, 8, 28); water = RL.PRNG.range(r, 45, 85); atmo = RL.PRNG.range(r, 55, 95); }
      else if (type === 'ocean') { temp = RL.PRNG.range(r, 2, 30); water = RL.PRNG.range(r, 80, 100); atmo = RL.PRNG.range(r, 40, 80); }
      else if (type === 'desert') { temp = RL.PRNG.range(r, 25, 60); water = RL.PRNG.range(r, 2, 20); atmo = RL.PRNG.range(r, 10, 40); }
      else if (type === 'ice') { temp = RL.PRNG.range(r, -60, -5); water = RL.PRNG.range(r, 30, 70); atmo = RL.PRNG.range(r, 5, 30); }
      else if (type === 'gas') { temp = RL.PRNG.range(r, -120, -40); water = RL.PRNG.range(r, 0, 10); atmo = RL.PRNG.range(r, 80, 100); }
      else { temp = RL.PRNG.range(r, -20, 45); water = RL.PRNG.range(r, 0, 35); atmo = RL.PRNG.range(r, 0, 50); }
      var size = type === 'gas' ? RL.PRNG.range(r, 2.6, 3.6) : RL.PRNG.range(r, 0.9, 1.9);
      var p = {
        id: 'p' + i, name: planetName(r), type: type,
        orbitR: orbitR, orbitSpeed: RL.PRNG.range(r, 0.008, 0.03) * (20 / orbitR),
        orbitAngle: r() * Math.PI * 2,
        size: size, rotSpeed: RL.PRNG.range(r, 0.2, 1.2), rotAngle: r() * 6,
        temp: Math.round(temp), water: Math.round(water), atmo: Math.round(atmo),
        life: null, civ: null, moons: []
      };
      var moonCount = type === 'gas' ? RL.PRNG.int(r, 1, 2) : (r() < 0.35 ? 1 : 0);
      for (var mI = 0; mI < moonCount; mI++) {
        p.moons.push({ size: RL.PRNG.range(r, 0.2, 0.45), orbitR: size + 0.9 + mI * 0.7,
                       orbitSpeed: RL.PRNG.range(r, 0.05, 0.12), orbitAngle: r() * 6 });
      }
      U.planets.push(p);
      orbitR += RL.PRNG.range(r, 7, 10);
    }
    return U;
  }

  function habitable(p) {
    return p.temp >= 0 && p.temp <= 40 && p.water > 30 && p.atmo > 20;
  }

  /* ---------- scene building ---------- */
  function clearScene() {
    if (!E.scene) return;
    E.scene.traverse(function (o) {
      if (o.geometry) o.geometry.dispose();
      if (o.material && !o.userData.shared) {
        if (o.material.map) o.material.map.dispose();
        o.material.dispose();
      }
    });
    E.scene = new THREE.Scene();
    E.scene.fog = null;
    E.planetMeshes = {};
  }

  function buildScene() {
    var U = E.U; if (!U) return;
    var q = E.quality;
    var starN = q === 'low' ? 1200 : q === 'high' ? 4500 : 2500;
    var r = RL.PRNG.rng('stars' + U.seed);

    // starfield
    var pos = new Float32Array(starN * 3), col = new Float32Array(starN * 3);
    var c = new THREE.Color();
    for (var i = 0; i < starN; i++) {
      var th = r() * Math.PI * 2, ph = Math.acos(2 * r() - 1), rad = 380 + r() * 120;
      pos[i*3] = rad * Math.sin(ph) * Math.cos(th);
      pos[i*3+1] = rad * Math.cos(ph);
      pos[i*3+2] = rad * Math.sin(ph) * Math.sin(th);
      c.setHSL(0.08 + r() * 0.55, r() * 0.5, 0.75 + r() * 0.25);
      col[i*3] = c.r; col[i*3+1] = c.g; col[i*3+2] = c.b;
    }
    var sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    sg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    var sm = new THREE.PointsMaterial({ size: 1.6, vertexColors: true, sizeAttenuation: false, transparent: true, opacity: 0.95 });
    sm.userData = { shared: true };
    E.scene.add(new THREE.Points(sg, sm));

    // nebulae (canvas radial sprites)
    var nebN = q === 'low' ? 2 : q === 'high' ? 5 : 3;
    var nebCols = [['#ff5c8a', '#7a2bff'], ['#2bd9ff', '#1a3cff'], ['#ffb347', '#ff5c5c'], ['#7dff9a', '#1a8cff'], ['#c86bff', '#3c1aff']];
    for (var nI = 0; nI < nebN; nI++) {
      var nc = nebCols[Math.floor(r() * nebCols.length)];
      var S = 256, cv = document.createElement('canvas'); cv.width = S; cv.height = S;
      var g2 = cv.getContext('2d');
      for (var b = 0; b < 5; b++) {
        var bx = S/2 + (r() - 0.5) * S * 0.5, by = S/2 + (r() - 0.5) * S * 0.5, br = S * (0.2 + r() * 0.25);
        var gr = g2.createRadialGradient(bx, by, 2, bx, by, br);
        gr.addColorStop(0, nc[b % 2] + 'aa'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        g2.fillStyle = gr; g2.fillRect(0, 0, S, S);
      }
      var ntex = new THREE.CanvasTexture(cv);
      var nmat = new THREE.SpriteMaterial({ map: ntex, transparent: true, opacity: 0.5, depthWrite: false });
      var nsp = new THREE.Sprite(nmat);
      var ns = 120 + r() * 160;
      nsp.scale.set(ns, ns, 1);
      var nth = r() * Math.PI * 2;
      nsp.position.set(Math.cos(nth) * 320, (r() - 0.5) * 200, Math.sin(nth) * 320);
      E.scene.add(nsp);
    }

    // central star: glow sprite + light
    var starHex = '#' + U.star.color.toString(16).padStart(6, '0');
    E.starMesh = glowSprite('#ffffff', starHex, 26);
    E.scene.add(E.starMesh);
    var pl = new THREE.PointLight(U.star.color, 1.6, 0);
    E.scene.add(pl);
    E.scene.add(new THREE.AmbientLight(0x334455, 0.55));

    // planets
    U.planets.forEach(function (p) {
      var grp = new THREE.Group();
      var tex = makeTexture(p.type, U.seed + p.id);
      var mat = new THREE.MeshLambertMaterial({ map: tex });
      var mesh = new THREE.Mesh(new THREE.SphereGeometry(p.size, q === 'low' ? 18 : 28, q === 'low' ? 14 : 20), mat);
      mesh.userData.pid = p.id;
      grp.add(mesh);
      // habitable glow ring
      if (habitable(p)) {
        var ring = glowSprite('#7dff9a', '#1a8cff', p.size * 4.2);
        ring.material.opacity = 0.35;
        grp.add(ring);
        p._glow = ring;
      }
      // moons
      p._moonMeshes = [];
      p.moons.forEach(function (mn) {
        var mm = new THREE.Mesh(new THREE.SphereGeometry(mn.size, 10, 8),
          new THREE.MeshLambertMaterial({ color: 0xaaaaaa }));
        grp.add(mm); p._moonMeshes.push(mm);
      });
      // orbit ring
      var seg = 72, pts = [];
      for (var sgi = 0; sgi <= seg; sgi++) {
        var a2 = sgi / seg * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(a2) * p.orbitR, 0, Math.sin(a2) * p.orbitR));
      }
      var rg = new THREE.BufferGeometry().setFromPoints(pts);
      var rl = new THREE.Line(rg, new THREE.LineBasicMaterial({ color: 0x3a5a8a, transparent: true, opacity: 0.5 }));
      E.scene.add(rl);
      E.scene.add(grp);
      E.planetMeshes[p.id] = { group: grp, mesh: mesh, ring: rl };
      positionPlanet(p);
    });

    // asteroid belt between planet 2 and 3 (if enough planets)
    if (U.planets.length >= 4) {
      var r0 = (U.planets[1].orbitR + U.planets[2].orbitR) / 2;
      var an = q === 'low' ? 300 : 800;
      var apos = new Float32Array(an * 3);
      for (var ai = 0; ai < an; ai++) {
        var aa = r() * Math.PI * 2, ar2 = r0 + (r() - 0.5) * 3;
        apos[ai*3] = Math.cos(aa) * ar2; apos[ai*3+1] = (r() - 0.5) * 0.8; apos[ai*3+2] = Math.sin(aa) * ar2;
      }
      var ag = new THREE.BufferGeometry();
      ag.setAttribute('position', new THREE.BufferAttribute(apos, 3));
      E.beltMesh = new THREE.Points(ag, new THREE.PointsMaterial({ color: 0x998877, size: 0.35 }));
      E.scene.add(E.beltMesh);
    }
    updateCamTarget();
  }

  function positionPlanet(p) {
    var rec = E.planetMeshes[p.id]; if (!rec) return;
    rec.group.position.set(Math.cos(p.orbitAngle) * p.orbitR, 0, Math.sin(p.orbitAngle) * p.orbitR);
    rec.mesh.rotation.y = p.rotAngle;
    p.moons.forEach(function (mn, i) {
      var mm = p._moonMeshes[i]; if (!mm) return;
      mm.position.set(Math.cos(mn.orbitAngle) * mn.orbitR, 0.3, Math.sin(mn.orbitAngle) * mn.orbitR);
    });
  }

  function updateCamTarget() {
    // frame the whole system
    var maxR = 20;
    if (E.U) E.U.planets.forEach(function (p) { if (p.orbitR > maxR) maxR = p.orbitR; });
    E.cam.dist = maxR + 22;
    E.cam.phi = 1.05;
  }

  /* ---------- camera controls (touch orbit / pinch zoom / 2-finger pan) ---------- */
  function bindTouch() {
    if (E._bound || !E.canvas) return;
    E._bound = true;
    var el = E.canvas, sens = 1;
    var touches = {}, pinchD0 = 0, tapT = 0, tapX = 0, tapY = 0, moved = false;
    function s() { return (E.cam.sens || 1); }
    el.addEventListener('touchstart', function (e) {
      RL.Audio.unlock();
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        touches[t.identifier] = { x: t.clientX, y: t.clientY };
      }
      var ids = Object.keys(touches);
      if (ids.length === 2) {
        var a = touches[ids[0]], b = touches[ids[1]];
        pinchD0 = Math.hypot(a.x - b.x, a.y - b.y);
      }
      tapT = Date.now(); tapX = e.changedTouches[0].clientX; tapY = e.changedTouches[0].clientY;
      moved = false;
      e.preventDefault();
    }, { passive: false });
    el.addEventListener('touchmove', function (e) {
      var ids = Object.keys(touches);
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        if (!touches[t.identifier]) continue;
        var dx = t.clientX - touches[t.identifier].x, dy = t.clientY - touches[t.identifier].y;
        if (Math.abs(dx) + Math.abs(dy) > 6) moved = true;
        if (ids.length === 1) {
          E.cam.theta -= dx * 0.005 * s();
          E.cam.phi = Math.max(0.15, Math.min(1.5, E.cam.phi - dy * 0.004 * s()));
        }
        touches[t.identifier] = { x: t.clientX, y: t.clientY };
      }
      ids = Object.keys(touches);
      if (ids.length === 2) {
        var a = touches[ids[0]], b = touches[ids[1]];
        var d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinchD0 > 0) E.cam.dist = Math.max(12, Math.min(160, E.cam.dist * (pinchD0 / d)));
        pinchD0 = d;
      }
      e.preventDefault();
    }, { passive: false });
    function endT(e) {
      for (var i = 0; i < e.changedTouches.length; i++) delete touches[e.changedTouches[i].identifier];
      if (!moved && Date.now() - tapT < 350) handleTap(tapX, tapY);
      pinchD0 = 0;
    }
    el.addEventListener('touchend', endT);
    el.addEventListener('touchcancel', endT);
    // mouse for desktop testing
    var dragging = false, lx = 0, ly = 0;
    el.addEventListener('mousedown', function (e) { dragging = true; lx = e.clientX; ly = e.clientY; moved = false; tapT = Date.now(); tapX = e.clientX; tapY = e.clientY; });
    el.addEventListener('mousemove', function (e) {
      if (!dragging) return;
      var dx = e.clientX - lx, dy = e.clientY - ly;
      if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
      E.cam.theta -= dx * 0.005 * s(); E.cam.phi = Math.max(0.15, Math.min(1.5, E.cam.phi - dy * 0.004 * s()));
      lx = e.clientX; ly = e.clientY;
    });
    el.addEventListener('mouseup', function (e) { dragging = false; if (!moved && Date.now() - tapT < 350) handleTap(e.clientX, e.clientY); });
    el.addEventListener('wheel', function (e) {
      E.cam.dist = Math.max(12, Math.min(160, E.cam.dist * (1 + e.deltaY * 0.001)));
      e.preventDefault();
    }, { passive: false });
  }

  var raycaster = null, mouseV = null;
  function handleTap(px, py) {
    if (!E.scene || !E.U) return;
    try {
      raycaster = raycaster || new THREE.Raycaster();
      mouseV = mouseV || new THREE.Vector2();
      var rect = E.canvas.getBoundingClientRect();
      mouseV.x = ((px - rect.left) / rect.width) * 2 - 1;
      mouseV.y = -((py - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouseV, E.camera);
      var meshes = [];
      for (var id in E.planetMeshes) meshes.push(E.planetMeshes[id].mesh);
      var hits = raycaster.intersectObjects(meshes);
      if (hits.length && E.selCb) E.selCb(hits[0].object.userData.pid);
    } catch (e) {}
  }

  function applyCamera() {
    var c = E.cam;
    var sp = Math.sin(c.phi), x = c.dist * sp * Math.cos(c.theta), y = c.dist * Math.cos(c.phi), z = c.dist * sp * Math.sin(c.theta);
    E.camera.position.set(c.tx + x, c.ty + y, c.tz + z);
    E.camera.lookAt(c.tx, c.ty, c.tz);
  }

  /* ---------- simulation ---------- */
  var YEARS_PER_SEC = 20; // at 1x

  function tick(dtYears) {
    var U = E.U; if (!U || dtYears <= 0) return;
    U.simTime += dtYears;
    var r = RL.PRNG.rng('drift' + U.seed + Math.floor(U.simTime / 50));
    U.planets.forEach(function (p) {
      p.orbitAngle += p.orbitSpeed * dtYears;
      p.rotAngle += p.rotSpeed * dtYears * 0.5;
      p.moons.forEach(function (mn) { mn.orbitAngle += mn.orbitSpeed * dtYears; });
      // slow environmental drift every ~50 years
      if (Math.floor(U.simTime / 50) !== Math.floor((U.simTime - dtYears) / 50)) {
        p.temp = Math.max(-150, Math.min(80, p.temp + Math.round((r() - 0.5) * 4)));
        p.water = Math.max(0, Math.min(100, p.water + Math.round((r() - 0.5) * 3)));
      }
      positionPlanet(p);
      if (RL.Life && p.life) RL.Life.tick(p, dtYears, U);
    });
  }

  /* ---------- public API ---------- */
  function init(canvas, opts) {
    opts = opts || {};
    E.quality = opts.quality || 'med';
    E.canvas = canvas;
    E.tmpV = new THREE.Vector3();
    E.renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: E.quality !== 'low' });
    E.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, E.quality === 'low' ? 1 : 2));
    E.scene = new THREE.Scene();
    E.scene.background = new THREE.Color(0x04060f);
    E.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 1200);
    bindTouch();
    resize();
    try { window.addEventListener('resize', resize); } catch (e) {}
  }

  function resize() {
    if (!E.renderer || !E.canvas) return;
    var w = E.canvas.clientWidth || window.innerWidth, h = E.canvas.clientHeight || window.innerHeight;
    E.renderer.setSize(w, h, false);
    E.camera.aspect = w / h;
    E.camera.updateProjectionMatrix();
  }

  function start() {
    if (E.running) return;
    E.running = true; E.lastT = performance.now();
    function loop() {
      if (!E.running) return;
      E.raf = requestAnimationFrame(loop);
      var now = performance.now();
      var dt = Math.min((now - E.lastT) / 1000, 0.1);
      E.lastT = now;
      if (E.U && E.U.speed > 0) tick(dt * YEARS_PER_SEC * E.U.speed);
      applyCamera();
      try { E.renderer.render(E.scene, E.camera); } catch (e) {}
    }
    loop();
  }

  function stop() { E.running = false; try { cancelAnimationFrame(E.raf); } catch (e) {} }

  function setSpeed(m) { if (E.U) E.U.speed = m; }

  function newUniverse(name, seedStr, size) {
    var seed = (seedStr || '').trim().toUpperCase() || RL.PRNG.newSeed(Math.random);
    var U = generate(seed, { name: name, size: size });
    loadData(U);
    return U;
  }

  function loadData(U) {
    clearScene();
    E.U = U;
    E.selectedId = null;
    buildScene();
  }

  function getPlanet(id) {
    if (!E.U) return null;
    for (var i = 0; i < E.U.planets.length; i++) if (E.U.planets[i].id === id) return E.U.planets[i];
    return null;
  }

  function seedLife(planetId) {
    var p = getPlanet(planetId);
    if (!p) return { ok: false, key: 'code_invalid' };
    if (p.life) return { ok: false, key: 'already_life', vars: { name: p.name } };
    if (!habitable(p)) return { ok: false, key: 'not_habitable' };
    p.life = { stage: 0, pop: 1000, adaptation: 50, stabilityYears: 0,
               rngState: RL.PRNG.int(RL.PRNG.rng('life' + E.U.seed + p.id), 1, 1e9) };
    pushEvent('life_seeded', { name: p.name });
    return { ok: true, vars: { name: p.name } };
  }

  function changeClimate(planetId, delta) {
    var p = getPlanet(planetId);
    if (!p) return false;
    p.temp = Math.max(-150, Math.min(80, p.temp + delta));
    pushEvent('climate_changed', { name: p.name });
    return true;
  }

  function pushEvent(key, vars) {
    if (!E.U) return;
    E.U.events.unshift({ t: Math.round(E.U.simTime), key: key, vars: vars || {} });
    if (E.U.events.length > 40) E.U.events.length = 40;
  }

  function stats() {
    var U = E.U; if (!U) return null;
    var lifeN = 0, techSum = 0, techN = 0;
    U.planets.forEach(function (p) {
      if (p.life) lifeN++;
      if (p.civ) { techSum += p.civ.tech; techN++; }
    });
    return { planets: U.planets.length, life: lifeN,
             avgTech: techN ? Math.round(techSum / techN) : 0,
             simTime: Math.round(U.simTime), events: U.events.length };
  }

  function serialize() {
    if (!E.U) return null;
    var U = E.U;
    return { seed: U.seed, name: U.name, createdAt: U.createdAt, simTime: U.simTime,
             speed: U.speed, size: U.size, star: U.star, rngState: U.rngState,
             planets: U.planets.map(function (p) {
               var c = { id: p.id, name: p.name, type: p.type, orbitR: p.orbitR,
                 orbitSpeed: p.orbitSpeed, orbitAngle: p.orbitAngle, size: p.size,
                 rotSpeed: p.rotSpeed, rotAngle: p.rotAngle, temp: p.temp,
                 water: p.water, atmo: p.atmo, life: p.life ? JSON.parse(JSON.stringify(p.life)) : null,
                 civ: p.civ ? JSON.parse(JSON.stringify(p.civ)) : null, moons: p.moons };
               return c;
             }),
             events: U.events.slice(0, 40) };
  }

  function onSelect(cb) { E.selCb = cb; }
  function setCamSens(v) { E.cam.sens = v; }
  function setQuality(q) {
    E.quality = q;
    if (E.renderer) E.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q === 'low' ? 1 : 2));
    if (E.U) { var U = E.U; clearScene(); E.U = U; buildScene(); }
  }

  window.RL = window.RL || {};
  RL.Universe = {
    init: init, start: start, stop: stop, resize: resize,
    generate: generate, newUniverse: newUniverse, loadData: loadData,
    tick: tick, setSpeed: setSpeed, onSelect: onSelect,
    getPlanet: getPlanet, seedLife: seedLife, changeClimate: changeClimate,
    habitable: habitable, stats: stats, serialize: serialize,
    setCamSens: setCamSens, setQuality: setQuality, pushEvent: pushEvent,
    getU: function () { return E.U; }
  };
})();
