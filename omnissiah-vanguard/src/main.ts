import { BOARD_COLS, BOARD_ROWS, isBlocked, makeDemoBoard } from './board';
import { CARDS } from './cards';
import { loadRig } from './rig';
import { toGrid, toScreen, type GridPos, type ScreenPos } from './projection';
import {
  createBackground,
  drawScene,
  tileFoot,
  type Camera,
  type Scene,
} from './render';
import { computeThreat, tileKey } from './threat';
import { makeDemoUnits, type Facing } from './units';
import { renderHand, setEnergy } from './ui';

const MOVE_RANGE = 3;
const ENERGY_PER_TURN = 3;
const STEP_SECONDS = 0.25;
const FLASH_SECONDS = 0.4;

const DIRS8: ReadonlyArray<readonly [number, number]> = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
];

interface GameState extends Scene {
  energy: number;
  paths: Map<string, GridPos[]>;
  playerPos: GridPos;
  walkPath: GridPos[];
  walkFrom: GridPos;
  walkStep: number;
  walkTimer: number;
}

function requireElement<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id} element`);
  return el as T;
}

function facingFromStep(from: GridPos, to: GridPos): Facing {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 1 : 3;
  return dy > 0 ? 0 : 2;
}

function lerp(a: ScreenPos, b: ScreenPos, t: number): ScreenPos {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function computeReachable(state: GameState): void {
  const occupied = new Set(
    state.units
    .filter((u) => u.kind !== 'techpriest')
    .map((u) => tileKey(u.pos.x, u.pos.y)),
  );
  const paths = new Map<string, GridPos[]>();
  paths.set(tileKey(state.playerPos.x, state.playerPos.y), []);
  const queue: Array<{ pos: GridPos; path: GridPos[] }> = [{ pos: state.playerPos, path: [] }];
  while (queue.length > 0) {
    const node = queue.shift()!;
    if (node.path.length >= MOVE_RANGE) continue;
    for (const [dx, dy] of DIRS8) {
      const next: GridPos = { x: node.pos.x + dx, y: node.pos.y + dy };
      const key = tileKey(next.x, next.y);
      if (
        paths.has(key) ||
        isBlocked(state.board, next.x, next.y) ||
        occupied.has(key)
      ) {
        continue;
      }
      const path = [...node.path, next];
      paths.set(key, path);
      queue.push({pos: next, path});
    }
  }
  paths.delete(tileKey(state.playerPos.x, state.playerPos.y));
  state.paths = paths;
  state.reachable = new Set(paths.keys());
}

function startWalk(state: GameState, target: GridPos): void{
  const path = state.paths.get(tileKey(target.x, target.y));
  if (!path || path.length === 0 || state.playerMoving || state.energy < path.length) return;
  state.walkPath = path;
  state.walkFrom = state.playerPos;
  state.walkStep = 0;
  state.walkTimer = 0;
  state.playerMoving = true;
  state.reachable = new Set();
  state.paths = new Map();
}


function advanceWalk(state: GameState, dt: number): void {
  state.walkTimer += dt;
  while (state.walkTimer >= STEP_SECONDS && state.walkStep < state.walkPath.length) {
    state.walkTimer -= STEP_SECONDS;
    const arrived = state.walkPath[state.walkStep]!;
    state.playerFacing = facingFromStep(state.walkFrom, arrived);
    state.walkFrom = arrived;
    state.playerPos = arrived;
    state.walkStep++;
    state.energy -= 1;
    setEnergy(state.energy, ENERGY_PER_TURN);
  }
  if (state.walkStep >= state.walkPath.length) {
    state.playerMoving = false;
    state.playerScreen = tileFoot(state.board, state.playerPos);
    computeReachable(state);
  } else {
    const target = state.walkPath[state.walkStep]!;
    state.playerFacing = facingFromStep(state.walkFrom, target);
    const t = state.walkTimer / STEP_SECONDS;
    state.playerScreen = lerp(tileFoot(state.board, state.walkFrom), tileFoot(state.board, target), t);
    state.playerPhase = t;
  }
}

const canvas = requireElement<HTMLCanvasElement>('board');
const ctx0rNull = canvas.getContext('2d');
if (!ctx0rNull) throw new Error('2D context unavailable');
const ctx: CanvasRenderingContext2D = ctxOrNull;

const threatButton = requireElement<HTMLButtonElement>('threat-toggle');

const camera: Camera = {x: 0, y: 0};
let background: HTMLCanvasElement;

function resize(): void {
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
  background = createBackground(canvas.width, canvas.height);
  const center = toScreen({ x: (BOARD_COLS - 1) / 2, y: (BOARD_ROWS - 1) / 2 });
  camera.x = canvas.width / 2 - center.x;
  camera.y = canvas.height / 2 - center.y;
}

const state: GameState = {
  board: makeDemoBoard(),
  units: makeDemoUnits(),
  threat: new Set<string>(),
  showThreat: false,
  reachable: new Set<string>(),
  playerScreen: {x: 0, y: 0},
  playerFacing: 0,
  playerPhase: 0,
  playermoving: false,
  flashTile:null,
  flashAge: 0,
  time: 0,
  energy: ENERGY_PER_TURN,
  paths: new Map<string, GridPos[]>(),
  playerPos: { ...makeDemoUnits()[0]!.pos },
  walkPath: [],
  walkFrom: { x: 0, y:0},
  walkStep: 0,
  walkTimer: 0,
};

state.playerPos = { ...state.units[0]!.pos };

state.playerScreen = tileFoot(state.board, state.playerPos);
state.threat = computeThreat(
  state.board,
  state.units.filter((u) => u.kind !== 'techpriest').map((u) => u.pos),
);
computeReachable(state);

resize();
window.addEventListener('resize', resize);
loadRig();
setEnergy(state.energy, ENERGY_PER_TURN);

canvas.addEventListener('pointerdown', (e) => {
  const rect = canvas.getBoundingClientRect();
  const g = toGrid({
    x: e.clientX - rect.left - camera.x,
    y: e.clientY - rect.top - camera.y,
  });
  startWalk(state, g);
});

requireElement<HTMLButtonElement>('new-turn').addEventListener('click', () => {
  state.energy = ENERGY_PER_TURN;
  setEnergy(state.energy, ENERGY_PER_TURN);
});

threatButton.addEventListener('click', () => {
  state.energy = ENERGY_PER_TURN;
  setEnergy(state.energy, ENERGY_PER_TURN);
});

renderHand(CARDS, canvas, (canvasX, canvasY) => {
  const g = toGrid({ x: canvasX - camera.x, y: canvasY - camera.y });
  console.log(`card drop at grid ${g.x},${g.y}`);
  state.flashTile = tileKey(g.x, g.y);
  state.flashAge = 1;
});

let last = performance.now();

function frame(now: number): void {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;

  state.time += dt;
  if (state.playerMoving) {
    advanceWalk(state, dt);
  } else {

    state.playerPhase = (state.playerPhase + dt * 0.6) % 1;
  }
  if(state.flashAge > 0) {
    state.flashAge = Math.max(0, state.flashAge - dt / FLASH_SECONDS);
  }

  drawScene(ctx, state, camera, background);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
