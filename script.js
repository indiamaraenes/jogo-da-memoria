const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
let TOTAL_PAIRS = 12; // default

// Game state
let firstCard = null;
let secondCard = null;
let lockBoard = false;
let matchedCount = 0;
let moves = 0;

// Timer
let timerId = null;
let seconds = 0;
let started = false;

// DOM
const boardEl = document.getElementById("game-board");
const resetBtn = document.getElementById("reset-btn");
const difficultySel = document.getElementById("difficulty");
const movesEl = document.getElementById("moves");
const timeEl = document.getElementById("time");
const bestEl = document.getElementById("best");

const winModal = document.getElementById("win-modal");
const winTimeEl = document.getElementById("win-time");
const winMovesEl = document.getElementById("win-moves");
const winBestEl = document.getElementById("win-best");
const playAgainBtn = document.getElementById("play-again");
const closeModalBtn = document.getElementById("close-modal");

// Layout constants
const GAP = 12; // px — deve bater com --gap no CSS
const ASPECT = 2 / 3; // width/height — cartas retangulares tipo 2:3

function pad(n) {
  return n.toString().padStart(2, "0");
}
function formatTime(s) {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${pad(m)}:${pad(r)}`;
}

function startTimer() {
  if (started) return;
  started = true;
  timerId = setInterval(() => {
    seconds++;
    timeEl.textContent = formatTime(seconds);
  }, 1000);
}
function stopTimer() {
  clearInterval(timerId);
  timerId = null;
  started = false;
}

function getBestKey() {
  return `memory-best-${TOTAL_PAIRS}`;
}
function loadBest() {
  const v = localStorage.getItem(getBestKey());
  return v ? JSON.parse(v) : null;
}
function saveBest(record) {
  localStorage.setItem(getBestKey(), JSON.stringify(record));
}

function shuffledPairs() {
  const pairsSource = ALPHABET.slice(0, TOTAL_PAIRS);
  const deck = [...pairsSource, ...pairsSource];
  for (let i = deck.length - 1; i > 0; i--) {
    const r = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[r]] = [deck[r], deck[i]];
  }
  return deck;
}

function createCardElement(symbol) {
  const card = document.createElement("div");
  card.className = "card";
  card.dataset.card = symbol;
  card.setAttribute("role", "button");
  card.setAttribute("tabindex", "0");
  card.setAttribute("aria-pressed", "false");

  const inner = document.createElement("div");
  inner.className = "card-inner";

  const front = document.createElement("div");
  front.className = "card-front";
  front.textContent = symbol;

  const back = document.createElement("div");
  back.className = "card-back";

  inner.appendChild(front);
  inner.appendChild(back);
  card.appendChild(inner);

  card.addEventListener("click", onCardClick);
  card.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onCardClick({ currentTarget: card });
    }
  });

  return card;
}

function updateHUD() {
  movesEl.textContent = moves;
  timeEl.textContent = formatTime(seconds);
  const best = loadBest();
  bestEl.textContent = best
    ? `${formatTime(best.time)} / ${best.moves} mov.`
    : "—";
}

function createBoard() {
  // preparar estado
  firstCard = null;
  secondCard = null;
  lockBoard = false;
  matchedCount = 0;
  moves = 0;
  seconds = 0;
  stopTimer();
  started = false;
  updateHUD();

  // montar deck
  boardEl.innerHTML = "";
  const deck = shuffledPairs();
  deck.forEach((symbol) => boardEl.appendChild(createCardElement(symbol)));

  // Ajustar layout ao viewport
  fitBoardToViewport();
}

function onCardClick(e) {
  const card = e.currentTarget;
  if (lockBoard) return;
  if (card === firstCard) return;
  if (card.classList.contains("matched")) return;

  startTimer();
  flip(card);

  if (!firstCard) {
    firstCard = card;
    return;
  }

  secondCard = card;
  moves++;
  updateHUD();
  checkForMatch();
}

function flip(card) {
  card.classList.add("flipped");
  card.setAttribute("aria-pressed", "true");
}
function unflip(card) {
  card.classList.remove("flipped");
  card.setAttribute("aria-pressed", "false");
}

function checkForMatch() {
  const isMatch = firstCard.dataset.card === secondCard.dataset.card;
  if (isMatch) {
    setMatched(firstCard, secondCard);
    resetTurn();
    if (matchedCount === TOTAL_PAIRS * 2) {
      stopTimer();
      showWin();
    }
  } else {
    lockBoard = true;
    setTimeout(() => {
      unflip(firstCard);
      unflip(secondCard);
      resetTurn();
    }, 700);
  }
}

function setMatched(a, b) {
  a.classList.add("matched");
  b.classList.add("matched");
  a.removeEventListener("click", onCardClick);
  b.removeEventListener("click", onCardClick);
  matchedCount += 2;
}

function resetTurn() {
  [firstCard, secondCard] = [null, null];
  lockBoard = false;
}

function showWin() {
  const best = loadBest();
  const current = { time: seconds, moves };
  let isRecord = false;
  if (
    !best ||
    current.time < best.time ||
    (current.time === best.time && current.moves < best.moves)
  ) {
    saveBest(current);
    isRecord = true;
  }
  winTimeEl.textContent = formatTime(seconds);
  winMovesEl.textContent = moves;
  const bestNow = loadBest();
  winBestEl.textContent = bestNow
    ? `${formatTime(bestNow.time)} / ${bestNow.moves} mov.` +
      (isRecord ? " (novo recorde!)" : "")
    : "—";
  winModal.classList.add("show");
  winModal.setAttribute("aria-hidden", "false");
}

function hideWin() {
  winModal.classList.remove("show");
  winModal.setAttribute("aria-hidden", "true");
}

function onDifficultyChange() {
  TOTAL_PAIRS = parseInt(difficultySel.value, 10);
  createBoard();
  updateHUD();
}

/* === Fit-to-viewport algorithm ===
 * Calcula colunas/linhas e tamanho da carta (W,H) para preencher o máximo possível
 * da área visível sem rolar, mantendo proporção ASPECT e gap fixo.
 */
function fitBoardToViewport() {
  // A área disponível é o elemento pai imediato que centraliza (#game-board fica dentro do .board-wrap)
  const wrap = boardEl.parentElement; // .board-wrap
  const availW = wrap.clientWidth;
  const availH = wrap.clientHeight;

  const N = TOTAL_PAIRS * 2;
  let best = { score: -1, cols: 0, rows: 0, cw: 0, ch: 0 };

  // testamos colunas de 3 até N (limite razoável)
  for (let cols = 3; cols <= N; cols++) {
    const rows = Math.ceil(N / cols);

    // espaço de gap
    const totalGapW = (cols - 1) * GAP;
    const totalGapH = (rows - 1) * GAP;

    // tamanhos máximos por restrição de largura/altura
    const maxCwByW = (availW - totalGapW) / cols;
    const maxChByH = (availH - totalGapH) / rows;

    // manter proporção: ch = cw / ASPECT → cw <= maxChByH * ASPECT
    let cw = Math.min(maxCwByW, maxChByH * ASPECT);
    let ch = cw / ASPECT;

    if (cw <= 0 || ch <= 0) continue;

    // pontuação: quão cheio fica o espaço
    const usedW = cols * cw + totalGapW;
    const usedH = rows * ch + totalGapH;
    const fill = (usedW / availW) * (usedH / availH);

    if (fill > best.score) best = { score: fill, cols, rows, cw, ch };
  }

  // aplicar
  boardEl.style.gridTemplateColumns = `repeat(${best.cols}, ${Math.floor(
    best.cw
  )}px)`;
  boardEl.style.gridAutoRows = `${Math.floor(best.ch)}px`;

  boardEl.querySelectorAll(".card").forEach((card) => {
    card.style.width = `${Math.floor(best.cw)}px`;
    card.style.height = `${Math.floor(best.ch)}px`;
  });
}

function init() {
  // envolve #game-board em .board-wrap para centralizar sem scroll (retrocompatível)
  if (!boardEl.parentElement.classList.contains("board-wrap")) {
    const wrap = document.createElement("div");
    wrap.className = "board-wrap";
    boardEl.replaceWith(wrap);
    wrap.appendChild(boardEl);
  }

  TOTAL_PAIRS = parseInt(difficultySel.value, 10);
  createBoard();
  updateHUD();

  resetBtn.addEventListener("click", () => {
    createBoard();
    updateHUD();
  });
  difficultySel.addEventListener("change", onDifficultyChange);

  playAgainBtn.addEventListener("click", () => {
    hideWin();
    createBoard();
    updateHUD();
  });
  closeModalBtn.addEventListener("click", hideWin);
  winModal.addEventListener("click", (e) => {
    if (e.target === winModal) hideWin();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hideWin();
  });

  // refit on resize
  window.addEventListener("resize", fitBoardToViewport);
}

window.addEventListener("load", init);
