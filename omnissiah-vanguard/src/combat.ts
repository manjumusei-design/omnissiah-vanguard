import { isBlocked, type TileKind } from './board';
import { CARDS } from './cards';
import { ENEMY_TYPES, type EnemyTypeId, type EnemyType } from './enemies';
import type { GridPos } from './projection';
import { tileKey } from './threat';

export type Facing = 0 | 1 | 2 | 3;

export type StatusId = 'blessing' | 'corrupted' | 'scrambled' | 'malfunctioning';

export interface Fighter {
  id: string;
  typeId: 'techpriest' | EnemyTypeId;
  pos: GridPos;
  hp: number;
  facing: Facing;
  armor: number;
  statuses: StatusId[];
}

export interface CombatState {
  board: TileKind[][];
  sanctified: string[];
  player: Fighter;
  enemies: Fighter[];
  turn: 'player' | 'enemy' | 'won' | 'lost';
  turnCount: number;
  energy: number;
  deck: string[];
  hand: string[];
  discard: string[];
  scannedTurns: number;
}

export type CombatEvent =
  | { type: 'move'; unitId: string; path: GridPos[] }
  | { type: 'attack'; attackerId: string; targetId: string; from: GridPos; damage: number; rear: boolean; killed: boolean }
  | { type: 'damage'; unitId: string; amount: number; killed: boolean }
  | { type: 'status'; unitId: string; status: StatusId }
  | { type: 'tile'; key: string; kind: 'sanctify' }
  | { type: 'turnEnd'; turn: CombatState['turn'] };

export const MOVE_RANGE = 3;
export const ENERGY_PER_TURN = 3;
export const HAND_SIZE = 5;
export const HAZARD_DAMAGE = 2;
export const RAISE_RANGE_BONUS = 1;
export const SANCTIFIED_BONUS = 2;
export const PLAYER_MAX_HP = 30;
export const SCAN_TURNS = 2;

const REAR_MULTIPLIER = 1.5;
const CORRUPTED_DAMAGE = 2;
const BLESSING_ARMOR = 2;
const LAS_PRAYER_DAMAGE = 3;
const LAS_PRAYER_RANGE = 5;
const BINHARIC_LASH_DAMAGE = 3;
const BIHARIC_LASH_RADIUS = 1;

export const START_DECK: string[] = [
  'las-prayer', 'las-prayer', 'las-prayer',
  'cog-step', 'cog-step',
  'binharic-lash', 'binharic-lash',
  'servo-skull',
  'machine-blessing', 'machine-blessing',
];

export function chebyshev(a: GridPos, b: GridPos): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

export function facingFromDelta(dx: number, dy: number): Facing {
  if (dx === 0 && dy === 0) return 0;
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? 1 : 3;
  return dy > 0 ? 0 : 2;
}

export function isRear(attackerPos: GridPos, target: Fighter): boolean {
  switch (target.facing) {
    case 0: return attackerPos.y > target.pos.y;
    case 1: return attackerPos.x > target.pos.x;
    case 2: return attackerPos.y < target.pos.y;
    case 3: return attackerPos.x < target.pos.x;
  }
}

export function losClear(board: TileKind[][], from: GridPos, to: GridPos): boolean {
  let x = from.x;
  let y = from.y;
  const dx = Math.abs(to.x - from.x);
  const dy = Math.abs(to.y - from.y);
  const sx = from.x < to.x ? 1 : -1;
  const sy = from.y < to.y ? 1 : -1;
  let err = dx - dy;
  while (x !== to.x || y !== to.y) {
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
    if (x === to.x && y === to.y) break;
    if (isBlocked(board, x, y)) return false;
  }
  return !isBlocked(board, to.x, to.y);
}

export function reach(board: TileKind[][], from: GridPos, range: number, occupied: GridPos[]): GridPos[] {
  const isOccupied = (p: GridPos) => occupied.some((o) => o.x === p.x && o.y === p.y);
  const reached = new Map<string, GridPos>([[tileKey(from.x, from.y), from]]);
  let frontier: GridPos[] = [from];
  for (let step = 0; step < range && frontier.length > 0; step++) {
    const next: GridPos[] = [];
    for (const p of frontier) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const q = { x: p.x + dx, y: p.y + dy };
          const key = tileKey(q.x, q.y);
          if (reached.has(key) || isBlocked(board, q.x, q.y)) continue;
          reached.set(key, q);
          if (!isOccupied(q)) next.push(q);
        }
      }
    }
    frontier = next;
  }
  return [...reached.values()];
}

export function createCombat(
  board: TileKind[][],
  playerPos: GridPos,
  enemyPlacements: { typeId: EnemyTypeId; pos: GridPos }[],
  deck: string[],
): CombatState {
  const player: Fighter = {
    id: 'player',
    typeId: 'techpriest',
    pos: { ...playerPos },
    hp: PLAYER_MAX_HP,
    facing: 0,
    armor: 0,
    statuses: [],
  };
  const enemies: Fighter[] = enemyPlacements.map((placement, i) => ({
    id: `e${i + 1}`,
    typeId: placement.typeId,
    pos: { ...placement.pos },
    hp: ENEMY_TYPES[placement.typeId].maxHp,
    facing: 2,
    armor: 0,
    statuses: [],
  }));
  return {
    board,
    sanctified: [],
    player,
    enemies,
    turn: 'player',
    turnCount: 1,
    energy: ENERGY_PER_TURN,
    deck: [...deck],
    hand: [],
    discard: [],
    scannedTurns: 0,
  };
}
  
function cloneFighter(fighter: Fighter): Fighter {
  return { ...fighter, pos: { ...fighter.pos }, statuses: [...fighter.statuses] };
}

function cloneState(state: CombatState): CombatState {
  return {
    ...state,
    sanctified: [...state.sanctified],
    player: cloneFighter(state.player),
    enemies: state.enemies.map(cloneFighter),
    deck: [...state.deck],
    hand: [...state.hand],
    discard: [...state.discard],
  };
}

function findFighter(state: CombatState, id: string): Fighter | undefined {
  return state.player.id === id ? state.player : state.enemies.find((e) => e.id === id);
}

function isOccupied(state: CombatState, pos: GridPos, selfId: string): boolean {
  return [state.player, ...state.enemies].some(
    (f) => f.id !== selfId && f.hp > 0 && f.pos.x === pos.x && f.pos.y === pos.y,
  );
}