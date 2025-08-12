// Minimal offline chess with full rules: legal moves, castling, en passant, promotion, undo, flip

const $ = (s, p = document) => p.querySelector(s);
const $$ = (s, p = document) => Array.from(p.querySelectorAll(s));

const boardEl = $('#board');
const turnText = $('#turnText');
const statusText = $('#statusText');
const movesList = $('#movesList');
const newBtn = $('#newGame');
const undoBtn = $('#undo');
const flipBtn = $('#flip');
const helpBtn = $('#helpBtn');
const helpDialog = $('#helpDialog');
const closeHelp = $('#closeHelp');
const promoDialog = $('#promoDialog');
const wClockEl = $('#wClock');
const bClockEl = $('#bClock');
const timeControl = $('#timeControl');
const pauseClockBtn = $('#pauseClock');

let flipped = false;
let selected = null; // square index
let legalTargets = new Set();
let history = [];
let wTime = 300; // seconds
let bTime = 300;
let clockRunning = false;
let clockTimer = null;

// Board representation: 0..63 squares. Pieces encoded as strings: 'wp','bp','wr','bn','bq','wk' etc.
// Starting position
// Standard orientation: Black on top (ranks 8-7), White on bottom (ranks 2-1)
const START = [
  'br','bn','bb','bq','bk','bb','bn','br',
  'bp','bp','bp','bp','bp','bp','bp','bp',
  0,0,0,0,0,0,0,0,
  0,0,0,0,0,0,0,0,
  0,0,0,0,0,0,0,0,
  0,0,0,0,0,0,0,0,
  'wp','wp','wp','wp','wp','wp','wp','wp',
  'wr','wn','wb','wq','wk','wb','wn','wr'
];

let board = START.slice();
let whiteToMove = true;
let rights = { wk: true, wq: true, bk: true, bq: true }; // castling rights
let ep = -1; // en passant target file index 0..7 on the capture rank

function reset() {
  board = START.slice();
  whiteToMove = true;
  rights = { wk: true, wq: true, bk: true, bq: true };
  ep = -1;
  history = [];
  selected = null;
  legalTargets.clear();
  render();
  updateStatus('Ready');
  setupClock();
}

function render() {
  boardEl.innerHTML = '';
  boardEl.style.gridTemplateColumns = 'repeat(8, 1fr)';
  const squares = flipped ? [...Array(64).keys()].reverse() : [...Array(64).keys()];
  for (const sq of squares) {
    const r = Math.floor(sq / 8);
    const c = sq % 8;
    const isLight = (r + c) % 2 === 0;
    const div = document.createElement('div');
    div.className = `sq ${isLight ? 'light' : 'dark'}`;
    div.dataset.idx = String(sq);
    div.setAttribute('role','gridcell');
    div.setAttribute('tabindex','0');
    const piece = board[sq];
    if (piece) {
      const span = document.createElement('span');
      span.className = `piece ${piece[0] === 'w' ? 'white' : 'black'}`;
      span.textContent = glyph(piece);
      div.appendChild(span);
    }
    if (legalTargets.has(sq)) {
      div.classList.add('dot');
      if (board[sq] && board[sq][0] !== (whiteToMove ? 'w':'b')) div.classList.add('capture');
    }
    if (selected === sq) div.classList.add('highlight');
    div.addEventListener('click', onSquareClick);
    div.addEventListener('keydown', (e) => { if (e.key==='Enter' || e.key===' ') onSquareClick({ currentTarget: div }); });
    boardEl.appendChild(div);
  }
  turnText.textContent = whiteToMove ? 'White' : 'Black';
}

function glyph(p) {
  const map = {
    wk: '♔', wq: '♕', wr: '♖', wb: '♗', wn: '♘', wp: '♙',
    bk: '♚', bq: '♛', br: '♜', bb: '♝', bn: '♞', bp: '♟'
  };
  return map[p];
}

function onSquareClick(e) {
  const idx = parseInt(e.currentTarget.dataset.idx, 10);
  const piece = board[idx];
  // If selecting a move target
  if (selected != null && legalTargets.has(idx)) {
    makeMove(selected, idx);
    selected = null; legalTargets.clear(); render();
    return;
  }
  // Select own piece
  if (piece && piece[0] === (whiteToMove ? 'w' : 'b')) {
    selected = idx;
    legalTargets = getLegalMoves(idx);
    render();
  } else {
    // Clicking empty or opponent piece without selection clears
    selected = null; legalTargets.clear(); render();
  }
}

