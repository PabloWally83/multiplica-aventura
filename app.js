'use strict';

const TOTAL_TABLES = 10;
const QUESTIONS_PER_LEVEL = 10;
const PASS_SCORE = 8;
const MAX_FACTOR = 10;
const STORAGE_KEY = 'maPlus';
const DAY_RANGES = {
  1: [1, 4],
  2: [5, 7],
  3: [8, 10]
};
const BASE_STATE = {
  unlocked: 1,
  done: [],
  stars: 0,
  streak: 0,
  day: 1,
  misses: [],
  sound: true
};

let state = readState();
let questions = [];
let questionIndex = 0;
let correctAnswers = 0;
let currentTable = 1;
let gameKind = 'table';
let earnedStars = 0;
let waitingForNext = false;
let audioContext = null;

const $ = id => document.getElementById(id);
function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const reducedMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function freshState() {
  return { ...BASE_STATE, done: [], misses: [] };
}

function readState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved || typeof saved !== 'object') return freshState();

    const done = Array.isArray(saved.done)
      ? [...new Set(saved.done.map(Number).filter(n => Number.isInteger(n) && n >= 1 && n <= TOTAL_TABLES))].sort((a, b) => a - b)
      : [];
    const misses = Array.isArray(saved.misses)
      ? saved.misses
          .filter(item => item && Number.isInteger(Number(item.a)) && Number.isInteger(Number(item.b)))
          .map(item => ({ a: clamp(Number(item.a), 1, TOTAL_TABLES), b: clamp(Number(item.b), 1, MAX_FACTOR) }))
          .slice(-80)
      : [];

    return {
      unlocked: clamp(Number(saved.unlocked) || 1, 1, TOTAL_TABLES),
      done,
      stars: Math.max(0, Number(saved.stars) || 0),
      streak: Math.max(0, Number(saved.streak) || 0),
      day: clamp(Number(saved.day) || 1, 1, 3),
      misses,
      sound: saved.sound !== false
    };
  } catch {
    return freshState();
  }
}

function writeState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function shuffle(items) {
  const array = [...items];
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = randomInt(0, i);
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function dayForTable(table) {
  if (table <= 4) return 1;
  if (table <= 7) return 2;
  return 3;
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(screen => screen.classList.remove('active'));
  $(id).classList.add('active');
}

function updateSoundButton() {
  const button = $('soundToggle');
  button.setAttribute('aria-pressed', String(state.sound));
  button.innerHTML = state.sound ? '🔊 <span>Sonido</span>' : '🔇 <span>Sonido</span>';
  button.title = state.sound ? 'Desactivar sonidos' : 'Activar sonidos';
}

function render() {
  state.unlocked = clamp(state.unlocked, 1, TOTAL_TABLES);
  state.done = state.done.filter(table => table <= TOTAL_TABLES);

  $('stars').textContent = `⭐ ${state.stars}`;
  $('streak').textContent = `🔥 ${state.streak}`;
  $('progressText').textContent = `${state.done.length}/${TOTAL_TABLES} niveles`;
  $('progressBar').style.width = `${(state.done.length / TOTAL_TABLES) * 100}%`;
  updateSoundButton();

  document.querySelectorAll('.day').forEach(button => {
    button.classList.toggle('active', Number(button.dataset.day) === state.day);
  });

  const levels = $('levels');
  levels.innerHTML = '';
  const [start, end] = DAY_RANGES[state.day];

  for (let table = start; table <= end; table += 1) {
    const completed = state.done.includes(table);
    const locked = table > state.unlocked;
    const level = document.createElement('button');
    level.type = 'button';
    level.className = `level${completed ? ' done' : ''}${locked ? ' locked' : ''}`;
    level.disabled = locked;
    level.setAttribute('aria-label', locked ? `Tabla del ${table}, bloqueada` : `Jugar tabla del ${table}`);
    level.innerHTML = `
      <div class="ico">${completed ? '🏆' : locked ? '🔒' : table === 1 ? '🌱' : '⭐'}</div>
      <b>Tabla del ${table}</b>
      <small>${completed ? '¡Dominada!' : locked ? 'Desbloqueá la anterior' : '10 preguntas'}</small>`;
    if (!locked) level.addEventListener('click', () => beginTable(table));
    levels.appendChild(level);
  }

  $('mistakeCount').textContent = state.misses.length ? `(${state.misses.length})` : '';
  $('mistakesBtn').disabled = state.misses.length === 0;
  writeState();
}

function getAudioContext() {
  if (!state.sound) return null;
  try {
    if (!audioContext) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return null;
      audioContext = new AudioContextClass();
    }
    if (audioContext.state === 'suspended') audioContext.resume();
    return audioContext;
  } catch {
    return null;
  }
}

