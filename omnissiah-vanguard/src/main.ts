import { isBlocked, makeDemoBoard } from './board';
import { CARDS, type CardDef } from './cards';
import {
  ENERGY_PER_TURN,
  MOVE_RANGE,
  PLAYER_MAX_HP,
  STARTER_DECK,
  castRite,
  chebyshev,
  computeAllThrea t,
  createCombat,
  drawCards,  
  endPlayerTurn,
  enemyTurn,
  losClear,
  movePlayer,
  type CombatState,
} from './combat';
import type { EnemyTypeId } from './enemies';
import { loadEnemyArt, loadRig } from './rig';
import { loadBoardTextures } from './textures';
import { toGrid, toScreen, type GridPos } from './projection';
import { BRASS } from './palette';
import {
  createBackground,
  drawScene,
  type Camera,
  type Scene,
} from './render';
import { Presenter } from './present';
import { tileKey } from './threat';
import { makeDemoUnits } from './units';
import {
  flashEnergy,
  setEnergy,
  setHand,
  setIntegrity,
  setMessage,
  type HandHandlers,
} from './ui';

const LAS_PRAYER_RANGE = 5;
const RAISED_RANGE_BONUS = 1;
const MSG_SECONDS = 1.6;

const WIN_TEXT = 'SANCTIFIED - THE SHRINE IS CLEARED';
const LOSE_TEXT = 'THE OMNISSIAH CLAIMS ANOTHER SERVITOR';

const DIRS8: ReadonlyArray<readonly [number, number]> = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
];

