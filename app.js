"use strict";

const N = 10;
const NUMQ = 10;
const NEED = 8;
const STORAGE_KEY = "maPlus";
const BASE = { unlocked: 1, done: [], stars: 0, streak: 0, day: 1, misses: [], plan: null, soundOn: true };

let s = readState();
let questions = [];
let questionIndex = 0;
let hits = 0;
let currentTable = 1;
let gameKind = "table";
let bonus = 0;
let waitingForNext = false;
let attemptResults = [];
let startAfterPlanSave = false;
let audioContext = null;

const $ = id => document.getElementById(id);

function cloneBase() { return JSON.parse(JSON.stringify(BASE)); }
function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function shuffle(items) {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = rand(0, i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function readState() {
  let raw;
  try { raw = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { raw = null; }
  const next = { ...cloneBase(), ...(raw && typeof raw === "object" ? raw : {}) };
  next.done = Array.isArray(next.done) ? [...new Set(next.done.map(Number).filter(n => n >= 1 && n <= N))].sort((a,b) => a-b) : [];
  next.unlocked = clamp(Number(next.unlocked) || 1, 1, N);
  next.stars = Math.max(0, Number(next.stars) || 0);
  next.streak = Math.max(0, Number(next.streak) || 0);
  next.misses = Array.isArray(next.misses) ? next.misses.filter(q => q && q.a >= 1 && q.a <= N && q.b >= 1 && q.b <= N).slice(-80) : [];
  if (!next.plan || !Number.isInteger(Number(next.plan.days))) next.plan = null;
  else next.plan = { days: clamp(Number(next.plan.days), 1, N) };
  next.day = clamp(Number(next.day) || 1, 1, next.plan ? next.plan.days : 1);
  next.soundOn = next.soundOn !== false;
  return next;
}

function writeState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); }
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(el => el.classList.remove("active"));
  $(id).classList.add("active");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function buildPlan(days) {
  const count = clamp(Number(days) || 1, 1, N);
  const baseSize = Math.floor(N / count);
  let extra = N % count;
  let table = 1;
  return Array.from({ length: count }, (_, index) => {
    const size = baseSize + (extra-- > 0 ? 1 : 0);
    const tables = Array.from({ length: size }, () => table++);
    return { day: index + 1, tables };
  });
}

function rangeLabel(tables) {
  if (tables.length === 1) return `Tabla ${tables[0]}`;
  return `Tablas ${tables[0]}–${tables[tables.length - 1]}`;
}

function dayForTable(table) {
  const plan = buildPlan(s.plan ? s.plan.days : 1);
  const match = plan.find(group => group.tables.includes(table));
  return match ? match.day : 1;
}

function render() {
  $("stars").textContent = `⭐ ${s.stars}`;
  $("streak").textContent = `🔥 ${s.streak}`;
  $("soundToggle").textContent = s.soundOn ? "🔊" : "🔇";
  $("soundToggle").setAttribute("aria-label", s.soundOn ? "Desactivar sonidos" : "Activar sonidos");
  $("progressText").textContent = `${s.done.length}/${N} niveles`;
  $("progressBar").style.width = `${(s.done.length / N) * 100}%`;

  const hasPlan = Boolean(s.plan);
  $("planSummary").hidden = !hasPlan;
  $("dayrow").hidden = !hasPlan;
  $("missionTag").textContent = hasPlan ? (s.plan.days === 1 ? "MISIÓN EN UNA SESIÓN ⚡" : `MISIÓN DE ${s.plan.days} DÍAS 🚀`) : "ELEGÍ TU MISIÓN 🚀";
  if (hasPlan) {
    $("planSummaryText").textContent = s.plan.days === 1 ? "Elegiste completar las 10 tablas en una sesión." : `Elegiste repartir las 10 tablas en ${s.plan.days} días.`;
    renderDays();
  }
  renderLevels();
  $("mistakeCount").textContent = s.misses.length ? `(${s.misses.length})` : "";
  $("mistakesBtn").disabled = s.misses.length === 0;
}

function renderDays() {
  const plan = buildPlan(s.plan.days);
  s.day = clamp(s.day, 1, plan.length);
  const container = $("dayrow");
  container.innerHTML = "";
  plan.forEach(group => {
    const button = document.createElement("button");
    const complete = group.tables.every(t => s.done.includes(t));
    button.type = "button";
    button.className = `day${group.day === s.day ? " active" : ""}${complete ? " complete" : ""}`;
    button.dataset.day = group.day;
    button.innerHTML = `DÍA ${group.day}<small>${rangeLabel(group.tables)}</small>`;
    button.addEventListener("click", () => { s.day = group.day; writeState(); render(); });
    container.appendChild(button);
  });
}

function renderLevels() {
  const container = $("levels");
  container.innerHTML = "";
  const visibleTables = s.plan ? buildPlan(s.plan.days)[s.day - 1].tables : Array.from({ length: N }, (_, i) => i + 1);
  visibleTables.forEach(t => {
    const done = s.done.includes(t);
    const locked = t > s.unlocked;
    const level = document.createElement("button");
    level.type = "button";
    level.className = `level${done ? " done" : ""}${locked ? " locked" : ""}`;
    level.disabled = locked;
    level.innerHTML = `<div class="ico">${done ? "🏆" : locked ? "🔒" : t === 1 ? "🌱" : "⭐"}</div><b>Tabla del ${t}</b><small>${done ? "¡Dominada!" : locked ? "Desbloqueá la anterior" : "10 preguntas"}</small>`;
    if (!locked) level.addEventListener("click", () => beginTable(t));
    container.appendChild(level);
  });
}

function openPlanModal(shouldStart) {
  startAfterPlanSave = shouldStart;
  const days = s.plan ? s.plan.days : 1;
  const type = days === 1 ? "one" : "days";
  document.querySelector(`input[name="planType"][value="${type}"]`).checked = true;
  $("daysInput").value = days === 1 ? 3 : days;
  $("daysPicker").hidden = type === "one";
  $("savePlan").textContent = shouldStart ? "Guardar y empezar" : "Guardar cambios";
  $("planError").textContent = "";
  updatePlanPreview();
  $("planModal").hidden = false;
  setTimeout(() => $("savePlan").focus(), 0);
}

function closePlanModal() { $("planModal").hidden = true; }
function selectedPlanType() { return document.querySelector('input[name="planType"]:checked').value; }
function selectedDays() { return selectedPlanType() === "one" ? 1 : Number($("daysInput").value); }

function updatePlanPreview() {
  const type = selectedPlanType();
  $("daysPicker").hidden = type === "one";
  const days = selectedDays();
  if (!Number.isInteger(days) || days < 1 || days > N) {
    $("planPreview").textContent = "Elegí una cantidad válida entre 2 y 10 días.";
    return;
  }
  const plan = buildPlan(days);
  $("planPreview").innerHTML = `<div class="preview-days">${plan.map(group => `<span><b>Día ${group.day}:</b> ${rangeLabel(group.tables)}</span>`).join("")}</div>`;
}

function savePlan() {
  const days = selectedDays();
  if (!Number.isInteger(days) || days < 1 || days > N || (selectedPlanType() === "days" && days < 2)) {
    $("planError").textContent = "Elegí una cantidad de días entre 2 y 10.";
    return;
  }
  s.plan = { days };
  s.day = dayForTable(s.unlocked);
  writeState();
  closePlanModal();
  render();
  playSound("start");
  if (startAfterPlanSave) beginNextAvailableTable();
}

function beginNextAvailableTable() {
  if (!s.plan) { openPlanModal(true); return; }
  const next = Array.from({ length: N }, (_, i) => i + 1).find(t => t <= s.unlocked && !s.done.includes(t));
  beginTable(next || s.unlocked);
}

function uniqueQuestions(pool, count) {
  const keyed = [];
  const seen = new Set();
  shuffle(pool).forEach(q => {
    const key = `${q.a}x${q.b}`;
    if (!seen.has(key)) { seen.add(key); keyed.push({ a: q.a, b: q.b }); }
  });
  while (keyed.length < count) keyed.push({ a: rand(1, N), b: rand(1, N) });
  return keyed.slice(0, count);
}

function tableQuestions(t) {
  const current = shuffle(Array.from({ length: N }, (_, i) => ({ a: t, b: i + 1 }))).slice(0, t === 1 ? NUMQ : 6);
  if (t === 1) return shuffle(current);
  const previousPool = [];
  for (let a = 1; a < t; a++) for (let b = 1; b <= N; b++) previousPool.push({ a, b });
  return shuffle([...current, ...uniqueQuestions(previousPool, 4)]);
}

function beginTable(t) {
  currentTable = clamp(t, 1, N);
  gameKind = "table";
  questions = tableQuestions(currentTable);
  beginGame();
}

function beginMix() {
  if (!s.plan) { openPlanModal(false); return; }
  gameKind = "mix";
  currentTable = s.unlocked;
  const pool = [];
  for (let a = 1; a <= s.unlocked; a++) for (let b = 1; b <= N; b++) pool.push({ a, b });
  questions = uniqueQuestions(pool, NUMQ);
  beginGame();
}

function beginMistakes() {
  if (!s.misses.length) return;
  gameKind = "mistakes";
  currentTable = s.unlocked;
  const pool = s.misses.slice(-30).map(q => ({ a: q.a, b: q.b }));
  const unique = uniqueQuestions(pool, Math.min(NUMQ, new Set(pool.map(q => `${q.a}x${q.b}`)).size));
  questions = [];
  while (questions.length < NUMQ) questions.push({ ...unique[questions.length % unique.length] });
  questions = shuffle(questions);
  beginGame();
}

function beginGame() {
  questionIndex = 0;
  hits = 0;
  bonus = 0;
  waitingForNext = false;
  attemptResults = [];
  showScreen("game");
  playSound("start");
  showQuestion();
}

function showQuestion() {
  waitingForNext = false;
  const q = questions[questionIndex];
  $("mode").textContent = gameKind === "table" ? `TABLA DEL ${currentTable}` : gameKind === "mix" ? "DESAFÍO MEZCLADO" : "ENTRENAMIENTO PERSONAL";
  $("count").textContent = `${questionIndex + 1}/${questions.length}`;
  $("qbar").style.width = `${(questionIndex / questions.length) * 100}%`;
  $("question").textContent = `${q.a} × ${q.b} = ?`;
  $("answer").value = "";
  $("answer").disabled = false;
  $("feedback").textContent = "";
  $("feedback").className = "";
  $("mascot").textContent = "🦊";
  $("mascot").className = "mascot";
  $("quizCard").className = "quiz";
  $("submit").textContent = "¡Listo!";
  $("earned").textContent = `⭐ ${bonus}`;
  $("encourage").textContent = "¡Vos podés!";
  $("answer").focus();
}

function answer() {
  if (waitingForNext) {
    questionIndex++;
    if (questionIndex === questions.length) finishGame(); else showQuestion();
    return;
  }
  const raw = $("answer").value;
  if (raw === "") return;
  const q = questions[questionIndex];
  const userAnswer = Number(raw);
  const expected = q.a * q.b;
  const ok = userAnswer === expected;
  const feedback = $("feedback");
  waitingForNext = true;
  $("answer").disabled = true;
  attemptResults.push({ index: questionIndex + 1, a: q.a, b: q.b, userAnswer, expected, ok });

  if (ok) {
    hits++;
    bonus++;
    playSound("correct");
    miniFireworks();
    feedback.textContent = ["¡Fantástico! ✨", "¡Respuesta mágica! 🌟", "¡Lo lograste! 🎉", "¡Súper cerebro! 🧠"][rand(0, 3)];
    feedback.className = "correct";
    $("mascot").textContent = "🥳";
    $("mascot").className = "mascot celebrate";
    $("quizCard").className = "quiz correct-pop";
    $("encourage").textContent = "¡Respuesta brillante!";
    s.misses = s.misses.filter(x => !(x.a === q.a && x.b === q.b));
  } else {
    playSound("wrong");
    feedback.textContent = `Casi: ${q.a} × ${q.b} es ${expected}. ¡La próxima sale!`;
    feedback.className = "incorrect";
    $("mascot").textContent = "🤗";
    $("quizCard").className = "quiz wrong-shake";
    $("encourage").textContent = "¡Ya vas a recordarla!";
    s.misses.push({ a: q.a, b: q.b });
    if (s.misses.length > 80) s.misses = s.misses.slice(-80);
  }
  writeState();
  $("earned").textContent = `⭐ ${bonus}`;
  $("qbar").style.width = `${((questionIndex + 1) / questions.length) * 100}%`;
  $("submit").textContent = questionIndex === questions.length - 1 ? "Ver resultados" : "Siguiente";
}

function finishGame() {
  const passed = gameKind === "table" && hits >= NEED;
  const stars = Math.max(0, Math.floor(hits / 2));
  if (gameKind === "table") {
    if (passed) {
      if (!s.done.includes(currentTable)) s.done.push(currentTable);
      s.done.sort((a,b) => a-b);
      s.unlocked = Math.max(s.unlocked, Math.min(N, currentTable + 1));
      s.streak++;
      s.day = dayForTable(s.unlocked);
    } else s.streak = 0;
  } else s.streak = hits === questions.length ? s.streak + 1 : 0;
  s.stars += stars;
  writeState();
  render();

  const success = gameKind === "table" ? passed : hits >= NEED;
  $("resultIcon").textContent = gameKind === "table" ? (passed ? "🏆" : "💪") : (success ? "🌟" : "🧠");
  $("resultIcon").className = `resulticon${success ? " big-celebrate" : ""}`;
  $("resultTitle").textContent = gameKind === "table" ? (passed ? "¡Nivel superado!" : "¡A practicar un poquito más!") : (success ? "¡Desafío genial!" : "¡Buen entrenamiento!");
  $("resultText").textContent = gameKind === "table" ? (passed ? `¡${hits} de ${questions.length}! Desbloqueaste el próximo nivel.` : `Tuviste ${hits} correctas. Necesitás ${NEED} para desbloquear la próxima tabla.`) : `¡${hits} de ${questions.length} respuestas correctas! Las cuentas difíciles quedan guardadas para practicarlas.`;
  $("score").textContent = `${hits}/${questions.length}`;
  $("award").textContent = `${stars} ⭐`;
  renderReview();

  const button = $("resultContinue");
  button.textContent = gameKind === "table" && !passed ? "Reintentar" : "Volver al mapa";
  button.onclick = () => {
    if (gameKind === "table" && !passed) beginTable(currentTable);
    else { showScreen("home"); render(); }
  };
  showScreen("result");
  if (success) { playSound("level"); bigCelebration(); }
}

function renderReview() {
  const list = $("reviewList");
  list.innerHTML = "";
  attemptResults.forEach(item => {
    const row = document.createElement("div");
    row.className = `review-item${item.ok ? "" : " bad"}`;
    row.innerHTML = `<span class="review-status" aria-label="${item.ok ? "Correcta" : "Incorrecta"}">${item.ok ? "✓" : "✗"}</span><div><div class="review-operation">${item.a} × ${item.b} = ${item.expected}</div><small>Operación ${item.index}</small></div><div class="review-answer"><small>Tu respuesta</small><strong>${item.userAnswer}</strong>${item.ok ? "" : `<small class="expected">Correcta: ${item.expected}</small>`}</div>`;
    list.appendChild(row);
  });
}

function getAudioContext() {
  if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
  if (audioContext.state === "suspended") audioContext.resume();
  return audioContext;
}

function tone(frequency, start, duration, gain = 0.065, type = "sine") {
  if (!s.soundOn) return;
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const vol = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, ctx.currentTime + start);
    vol.gain.setValueAtTime(0.001, ctx.currentTime + start);
    vol.gain.exponentialRampToValueAtTime(gain, ctx.currentTime + start + 0.02);
    vol.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
    osc.connect(vol); vol.connect(ctx.destination);
    osc.start(ctx.currentTime + start); osc.stop(ctx.currentTime + start + duration + 0.03);
  } catch {}
}