function playNote(context, frequency, start, duration, type = 'sine', volume = 0.055) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.018);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

function playSound(name) {
  const context = getAudioContext();
  if (!context) return;
  const now = context.currentTime + 0.015;

  if (name === 'correct') {
    [[523.25, 0], [659.25, 0.075], [783.99, 0.15], [1046.5, 0.225]].forEach(([note, delay], index) => {
      playNote(context, note, now + delay, 0.18, index === 3 ? 'sine' : 'triangle', 0.05);
    });
  } else if (name === 'wrong') {
    playNote(context, 392, now, 0.22, 'sine', 0.035);
    playNote(context, 329.63, now + 0.14, 0.28, 'sine', 0.032);
  } else if (name === 'start') {
    [[392, 0], [523.25, 0.09], [659.25, 0.18]].forEach(([note, delay]) => {
      playNote(context, note, now + delay, 0.2, 'triangle', 0.045);
    });
  } else if (name === 'win') {
    [[523.25, 0], [659.25, 0.1], [783.99, 0.2], [1046.5, 0.32], [1318.51, 0.46]].forEach(([note, delay], index) => {
      playNote(context, note, now + delay, index < 3 ? 0.3 : 0.5, index % 2 ? 'sine' : 'triangle', 0.055);
    });
  } else if (name === 'encourage') {
    [[329.63, 0], [392, 0.12], [523.25, 0.25]].forEach(([note, delay]) => {
      playNote(context, note, now + delay, 0.25, 'sine', 0.035);
    });
  }
}

function makeFirework(x, y, sparkCount = 18, radius = 95) {
  const palette = ['#ffdb70', '#ff6fa0', '#66e3b4', '#8f80ff', '#62c6ff', '#ffffff'];
  const firework = document.createElement('div');
  firework.className = 'firework';
  firework.style.left = `${x}%`;
  firework.style.top = `${y}%`;

  for (let i = 0; i < sparkCount; i += 1) {
    const angle = (Math.PI * 2 * i) / sparkCount + Math.random() * 0.16;
    const distance = radius * (0.62 + Math.random() * 0.55);
    const spark = document.createElement('span');
    spark.className = 'spark';
    spark.style.setProperty('--dx', `${Math.cos(angle) * distance}px`);
    spark.style.setProperty('--dy', `${Math.sin(angle) * distance}px`);
    spark.style.setProperty('--color', palette[i % palette.length]);
    spark.style.animationDelay = `${Math.random() * 70}ms`;
    firework.appendChild(spark);
  }

  $('celebration').appendChild(firework);
  window.setTimeout(() => firework.remove(), 1100);
}

function celebrate(big = false) {
  if (reducedMotion()) return;
  if (big) {
    [[20, 28], [50, 20], [80, 31], [34, 52], [68, 55]].forEach(([x, y], index) => {
      window.setTimeout(() => makeFirework(x, y, 24, 125), index * 150);
    });
  } else {
    makeFirework(randomInt(38, 62), randomInt(25, 42), 18, 88);
  }
}

function showEncouragementPuffs() {
  if (reducedMotion()) return;
  ['💛', '⭐', '🌈'].forEach((symbol, index) => {
    const puff = document.createElement('span');
    puff.className = 'puff';
    puff.textContent = symbol;
    puff.style.left = `${44 + index * 6}%`;
    puff.style.top = `${38 + (index % 2) * 7}%`;
    puff.style.animationDelay = `${index * 90}ms`;
    $('celebration').appendChild(puff);
    window.setTimeout(() => puff.remove(), 1200);
  });
}

function restartAnimation(element, className) {
  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
  window.setTimeout(() => element.classList.remove(className), 900);
}

