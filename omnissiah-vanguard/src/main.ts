import { isBlocked, makeDemoBoard } from './board';
import { CARDS, type CardDef } from './cards';
import {
  ENERGY_PER_TURN,
  MOVE_RANGE,
  PLAYER_MAX_HP,
  castRite,
  computeAllThreat,
  createCombat,
  drawCards,
  endPlayerTurn,
  enemyTurn,
  movePlayer,
  type CombatState,
} from './combat';
import type { EnemyTypeId } from './enemies';
import { loadEnemyArt, loadRig, loadTurretArt } from './rig';
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
import {castHint, castTargeting, type CastTargeting } from './targeting';
import { tileKey } from './threat';
import {
  DECK_CAP,
  DOCTRINES,
  addReward,
  createRun,
  doctrineHints,
  recordWin,
  rollRewards,
  type RunState,
} from './run';
import { makeDemoUnits } from './units';
import {
  flashEnergy,
  setDeckLabel,
  setEnergy,
  setHand,
  setIntegrity,
  setRewardCards,
  setMessage,
  type HandHandlers,
} from './ui';

const MSG_SECONDS = 2.4;

const WIN_TEXT = 'SANCTIFIED - THE SHRINE IS CLEARED';
const LOSE_TEXT = 'THE OMNISSIAH CLAIMS ANOTHER SERVITOR';
const SPAWN = { x: 6, y: 4};

const DIRS8: ReadonlyArray<readonly [number, number]> = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
];

