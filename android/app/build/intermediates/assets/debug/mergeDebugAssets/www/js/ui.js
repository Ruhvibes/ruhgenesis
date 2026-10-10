/* RuhGenesis UI — all screens, HUD, panels, dialogs, tutorial. */
(function () {
  'use strict';

  var U = {
    currentId: null, selectedPid: null, speedIdx: 1,
    speeds: [0, 1, 2, 5, 10],
    tutStep: 0, backT: 0, autosaveT: 0
  };
  var SPEEDS_LABEL = ['⏸', '1×', '2×', '5×', '10×'];

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, html) {
    var d = document.createElement(tag);
    if (cls) d.className = cls;
    if (html !== undefined) d.innerHTML = html;
    return d;
  }

  function toast(msg, ms) {
    var t = $('toast'); if (!t) return;
    t.textContent = msg; t.classList.add('show');
    clearTimeout(t._h);
    t._h = setTimeout(function () { t.classList.remove('show'); }, ms || 2600);
  }

  function confirmDlg(msg, cb) {
    var ov = $('overlay'), box = $('dlg-box');
    box.innerHTML = '<div class="dlg-msg">' + msg + '</div>' +
      '<div class="dlg-row"><button class="btn ghost" id="dlg-no">' + RL.t('btn_cancel') + '</button>' +
      '<button class="btn primary" id="dlg-yes">' + RL.t('btn_confirm') + '</button></div>';
    ov.classList.add('show');
    $('dlg-no').onclick = function () { ov.classList.remove('show'); cb(false); };
    $('dlg-yes').onclick = function () { ov.classList.remove('show'); cb(true); };
  }

  function promptDlg(title, def, cb) {
    var ov = $('overlay'), box = $('dlg-box');
    box.innerHTML = '<div class="dlg-title">' + title + '</div>' +
      '<input class="inp" id="dlg-inp" value="' + (def || '').replace(/"/g, '&quot;') + '">' +
      '<div class="dlg-row"><button class="btn ghost" id="dlg-no">' + RL.t('btn_cancel') + '</button>' +
      '<button class="btn primary" id="dlg-yes">' + RL.t('btn_ok') + '</button></div>';
    ov.classList.add('show');
    var inp = $('dlg-inp'); try { inp.focus(); } catch (e) {}
    $('dlg-no').onclick = function () { ov.classList.remove('show'); cb(null); };
    $('dlg-yes').onclick = function () { var v = inp.value; ov.classList.remove('show'); cb(v); };
  }

  function show(id) {
    var ss = document.querySelectorAll('.screen');
    for (var i = 0; i < ss.length; i++) ss[i].classList.remove('active');
    var s = $('screen-' + id);
    if (s) s.classList.add('active');
    if (id === 'menu') renderMenuContinue();
    if (id === 'worlds') renderWorlds();
    if (id === 'timelines') renderTimelines();
    if (id === 'community') renderCommunity();
    if (id === 'settings') renderSettings();
  }

  /* ---------- splash & menu ---------- */
  function initSplash() {
    var sp = $('screen-splash');
    function go() { RL.Audio.unlock(); show('menu'); maybeTutorial(); }
    sp.addEventListener('click', go);
    setTimeout(function () { if ($('screen-splash').classList.contains('active')) go(); }, 6000);
  }

  function renderMenuContinue() {
    var arr = RL.Save.list();
    var b = $('btn-continue');
    b.style.opacity = arr.length ? 1 : 0.45;
  }

  function initMenu() {
    $('btn-new').onclick = function () { RL.Audio.blip(660); openNewDialog(); };
    $('btn-continue').onclick = function () {
      var arr = RL.Save.list();
      if (!arr.length) { toast(RL.t('worlds_empty')); return; }
      RL.Audio.blip(660); loadUniverse(arr[0].id);
    };
    $('btn-worlds').onclick = function () { RL.Audio.blip(660); show('worlds'); };
    $('btn-community').onclick = function () { RL.Audio.blip(660); show('community'); };
    $('btn-timeline-menu').onclick = function () { RL.Audio.blip(660); show('timelines'); };
    $('btn-settings').onclick = function () { RL.Audio.blip(660); show('settings'); };
    $('btn-about').onclick = function () { RL.Audio.blip(660); show('about'); };
    $('btn-exit').onclick = function () {
      if (window.Android && Android.closeApp) Android.closeApp();
      else toast(RL.t('exit_app'));
    };
    var backs = document.querySelectorAll('[data-back]');
    for (var i = 0; i < backs.length; i++) {
      backs[i].onclick = function () { RL.Audio.blip(440); show('menu'); };
    }
  }

  /* ---------- new universe dialog ---------- */
  function openNewDialog() {
    var ov = $('overlay'), box = $('dlg-box');
    box.innerHTML =
      '<div class="dlg-title" data-i18n="new_title">' + RL.t('new_title') + '</div>' +
      '<label class="lbl">' + RL.t('uni_name') + '</label>' +
      '<input class="inp" id="nu-name" maxlength="24" placeholder="' + RL.t('uni_name_ph') + '">' +
      '<label class="lbl">' + RL.t('uni_seed') + '</label>' +
      '<input class="inp" id="nu-seed" maxlength="16" style="text-transform:uppercase">' +
      '<label class="lbl">' + RL.t('uni_size') + '</label>' +
      '<div class="seg" id="nu-size">' +
      '<button data-v="s">' + RL.t('size_s') + '</button>' +
      '<button data-v="m" class="on">' + RL.t('size_m') + '</button>' +
      '<button data-v="l">' + RL.t('size_l') + '</button></div>' +
      '<div class="dlg-row"><button class="btn ghost" id="nu-cancel">' + RL.t('btn_cancel') + '</button>' +
      '<button class="btn primary" id="nu-go">' + RL.t('btn_create') + '</button></div>';
    ov.classList.add('show');
    var size = 'm';
    var segs = box.querySelectorAll('#nu-size button');
    for (var i = 0; i < segs.length; i++) {
      segs[i].onclick = function () {
        for (var j = 0; j < segs.length; j++) segs[j].classList.remove('on');
        this.classList.add('on'); size = this.getAttribute('data-v');
        RL.Audio.blip(520);
      };
    }
    $('nu-cancel').onclick = function () { ov.classList.remove('show'); };
    $('nu-go').onclick = function () {
      var name = $('nu-name').value.trim() || RL.t('uni_name_ph');
      var seed = $('nu-seed').value.trim();
      ov.classList.remove('show');
      startNewUniverse(name, seed, size);
    };
  }

  function startNewUniverse(name, seed, size) {
    var Uu = RL.Universe.newUniverse(name, seed, size);
    Uu.timelines = [];
    U.currentId = 'u' + Date.now();
    U.speedIdx = 1;
    RL.Universe.setSpeed(1);
    RL.Save.markDirty();
    persist(false);
    show('universe');
    RL.Universe.start();
    toast(RL.t('fact_hint'));
    startAutosave();
  }

  function loadUniverse(id) {
    var rec = RL.Save.get(id);
    if (!rec || !rec.data) { toast(RL.t('toast_save_fail')); return; }
    U.currentId = id;
    RL.Universe.loadData(rehydrate(rec.data));
    U.speedIdx = 1;
    RL.Universe.setSpeed(1);
    show('universe');
    RL.Universe.start();
    startAutosave();
  }

  // ensure timelines array + planet runtime fields exist
  function rehydrate(d) {
    if (!d.timelines) d.timelines = [];
    return d;
  }

  function persist(withThumb) {
    if (!U.currentId) return;
    var data = RL.Universe.serialize();
    if (!data) return;
    var thumb = null;
    if (withThumb) { try { thumb = snapshotThumb(); } catch (e) {} }
    var ok = RL.Save.saveUniverse({ id: U.currentId }, data, thumb);
    if (withThumb) toast(ok ? RL.t('toast_saved') : RL.t('toast_save_fail'));
  }

  function snapshotThumb() {
    var cv = document.querySelector('#gl');
    if (!cv) return null;
    try {
      // render one frame synchronously then capture
      return cv.toDataURL('image/jpeg', 0.6);
    } catch (e) { return null; }
  }

  function startAutosave() {
    clearInterval(U.autosaveT);
    U.autosaveT = setInterval(function () {
      if (RL.Save.isDirty() && $('screen-universe').classList.contains('active')) persist(false);
    }, 60000);
  }

  /* ---------- universe HUD ---------- */
  function initUniverse() {
    RL.Universe.onSelect(function (pid) {
      U.selectedPid = pid;
      RL.Audio.blip(700);
      renderPlanetPanel(pid);
    });
    $('tb-speed').onclick = cycleSpeed;
    $('tb-save').onclick = function () { RL.Audio.blip(660); RL.Save.markDirty(); persist(true); };
    $('tb-timeline').onclick = function () { RL.Audio.blip(660); show('timelines'); };
    $('tb-share').onclick = openShareDialog;
    $('tb-home').onclick = function () {
      confirmDlg(RL.t('confirm_home'), function (ok) {
        if (!ok) return;
        RL.Save.markDirty(); persist(false);
        RL.Universe.stop();
        show('menu');
      });
    };
    $('tb-stats').onclick = function () { $('stats-panel').classList.toggle('show'); renderStats(); };
    $('tb-addlife').onclick = function () {
      if (U.selectedPid) doSeedLife(U.selectedPid);
      else toast(RL.t('tut2'));
    };
    $('tb-climate').onclick = openClimateDialog;
    $('tb-panseed').onclick = doPanSeed;
    setInterval(refreshHud, 1000);
  }

  function cycleSpeed() {
    U.speedIdx = (U.speedIdx + 1) % U.speeds.length;
    var m = U.speeds[U.speedIdx];
    RL.Universe.setSpeed(m);
    RL.Audio.blip(500 + U.speedIdx * 90);
    refreshHud();
  }

  function refreshHud() {
    var u = RL.Universe.getU(); if (!u) return;
    $('hud-name').textContent = u.name;
    $('hud-time').textContent = Math.round(u.simTime).toLocaleString() + ' ' + RL.t('years');
    $('tb-speed').textContent = SPEEDS_LABEL[U.speedIdx];
    if ($('stats-panel').classList.contains('show')) renderStats();
    renderEvents();
  }

  function renderStats() {
    var st = RL.Universe.stats(); if (!st) return;
    $('stats-panel').innerHTML =
      '<div class="stat"><b>' + st.planets + '</b><span>' + RL.t('stats_planets') + '</span></div>' +
      '<div class="stat"><b>' + st.life + '</b><span>' + RL.t('stats_life') + '</span></div>' +
      '<div class="stat"><b>' + st.avgTech + '</b><span>' + RL.t('stats_tech') + '</span></div>' +
      '<div class="stat"><b>' + fmtYears(st.simTime) + '</b><span>' + RL.t('stats_time') + '</span></div>';
  }

  function fmtYears(y) {
    if (y >= 1e9) return (y / 1e9).toFixed(1) + 'B';
    if (y >= 1e6) return (y / 1e6).toFixed(1) + 'M';
    if (y >= 1e3) return (y / 1e3).toFixed(1) + 'K';
    return '' + y;
  }

  function renderEvents() {
    var u = RL.Universe.getU(); if (!u) return;
    var box = $('events-feed'); if (!box) return;
    var html = '';
    for (var i = 0; i < Math.min(6, u.events.length); i++) {
      var e = u.events[i];
      html += '<div class="ev">◈ ' + RL.t(e.key, e.vars) + ' <small>' + fmtYears(e.t) + '</small></div>';
    }
    box.innerHTML = html;
  }

  function renderPlanetPanel(pid) {
    var p = RL.Universe.getPlanet(pid); if (!p) return;
    var hab = RL.Universe.habitable(p);
    var lifeTxt = p.life ? RL.stageName(p.life.stage) + ' (' + fmtPop(p.life.pop) + ')' : RL.t('no_life');
    var civTxt = p.civ ? RL.stageName(p.life.stage) + ' · ' + RL.t('info_pop') + ' ' + Math.round(p.civ.pop) + 'K · ' + RL.t('info_tech') + ' ' + Math.round(p.civ.tech) : '—';
    $('planet-panel').innerHTML =
      '<div class="pp-head"><b>' + esc(p.name) + '</b><span class="pp-type">' + RL.planetTypeName(p.type) + '</span>' +
      '<button class="x" id="panel-close">✕</button></div>' +
      '<div class="pp-grid">' +
      '<div>🌡️ ' + RL.t('info_temp') + ': <b>' + p.temp + '°C</b></div>' +
      '<div>💧 ' + RL.t('info_water') + ': <b>' + p.water + '%</b></div>' +
      '<div>🌬️ ' + RL.t('info_atmo') + ': <b>' + p.atmo + '%</b></div>' +
      '<div>🧬 ' + RL.t('info_life') + ': <b>' + lifeTxt + '</b></div>' +
      '<div>🏙️ ' + RL.t('info_civ') + ': <b>' + civTxt + '</b></div>' +
      (hab && !p.life ? '<div class="pp-hab">✨ ' + RL.t('fact_hint') + '</div>' : '') +
      '</div>' +
      '<div class="pp-row">' +
      '<button class="btn primary sm" id="pp-seed">' + RL.t('seed_life') + '</button>' +
      '<button class="btn ghost sm" id="pp-warm">' + RL.t('climate_warmer') + '</button>' +
      '<button class="btn ghost sm" id="pp-cool">' + RL.t('climate_cooler') + '</button>' +
      (p.life && p.life.stage >= 7 ? '<button class="btn ghost sm" id="pp-panseed">🌱 ' + RL.t('seed_neighbor') + '</button>' : '') +
      '</div>';
    $('planet-panel').classList.add('show');
    $('panel-close').onclick = function () { $('planet-panel').classList.remove('show'); U.selectedPid = null; };
    $('pp-seed').onclick = function () { doSeedLife(pid); };
    $('pp-warm').onclick = function () { doClimate(pid, 5); };
    $('pp-cool').onclick = function () { doClimate(pid, -5); };
    var ps = $('pp-panseed');
    if (ps) ps.onclick = doPanSeed;
  }

  function fmtPop(n) {
    if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return '' + Math.round(n);
  }

  function esc(s) { return ('' + s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

  function doSeedLife(pid) {
    var r = RL.Universe.seedLife(pid);
    if (r.ok) { RL.Audio.stinger(); RL.Audio.vibrate(50); toast(RL.t('life_seeded', r.vars)); }
    else toast(RL.t(r.key, r.vars));
    RL.Save.markDirty();
    if (U.selectedPid) renderPlanetPanel(U.selectedPid);
  }

  function doClimate(pid, delta) {
    var id = pid || U.selectedPid;
    if (!id) { toast(RL.t('tut2')); return; }
    var p = RL.Universe.getPlanet(id);
    RL.Universe.changeClimate(id, delta);
    RL.Audio.blip(delta > 0 ? 760 : 420);
    toast(RL.t('climate_changed', { name: p ? p.name : '' }));
    RL.Save.markDirty();
    if (U.selectedPid) renderPlanetPanel(U.selectedPid);
  }

  function openClimateDialog() {
    if (!U.selectedPid) { toast(RL.t('tut2')); return; }
    doClimate(U.selectedPid, 0); // just refreshes panel; buttons inside panel adjust
    toast(RL.t('hud_climate') + ' — ' + RL.t('tut2'));
  }

  function doPanSeed() {
    var id = U.selectedPid;
    if (!id) { toast(RL.t('tut2')); return; }
    var r = RL.Life.seedNeighbor(RL.Universe.getU(), id);
    if (r.ok) { RL.Audio.stinger(); toast(RL.t('ev_panspermia', { name: '', target: r.target })); }
    else toast(RL.t(r.key || 'no_neighbor'));
    RL.Save.markDirty();
  }

  /* ---------- share code ---------- */
  function openShareDialog() {
    var u = RL.Universe.getU(); if (!u) return;
    var code = RL.Codes.encode(u);
    var ov = $('overlay'), box = $('dlg-box');
    box.innerHTML =
      '<div class="dlg-title">' + RL.t('code_title') + '</div>' +
      '<div class="code">' + code + '</div>' +
      '<div class="hint">' + RL.t('code_hint') + '</div>' +
      '<div class="dlg-row"><button class="btn ghost" id="code-close">' + RL.t('btn_close') + '</button>' +
      '<button class="btn primary" id="code-copy">' + RL.t('code_copy') + '</button></div>' +
      '<div class="dlg-row" style="margin-top:8px"><button class="btn ghost" id="code-enter">' + RL.t('code_enter') + '</button></div>';
    ov.classList.add('show');
    $('code-close').onclick = function () { ov.classList.remove('show'); };
    $('code-copy').onclick = function () {
      copyText(code);
      if (window.Android && Android.shareText) { try { Android.shareText(code); } catch (e) {} }
      toast(RL.t('code_copied'));
    };
    $('code-enter').onclick = function () { ov.classList.remove('show'); openEnterCode(); };
  }

  function copyText(t) {
    try {
      if (navigator.clipboard) navigator.clipboard.writeText(t);
      else { var ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); }
    } catch (e) {}
  }

  function openEnterCode() {
    promptDlg(RL.t('code_enter'), '', function (v) {
      if (!v) return;
      var p = RL.Codes.decode(v);
      if (!p) { toast(RL.t('code_invalid')); return; }
      var Uu = RL.Codes.applyToUniverse(p);
      Uu.timelines = [];
      U.currentId = 'u' + Date.now();
      RL.Universe.loadData(Uu);
      U.speedIdx = 1; RL.Universe.setSpeed(1);
      RL.Save.markDirty(); persist(false);
      show('universe'); RL.Universe.start(); startAutosave();
      toast(RL.t('code_loaded'));
    });
  }

  /* ---------- timelines screen ---------- */
  function renderTimelines() {
    var box = $('tl-list');
    var u = RL.Universe.getU();
    if (!u) { box.innerHTML = '<div class="empty">' + RL.t('tut2') + '</div>'; $('tl-new').style.display = 'none'; return; }
    $('tl-new').style.display = '';
    var arr = RL.Timeline.list();
    var html = '';
    if (!arr.length) html = '<div class="empty">' + RL.t('tl_none') + '</div>';
    arr.forEach(function (s) {
      var sm = RL.Timeline.summarize(s.data);
      html += '<div class="tl-item"><div class="tl-main"><b>' + esc(s.label) + '</b>' +
        '<small>' + fmtYears(s.simTime) + ' ' + RL.t('years') + ' · 🧬' + sm.life + ' · ⚙' + sm.avgTech + '</small></div>' +
        '<div class="tl-btns"><button class="btn sm ghost" data-act="restore" data-id="' + s.id + '">' + RL.t('tl_restore') + '</button>' +
        '<button class="btn sm ghost" data-act="branch" data-id="' + s.id + '">' + RL.t('tl_branch') + '</button>' +
        '<button class="btn sm ghost" data-act="cmp" data-id="' + s.id + '">' + RL.t('tl_compare') + '</button></div></div>';
    });
    box.innerHTML = html;
    var btns = box.querySelectorAll('button');
    for (var i = 0; i < btns.length; i++) {
      btns[i].onclick = function () {
        var id = this.getAttribute('data-id'), act = this.getAttribute('data-act');
        if (act === 'restore') {
          confirmDlg(RL.t('tl_restore') + '?', function (ok) {
            if (!ok) return;
            RL.Timeline.restore(id);
            RL.Save.markDirty(); persist(false);
            toast(RL.t('tl_restored'));
            show('universe'); RL.Universe.start();
          });
        } else if (act === 'branch') {
          var data = RL.Timeline.branch(id);
          if (data) {
            var nid = 'u' + Date.now();
            RL.Save.saveUniverse({ id: nid }, data, null);
            toast(RL.t('tl_branched'));
            show('worlds');
          }
        } else if (act === 'cmp') { openCompare(id); }
      };
    }
  }

  function openCompare(id) {
    var arr = RL.Timeline.list();
    var other = null;
    for (var i = 0; i < arr.length; i++) if (arr[i].id !== id) { other = arr[i]; break; }
    if (!other) { toast(RL.t('tl_none')); return; }
    var d = RL.Timeline.compare(id, other.id);
    var ov = $('overlay'), box = $('dlg-box');
    box.innerHTML = '<div class="dlg-title">' + RL.t('tl_compare') + '</div>' +
      '<div class="cmp"><div><b>' + esc(d.a.label) + '</b> → <b>' + esc(d.b.label) + '</b></div>' +
      '<div>⏳ ' + RL.t('tl_diff_time') + ': <b>' + (d.dTime >= 0 ? '+' : '') + fmtYears(d.dTime) + '</b></div>' +
      '<div>🧬 ' + RL.t('tl_diff_life') + ': <b>' + (d.dLife >= 0 ? '+' : '') + d.dLife + '</b></div>' +
      '<div>⚙ ' + RL.t('tl_diff_tech') + ': <b>' + (d.dTech >= 0 ? '+' : '') + d.dTech + '</b></div></div>' +
      '<div class="dlg-row"><button class="btn primary" id="cmp-ok">' + RL.t('btn_ok') + '</button></div>';
    ov.classList.add('show');
    $('cmp-ok').onclick = function () { ov.classList.remove('show'); };
  }

  function initTimelines() {
    $('tl-new').onclick = function () {
      promptDlg(RL.t('tl_snapshot'), '', function (v) {
        if (v === null) return;
        RL.Timeline.snapshot(v || undefined);
        renderTimelines();
        RL.Audio.blip(700);
      });
    };
  }

  /* ---------- worlds ---------- */
  function renderWorlds() {
    var box = $('worlds-list');
    var arr = RL.Save.list();
    if (!arr.length) { box.innerHTML = '<div class="empty">' + RL.t('worlds_empty') + '</div>'; return; }
    var html = '';
    arr.forEach(function (w) {
      html += '<div class="w-item">' +
        (w.thumb ? '<img class="w-thumb" src="' + w.thumb + '">' : '<div class="w-thumb none">🌌</div>') +
        '<div class="w-main"><b>' + esc(w.name) + '</b><small>' + RL.t('last_played') + ': ' + new Date(w.lastPlayed).toLocaleDateString() + '</small></div>' +
        '<div class="w-btns"><button class="btn sm primary" data-act="load" data-id="' + w.id + '">' + RL.t('btn_load') + '</button>' +
        '<button class="btn sm ghost" data-act="rename" data-id="' + w.id + '">' + RL.t('btn_rename') + '</button>' +
        '<button class="btn sm ghost" data-act="del" data-id="' + w.id + '">' + RL.t('btn_delete') + '</button></div></div>';
    });
    box.innerHTML = html;
    var btns = box.querySelectorAll('button');
    for (var i = 0; i < btns.length; i++) {
      btns[i].onclick = function () {
        var id = this.getAttribute('data-id'), act = this.getAttribute('data-act');
        if (act === 'load') loadUniverse(id);
        else if (act === 'rename') {
          var rec = RL.Save.get(id);
          promptDlg(RL.t('btn_rename'), rec ? rec.name : '', function (v) {
            if (!v) return;
            RL.Save.rename(id, v.slice(0, 24)); renderWorlds();
          });
        } else if (act === 'del') {
          confirmDlg(RL.t('confirm_delete'), function (ok) { if (ok) { RL.Save.remove(id); renderWorlds(); } });
        }
        RL.Audio.blip(600);
      };
    }
  }

  /* ---------- community ---------- */
  function renderCommunity() {
    var box = $('com-list');
    if (!RL.Online.available()) {
      box.innerHTML = '<div class="notice">📡 ' + RL.t('online_not_configured') + '</div>' +
        '<div class="hint">' + RL.t('code_hint') + '</div>';
      return;
    }
    box.innerHTML = '<div class="empty">…</div>';
    RL.Online.browse(function (arr) {
      if (!arr || !arr.length) { box.innerHTML = '<div class="empty">' + RL.t('com_none') + '</div>'; return; }
      var html = '';
      arr.forEach(function (v) {
        html += '<div class="w-item"><div class="w-thumb none">🌌</div>' +
          '<div class="w-main"><b>' + esc(v.name || '???') + '</b><small>🧬' + (v.life || 0) + ' · ⚙' + (v.avgTech || 0) + ' · ' + RL.t('online_published_by') + '</small></div>' +
          '<div class="w-btns"><button class="btn sm primary" data-code="' + esc(v.code || '') + '">' + RL.t('com_open') + '</button></div></div>';
      });
      box.innerHTML = html;
      var btns = box.querySelectorAll('button');
      for (var i = 0; i < btns.length; i++) {
        btns[i].onclick = function () {
          var p = RL.Codes.decode(this.getAttribute('data-code'));
          if (!p) { toast(RL.t('code_invalid')); return; }
          var Uu = RL.Codes.applyToUniverse(p);
          Uu.timelines = [];
          U.currentId = 'u' + Date.now();
          RL.Universe.loadData(Uu);
          RL.Universe.setSpeed(1); U.speedIdx = 1;
          RL.Save.markDirty(); persist(false);
          show('universe'); RL.Universe.start(); startAutosave();
          toast(RL.t('code_loaded'));
        };
      }
    });
  }

  function initCommunity() {
    $('com-publish').onclick = function () {
      var u = RL.Universe.getU();
      if (!u) { toast(RL.t('tut2')); return; }
      RL.Online.publish(u, function (ok) {
        toast(ok ? RL.t('com_published') : RL.t('online_not_configured'));
        if (ok) renderCommunity();
      });
    };
    $('com-entercode').onclick = openEnterCode;
  }

  /* ---------- settings ---------- */
  function renderSettings() {
    var s = RL.Save.getSettings();
    $('set-lang').value = s.lang;
    $('set-quality').value = s.quality;
    $('set-master').value = s.master;
    $('set-music').value = s.music;
    $('set-sfx').value = s.sfx;
    $('set-mute').checked = s.mute;
    $('set-camsens').value = s.camSens;
    $('set-vibrate').checked = s.vibrate;
  }

  function initSettings() {
    function cur() { return RL.Save.getSettings(); }
    function upd(patch) {
      var s = cur();
      for (var k in patch) s[k] = patch[k];
      RL.Save.saveSettings(s);
      applySettings(s);
    }
    $('set-lang').onchange = function () { upd({ lang: this.value }); RL.setLang(this.value); toast(RL.t('set_saved')); };
    $('set-quality').onchange = function () { upd({ quality: this.value }); RL.Universe.setQuality(this.value); toast(RL.t('set_saved')); };
    $('set-master').oninput = function () { upd({ master: parseFloat(this.value) }); };
    $('set-music').oninput = function () { upd({ music: parseFloat(this.value) }); };
    $('set-sfx').oninput = function () { upd({ sfx: parseFloat(this.value) }); };
    $('set-mute').onchange = function () { upd({ mute: this.checked }); };
    $('set-camsens').oninput = function () { upd({ camSens: parseFloat(this.value) }); };
    $('set-vibrate').onchange = function () { upd({ vibrate: this.checked }); };
    $('set-tutorial').onclick = function () { var s = cur(); s.tutorial = true; RL.Save.saveSettings(s); U.tutStep = 0; show('menu'); maybeTutorial(true); };
    $('set-reset').onclick = function () {
      confirmDlg(RL.t('set_reset') + '?', function (ok) {
        if (!ok) return;
        try { localStorage.removeItem('ruhgenesis_settings_v1'); } catch (e) {}
        var s = RL.Save.getSettings();
        RL.setLang(s.lang); applySettings(s); renderSettings();
        toast(RL.t('set_reset_done'));
      });
    };
  }

  function applySettings(s) {
    RL.Audio.setVolumes({ master: s.master, music: s.music, sfx: s.sfx, mute: s.mute, vibrate: s.vibrate });
    RL.Universe.setCamSens(s.camSens || 1);
  }

  /* ---------- tutorial ---------- */
  function maybeTutorial(force) {
    var s = RL.Save.getSettings();
    if (!s.tutorial && !force) return;
    if (force) { try { var ss = RL.Save.getSettings(); ss.tutorial = false; RL.Save.saveSettings(ss); } catch (e) {} }
    U.tutStep = 0;
    showTut();
  }

  function showTut() {
    var keys = ['tut1', 'tut2', 'tut3', 'tut4', 'tut5'];
    if (U.tutStep >= keys.length) { $('tut-ov').classList.remove('show'); return; }
    $('tut-txt').textContent = RL.t(keys[U.tutStep]);
    $('tut-btn').textContent = U.tutStep === keys.length - 1 ? RL.t('tut_done') : RL.t('tut_next');
    $('tut-ov').classList.add('show');
  }

  function initTutorial() {
    $('tut-btn').onclick = function () { RL.Audio.blip(600); U.tutStep++; showTut(); };
    $('tut-skip').onclick = function () { $('tut-ov').classList.remove('show'); };
  }

  /* ---------- life event hooks ---------- */
  function onEvolved(p) {
    toast('🧬 ' + RL.t('ev_evolved', { name: p.name, stage: RL.stageName(p.life.stage) }), 3400);
    RL.Audio.vibrate(60);
    RL.Save.markDirty();
  }
  function onExtinct(name) {
    toast('☠️ ' + RL.t('ev_extinct', { name: name }), 3400);
    RL.Save.markDirty();
  }
  function onPanspermia(from, target) {
    toast('🌱 ' + RL.t('ev_panspermia', { name: from.name, target: target.name }), 3400);
    RL.Audio.stinger();
    RL.Save.markDirty();
  }

  /* ---------- back button ---------- */
  function initBack() {
    document.addEventListener('backbutton', function () {
      var active = document.querySelector('.screen.active');
      var id = active ? active.id : '';
      if (id === 'screen-menu') {
        var now = Date.now();
        if (now - U.backT < 2000) { if (window.Android && Android.closeApp) Android.closeApp(); }
        else { U.backT = now; toast(RL.t('exit_app')); }
      } else if (id === 'screen-universe') {
        $('tb-home').click();
      } else show('menu');
    }, false);
  }

  function init() {
    initSplash(); initMenu(); initUniverse(); initTimelines(); initCommunity();
    initSettings(); initTutorial(); initBack();
  }

  window.RL = window.RL || {};
  RL.UI = { init: init, show: show, toast: toast, confirmDlg: confirmDlg,
            onEvolved: onEvolved, onExtinct: onExtinct, onPanspermia: onPanspermia,
            persist: persist, openEnterCode: openEnterCode };
})();
