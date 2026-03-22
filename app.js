'use strict';

// ═══════════════════════════════════════════════════════════════════════
//  SPELLING STARS — app.js
// ═══════════════════════════════════════════════════════════════════════

// ── Default word list ───────────────────────────────────────────────────
const DEFAULT_WORDS = ['cat', 'dog', 'house', 'tree', 'book', 'play', 'fish', 'bird', 'cake', 'jump'];

// ── LocalStorage keys ───────────────────────────────────────────────────
const LS_WORDS    = 'spellingStars_words';
const LS_MASTERED = 'spellingStars_mastered';
const LS_SESSIONS = 'spellingStars_sessions';

// ── App state ───────────────────────────────────────────────────────────
let words          = [];      // current word list
let mastered       = {};      // { word: true } for mastered words
let practiceQueue  = [];      // words being practised this session
let queueIndex     = 0;       // current position in practiceQueue
let attempts       = 0;       // wrong attempts on the current word
let sessionCorrect = 0;       // words answered correctly this session
let currentMode    = '';      // 'Hear & Type' or 'See & Type'
let seeCountdownId = null;    // setInterval handle for See & Type countdown

// ── Encouragement messages ──────────────────────────────────────────────
const ENCOURAGEMENTS = [
  'Almost! Try again! 💪',
  'So close! Give it another go! 🌟',
  'Keep trying — you\'ve got this! 😊',
  'Not quite! You can do it! 🎯',
  'Nearly there! One more try! 🌈',
];

// ═══════════════════════════════════════════════════════════════════════
//  INITIALISATION
// ═══════════════════════════════════════════════════════════════════════
function init() {
  // Load saved state from localStorage (fall back to defaults)
  words    = JSON.parse(localStorage.getItem(LS_WORDS))    || DEFAULT_WORDS.slice();
  mastered = JSON.parse(localStorage.getItem(LS_MASTERED)) || {};

  // Render main screen
  renderMain();

  // ── Wire up all button clicks ─────────────────────────────────────────
  // Main screen
  document.getElementById('btn-parent')    .addEventListener('click', showParent);
  document.getElementById('btn-hear-type') .addEventListener('click', startHearMode);
  document.getElementById('btn-see-type')  .addEventListener('click', startSeeMode);

  // Hear & Type screen
  document.getElementById('back-from-hear')   .addEventListener('click', () => showScreen('main'));
  document.getElementById('btn-say')           .addEventListener('click', sayCurrentWord);
  document.getElementById('btn-hear-submit')   .addEventListener('click', submitHear);
  document.getElementById('hear-input')        .addEventListener('keydown', e => { if (e.key === 'Enter') submitHear(); });

  // See & Type screen
  document.getElementById('back-from-see')    .addEventListener('click', () => { clearSeeCountdown(); showScreen('main'); });
  document.getElementById('btn-see-submit')   .addEventListener('click', submitSee);
  document.getElementById('btn-peek')         .addEventListener('click', peekWord);
  document.getElementById('see-input')        .addEventListener('keydown', e => { if (e.key === 'Enter') submitSee(); });

  // Celebration screen
  document.getElementById('btn-celebration-home').addEventListener('click', () => showScreen('main'));

  // Parent screen
  document.getElementById('back-from-parent')  .addEventListener('click', () => showScreen('main'));
  document.getElementById('btn-save-words')     .addEventListener('click', saveNewWordList);
  document.getElementById('btn-reset-progress') .addEventListener('click', resetProgress);
}

// ═══════════════════════════════════════════════════════════════════════
//  SCREEN MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + id).classList.add('active');
  if (id === 'main') renderMain();
}

// ═══════════════════════════════════════════════════════════════════════
//  MAIN SCREEN — progress + word chips
// ═══════════════════════════════════════════════════════════════════════
function renderMain() {
  const total         = words.length;
  const masteredCount = words.filter(w => mastered[w]).length;
  const pct           = total > 0 ? (masteredCount / total) * 100 : 0;

  document.getElementById('progress-text').textContent =
    `${masteredCount} of ${total} word${total !== 1 ? 's' : ''} mastered!`;

  document.getElementById('progress-bar').style.width = pct + '%';

  // Rebuild word chips
  const list = document.getElementById('word-list');
  list.innerHTML = '';
  words.forEach(word => {
    const div       = document.createElement('div');
    const isMastered = !!mastered[word];
    div.className   = 'word-chip' + (isMastered ? ' mastered' : '');
    div.innerHTML   = `<span class="chip-icon">${isMastered ? '⭐' : '○'}</span>${word}`;
    list.appendChild(div);
  });
}

