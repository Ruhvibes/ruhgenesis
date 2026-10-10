/* RuhGenesis boot. */
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    var s = RL.Save.getSettings();
    RL.setLang(s.lang || 'en');
    RL.Audio.setVolumes({ master: s.master, music: s.music, sfx: s.sfx, mute: s.mute, vibrate: s.vibrate });
    RL.Universe.init(document.getElementById('gl'), { quality: s.quality || 'med' });
    RL.Universe.setCamSens(s.camSens || 1);
    RL.UI.init();
    RL.Online.init();
    RL.UI.show('splash');
    // audio unlock on first interaction (mobile autoplay policy)
    function unl() { RL.Audio.unlock(); document.removeEventListener('touchstart', unl); document.removeEventListener('click', unl); }
    document.addEventListener('touchstart', unl);
    document.addEventListener('click', unl);
  });
})();
