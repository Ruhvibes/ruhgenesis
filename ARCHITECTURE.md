# RuhGenesis — The Living Universe — Architecture Spec

## Overview
RuhGenesis = 3D universe simulation game. Player creates a universe (seeded procedural
generation), watches stars/planets evolve, seeds life, grows civilizations through stages,
explores alternate timelines. Single-page web app (Three.js r128 UMD bundled at
`www/three.min.js`) packaged as Android WebView APK (`com.ruhgenesis.app`). Offline-first;
online features via Firebase (anonymous auth, no login needed) when configured.

## File layout (www/)
```
index.html          # screens: #screen-splash, #screen-menu, #screen-universe (canvas #gl + HUD),
                    #          #screen-timelines, #screen-community, #screen-settings, #screen-about
css/style.css       # deep-space premium theme, cinematic menu, rounded glass panels
js/i18n.js          # RL.I18N {en, hi}, RL.t(), RL.setLang() — EN + formal Devanagari Hindi
js/audio.js         # RL.Audio — procedural WebAudio: space drone pad, UI blips, event stingers.
                    #           No external files. Master/music/sfx volumes + mute.
js/prng.js          # RL.PRNG — mulberry32 + string-seed hash. ALL procedural generation
                    #           MUST derive from this (deterministic: same seed => same universe).
js/universe.js      # RL.Universe — 3D scene + simulation. See API below.
js/life.js          # RL.Life — life evolution + civilization stages. See API below.
js/timeline.js      # RL.Timeline — snapshots, branches, compare, restore.
js/codes.js         # RL.Codes — universe share codes (pure local, ALWAYS works).
js/online.js        # RL.Online — Firebase community features (graceful when unconfigured).
js/save.js          # RL.Save — localStorage: universes, settings, published cache.
js/ui.js            # RL.UI — all screens, HUD, panels, toasts, tutorial.
js/app.js           # boot.
```

## RL.PRNG
- `RL.PRNG.hash(str)` → uint32; `RL.PRNG.rng(seed)` → function() → [0,1).
- Rule: every procedural decision (star count/positions, planet params, names) uses a
  seeded rng created from the universe seed. Never Math.random() for world-gen.

## RL.Universe API
- `RL.Universe.init(canvas, opts)` — opts {quality:'low|med|high'}.
  Scene: starfield (Points, 1500/3000/5000), nebulae (2-4 large soft sprites, canvas-
  generated radial gradients), central star (glowing sprite + point light), 4-8 planets
  (SphereGeometry, canvas-generated surface textures: rocky/ice/gas/earth-like bands),
  0-2 moons each, asteroid belt (Points ring), orbital rings (LineLoops).
- `RL.Universe.generate(seedStr, opts)` — opts {starCount, planetCount, name}.
  Deterministic via RL.PRNG. Returns universe object:
  `{seed, name, createdAt, simTime (years), speed, planets:[{id,name,type,orbitR,orbitSpeed,
  size,temp,water,atmo,life:null|{stage,...},civ:null|{...}}], events:[...]}`.
- `RL.Universe.tick(dtYears)` — advance orbits (angle += speed*dt), rotate planets,
  evolve per-planet environment slowly, call RL.Life.tick for each planet with life.
- `RL.Universe.setSpeed(mult)` — 0=paused, 1, 2, 5, 10. Display as years/sec.
- `RL.Universe.selectPlanet(id)` / tap raycast → cb(planet). Info panel shows:
  name, type, temp, water %, atmosphere, life stage, civ stage, population.
- `RL.Universe.seedLife(planetId)` — only if habitable (temp 0-40°C, water>30%, atmo>20%);
  else toast reason. Creates life {stage:0 'microbes', pop, adaptation}.
- `RL.Universe.changeClimate(planetId, delta)` — adjust temp ±; affects habitability.
- `RL.Universe.addMoon/removeMoon`? — skip; not required.
- `RL.Universe.serialize()` / `RL.Universe.load(data)` — full state.
- Camera: touch orbit/zoom (same custom controls pattern as RuhLife engine).
- Quality: star counts, planet texture size, nebula count per tier.