function getLegalMoves(from) {
  const set = new Set();
  const piece = board[from]; if (!piece) return set;
  const color = piece[0];
  const type = piece[1];
  const r = Math.floor(from / 8), c = from % 8;

  const push = (to) => { if (to>=0 && to<64) set.add(to); };
  const enemy = (sq) => board[sq] && board[sq][0] !== color;
  const empty = (sq) => !board[sq];
  const addRay = (dr, dc) => {
    let rr = r + dr, cc = c + dc;
    while (rr>=0 && rr<8 && cc>=0 && cc<8) {
      const sq = rr*8+cc;
      if (empty(sq)) { push(sq); }
      else { if (enemy(sq)) push(sq); break; }
      rr += dr; cc += dc;
    }
  };

  if (type === 'p') {
    const dir = color === 'w' ? -1 : 1;
    const startRank = color === 'w' ? 6 : 1;
    const one = (r+dir)*8 + c;
    if (r+dir>=0 && r+dir<8 && empty(one)) push(one);
    const two = (r+2*dir)*8 + c;
    if (r === startRank && empty(one) && empty(two)) push(two);
    // captures
    for (const dc of [-1, 1]) {
      const rr = r+dir, cc = c+dc; if (rr<0||rr>=8||cc<0||cc>=8) continue;
      const sq = rr*8+cc;
      if (enemy(sq)) push(sq);
    }
    // en passant
    if (ep !== -1 && r === (color==='w'?3:4)) {
      for (const dc of [-1,1]) {
        const cc = c+dc; if (cc<0||cc>=8) continue;
        if (cc === ep) push((r+dir)*8 + cc);
      }
    }
  }
  if (type === 'n') {
    for (const [dr,dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
      const rr=r+dr, cc=c+dc; if (rr<0||rr>=8||cc<0||cc>=8) continue; const sq=rr*8+cc;
      if (!board[sq] || enemy(sq)) push(sq);
    }
  }
  if (type === 'b' || type === 'q') { addRay(-1,-1); addRay(-1,1); addRay(1,-1); addRay(1,1); }
  if (type === 'r' || type === 'q') { addRay(-1,0); addRay(1,0); addRay(0,-1); addRay(0,1); }
  if (type === 'k') {
    for (let dr=-1; dr<=1; dr++) for (let dc=-1; dc<=1; dc++) {
      if (dr===0 && dc===0) continue; const rr=r+dr, cc=c+dc; if (rr<0||rr>=8||cc<0||cc>=8) continue; const sq=rr*8+cc;
      if (!board[sq] || enemy(sq)) push(sq);
    }
    // castling
    if (!inCheck(color)) {
      if (color==='w' && r===7 && c===4) {
        if (rights.wk && empty(7*8+5) && empty(7*8+6) && !wouldCheck(from,7*8+5) && !wouldCheck(from,7*8+6)) push(7*8+6);
        if (rights.wq && empty(7*8+3) && empty(7*8+2) && empty(7*8+1) && !wouldCheck(from,7*8+3) && !wouldCheck(from,7*8+2)) push(7*8+2);
      }
      if (color==='b' && r===0 && c===4) {
        if (rights.bk && empty(0*8+5) && empty(0*8+6) && !wouldCheck(from,0*8+5) && !wouldCheck(from,0*8+6)) push(0*8+6);
        if (rights.bq && empty(0*8+3) && empty(0*8+2) && empty(0*8+1) && !wouldCheck(from,0*8+3) && !wouldCheck(from,0*8+2)) push(0*8+2);
      }
    }
  }

  // filter out moves that leave king in check
  for (const to of Array.from(set)) if (leavesInCheck(from, to)) set.delete(to);
  return set;
}

function inCheck(color) {
  const kingSq = board.findIndex(p => p === (color+'k'));
  return squareAttacked(kingSq, color === 'w' ? 'b' : 'w');
}

function wouldCheck(from, to) { // specifically for king passing through
  const savedFrom = board[from];
  const savedTo = board[to];
  board[to] = savedFrom; board[from] = 0;
  const res = inCheck(savedFrom[0]);
  board[from] = savedFrom; board[to] = savedTo;
  return res;
}

function leavesInCheck(from, to) {
  const moving = board[from];
  const captured = board[to];
  const savedEP = ep;
  const savedRights = { ...rights };
  const special = applyMove(from, to, true);
  const res = inCheck(moving[0]);
  // undo simulated
  undoMoveInternal({ from, to, moving, captured, special, rightsBefore: savedRights, epBefore: savedEP }, true);
  return res;
}

function squareAttacked(sq, byColor) {
  // rudimentary: scan all opponent pseudo moves and see if can capture king square
  for (let i=0;i<64;i++) {
    const p = board[i]; if (!p || p[0]!==byColor) continue;
    if (pseudoCanGo(i, sq)) return true;
  }
  return false;
}

function pseudoCanGo(from, to) {
  const p = board[from]; if (!p) return false; const color=p[0], type=p[1];
  const r=Math.floor(from/8), c=from%8, rr=Math.floor(to/8), cc=to%8;
  const dr = Math.sign(rr-r), dc=Math.sign(cc-c);
  const empty = (s)=>!board[s]; const enemy = (s)=>board[s] && board[s][0]!==color;
  if (type==='p') {
    const dir = color==='w'?-1:1;
    if (cc===c && rr===r+dir && empty(to)) return true; // forward
    if (Math.abs(cc-c)===1 && rr===r+dir && enemy(to)) return true; // capture
    // en passant target
    if (Math.abs(cc-c)===1 && rr===r+dir && to===((r+dir)*8+cc) && ep===cc && r===(color==='w'?3:4)) return true;
  }
  if (type==='n') {
    const moves=[[2,1],[2,-1],[-2,1],[-2,-1],[1,2],[1,-2],[-1,2],[-1,-2]];
    return moves.some(([dr,dc])=> r+dr===rr && c+dc===cc && (!board[to]||enemy(to)));
  }
  if (type==='b' || type==='q') {
    if (Math.abs(rr-r)===Math.abs(cc-c)) {
      for (let i=1;i<Math.abs(rr-r);i++) if (board[(r+i*dr)*8+(c+i*dc)]) return false; return (!board[to]||enemy(to));
    }
  }
  if (type==='r' || type==='q') {
    if (r===rr || c===cc) { for (let i=1;i<Math.max(Math.abs(rr-r),Math.abs(cc-c));i++) if (board[(r+i*dr)*8+(c+i*dc)]) return false; return (!board[to]||enemy(to)); }
  }
  if (type==='k') { if (Math.max(Math.abs(rr-r),Math.abs(cc-c))===1) return (!board[to]||enemy(to)); }
  return false;
}

function makeMove(from, to) {
  const moving = board[from];
  const captured = board[to];
  const rightsBefore = { ...rights };
  const epBefore = ep;
  const special = applyMove(from, to, false);
  history.push({ from, to, moving, captured, special, rightsBefore, epBefore });
  addMoveNotation(from, to, moving, captured, special);
  whiteToMove = !whiteToMove;
  selected = null; legalTargets.clear();
  updateStatus(evaluateStatus());
  tickClockSide();
}

function applyMove(from, to, simulate) {
  let special = null;
  const moving = board[from];
  const color = moving[0]; const type = moving[1];
  ep = -1;
  // castling move
  if (type==='k' && Math.abs((to%8)-(from%8))===2) {
    if (to%8===6) { // king side
      const rookFrom = (color==='w'?7*8+7:0*8+7); const rookTo = (color==='w'?7*8+5:0*8+5);
      board[rookTo] = board[rookFrom]; board[rookFrom] = 0;
      special = { castle: 'k' };
    } else { // queen side
      const rookFrom = (color==='w'?7*8+0:0*8+0); const rookTo = (color==='w'?7*8+3:0*8+3);
      board[rookTo] = board[rookFrom]; board[rookFrom] = 0;
      special = { castle: 'q' };
    }
  }
  // en passant capture
  if (type==='p' && (to%8)!==(from%8) && !board[to]) {
    const capSq = (color==='w' ? (to+8) : (to-8));
    board[capSq] = 0;
    special = { ep: true, capSq };
  }
  // move piece
  board[to] = moving; board[from] = 0;
  // set en passant target if double push
  if (type==='p' && Math.abs(Math.floor(to/8)-Math.floor(from/8))===2) {
    ep = from % 8;
  }
  // update castling rights
  if (moving==='wk') { rights.wk=false; rights.wq=false; }
  if (moving==='bk') { rights.bk=false; rights.bq=false; }
  if (from===7*8+0 || to===7*8+0) rights.wq = false;
  if (from===7*8+7 || to===7*8+7) rights.wk = false;
  if (from===0*8+0 || to===0*8+0) rights.bq = false;
  if (from===0*8+7 || to===0*8+7) rights.bk = false;
  // promotion
  if (type==='p' && (to<8 || to>=56) && !simulate) {
    promoDialog.showModal();
    const handler = (e) => {
      const piece = e.target.getAttribute('data-piece');
      if (!piece) return;
      board[to] = color + piece; // promote
      promoDialog.close();
      promoDialog.removeEventListener('click', handler);
      render();
    };
    promoDialog.addEventListener('click', handler);
  }
  return special;
}

function undoMove() {
  const last = history.pop(); if (!last) return;
  undoMoveInternal(last, false);
  whiteToMove = !whiteToMove;
  render();
  updateStatus('Undid move');
}

function undoMoveInternal(last, simulate) {
  const { from, to, moving, captured, special, rightsBefore, epBefore } = last;
  board[from] = moving; board[to] = captured || 0;
  if (special?.castle==='k') {
    const color = moving[0]; const rookFrom = (color==='w'?7*8+7:0*8+7); const rookTo = (color==='w'?7*8+5:0*8+5);
    board[rookFrom] = board[rookTo]; board[rookTo] = 0;
  }
  if (special?.castle==='q') {
    const color = moving[0]; const rookFrom = (color==='w'?7*8+0:0*8+0); const rookTo = (color==='w'?7*8+3:0*8+3);
    board[rookFrom] = board[rookTo]; board[rookTo] = 0;
  }
  if (special?.ep) { board[special.capSq] = (moving[0]==='w'?'bp':'wp'); }
  rights = rightsBefore; ep = epBefore;
  if (!simulate) movesList.lastElementChild?.remove();
}

function addMoveNotation(from, to, moving, captured, special) {
  const files = 'abcdefgh';
  const ranks = '12345678';
  const f = files[from%8] + ranks[7-Math.floor(from/8)];
  const t = files[to%8] + ranks[7-Math.floor(to/8)];
  let note = '';
  if (moving[1]==='k' && Math.abs((to%8)-(from%8))===2) note = (to%8===6? 'O-O': 'O-O-O');
  else note = (moving[1]!=='p'? moving[1].toUpperCase(): '') + (captured? 'x' : '') + t;
  const li = document.createElement('li'); li.textContent = note; movesList.appendChild(li); li.scrollIntoView(false);
}

function evaluateStatus() {
  const color = whiteToMove ? 'w':'b';
  // gather any legal moves
  for (let i=0;i<64;i++) {
    if (board[i] && board[i][0]===color) {
      if (getLegalMoves(i).size>0) return inCheck(color)? 'Check' : 'In progress';
    }
  }
  return inCheck(color) ? 'Checkmate' : 'Stalemate';
}

function updateStatus(text) { statusText.textContent = text; }

newBtn.addEventListener('click', reset);
undoBtn.addEventListener('click', undoMove);
flipBtn.addEventListener('click', () => { flipped = !flipped; render(); });
helpBtn.addEventListener('click', () => helpDialog.showModal());
closeHelp.addEventListener('click', () => helpDialog.close());

timeControl.addEventListener('change', setupClock);
pauseClockBtn.addEventListener('click', () => {
  clockRunning = !clockRunning;
  pauseClockBtn.textContent = clockRunning ? 'Pause' : 'Resume';
});

reset();

// Clock logic
function setupClock() {
  const base = parseInt(timeControl.value, 10);
  if (!base) {
    wTime = 0; bTime = 0; clockRunning = false;
    wClockEl.textContent = '--:--'; bClockEl.textContent = '--:--';
    wClockEl.classList.remove('active'); bClockEl.classList.remove('active');
    if (clockTimer) clearInterval(clockTimer);
    clockTimer = null;
    return;
  }
  wTime = base; bTime = base;
  clockRunning = true;
  wClockEl.textContent = fmt(wTime); bClockEl.textContent = fmt(bTime);
  if (clockTimer) clearInterval(clockTimer);
  clockTimer = setInterval(() => {
    if (!clockRunning) return;
    if (whiteToMove) { wTime = Math.max(0, wTime - 1); wClockEl.textContent = fmt(wTime); }
    else { bTime = Math.max(0, bTime - 1); bClockEl.textContent = fmt(bTime); }
    wClockEl.classList.toggle('active', whiteToMove);
    bClockEl.classList.toggle('active', !whiteToMove);
    if (wTime===0 || bTime===0) {
      clockRunning = false;
      updateStatus((wTime===0)? 'Black wins on time' : 'White wins on time');
    }
  }, 1000);
}

function tickClockSide() {
  if (parseInt(timeControl.value, 10) === 0) return; // no clock
  clockRunning = true; // resume on move
}

function fmt(s) {
  const m = Math.floor(s/60).toString().padStart(2,'0');
  const ss = (s%60).toString().padStart(2,'0');
  return `${m}:${ss}`;
}


