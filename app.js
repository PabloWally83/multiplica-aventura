const N = 12;
const NUMQ = 10;
const NEED = 8;
const BASE = {
  unlocked: 1,
  done: [],
  stars: 0,
  streak: 0,
  day: 1,
  misses: []
};

let s = read();
let qs = [];
let ix = 0;
let hit = 0;
let table = 1;
let kind = "table";
let bonus = 0;
let advance = false;

function cloneBase() {
  return JSON.parse(JSON.stringify(BASE));
}

function normalizeState(value) {
  const state = value && typeof value === "object" ? value : {};
  return {
    unlocked: Math.min(N, Math.max(1, Number(state.unlocked) || 1)),
    done: Array.isArray(state.done)
      ? [...new Set(state.done.map(Number).filter(n => n >= 1 && n <= N))]
      : [],
    stars: Math.max(0, Number(state.stars) || 0),
    streak: Math.max(0, Number(state.streak) || 0),
    day: Math.min(3, Math.max(1, Number(state.day) || 1)),
    misses: Array.isArray(state.misses)
      ? state.misses
          .filter(q => q && Number.isFinite(Number(q.a)) && Number.isFinite(Number(q.b)))
          .map(q => ({ a: Number(q.a), b: Number(q.b) }))
          .slice(-80)
      : []
  };
}

function read() {
  try {
    const saved = localStorage.getItem("maPlus");
    return saved ? normalizeState(JSON.parse(saved)) : cloneBase();
  } catch {
    return cloneBase();
  }
}

function write() {
  localStorage.setItem("maPlus", JSON.stringify(s));
}

function rand(lo, hi) {
  return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}

function sound(ok) {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.type = "sine";
    oscillator.frequency.value = ok ? 760 : 280;
    gain.gain.setValueAtTime(0.1, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.22);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.23);
  } catch {
    // El juego sigue funcionando aunque el navegador bloquee el audio.
  }
}

function screen(id) {
  document.querySelectorAll(".screen").forEach(element => {
    element.classList.remove("active");
  });

  const target = document.getElementById(id);
  if (target) target.classList.add("active");
}

function render() {
  document.getElementById("stars").textContent = `⭐ ${s.stars}`;
  document.getElementById("streak").textContent = `🔥 ${s.streak}`;
  document.getElementById("progressText").textContent = `${s.done.length}/12 niveles`;
  document.getElementById("progressBar").style.width = `${(s.done.length / 12) * 100}%`;

  document.querySelectorAll(".day").forEach(button => {
    button.classList.toggle("active", Number(button.dataset.day) === s.day);
  });

  const container = document.getElementById("levels");
  container.innerHTML = "";

  const start = (s.day - 1) * 4 + 1;
  const end = s.day * 4;

  for (let t = start; t <= end; t++) {
    const done = s.done.includes(t);
    const locked = t > s.unlocked;
    const level = document.createElement("div");

    level.className = `level ${done ? "done " : ""}${locked ? "locked" : ""}`;
    level.innerHTML = `
      <div class="ico">${done ? "🏆" : locked ? "🔒" : t === 1 ? "🌱" : "⭐"}</div>
      <b>Tabla del ${t}</b>
      <small>${done ? "¡Dominada!" : locked ? "Desbloqueá la anterior" : "10 preguntas"}</small>
    `;

    if (!locked) {
      level.setAttribute("role", "button");
      level.setAttribute("tabindex", "0");
      level.addEventListener("click", () => beginTable(t));
      level.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          beginTable(t);
        }
      });
    }

    container.appendChild(level);
  }

  document.getElementById("mistakeCount").textContent = s.misses.length
    ? `(${s.misses.length})`
    : "";
  document.getElementById("mistakesBtn").disabled = s.misses.length === 0;
}

