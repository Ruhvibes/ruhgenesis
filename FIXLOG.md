# RuhGenesis — Full Audit FIXLOG (2026-10-10)

Comprehensive audit + fix pass. **14 bugs fixed**, 0 JS errors, automated
headless-Chrome suite: **50/50 (real Firebase), 46/46 (null config), 45/46 (offline)**.

---

## 🔴 Critical bugs fixed

### 1. Timeline snapshots LOST on save/load
**Root cause:** `RL.Universe.serialize()` never included `timelines`. `persist()`
saved the serialize output, so every snapshot vanished after save → reload.
`loadUniverse` then rehydrated with `timelines: []`.
**Fix (`universe.js`, `ui.js`, `timeline.js`):** `serialize(withTimelines)` —
`s persist()` calls `serialize(true)`; snapshot payloads are stored *without*
nested timelines (avoids recursion bloat); snapshots capped at 20.
**Test:** save → reload keeps all snapshots; restore/branch/compare work after reload.

### 2. Snapshot moon state corrupted (shared reference)
**Root cause:** `serialize()` copied `moons: p.moons` **by reference** — the live
sim's moon angles kept mutating inside stored snapshots/timeline data.
**Fix:** deep-copy moons via `planetCopy()` (JSON round-trip).

### 3. Panspermia could re-fire after save/load
**Root cause:** `p._seededNeighbor` (stage-7 civ's "already seeded" flag) was
dropped by `serialize()` → after reload, the civ seeded the neighbor again.
**Fix:** included in `planetCopy()`.

### 4. Firebase publish → PERMISSION_DENIED
**Root cause:** Firestore rules require new docs to contain keys
`['id','name','seed']`, but `fbPublish()` never sent `id`.
**Fix (`online.js`):** doc now includes `id: u.id || ('u'+Date.now())`.
**Test:** end-to-end publish → Firestore write → read-back, all green.

### 5. Wrong toast on Firebase publish success
**Root cause:** `publishUniverse()` resolved a boolean, so a Firebase success
showed "Opening publish flow…" (the GitHub message).
**Fix:** resolves `'firebase' | 'github' | false`; UI shows `com_published`
("Universe published!") for Firebase.

### 6. Publish raced anonymous sign-in
**Root cause:** `fbPublish()` fired the Firestore write immediately; if the
boot-time `signInAnonymously()` hadn't completed, the write failed and fell
back to GitHub even though Firebase was configured.
**Fix (`online.js`):** `authReady()` waits up to 2.5s for an auth user before writing.

## 🟡 Medium bugs fixed

### 7. Blank world thumbnails
**Root cause:** `snapshotThumb()` called `canvas.toDataURL()` on a WebGL canvas
without `preserveDrawingBuffer` — returns blank (same class of bug as RuhLife).
**Fix (`universe.js`):** new `RL.Universe.captureThumb()` renders one frame
synchronously *then* captures. `ui.js` uses it.

### 8. Climate button showed fake "adjusted" toast
**Root cause:** `openClimateDialog()` called `doClimate(pid, 0)` — delta 0 changes
nothing but toasted "Climate adjusted".
**Fix:** removed the no-op call; the button now just opens the planet panel whose
Warmer/Cooler buttons do the real work.

### 9. Saved sim speed ignored on load
**Root cause:** `loadUniverse()` / code-import hardcoded `speedIdx = 1` (1×).
**Fix (`ui.js`):** `syncSpeed()` restores the saved speed and HUD label; also
applied after timeline restore and code import.

### 10. Per-frame closure allocation in tick()
**Root cause:** `RL.PRNG.rng('drift'…)` was constructed **every frame** (60/sec)
even though it's only used when crossing a 50-year boundary.
**Fix:** boundary check first, rng built only when crossed.

### 11. Share codes & community visits lost universe size
**Root cause:** `codes.encode()` omitted `size`; `applyToUniverse()` and
`visitEntry()` regenerated with default `'m'` — a Large universe shared as Small.
**Fix:** `size` in code payload (backward-compatible decode), in published
`stats`, and used by `visitEntry()`.

### 12. Idle simulation never autosaved
**Root cause:** `tick()` never marked the save dirty, so pure idle sim time was
lost if the app was killed without pressing Home.
**Fix (`ui.js`):** `refreshHud()` marks dirty every ~240 sim-years; autosave picks it up.

### 13. Open planet panel went stale
**Root cause:** panel rendered once; life stages kept evolving behind it.
**Fix:** throttled (5s) live refresh while the panel is open.

### 14. Share dialog could render "null"
**Root cause:** `RL.Codes.encode()` can return `null`; dialog interpolated it raw.
**Fix:** guard → `code_invalid` toast.

## ✅ Verified good (no change needed)
- **Seed determinism:** same seed → byte-identical planet lists (tested).
- **All `getElementById` targets exist** (programmatic check); **all `RL.t()` keys
  exist in both EN + HI** (programmatic check).
- **Codes:** `RG-XXXX` format, checksum, invalid-code rejection.
- **Save corruption:** garbage JSON / malformed records handled, no crash.
- **Geometry disposal** on reload/quality change (`clearScene` traverses +
  disposes); camera limits; touch orbit/zoom; 390px layout.
- **Audio:** mute respected, no autoplay before gesture (`unlock()` on tap),
  volumes live via settings.
- **Offline-first:** network blocked → full game works; community shows empty
  state gracefully; publish falls back to GitHub flow.

## 🔥 Firebase backend — real findings (action needed)
- **API key transcription error FIXED:** `secrets/firebase-config.js` had
  `...BTeI1aTLyw...`, screenshot shows `...BTeiIaTlyw...`. Anonymous auth,
  writes, reads all verified working after correction. **The delivered APK
  (v1/versionCode 3) was built with the wrong key — Firebase is dead in that
  build; needs a rebuild.**
- **Published Firestore rules differ from intended:** `update`/`delete` return
  403 even for authed users (only `create`+`read` work). App needs only
  create+read, so nothing breaks — but Hasnain should re-check the rules in
  console (the `allow update, delete: if request.auth != null;` line seems
  missing/mis-published).
- **Test docs left in `universes` collection** (can't delete — see above):
  "Audit Test", "Del Test", "Audit Probe", "PubTest"/"My Universe". Hasnain can
  remove them from the Firestore console once delete works.

## Test evidence
- `node --check` on all 11 JS files: clean.
- Headless Chrome (SwiftShader WebGL) full journey: new universe → seed life →
  evolve → timeline → share code → save/reload → community → publish, plus
  settings/about/tutorial/HUD/speed/pause, Hindi toggle.
- **real config: 50/50 · null config: 46/46 · offline: 45/46**
  (offline's single "fail" is Chrome logging the intentionally-blocked GitHub
  fetch — the app itself handles it gracefully with zero JS errors).

*`www/firebase-config.js` left as the `null` placeholder; real config lives only
in `secrets/` (git-ignored) and was used for testing via a temp copy.*
