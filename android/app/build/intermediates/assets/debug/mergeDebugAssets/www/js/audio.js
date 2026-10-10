/* RuhGenesis Audio — 100% procedural WebAudio. Space drone pad, UI blips,
   event stingers. No external files. Respects mute + volumes. */
(function () {
  'use strict';

  var ctx = null, master = null, musicBus = null, sfxBus = null;
  var droneNodes = [], started = false;
  var settings = { master: 0.8, music: 0.5, sfx: 0.7, mute: false, vibrate: true };

  function ensure() {
    if (ctx) return true;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain(); master.connect(ctx.destination);
      musicBus = ctx.createGain(); musicBus.connect(master);
      sfxBus = ctx.createGain(); sfxBus.connect(master);
      applyVolumes();
      return true;
    } catch (e) { return false; }
  }

  function applyVolumes() {
    if (!ctx) return;
    var m = settings.mute ? 0 : settings.master;
    master.gain.value = m;
    musicBus.gain.value = settings.music;
    sfxBus.gain.value = settings.sfx;
  }

  function setVolumes(s) {
    for (var k in s) if (settings[k] !== undefined) settings[k] = s[k];
    applyVolumes();
  }
  function getSettings() { return { master: settings.master, music: settings.music, sfx: settings.sfx, mute: settings.mute, vibrate: settings.vibrate }; }

  // Deep space drone: two detuned low oscillators + slow filter LFO
  function startDrone() {
    if (!ensure() || started) return;
    started = true;
    try {
      var o1 = ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = 55;
      var o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = 55.7;
      var o3 = ctx.createOscillator(); o3.type = 'triangle'; o3.frequency.value = 110.3;
      var g = ctx.createGain(); g.gain.value = 0.16;
      var g3 = ctx.createGain(); g3.gain.value = 0.05;
      var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 320; f.Q.value = 0.6;
      var lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
      var lfoG = ctx.createGain(); lfoG.gain.value = 140;
      lfo.connect(lfoG); lfoG.connect(f.frequency);
      o1.connect(g); o2.connect(g); o3.connect(g3); g3.connect(g);
      g.connect(f); f.connect(musicBus);
      o1.start(); o2.start(); o3.start(); lfo.start();
      droneNodes = [o1, o2, o3, lfo];
    } catch (e) {}
  }

  function blip(freq) {
    if (!ensure()) return;
    try {
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = freq || 660;
      g.gain.setValueAtTime(0.25, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
      o.connect(g); g.connect(sfxBus);
      o.start(); o.stop(ctx.currentTime + 0.2);
    } catch (e) {}
  }

  // Event stinger: soft major arpeggio (discovery / evolution)
  function stinger() {
    if (!ensure()) return;
    try {
      var notes = [261.6, 329.6, 392.0, 523.3];
      for (var i = 0; i < notes.length; i++) {
        (function (n, d) {
          var o = ctx.createOscillator(), g = ctx.createGain();
          o.type = 'triangle'; o.frequency.value = n;
          var t0 = ctx.currentTime + d;
          g.gain.setValueAtTime(0.0001, t0);
          g.gain.exponentialRampToValueAtTime(0.22, t0 + 0.05);
          g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.9);
          o.connect(g); g.connect(sfxBus);
          o.start(t0); o.stop(t0 + 1.0);
        })(notes[i], i * 0.14);
      }
    } catch (e) {}
  }

  function vibrate(ms) {
    if (!settings.vibrate) return;
    try { if (window.Android && Android.vibrate) Android.vibrate(Math.min(ms || 40, 500)); } catch (e) {}
    try { if (navigator.vibrate) navigator.vibrate(ms || 40); } catch (e) {}
  }

  function unlock() { ensure(); if (ctx && ctx.state === 'suspended') { try { ctx.resume(); } catch (e) {} } startDrone(); }

  window.RL = window.RL || {};
  RL.Audio = {
    unlock: unlock, startDrone: startDrone, blip: blip, stinger: stinger,
    setVolumes: setVolumes, getSettings: getSettings, vibrate: vibrate
  };
})();