function playSound(type) {
  if (!s.soundOn) return;
  const melodies = {
    start: [[523,0,.12],[659,.1,.13]],
    correct: [[659,0,.12],[784,.1,.13],[1047,.21,.22]],
    wrong: [[392,0,.16],[330,.14,.2]],
    level: [[523,0,.14],[659,.12,.14],[784,.24,.14],[1047,.37,.34]]
  };
  (melodies[type] || []).forEach(([f,t,d], i) => tone(f,t,d,type === "wrong" ? .04 : .065,i % 2 ? "triangle" : "sine"));
}

function miniFireworks() {
  const rect = $("question").getBoundingClientRect();
  burst(rect.left + rect.width / 2, rect.top + rect.height / 2, 22);
}

function burst(x, y, count) {
  const colors = ["#ff4d8d","#ffcf33","#57dfaf","#6c5ce7","#52b7ff","#ff7b3d"];
  for (let i = 0; i < count; i++) {
    const p = document.createElement("i");
    const angle = (Math.PI * 2 * i) / count + Math.random() * .2;
    const distance = rand(55, 145);
    p.className = "particle";
    p.style.left = `${x}px`; p.style.top = `${y}px`;
    p.style.background = colors[i % colors.length];
    p.style.setProperty("--x", `${Math.cos(angle) * distance}px`);
    p.style.setProperty("--y", `${Math.sin(angle) * distance}px`);
    $("celebration").appendChild(p);
    setTimeout(() => p.remove(), 1000);
  }
}