function tableQuestions(table) {
  const factors = shuffle(Array.from({ length: MAX_FACTOR }, (_, index) => index + 1));
  const currentCount = table === 1 ? QUESTIONS_PER_LEVEL : 6;
  const result = factors.slice(0, currentCount).map(factor => ({ a: table, b: factor }));

  while (result.length < QUESTIONS_PER_LEVEL) {
    result.push({ a: randomInt(1, table), b: randomInt(1, MAX_FACTOR) });
  }
  return shuffle(result);
}

function beginTable(table) {
  currentTable = clamp(table, 1, TOTAL_TABLES);
  gameKind = 'table';
  questions = tableQuestions(currentTable);
  beginGame();
}

function beginMix() {
  gameKind = 'mix';
  currentTable = clamp(state.unlocked, 1, TOTAL_TABLES);
  questions = Array.from({ length: QUESTIONS_PER_LEVEL }, () => ({
    a: randomInt(1, currentTable),
    b: randomInt(1, MAX_FACTOR)
  }));
  beginGame();
}

function beginMistakes() {
  if (!state.misses.length) return;
  gameKind = 'mistakes';
  currentTable = clamp(state.unlocked, 1, TOTAL_TABLES);
  const pool = shuffle(state.misses.slice(-24));
  questions = Array.from({ length: QUESTIONS_PER_LEVEL }, (_, index) => ({ ...pool[index % pool.length] }));
  beginGame();
}

function beginGame() {
  questionIndex = 0;
  correctAnswers = 0;
  earnedStars = 0;
  waitingForNext = false;
  playSound('start');
  showScreen('game');
  showQuestion();
}

function showQuestion() {
  waitingForNext = false;
  const question = questions[questionIndex];
  $('mode').textContent = gameKind === 'table'
    ? `TABLA DEL ${currentTable}`
    : gameKind === 'mix'
      ? 'DESAFÍO MEZCLADO'
      : 'ENTRENAMIENTO PERSONAL';
  $('count').textContent = `${questionIndex + 1}/${questions.length}`;
  $('qbar').style.width = `${(questionIndex / questions.length) * 100}%`;
  $('question').textContent = `${question.a} × ${question.b} = ?`;
  $('answer').value = '';
  $('answer').disabled = false;
  $('feedback').textContent = '';
  $('feedback').className = '';
  $('mascot').textContent = '🦊';
  $('submit').textContent = '¡Listo!';
  $('earned').textContent = `⭐ ${earnedStars}`;
  $('encourage').textContent = '¡Vos podés!';
  $('answer').focus();
}

function rememberMistake(question) {
  state.misses = state.misses.filter(item => !(item.a === question.a && item.b === question.b));
  state.misses.push({ a: question.a, b: question.b });
  state.misses = state.misses.slice(-80);
}

function forgetMistake(question) {
  state.misses = state.misses.filter(item => !(item.a === question.a && item.b === question.b));
}

function answerQuestion() {
  if (waitingForNext) {
    questionIndex += 1;
    if (questionIndex === questions.length) finishGame();
    else showQuestion();
    return;
  }

  const rawAnswer = $('answer').value;
  if (rawAnswer === '') {
    $('feedback').textContent = 'Escribí una respuesta primero 😊';
    $('feedback').className = 'incorrect';
    return;
  }

  const question = questions[questionIndex];
  const expected = question.a * question.b;
  const isCorrect = Number(rawAnswer) === expected;
  const feedback = $('feedback');
  const quizCard = $('quizCard');
  waitingForNext = true;
  $('answer').disabled = true;

  if (isCorrect) {
    correctAnswers += 1;
    earnedStars += 1;
    playSound('correct');
    celebrate(false);
    restartAnimation(quizCard, 'correct-pop');
    feedback.textContent = ['¡Fantástico! ✨', '¡Respuesta mágica! 🌟', '¡Lo lograste! 🎉', '¡Súper cerebro! 🧠'][randomInt(0, 3)];
    feedback.className = 'correct';
    $('mascot').textContent = '🥳';
    $('encourage').textContent = '¡Respuesta brillante!';
    forgetMistake(question);
  } else {
    playSound('wrong');
    showEncouragementPuffs();
    restartAnimation(quizCard, 'oops');
    feedback.textContent = `Casi. ${question.a} × ${question.b} es ${expected}. ¡La próxima sale!`;
    feedback.className = 'incorrect';
    $('mascot').textContent = '🤗';
    $('encourage').textContent = 'Equivocarse también es aprender';
    rememberMistake(question);
  }

  writeState();
  $('earned').textContent = `⭐ ${earnedStars}`;
  $('submit').textContent = questionIndex === questions.length - 1 ? 'Ver resultado' : 'Siguiente';
}