function tableQuestions(t) {
  const questions = [];

  for (let i = 0; i < 6; i++) {
    questions.push({ a: t, b: rand(1, 12), target: t });
  }

  for (let i = 0; i < 4; i++) {
    questions.push({ a: rand(1, t), b: rand(1, 12), target: null });
  }

  return shuffle(questions);
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = rand(0, i);
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function beginTable(t) {
  table = t;
  kind = "table";
  qs = tableQuestions(t);
  begin();
}

function beginMix() {
  kind = "mix";
  table = s.unlocked;
  qs = shuffle(
    Array.from({ length: NUMQ }, () => ({
      a: rand(1, Math.max(1, s.unlocked)),
      b: rand(1, 12),
      target: null
    }))
  );
  begin();
}

function beginMistakes() {
  if (s.misses.length === 0) return;

  kind = "mistakes";
  table = s.unlocked;
  const pool = s.misses.slice(-24);
  qs = shuffle(
    Array.from({ length: NUMQ }, (_, i) => ({ ...pool[i % pool.length] }))
  );
  begin();
}

function begin() {
  ix = 0;
  hit = 0;
  bonus = 0;
  advance = false;
  screen("game");
  showq();
}

function showq() {
  advance = false;
  const q = qs[ix];

  document.getElementById("mode").textContent =
    kind === "table"
      ? `TABLA DEL ${table}`
      : kind === "mix"
        ? "DESAFÍO MEZCLADO"
        : "ENTRENAMIENTO PERSONAL";

  document.getElementById("count").textContent = `${ix + 1}/${qs.length}`;
  document.getElementById("qbar").style.width = `${(ix / qs.length) * 100}%`;
  document.getElementById("question").textContent = `${q.a} × ${q.b} = ?`;
  document.getElementById("answer").value = "";
  document.getElementById("feedback").textContent = "";
  document.getElementById("feedback").className = "";
  document.getElementById("mascot").textContent = "🦊";
  document.getElementById("submit").textContent = "¡Listo!";
  document.getElementById("earned").textContent = `⭐ ${bonus}`;
  document.getElementById("encourage").textContent = "¡Vos podés!";
  document.getElementById("answer").focus();
}

function answer() {
  if (advance) {
    ix++;
    if (ix === qs.length) finish();
    else showq();
    return;
  }

  const input = document.getElementById("answer");
  const value = input.value.trim();
  if (value === "") return;

  const q = qs[ix];
  const correctAnswer = q.a * q.b;
  const feedback = document.getElementById("feedback");
  advance = true;

  if (Number(value) === correctAnswer) {
    hit++;
    bonus++;
    sound(true);

    const messages = [
      "¡Fantástico! ✨",
      "¡Respuesta mágica! 🌟",
      "¡Lo lograste! 🎉",
      "¡Súper cerebro! 🧠"
    ];

    feedback.textContent = messages[rand(0, messages.length - 1)];
    feedback.className = "correct";
    document.getElementById("mascot").textContent = "🥳";
    document.getElementById("encourage").textContent = "¡Respuesta brillante!";
    s.misses = s.misses.filter(item => !(item.a === q.a && item.b === q.b));
  } else {
    sound(false);
    feedback.textContent = `¡Vamos de nuevo! ${q.a} × ${q.b} es ${correctAnswer}.`;
    feedback.className = "incorrect";
    document.getElementById("mascot").textContent = "🤗";
    document.getElementById("encourage").textContent = "¡Ya vas a recordarla!";
    s.misses.push({ a: q.a, b: q.b });
    if (s.misses.length > 80) s.misses = s.misses.slice(-80);
  }

  write();
  document.getElementById("earned").textContent = `⭐ ${bonus}`;
  document.getElementById("submit").textContent =
    ix === qs.length - 1 ? "Ver resultado" : "Siguiente";
}

function finish() {
  const pass = kind === "table" && hit >= NEED;
  const stars = Math.max(0, Math.floor(hit / 2));

  if (kind === "table") {
    if (pass) {
      if (!s.done.includes(table)) s.done.push(table);
      s.unlocked = Math.max(s.unlocked, Math.min(N, table + 1));
      s.streak++;
    } else {
      s.streak = 0;
    }
  } else {
    s.streak = hit === qs.length ? s.streak + 1 : 0;
  }

  s.stars += stars;
  write();
  render();

  document.getElementById("resultIcon").textContent =
    kind === "table" ? (pass ? "🏆" : "💪") : hit >= 8 ? "🌟" : "🧠";

  document.getElementById("resultTitle").textContent =
    kind === "table"
      ? pass
        ? "¡Nivel superado!"
        : "¡A practicar un poquito más!"
      : hit >= 8
        ? "¡Desafío genial!"
        : "¡Buen entrenamiento!";

  document.getElementById("resultText").textContent =
    kind === "table"
      ? pass
        ? `¡${hit} de 10! Desbloqueaste el próximo nivel. ¡Seguí así!`
        : `Tuviste ${hit} correctas. Necesitás ${NEED} para desbloquear la próxima tabla. ¡Reintentá!`
      : `¡${hit} de ${qs.length} respuestas correctas! ${
          s.misses.length
            ? "Las cuentas difíciles quedan guardadas para entrenarlas."
            : "¡Muy bien!"
        }`;

  document.getElementById("score").textContent = `${hit}/${qs.length}`;
  document.getElementById("award").textContent = `${stars} ⭐`;

  const button = document.getElementById("resultContinue");
  button.textContent = kind === "table" ? (pass ? "¡Continuar!" : "Reintentar") : "Volver al mapa";
  button.onclick = () => {
    if (kind === "table" && !pass) beginTable(table);
    else {
      screen("home");
      render();
    }
  };

  screen("result");
}

function bindEvents() {
  document.querySelectorAll(".day").forEach(button => {
    button.addEventListener("click", () => {
      s.day = Number(button.dataset.day);
      write();
      render();
    });
  });

  document.getElementById("start").addEventListener("click", () => {
    const firstTableOfDay = (s.day - 1) * 4 + 1;
    beginTable(Math.min(s.unlocked, firstTableOfDay));
  });

  document.getElementById("back").addEventListener("click", () => {
    screen("home");
    render();
  });

  document.getElementById("submit").addEventListener("click", answer);
  document.getElementById("answer").addEventListener("keydown", event => {
    if (event.key === "Enter") answer();
  });

  document.getElementById("mixBtn").addEventListener("click", beginMix);
  document.getElementById("mistakesBtn").addEventListener("click", beginMistakes);
}

bindEvents();
render();