function bigCelebration() {
  const width = window.innerWidth, height = window.innerHeight;
  [[width*.22,height*.28],[width*.5,height*.2],[width*.78,height*.3]].forEach(([x,y], index) => setTimeout(() => burst(x,y,34), index * 180));
  const colors = ["#ff4d8d","#ffcf33","#57dfaf","#6c5ce7","#52b7ff"];
  for (let i = 0; i < 45; i++) {
    const c = document.createElement("i");
    c.className = "confetti";
    c.style.left = `${rand(0,100)}vw`; c.style.top = "-20px";
    c.style.background = colors[i % colors.length];
    c.style.animationDelay = `${rand(0,500)}ms`;
    $("celebration").appendChild(c);
    setTimeout(() => c.remove(), 2200);
  }
}

$("start").addEventListener("click", () => s.plan ? beginNextAvailableTable() : openPlanModal(true));
$("changePlan").addEventListener("click", () => openPlanModal(false));
$("closePlan").addEventListener("click", closePlanModal);
$("savePlan").addEventListener("click", savePlan);
$("planModal").addEventListener("click", e => { if (e.target === $("planModal")) closePlanModal(); });
document.querySelectorAll('input[name="planType"]').forEach(input => input.addEventListener("change", updatePlanPreview));
$("daysInput").addEventListener("input", updatePlanPreview);
$("lessDays").addEventListener("click", () => { $("daysInput").value = clamp((Number($("daysInput").value) || 3) - 1, 2, N); updatePlanPreview(); });
$("moreDays").addEventListener("click", () => { $("daysInput").value = clamp((Number($("daysInput").value) || 3) + 1, 2, N); updatePlanPreview(); });
$("back").addEventListener("click", () => { showScreen("home"); render(); });
$("submit").addEventListener("click", answer);
$("answer").addEventListener("keydown", e => { if (e.key === "Enter") answer(); });
$("mixBtn").addEventListener("click", beginMix);
$("mistakesBtn").addEventListener("click", beginMistakes);
$("soundToggle").addEventListener("click", () => { s.soundOn = !s.soundOn; writeState(); render(); if (s.soundOn) playSound("correct"); });
document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("planModal").hidden) closePlanModal(); });

render();