function requireElement<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id} element`);
  return el as T;
}

function enemyPlacements(): { typeId: EnemyTypeId; pos: GridPos }[] {
  return makeDemoUnits()
    .filter((u) => u.typeId !== 'techpriest')
    .map((u) => ({ typeId: u.typeId as EnemyTypeId, pos: { ...u.pos } }));
}

let run: RunState = createRun();

function freshState(): CombatState {
  return drawCards(
    createCombat(makeDemoBoard(), SPAWN, enemyPlacements(), run.deck),
    Math.random,
  );
}

function computePaths(state: CombatState): Map<string, GridPos[]> {
  const occupied = new Set(
    [
      ...[state.player, ...state.enemies].filter((f) => f.hp > 0),
      ...state.turrets,
    ].map((f) => tileKey(f.pos.x, f.pos.y)),
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
const rewardPanel = requireElement<HTMLElement>('reward');
const declineButton = requireElement<HTMLButtonElement>('decline');

const camera: Camera = { x: 0, y: 0};
let background: HTMLCanvasElement;

function fitCamera(): void {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (canvas.width === w && canvas.height === h) return;
  canvas.width = w;
  canvas.height = h;
  background = createBackground(w, h);
  const cols = state.board[0]?.length ?? 0;
  const rows = state.board.length;
  const center = toScreen({ x: (cols - 1) / 2, y: (rows - 1) / 2 });
  camera.x = w / 2 - center.x;
  camera.y = h / 2 - center.y;
}

function resize(): void {
  fitCamera();
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
  return state.turn === 'player'
  && !presenter.busy
  && overlay.classList.contains('hidden')
  && rewardPanel.classList.contains('hidden');
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

function showEndOverlay(): void {
  if (state.turn === 'won') {
    showOverlay(WIN_TEXT);
    restartButton.textContent = 'CLAIM THE SPOILS';
  } else if (state.turn === 'lost') {
    showOverlay(LOSE_TEXT);
    restartButton.textContent = 'BEGIN AGAIN';
  }
}

function afterAction(): void {
  refreshHud();
  showEndOverlay();
}

function enemyAt(g: GridPos) {
  return state.enemies.find((e) => e.hp > 0 && e.pos.x === g.x && e.pos.y === g.y);
}

function invalidCast(text: string): void {
  flashEnergy();
  say(text);
}

function cast(cardId: string, targetUnitId: string | null, targetTile: GridPos | null): void {
  if (state.energy < cardDef(cardId).cost) {
    invalidCast('NOT ENOUGH ENERGY');
    return;
  }
  const result = castRite(state, cardId, targetUnitId, targetTile, Math.random);
  if (result.state === state) {
    selectedCard = null;
    invalidCast(castHint(cardId));
    refreshHud();
    return;
  }
  state = result.state;
  selectedCard = null;
  refreshHud();
  const effect = cardDef(cardId).effect;
  const opts = effect.kind === 'damage' && effect.shape === 'single' && effect.los
    ? { projectile: true }
    : effect.kind === 'damage' && effect.shape === 'arc1'
      ? { ring: true }
      : { priestGlowColor: BRASS };
  presenter.play(result.events, state, opts, afterAction);
}

function resolveCastClick(cardId: string, g: GridPos, fromDrop: boolean): void {
  const targets = castTargeting(state, cardId);
  const key = tileKey(g.x, g.y);
  const enemy = enemyAt(g);
  if (enemy && targets.enemies.has(key)) {
    cast(cardId, enemy.id, g);
    return;
  }
  if (targets.tiles.has(key)) {
    cast(cardId, null, g);
    return;
  }
  if (targets.tiles.size === 0 && targets.enemies.size === 0) {
    cast(cardId, null, null);
    return;
  }
  invalidCast(castHint(cardId));
  if (!fromDrop) {
    selectedCard = null;
    refreshHud();
  }
}

canvas.addEventListener('pointerdown', (e) => {
  const rect = canvas.getBoundingClientRect();
  const g = toGrid({
    x: e.clientX - rect.left - camera.x,
    y: e.clientY - rect.top - camera.y,
  });
  if (!canAct()) return;
  if (selectedCard) {
    resolveCastClick(selectedCard, g, false);
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
    resolveCastClick(cardId, toGrid({ x: canvasX - camera.x, y: canvasY - camera.y }), true);
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
      showEndOverlay();
    });
    return;
  }
  const result = enemyTurn(state, Math.random);
  state = result.state;
  presenter.play([...ended.events, ...result.events], state, {}, () => {
    if (state.turn !== 'player') {
      refreshHud();
      showEndOverlay();
      return;
    }
    state = drawCards(state, Math.random);
    refreshHud();
  });
});

threatButton.addEventListener('click', () => {
  showThreat = !showThreat;
  threatButton.textContent = showThreat ? 'THREAT: ON' : 'THREAT: OFF';
});

function startNextFight(): void {
  state = freshState();
  selectedCard = null;
  presenter.reset(state);
  overlay.classList.add('hidden');
  rewardPanel.classList.add('hidden');
  restartButton.textContent = 'BEGIN AGAIN';
  say('');
  refreshHud();
}

restartButton.addEventListener('click', () => {
  if (state.turn === 'won') {
    run = recordWin(run);
    overlay.classList.add('hidden');
    openRewards();
    return;
  }
  run = createRun();
  startNextFight();
});

function openRewards(): void {
  setDeckLabel(run.deck.length, DECK_CAP);
  const rolled = rollRewards(run.deck, doctrineHints(run.deck), Math.random);
  if (rolled.length === 0) {
    startNextFight();
    say('DECK AT CAP - THE FORGE OFFERS NOTHING');
    return;
  }
  setRewardCards(
    rolled.map((id) => ({
      card: cardDef(id),
      doctrine: DOCTRINES[id] ?? null,
    })),
    {
      onTake(cardId) {
        run = addReward(run, cardId);
        startNextFight();
      },
      onDecline() {
        startNextFight();
      },
    },
  );
  rewardPanel.classList.remove('hidden');
}

declineButton.addEventListener('click', () => {
  if (rewardPanel.classList.contains('hidden')) return;
  startNextFight();
});

resize();
window.addEventListener('resize', resize);
new ResizeObserver(fitCamera).observe(canvas);
await Promise.all([loadRig(), loadEnemyArt(), loadTurretArt(), loadBoardTextures()]);
refreshHud();

let last = performance.now();

function frame(now: number): void {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;

  presenter.update(dt, state.board);
  const scanned = state.scannedTurns > 0;
  const targets: CastTargeting = selectedCard
    ? castTargeting(state, selectedCard)
    : { tiles: new Set(), enemies: new Set() };
  const fx = presenter.effects();
  const scene: Scene = {
    board: state.board,
    threat,
    showThreat: showThreat || scanned,
    reachable: selectedCard || presenter.busy ? new Set() : new Set(paths.keys()),
    units: presenter.unitViews(state, scanned),
    turrets: state.turrets.map((t) => t.pos),
    sanctified: new Set(state.sanctified),
    targetTiles: targets.tiles,
    targetEnemies: targets.enemies,
    floaters: fx.floaters,
    projectile: fx.projectile,
    ring: fx.ring,
    glows: fx.glows,
  };

  drawScene(ctx, scene, camera, background);
  requestAnimationFrame(frame);
}

interface OmvTestHook {
  load(setup: {
    deck: string[];
    hand: string[];
    energy?: number;
    hp?: number;
    facing?: number;
    placements?: { typeId: EnemyTypeId; pos: GridPos }[];
  }): void;
  give(cardId: string): void;
  read(): unknown;
}

declare global {
  interface Window {
    _omvTest?: OmvTestHook;
  }
}

window.__omvTest = {  //ai helped me write this function fully to test stuff
  load(setup) {
    const combat = createCombat(
      makeDemoBoard(),
      SPAWN,
      setup.placements ?? enemyPlacements(),
      setup.deck,
    );
    combat.hand = [...setup.hand];
    combat.energy = setup.energy ?? ENERGY_PER_TURN;
    combat.player.hp = setup.hp ?? PLAYER_MAX_HP;
    combat.player.facing = (setup.facing ?? 0) as CombatState['player']['facing'];
    state = combat;
    presenter.reset(state);
    refreshHud();
  },
  give(cardId: string) {
    state.hand.push(cardId);
    refreshHud();
  },
  read() {
    return {
      busy: presenter.busy,
      turn: state.turn,
      turnCount: state.turnCount,
      energy: state.energy,
      hp: state.player.hp,
      armor: state.player.armor,
      facing: state.player.facing,
      playerPos: { ...state.player.pos },
      hand: [...state.hand],
      deck: [...state.deck],
      discard: [...state.discard],
      runDeck: [...run.deck],
      fightsWon: run.fightsWon,
      sanctified: [...state.sanctified],
      stasisNext: state.stasisNext,
      threatCount: computeAllThreat(state).size,
      scannedTurns: state.scannedTurns,
      enemies: state.enemies.map((e) => ({ id: e.id, hp: e.hp, pos: e.pos, facing: e.facing })),
      turrets: state.turrets.map((t) => ({ id: t.id, pos: t.pos })),
      rewardHidden: rewardPanel.classList.contains('hidden'),
      overlayText: overlay.classList.contains('hidden') ? null : overlayText.textContent,
    };
  },
};
requestAnimationFrame(frame);