// ═══════════════════════════════════════════════════════════════════════
//  HEAR & TYPE MODE
// ═══════════════════════════════════════════════════════════════════════
function startHearMode() {
  practiceQueue  = words.slice();
  queueIndex     = 0;
  sessionCorrect = 0;
  currentMode    = 'Hear & Type';
  showScreen('hear');
  loadHearWord();
}

function loadHearWord() {
  if (queueIndex >= practiceQueue.length) {
    saveSession();
    showScreen('main');
    checkAllMastered();
    return;
  }

  document.getElementById('hear-progress').textContent =
    `Word ${queueIndex + 1} of ${practiceQueue.length}`;

  attempts = 0;

  const input    = document.getElementById('hear-input');
  const feedback = document.getElementById('hear-feedback');
  input.value        = '';
  input.disabled     = false;
  feedback.textContent = '';
  feedback.className   = 'feedback';
  input.focus();
}

function sayCurrentWord() {
  speak(practiceQueue[queueIndex]);
}

function submitHear() {
  const input    = document.getElementById('hear-input');
  const feedback = document.getElementById('hear-feedback');
  const typed    = input.value.trim().toLowerCase();
  const correct  = practiceQueue[queueIndex].toLowerCase();

  if (!typed) return;

  if (typed === correct) {
    mastered[correct] = true;
    sessionCorrect++;
    saveState();
    showFeedback(feedback, input, true);
    setTimeout(() => {
      queueIndex++;
      loadHearWord();
    }, 1800);
  } else {
    attempts++;
    if (attempts >= 2) {
      showSkip(feedback, input, correct);
      setTimeout(() => { queueIndex++; loadHearWord(); }, 2200);
    } else {
      showFeedback(feedback, input, false);
      input.value = '';
      setTimeout(() => input.focus(), 50);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  SEE & TYPE MODE
// ═══════════════════════════════════════════════════════════════════════
function startSeeMode() {
  practiceQueue  = words.slice();
  queueIndex     = 0;
  sessionCorrect = 0;
  currentMode    = 'See & Type';
  showScreen('see');
  loadSeeWord();
}

function loadSeeWord() {
  if (queueIndex >= practiceQueue.length) {
    saveSession();
    showScreen('main');
    checkAllMastered();
    return;
  }

  const wordText  = document.getElementById('word-text');
  const countdown = document.getElementById('see-countdown');
  const input     = document.getElementById('see-input');
  const submit    = document.getElementById('btn-see-submit');
  const feedback  = document.getElementById('see-feedback');

  // Reset state
  clearSeeCountdown();
  attempts             = 0;
  input.value          = '';
  input.disabled       = true;
  submit.disabled      = true;
  feedback.textContent = '';
  feedback.className   = 'feedback';
  document.getElementById('btn-peek').hidden = true;

  // Update counter label
  document.getElementById('see-progress').textContent =
    `Word ${queueIndex + 1} of ${practiceQueue.length}`;

  // Show word
  wordText.textContent = practiceQueue[queueIndex];
  wordText.classList.add('visible');
  countdown.textContent = '3';

  // Count down 3 → 2 → 1 → hide
  let secs = 3;
  seeCountdownId = setInterval(() => {
    secs--;
    if (secs <= 0) {
      clearSeeCountdown();
      wordText.classList.remove('visible');
      countdown.textContent = '';
      input.disabled  = false;
      submit.disabled = false;
      document.getElementById('btn-peek').hidden = false;
      input.focus();
    } else {
      countdown.textContent = secs;
    }
  }, 1000);
}

function clearSeeCountdown() {
  if (seeCountdownId !== null) {
    clearInterval(seeCountdownId);
    seeCountdownId = null;
  }
}

function peekWord() {
  const wordText = document.getElementById('word-text');
  const peekBtn  = document.getElementById('btn-peek');

  // Show the word briefly, then hide it again after 2 seconds
  wordText.classList.add('visible');
  peekBtn.disabled = true;

  setTimeout(() => {
    wordText.classList.remove('visible');
    peekBtn.disabled = false;
  }, 2000);
}

function submitSee() {
  const input    = document.getElementById('see-input');
  const feedback = document.getElementById('see-feedback');
  const typed    = input.value.trim().toLowerCase();
  const correct  = practiceQueue[queueIndex].toLowerCase();

  if (!typed) return;

  if (typed === correct) {
    mastered[correct] = true;
    sessionCorrect++;
    saveState();
    showFeedback(feedback, input, true);
    setTimeout(() => {
      queueIndex++;
      loadSeeWord();
    }, 1800);
  } else {
    attempts++;
    if (attempts >= 2) {
      showSkip(feedback, input, correct);
      setTimeout(() => { queueIndex++; loadSeeWord(); }, 2200);
    } else {
      showFeedback(feedback, input, false);
      input.value = '';
      setTimeout(() => input.focus(), 50);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  SHARED FEEDBACK
// ═══════════════════════════════════════════════════════════════════════
function showFeedback(feedbackEl, inputEl, isCorrect) {
  if (isCorrect) {
    feedbackEl.textContent = '✅ Correct! Great job! 🎉';
    feedbackEl.className   = 'feedback correct';
    launchConfetti(false);
  } else {
    const msg = ENCOURAGEMENTS[Math.floor(Math.random() * ENCOURAGEMENTS.length)];
    feedbackEl.textContent = msg;
    feedbackEl.className   = 'feedback incorrect';

    // Shake the input field
    inputEl.classList.remove('input-shake');
    // Force reflow so the animation restarts if triggered again
    void inputEl.offsetWidth;
    inputEl.classList.add('input-shake');
    inputEl.addEventListener('animationend', () => inputEl.classList.remove('input-shake'), { once: true });
  }
}

function showSkip(feedbackEl, inputEl, correctWord) {
  feedbackEl.textContent = `The word was "${correctWord}". Let's try the next one! 👍`;
  feedbackEl.className   = 'feedback incorrect';
  inputEl.disabled       = true;
}

// ═══════════════════════════════════════════════════════════════════════
//  CELEBRATION
// ═══════════════════════════════════════════════════════════════════════
function checkAllMastered() {
  if (words.length > 0 && words.every(w => mastered[w])) {
    setTimeout(() => {
      showScreen('celebration');
      launchConfetti(true);
    }, 400);
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  CONFETTI
// ═══════════════════════════════════════════════════════════════════════
const CONFETTI_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A',
  '#98FB98', '#DDA0DD', '#FFD700', '#FF69B4',
  '#3A86FF', '#06D6A0', '#FFD166', '#FF6B35',
];

function launchConfetti(big) {
  const layer = document.getElementById('confetti-layer');
  const count = big ? 160 : 45;

  for (let i = 0; i < count; i++) {
    const bit   = document.createElement('div');
    const color = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
    const size  = Math.random() * 10 + 6;             // 6–16 px
    const drift = (Math.random() - 0.5) * 120;        // horizontal drift
    const dur   = Math.random() * 2 + 2.2;            // 2.2–4.2 s
    const delay = Math.random() * 0.6;                // staggered start

    bit.className = 'confetti-bit';
    bit.style.cssText = [
      `left: ${Math.random() * 100}%`,
      `width: ${size}px`,
      `height: ${size}px`,
      `background: ${color}`,
      `border-radius: ${Math.random() > 0.5 ? '50%' : '3px'}`,
      `--d: ${drift}px`,
      `animation-duration: ${dur}s`,
      `animation-delay: ${delay}s`,
    ].join(';');

    layer.appendChild(bit);
    bit.addEventListener('animationend', () => bit.remove(), { once: true });
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  SPEECH (Web Speech API)
// ═══════════════════════════════════════════════════════════════════════

// Voice preference list — clearest, most natural-sounding English voices
// across macOS, iOS (iPad), Chrome, and Windows.
const PREFERRED_VOICES = [
  'Samantha',          // macOS / iOS — clear, natural American English
  'Karen',             // macOS Australian — very clear
  'Daniel',            // macOS British — clear
  'Google US English', // Chrome on desktop/Android
  'Google UK English Female',
  'Microsoft Zira',    // Windows — clear female voice
  'Microsoft David',   // Windows — clear male voice
  'Alex',              // older macOS fallback
];

let selectedVoice = null;

function loadVoice() {
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return;   // not ready yet — onvoiceschanged will retry

  // Try each preferred voice in order
  for (const name of PREFERRED_VOICES) {
    const match = voices.find(v => v.name === name);
    if (match) { selectedVoice = match; return; }
  }

  // Fallback: any local (not network) en-US voice
  const localEnUS = voices.find(v => v.lang === 'en-US' && v.localService);
  if (localEnUS) { selectedVoice = localEnUS; return; }

  // Last resort: any English voice
  selectedVoice = voices.find(v => v.lang.startsWith('en')) || null;
}

// Voices may not be ready immediately — load now and also on the change event
if ('speechSynthesis' in window) {
  loadVoice();
  window.speechSynthesis.onvoiceschanged = loadVoice;
}

function speak(text) {
  if (!('speechSynthesis' in window)) {
    alert('Sorry, your browser does not support text-to-speech.\nTry Chrome or Safari on iPad.');
    return;
  }

  window.speechSynthesis.cancel();

  // Say the word twice with a pause between, like a teacher would.
  // We achieve the pause by queuing two utterances — the first ends with
  // a comma (which forces a natural beat) and the second is the plain word.
  function makeUtt(spoken) {
    const utt  = new SpeechSynthesisUtterance(spoken);
    utt.rate   = 0.6;
    utt.pitch  = 1.0;
    utt.volume = 1.0;
    if (selectedVoice) utt.voice = selectedVoice;
    return utt;
  }

  // Speak the first utterance, then wait 800ms before the second
  const first = makeUtt(text);
  first.onend = () => setTimeout(() => window.speechSynthesis.speak(makeUtt(text)), 800);
  window.speechSynthesis.speak(first);
}

// ═══════════════════════════════════════════════════════════════════════
//  PARENT VIEW
// ═══════════════════════════════════════════════════════════════════════
function showParent() {
  // Populate progress chips
  const list = document.getElementById('parent-progress-list');
  list.innerHTML = '';
  words.forEach(word => {
    const div        = document.createElement('div');
    const isMastered = !!mastered[word];
    div.className    = 'parent-word-chip' + (isMastered ? ' mastered' : '');
    div.textContent  = (isMastered ? '⭐ ' : '○ ') + word;
    list.appendChild(div);
  });

  // Populate textarea with current words
  document.getElementById('parent-word-list').value = words.join('\n');

  // Populate session history
  const sessions = JSON.parse(localStorage.getItem(LS_SESSIONS)) || [];
  const historyEl = document.getElementById('parent-session-history');
  historyEl.innerHTML = '';

  if (sessions.length === 0) {
    historyEl.innerHTML = '<p class="parent-hint">No sessions completed yet.</p>';
  } else {
    // Show most recent first
    sessions.slice().reverse().forEach(s => {
      const row  = document.createElement('div');
      const date = new Date(s.date);
      const dateStr = date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
      const timeStr = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
      const pct  = Math.round((s.correct / s.total) * 100);

      row.className = 'session-row';
      row.innerHTML = `
        <span class="session-datetime">${dateStr} at ${timeStr}</span>
        <span class="session-mode">${s.mode === 'Hear & Type' ? '🔊' : '👀'} ${s.mode}</span>
        <span class="session-score ${pct === 100 ? 'perfect' : ''}">${s.correct}/${s.total} correct</span>
      `;
      historyEl.appendChild(row);
    });
  }

  showScreen('parent');
}

function saveNewWordList() {
  const raw      = document.getElementById('parent-word-list').value;
  const newWords = raw
    .split('\n')
    .map(w => w.trim().toLowerCase())
    .filter(w => w.length > 0);

  if (newWords.length === 0) {
    alert('Please enter at least one word before saving.');
    return;
  }

  const confirmed = confirm(
    `Save ${newWords.length} new word${newWords.length !== 1 ? 's' : ''} and reset all progress?\n\n` +
    `Words: ${newWords.join(', ')}`
  );

  if (confirmed) {
    words   = newWords;
    mastered = {};
    saveState();
    showScreen('main');
  }
}

function resetProgress() {
  const confirmed = confirm(
    'Reset all progress? The word list will stay the same, but all ⭐ stars will be cleared.'
  );
  if (confirmed) {
    mastered = {};
    saveState();
    showParent();   // Stay on parent screen, refresh the chip display
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  LOCALSTORAGE
// ═══════════════════════════════════════════════════════════════════════
function saveState() {
  localStorage.setItem(LS_WORDS,    JSON.stringify(words));
  localStorage.setItem(LS_MASTERED, JSON.stringify(mastered));
}

function saveSession() {
  const sessions = JSON.parse(localStorage.getItem(LS_SESSIONS)) || [];
  sessions.push({
    date:    new Date().toISOString(),
    mode:    currentMode,
    correct: sessionCorrect,
    total:   practiceQueue.length,
  });
  // Keep only the 20 most recent sessions
  if (sessions.length > 20) sessions.splice(0, sessions.length - 20);
  localStorage.setItem(LS_SESSIONS, JSON.stringify(sessions));
}

// ═══════════════════════════════════════════════════════════════════════
//  BOOT
// ═══════════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', init);
