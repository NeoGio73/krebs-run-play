/* What The Battle of Embden left behind in this browser, for The Krebs Run's opening (TRANSITION-PLAN.md).
 * Read-only: nothing is ever written. Both games share these keys only when they are served from the same site
 * (https://neogio73.github.io/); anywhere else, including D2L and the Unity Editor, the reads find nothing and the opening
 * plays with its default lines.
 *   fromEmbden      the page was opened with ?from=embden (Embden's CONTINUE TO THE KREBS RUN link)
 *   embdenComplete  Embden's save here has every question cleared in all four stages
 *   pilot           the name Embden's certificate was made for, if any
 * KrebsSave.jslib (KR_Handoff) calls KrebsHandoff.read() once when the game starts. */
(function (root) {
  'use strict';
  var EMBDEN_SAVE = 'battle-of-embden:browser-save:v1:/battle-of-embden-play/index.html';
  var EMBDEN_PILOT = 'battle-of-embden:pilot:v1';
  var EMBDEN_FULL = [1048575, 1048575, 1048575, 63];   // Embden's 20, 20, 20 and 6 questions (its browser-save.js COUNTS)
  function read() {
    var out = { fromEmbden: false, embdenComplete: false, pilot: '' };
    try { out.fromEmbden = new URLSearchParams(root.location.search).get('from') === 'embden'; } catch (e) { /* no address to read */ }
    try {
      var raw = root.localStorage.getItem(EMBDEN_SAVE);
      var solved = raw && JSON.parse(raw).progress.solved;
      out.embdenComplete = Array.isArray(solved) && solved.length === EMBDEN_FULL.length &&
        solved.every(function (mask, i) { return (mask & EMBDEN_FULL[i]) === EMBDEN_FULL[i]; });
    } catch (e) { /* no Embden save here, or not readable */ }
    try {
      var pilot = JSON.parse(root.localStorage.getItem(EMBDEN_PILOT) || 'null');
      if (pilot && typeof pilot.name === 'string') out.pilot = pilot.name.replace(/\s+/g, ' ').trim().slice(0, 60);
    } catch (e) { /* no name left behind */ }
    return out;
  }
  root.KrebsHandoff = { read: read };
})(window);