## RL.Life API (life.js)
- Stages: 0 microbes → 1 simple → 2 complex → 3 intelligent → 4 primitive civ →
  5 settlements → 6 science/tech → 7 spacefaring → 8 interplanetary.
- `RL.Life.tick(planet, dtYears, universe)` — needs-based: pop grows if
  temp/water/atmo in range; evolves stage when pop threshold + stability time met;
  extinction events if climate collapses (recorded in universe.events).
- Civilization (stage≥4): {pop (thousands), tech 0-100, resources, events[]}.
  Tech unlocks: stage 7 → can "seed" neighboring habitable planet (panspermia event).
- All numbers derive from sim state; no fake progress.

## RL.Timeline API
- `RL.Timeline.snapshot(label)` — deep-copy serialize + simTime + label.
- `RL.Timeline.list()`, `RL.Timeline.restore(id)` (replaces current; original kept as
  auto-snapshot "pre-restore"), `RL.Timeline.branch(id)` (duplicate as new timeline),
  `RL.Timeline.compare(a,b)` → human-readable diff (time, avg tech, life count, events).
- Persisted in save data.

## RL.Codes (ALWAYS works, no backend)
- `RL.Codes.encode(universe)` → string like `RG-XXXX-XXXX-XXXX` encoding
  {seed, name, simTime, planetCount, lifeSeeds:[planetIdx:stage]}. Compact base36.
- `RL.Codes.decode(code)` → params or null (validate checksum char).
- UI: "Share Code" (copies + Android share if available), "Enter Code" input.

## RL.Online (Firebase, graceful)
- `RL.Online.init(firebaseConfig)` — if no config (RL.FIREBASE_CONFIG undefined),
  `RL.Online.available()` → false; community buttons show honest toast
  `online_not_configured` ("Community features need setup — ask Hasnain").
- When configured: anonymous auth (`signInAnonymously`), Firestore collection
  `universes`: publish {code, name, seed, stats, createdAt, author:"anonymous"},
  browse (orderBy createdAt desc, limit 30), fetch by id → decode → load.
- NEVER fake: no mock lists, no pretend uploads. Config lives in
  `www/firebase-config.js` (placeholder in repo; real config injected at build time
  from `~/workspace/ruhgenesis/secrets/`, same pattern as RuhRank).

## RL.Save
- `ru genesis_saves_v1`: universes [{id, name, seed, data, thumb, lastPlayed}],
  `ruhgenesis_settings_v1`. Same CRUD discipline as RuhLife.

## Screens (ui.js)
- Splash: logo (assets/logo.png — copy from the user's RuhGenesis upload), "Created by
  Hasnain Khan", animated starfield CSS, tap/skip.
- Menu (blueprint order): Start My Universe, Explore Global Universe (community),
  Continue Simulation, Timeline Explorer, Settings, About the Creator.
- Universe HUD: planet tap → info panel; bottom bar: Add Life, Climate, Speed
  (⏸/1×/2×/5×/10×), Save, Timeline, Share Code, Home. Stats panel (planets, life
  count, avg tech, sim years). Events feed.
- Timelines screen: snapshots list, compare view, restore/branch.
- Community screen: browse published (or not-configured notice), enter code, publish.
- Settings: lang, quality, volumes/mute, camera sensitivity, vibration, reset, version.
- About: logo, "Created by Hasnain Khan", description.

## i18n / audio / perf
- Same discipline as RuhLife: every string via RL.t(), procedural audio only,
  dt clamp, quality caps, 0 external requests (except Firebase when configured).

## Acceptance
0 JS errors; new universe generates deterministically (same seed → same planets);
life evolves over sim time; civ stages advance; timeline snapshot/restore/compare work;
share code regenerates universe; save/load round-trip; HI/EN toggle; offline fully
playable (block network in test → everything except community browse works).
