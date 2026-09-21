/* Petit Timer : timer visuel pour enfant.
   Écrit pour Safari iOS 15 : pas de dépendance, pas de Wake Lock, audio via Web Audio. */
(function () {
  'use strict';

  var MIN_MINUTES = 1;
  var MAX_MINUTES = 90;
  var PRESETS = [1, 2, 5, 10, 15, 30];
  var MASCOTS = ['🐻', '🐰', '🐱', '🐢', '🦊', '🐼'];
  var STAR_COUNT = 10;
  var WARN_MS = 60 * 1000;
  var DEFAULT_MESSAGE = 'Le temps est écoulé !';
  var OLD_DEFAULT_MESSAGE = 'On éteint les dessins animés';

  function $(id) { return document.getElementById(id); }

  /* ---------- Stockage (peut échouer en navigation privée) ---------- */

  function load(key, fallback) {
    try {
      var value = window.localStorage.getItem('pt.' + key);
      return value === null ? fallback : value;
    } catch (e) {
      return fallback;
    }
  }

  function save(key, value) {
    try { window.localStorage.setItem('pt.' + key, value); } catch (e) { /* ignoré */ }
  }

  /* ---------- État ---------- */

  var minutes = clamp(parseInt(load('minutes', '5'), 10) || 5);
  var mascot = load('mascot', MASCOTS[0]);
  var message = load('message', DEFAULT_MESSAGE);
  if (message === OLD_DEFAULT_MESSAGE) { message = DEFAULT_MESSAGE; }

  // ?test=10 lance des timers de 10 secondes (pratique pour vérifier).
  var testSeconds = parseInt((/[?&]test=(\d+)/.exec(window.location.search) || [])[1], 10) || 0;

  var phase = 'setup';       // setup | running | paused | done
  var durationMs = 0;
  var endAt = 0;             // heure de fin (ms) tant que le timer tourne
  var remainingMs = 0;       // temps restant pendant la pause
  var warned = false;
  var tickHandle = null;

  var screens = {
    setup: $('screen-setup'),
    run: $('screen-run'),
    done: $('screen-done')
  };
  var els = {
    time: $('time'),
    fill: $('fill'),
    runner: $('runner'),
    runnerEmoji: $('runnerEmoji'),
    stars: $('stars'),
    pauseBtn: $('pauseBtn'),
    minutesValue: $('minutesValue'),
    presets: $('presets'),
    doneMascot: $('doneMascot'),
    doneMessage: $('doneMessage'),
    settings: $('settings'),
    mascotPicker: $('mascotPicker'),
    messageInput: $('messageInput')
  };

  function clamp(value) {
    return Math.max(MIN_MINUTES, Math.min(MAX_MINUTES, value));
  }

  function show(name) {
    Object.keys(screens).forEach(function (key) {
      screens[key].classList.toggle('active', key === name);
    });
  }

  /* ---------- Audio (Web Audio, débloqué par un appui) ---------- */

  var audioCtx = null;
  var ringHandle = null;

  function unlockAudio() {
    var AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) { return; }
    try {
      if (!audioCtx) { audioCtx = new AudioContextClass(); }
      if (audioCtx.state !== 'running' && audioCtx.resume) { audioCtx.resume(); }
    } catch (e) { /* pas de son, tant pis */ }
  }

  function playNote(freq, when, length, volume) {
    var osc = audioCtx.createOscillator();
    var gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.linearRampToValueAtTime(volume, when + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + length);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(when);
    osc.stop(when + length + 0.05);
  }

  function playMelody() {
    if (!audioCtx) { return; }
    if (audioCtx.state !== 'running' && audioCtx.resume) { audioCtx.resume(); }
    var start = audioCtx.currentTime + 0.05;
    [523.25, 659.25, 783.99, 1046.5, 783.99, 659.25, 523.25].forEach(function (freq, i) {
      playNote(freq, start + i * 0.32, 0.7, 0.3);
    });
  }

  function playBell() {
    if (!audioCtx) { return; }
    var start = audioCtx.currentTime + 0.05;
    playNote(880, start, 0.9, 0.25);
    playNote(1174.66, start + 0.25, 0.9, 0.25);
  }

  function startRinging() {
    stopRinging();
    playMelody();
    ringHandle = window.setInterval(playMelody, 3500);
  }

  function stopRinging() {
    if (ringHandle !== null) {
      window.clearInterval(ringHandle);
      ringHandle = null;
    }
  }

  /* ---------- Écran toujours allumé ---------- */

  // iOS 15 n'a pas de Wake Lock : NoSleep.js joue une mini vidéo muette en boucle.
  // Ça doit démarrer sur un appui (Démarrer / Encore), comme le son.
  var noSleep = null;

  function keepAwake(on) {
    if (!window.NoSleep) { return; }
    try {
      if (!noSleep) { noSleep = new window.NoSleep(); }
      var result = on ? noSleep.enable() : noSleep.disable();
      if (result && result.catch) { result.catch(function () { /* refusé : tant pis */ }); }
    } catch (e) { /* écran qui pourra s'éteindre */ }
  }

  /* ---------- Boutons à appui long ---------- */

  // onTap (facultatif) est appelé si l'appui a été relâché trop tôt.
  function onHold(button, ms, action, onTap) {
    var handle = null;
    button.style.setProperty('--hold-ms', ms + 'ms');

    function cancel() {
      if (handle !== null) { window.clearTimeout(handle); handle = null; }
      button.classList.remove('holding');
    }

    button.addEventListener('pointerup', function () {
      if (handle !== null && onTap) { onTap(); }
    });

    button.addEventListener('pointerdown', function () {
      cancel();
      button.classList.add('holding');
      handle = window.setTimeout(function () {
        handle = null;
        button.classList.remove('holding');
        action();
      }, ms);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (type) {
      button.addEventListener(type, cancel);
    });
    button.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  }

  /* ---------- Écran de réglage ---------- */

  function renderSetup() {
    els.minutesValue.textContent = minutes;
    Array.prototype.forEach.call(els.presets.children, function (btn) {
      btn.classList.toggle('selected', parseInt(btn.getAttribute('data-min'), 10) === minutes);
    });
    els.runnerEmoji.textContent = mascot;
    els.doneMascot.textContent = mascot;
  }

  function setMinutes(value) {
    minutes = clamp(value);
    save('minutes', minutes);
    renderSetup();
  }

  function buildPresets() {
    PRESETS.forEach(function (value) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn round';
      btn.setAttribute('data-min', value);
      btn.innerHTML = value + '<small>min</small>';
      btn.addEventListener('click', function () { setMinutes(value); });
      els.presets.appendChild(btn);
    });
  }

  function buildStars() {
    for (var i = 0; i < STAR_COUNT; i++) {
      var star = document.createElement('span');
      star.className = 'star';
      star.textContent = '⭐';
      els.stars.appendChild(star);
    }
  }

  /* ---------- Décompte ---------- */

  function pad(n) { return n < 10 ? '0' + n : String(n); }

  function formatTime(ms) {
    var total = Math.ceil(ms / 1000);
    return pad(Math.floor(total / 60)) + ':' + pad(total % 60);
  }

  // Vert quand il reste beaucoup de temps, orange puis rouge doux vers la fin.
  function colorFor(fraction) {
    var hue = Math.round(Math.max(0, Math.min(1, fraction / 0.6)) * 130);
    return 'hsl(' + hue + ', 75%, 62%)';
  }

  function render(ms) {
    var fraction = Math.max(0, Math.min(1, ms / durationMs));
    var percent = (fraction * 100).toFixed(2) + '%';
    els.time.textContent = formatTime(ms);
    els.fill.style.width = percent;
    els.fill.style.backgroundColor = colorFor(fraction);
    els.runner.style.left = percent;

    var lit = Math.ceil(fraction * STAR_COUNT);
    for (var i = 0; i < els.stars.children.length; i++) {
      els.stars.children[i].classList.toggle('off', i >= lit);
    }
  }

  function tick() {
    if (phase !== 'running') { return; }
    var ms = endAt - Date.now();
    if (ms <= 0) {
      finish();
      return;
    }
    if (!warned && durationMs >= 2 * WARN_MS && ms <= WARN_MS) {
      warned = true;
      els.time.classList.add('warn');
      playBell();
    }
    render(ms);
  }

  function start() {
    unlockAudio();
    keepAwake(true);
    durationMs = (testSeconds || minutes * 60) * 1000;
    endAt = Date.now() + durationMs;
    warned = false;
    phase = 'running';
    els.time.className = 'time';
    screens.run.classList.remove('paused-state');
    els.pauseBtn.textContent = '⏸ Pause';

    // Pas d'animation de départ : la barre repart pleine d'un coup.
    els.fill.style.transition = 'none';
    els.runner.style.transition = 'none';
    render(durationMs);
    // Force le recalcul du style avant de réactiver les transitions.
    void els.fill.offsetWidth;
    els.fill.style.transition = '';
    els.runner.style.transition = '';

    show('run');
    window.clearInterval(tickHandle);
    tickHandle = window.setInterval(tick, 200);
  }

  function togglePause() {
    unlockAudio();
    if (phase === 'running') {
      remainingMs = Math.max(0, endAt - Date.now());
      phase = 'paused';
      els.time.classList.add('paused');
      els.time.classList.remove('warn');
      screens.run.classList.add('paused-state');
      els.pauseBtn.textContent = '▶ Reprendre';
    } else if (phase === 'paused') {
      endAt = Date.now() + remainingMs;
      phase = 'running';
      els.time.classList.remove('paused');
      if (warned) { els.time.classList.add('warn'); }
      screens.run.classList.remove('paused-state');
      els.pauseBtn.textContent = '⏸ Pause';
    }
  }

  function cancelTimer() {
    window.clearInterval(tickHandle);
    keepAwake(false);
    phase = 'setup';
    show('setup');
  }

  function finish() {
    window.clearInterval(tickHandle);
    phase = 'done';
    render(0);
    els.time.className = 'time';
    els.doneMessage.textContent = message;
    show('done');
    startRinging();
  }

  function backToSetup() {
    stopRinging();
    keepAwake(false);
    phase = 'setup';
    show('setup');
  }

  function again() {
    stopRinging();
    start();
  }

  /* ---------- Réglages parents ---------- */

  function buildMascotPicker() {
    MASCOTS.forEach(function (emoji) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = emoji;
      btn.addEventListener('click', function () {
        mascot = emoji;
        save('mascot', emoji);
        renderMascotPicker();
        renderSetup();
      });
      els.mascotPicker.appendChild(btn);
    });
  }

  function renderMascotPicker() {
    Array.prototype.forEach.call(els.mascotPicker.children, function (btn) {
      btn.classList.toggle('selected', btn.textContent === mascot);
    });
  }

  function openSettings() {
    els.messageInput.value = message;
    renderMascotPicker();
    els.settings.hidden = false;
  }

  function closeSettings() {
    message = els.messageInput.value.replace(/^\s+|\s+$/g, '') || DEFAULT_MESSAGE;
    save('message', message);
    els.settings.hidden = true;
  }

  /* ---------- Branchements ---------- */

  buildPresets();
  buildStars();
  buildMascotPicker();
  renderSetup();

  $('minus').addEventListener('click', function () { setMinutes(minutes - 1); });
  $('plus').addEventListener('click', function () { setMinutes(minutes + 1); });
  $('startBtn').addEventListener('click', start);
  els.pauseBtn.addEventListener('click', togglePause);
  $('okBtn').addEventListener('click', backToSetup);
  $('againBtn').addEventListener('click', again);
  $('closeSettings').addEventListener('click', closeSettings);

  onHold($('cancelBtn'), 900, cancelTimer);
  var hintHandle = null;
  onHold($('settingsBtn'), 800, openSettings, function () {
    var hint = $('gearHint');
    hint.hidden = false;
    window.clearTimeout(hintHandle);
    hintHandle = window.setTimeout(function () { hint.hidden = true; }, 2500);
  });

  // Au retour sur l'app (écran rallumé), on recalcule tout de suite et on relance le son.
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { return; }
    tick();
    if (audioCtx && audioCtx.state !== 'running' && audioCtx.resume) { audioCtx.resume(); }
  });
}());