function finishGame() {
  const passed = gameKind === 'table' && correctAnswers >= PASS_SCORE;
  const starsWon = Math.max(0, Math.floor(correctAnswers / 2));
  const finalTableCompleted = passed && currentTable === TOTAL_TABLES;

  if (gameKind === 'table') {
    if (passed) {
      if (!state.done.includes(currentTable)) state.done.push(currentTable);
      state.done.sort((a, b) => a - b);
      state.unlocked = Math.max(state.unlocked, Math.min(TOTAL_TABLES, currentTable + 1));
      state.streak += 1;
      state.day = dayForTable(state.unlocked);
    } else {
      state.streak = 0;
    }
  } else {
    state.streak = correctAnswers === questions.length ? state.streak + 1 : 0;
  }

  state.stars += starsWon;
  writeState();
  render();

  const goodResult = passed || (gameKind !== 'table' && correctAnswers >= PASS_SCORE);
  const resultCard = $('resultCard');
  resultCard.classList.toggle('win', goodResult);

  if (goodResult) {
    playSound('win');
    window.setTimeout(() => celebrate(true), 120);
  } else {
    playSound('encourage');
  }

  $('resultIcon').textContent = gameKind === 'table' ? (passed ? '🏆' : '💪') : (goodResult ? '🌟' : '🧠');
  $('resultTitle').textContent = gameKind === 'table'
    ? passed
      ? finalTableCompleted ? '¡Dominaste las tablas del 1 al 10!' : '¡Nivel superado!'
      : '¡A practicar un poquito más!'
    : goodResult ? '¡Desafío genial!' : '¡Buen entrenamiento!';

  if (gameKind === 'table') {
    $('resultText').textContent = passed
      ? finalTableCompleted
        ? `¡${correctAnswers} de 10! Completaste toda la aventura. ¡Sos una estrella de la multiplicación!`
        : `¡${correctAnswers} de 10! Desbloqueaste la próxima tabla. ¡Seguí así!`
      : `Tuviste ${correctAnswers} correctas. Necesitás ${PASS_SCORE} para desbloquear la próxima tabla. ¡Reintentá!`;
  } else {
    $('resultText').textContent = `¡${correctAnswers} de ${questions.length} respuestas correctas! ${state.misses.length ? 'Las cuentas difíciles quedan guardadas para entrenarlas.' : '¡Muy bien!'}`;
  }

  $('score').textContent = `${correctAnswers}/${questions.length}`;
  $('award').textContent = `${starsWon} ⭐`;
  const continueButton = $('resultContinue');
  continueButton.textContent = gameKind === 'table' ? (passed ? '¡Continuar!' : 'Reintentar') : 'Volver al mapa';
  continueButton.onclick = () => {
    if (gameKind === 'table' && !passed) beginTable(currentTable);
    else {
      showScreen('home');
      render();
    }
  };
  showScreen('result');
}

$('start').addEventListener('click', () => {
  const nextTable = clamp(state.unlocked, 1, TOTAL_TABLES);
  state.day = dayForTable(nextTable);
  writeState();
  beginTable(nextTable);
});

$('back').addEventListener('click', () => {
  showScreen('home');
  render();
});

$('submit').addEventListener('click', answerQuestion);
$('answer').addEventListener('keydown', event => {
  if (event.key === 'Enter') answerQuestion();
});
$('mixBtn').addEventListener('click', beginMix);
$('mistakesBtn').addEventListener('click', beginMistakes);
$('soundToggle').addEventListener('click', () => {
  state.sound = !state.sound;
  writeState();
  updateSoundButton();
  if (state.sound) playSound('correct');
});

document.querySelectorAll('.day').forEach(button => {
  button.addEventListener('click', () => {
    state.day = Number(button.dataset.day);
    writeState();
    render();
  });
});

render();