function requireElement<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id} element`);
  return el as T;
}b

function enemyPlacements(): { typeId: EnemyTypeId; pos: GridPos }[] {
  return makeDemoUnits()
    .filter((u) => u.typeId !== 'techpriest')
    .map((u) => ({ typeId: u.typeId as EnemyTypeId, pos: { ...u.pos } }));
}

function freshState(): CombatState {
  return drawCards(
    createCombat(makeDemoBoard(), { x: 6, y: 4 }, enemyPlacements(), STARTER_DECK),
    Math.random,
  );
}

function computePaths(state: CombatState): Map<string, GridPos[]> {
  const occupied = new Set(
    [state.player, ...state.enemies]
      .filter((f) => f.hp > 0)
      .map((f) => tileKey(f.pos.x, f.pos.y)),
  );
  const start = tileKey(state.player.pos.x, state.player.pos.y);
  const paths = new Map<string, GridPos[]>([[start, []]]);
  const queue: Array<{ pos: GridPos; path: GridPos[] }> = [{ pos: { ...state.player.pos }, path: [] }];
  while (queue.length >0) {
    const  node = queue.shift()!;
    if (node.path.length >= MOVE_RANGE) continue;
    for (const[dx, dy] of DIRS8) {
      const next: GridPos = { x: node.pos.x + dx, y: node.pos.y + dy };
      const key = tileKey(next.x, next.y);
      if (paths.has(key) || isBlocked(state.board, next.x, next.y) || occupied.has(key)) continue;
      const path = [...node.path, next];
      paths.set(key, path);
      queue.push({ pos: next, path });
    }
  }
  paths.delete(start);
  return paths;
}

const canvas = requireElement<HTMLCanvasElement>('board');
const ctxOrNull = canvas.getContext('2d');
if (!ctxOrNull) throw new Error('2D context unavailable');
const ctx: CanvasRenderingContext2D = ctxOrNull;

const threatButton = requireElement<HTMLButtonElement>('threat-toggle');
const endTurnButton = requireElement<HTMLButtonElement>('end-turn');
const overlay = requireElement<HTMLElement>('overlay');
const overlayText = requireElement<HTMLElement>('overlay-text');
const restartButton = requireElement<HTMLButtonElement>('restart');

const camera: Camera = { x: 0, y: 0};
let background: HTMLCanvasElement;

function resize(): void {
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
  background = createBackground(canvas.width, canvas.height);
  const cols = state.board[0]?.length ?? 0;
  const rows = state.board.length;
  const center = toScreen({ x: (cols - 1) / 2, y: (rows - 1) / 2 });
  camera.x = canvas.width / 2 - center.x;
  camera.y = canvas.height / 2 - center.y;
}

let state: CombatState = freshState();
const presenter = new Presenter();
presenter.snap(state);

let selectedCard: string | null = null;
let paths = new Map<string, GridPos[]>();
let threat = new Set<string>();
let showThreat = false;
let msgTimer = 0;

function cardDef(id: string): CardDef {
  const def = CARDS.find((c) => c.id === id);
  if (!def) throw new Error(`unknown card ${id}`);
  return def;
}

function handCards(): CardDef[] {
  return state.hand.map(cardDef);
}

function canAct(): boolean{
  return state.turn === 'player' && !presenter.busy && overlay.classList.contains('hidden');
}

function refreshHud(): void {
  setEnergy(state.energy, ENERGY_PER_TURN);
  setIntegrity(state.player.hp, PLAYER_MAX_HP, state.player.armor);
  paths = computePaths(state);
  threat = computeAllThreat(state);
  setHand(handCards(), state.energy, selectedCard, canvas, handHandlers);
}

function say(text: string): void {
  setMessage(text);
  window.clearTimeout(msgTimer);
  if (text) msgTimer = window.setTimeout(() => setMessage(''), MSG_SECONDS * 1000);
}

function showOverlay(text: string): void {
  overlayText.textContent = text;
  overlay.classList.remove('hidden');
}

function afterAction(): void {
  refreshHud();
  if (state.turn === 'won') showOverlay(WIN_TEXT);
  else if (state.turn === 'lost') showOverlay(LOSE_TEXT);
}

function lasPrayerRange(): number {
  const tile = state.board[state.player.pos.y]?.[state.player.pos.x];
  return LAS_PRAYER_RANGE + (tile === 'raised' ? RAISED_RANGE_BONUS : 0);
}

function lasPrayerTargetTiles(): Set<string> {
  const keys = new Set<string>();
  for (const enemy of state.enemies) {
    if (chebyshev(state.player.pos, enemy.pos) > lasPrayerRange()) continue;
    if (!losClear(state.board, state.player.pos, enemy.pos)) continue;
    keys.add(tileKey(enemy.pos.x, enemy.pos.y));
  }
  return keys;
}

function cogStepTargetTiles(): Set<string> {
  const occupied = new Set(
    [state.player, ...state.enemies].map((f) => tileKey(f.pos.x, f.pos.y)),
  );
  const keys = new Set<string>();
  for (const [dx, dy] of DIRS8) {
    const p: GridPos = { x: state.player.pos.x + dx, y: state.player.pos.y + dy };
    if (isBlocked(state.board, p.x, p.y) || occupied.has(tileKey(p.x, p.y))) continue;
    keys.add(tileKey(p.x, p.y));
  }
  return keys;
}

function enemyAt(g: GridPos) {
  return state.enemies.find((e) => e.hp > 0 && e.pos.x === g.x && e.pos.y === g.y);
}

function invalidCast(text: string): void {
  flashEnergy();
  say(text);
}

function cast(cardId: string, targetUnitId: string | null, targetTile: GridPos | null): void {
  const handBefore = state.hand.length;
  const result = castRite(state, cardId, targetUnitId, targetTile);
  const spent = result.state !== state || result.state || result.state.hand.length !== handBefore;
  if (!spent) {
    invalidCast('INVALID TARGET');
    return;
  }
  state = result.state;
  selectedCard = null;
  refreshHud();
  const opts = cardId === 'las-prayer'
    ? { projectile: true }
    : cardId === 'binharic-lash'
      ? { ring: true }
      : { priestGlowColor: BRASS };
  presenter.play(result.events, state, opts, afterAction);
}

function castAtClick(g: GridPos): void {
  const cardId = selectedCard;
  if (!cardId) return;
  const key = tileKey(g.x, g.y);
  if (cardId === 'las-prayer') {
    const enemy = enemyAt(g);
    if (enemy && lasPrayerTargetTiles().has(key)) {
      cast(cardId, enemy.id, null);
    } else {
      selectedCard = null;
      refreshHud();
    }
    return;
}
if (cardId === 'cog-step') {
  if (cogStepTargetTiles().has(key)) {
    cast(cardId, null, g);
  } else {
    selectedCard = null;
    refreshHud();
  }
  return;
}
cast(cardId, null, null);
}

canvas.addEventListener('pointerdown', (e) => {
  const rect = canvas.getBoundingClientRect();
  const g = toGrid({
    x: e.clientX - rect.left - camera.x,
    y: e.clientY - rect.top - camera.y,
  });
  if (!canAct()) return;
  if (selectedCard) {
    castAtClick(g);
    return;
  }
  const path = paths.get(tileKey(g.x, g.y));
  if (!path) return;
  if (path.length > state.energy) {
    invalidCast('NOT ENOUGH ENERGY');
    return;
  }
  const next = movePlayer(state, path);
  if (next === state) return;
  state = next;
  setEnergy(state.energy, ENERGY_PER_TURN);
  paths = new Map();
  presenter.play([{ type: 'move', unitId: 'player', path }], state, {}, afterAction);
});

const handHandlers: HandHandlers = {
  onLift(cardId) {
    if (!canAct()) return;
    selectedCard = cardId;
  },
  onLand(cardId) {
    if (selectedCard === cardId) {
      selectedCard = null;
      refreshHud();
    }
  },
  onDrop(cardId, canvasX, canvasY) {
    if (!canAct()) return;
    const g = toGrid({ x: canvasX - camera.x, y: canvasY - camera.y });
    const key = tileKey(g.x, g.y);
    if (cardId === 'las-prayer') {
      const enemy = enemyAt(g);
      if (enemy && lasPrayerTargetTiles().has(key)) {
        cast(cardId, enemy.id, null);
      } else {
        invalidCast('NO TARGET IN RANGE');
      }
      return;
    }
    if (cardId === 'cog-step') {
      if (cogStepTargetTiles().has(key)) {
        cast(cardId, null, g);
      } else {
        invalidCast('NOT AN ADJACENT TILE');
      }
      return;
    }
    cast(cardId, null, null);
  },
  onSelect(cardId) {
    if (!canAct()) return;
    selectedCard = selectedCard === cardId ? null : cardId;
    refreshHud();
  },
};

endTurnButton.addEventListener('click', () => {
  if (!canAct()) return;
  selectedCard = null;
  say('');
  const ended = endPlayerTurn(state);
  state = ended.state;
  setIntegrity(state.player.hp, PLAYER_MAX_HP, state.player.armor);
  paths = new Map();
  if (state.turn === 'lost') {
    presenter.play(ended.events, state, {}, () => {
      refreshHud();
      showOverlay(LOSE_TEXT);
    });
    return;
  }
  const result = enemyTurn(state, Math.random);
  state = result.statel
  presenter.play([...ended.events, ...result.events], state, {}, () => {
    if (state.turn === 'won') {
      refreshHud();
      showOverlay(WIN_TEXT);
      return;
    }
    if (state.turn === 'lost') {
      refreshHud();
      showOverlay(LOSE_TEXT);
      return;
    }
    state = drawCards(state, Math.random);
    refreshHud();
  });
});