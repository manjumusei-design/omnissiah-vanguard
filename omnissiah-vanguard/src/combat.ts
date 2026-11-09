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

function tileAt(board: TileKind[][], pos: GridPos): TileKind | undefined {
  return board[pos.y]?.[pos.x];
}

function enemyStats(typeId: Fighter['typeId']): EnemyType {
  return ENEMY_TYPES[typeId as EnemyTypeId];
}

export function movePlayer(state: CombatState, path: GridPos[]): CombatState { 
  if (state.turn !== 'player' || path.length === 0 || path.length > MOVE_RANGE) return state;
  if (state.energy < path.length) return state;
  let from = state.player.pos;
  let facing = state.player.facing;
  for (const step of path) {
    if (chebyshev(from, step) !== 1) return state;
    if (isBlocked(state.board, step.x, step.y)) return state;
    if (isOccupied(state, step, 'player')) return state;
    facing = facingFromDelta(step.x - from.x, step.y - from.y);
    from = step;
  }
  const next = cloneState(state);
  next.player.pos = { ...from };
  next.player.facing = facing;
  next.energy -= path.length;
  return next;
}

export function drawCards(state: CombatState, rng: () => number): CombatState {
  const next = cloneState(state);
  while (next.hand.length < HAND_SIZE) {
    if (next.deck.length === 0) {
      if (next.discard.length === 0) break;
      const reshuffled: string[] = [];
      while (next.discard.length > 0) {
        const index = Math.floor(rng() * next.discard.length);
        reshuffled.push(next.discard.splice(index, 1)[0]!);
      }
      next.deck = reshuffled;
    }
    const index = Math.floor(rng() * next.deck.length);
    next.hand.push(...next.deck.splice(index, 1));
  }
  return next;
}

export function castRite(
  state: CombatState,
  cardId: string,
  targetUnitId: string | null,
  targetTile: GridPos | null,
): { state: CombatState; events: CombatEvent[] } {
  if (state.turn !== 'player') return { state, events: [] };
  if (!state.hand.includes(cardId)) return { state, events: [] };
  const card = CARDS.find((c) => c.id === cardId);
  if (!card || state.energy < card.cost) return { state, events: [] };

  const applied = applyRite(state, cardId, targetUnitId, targetTile);
  if (!applied) return { state, events: [] };

  const next = applied.state;
  const handIndex = next.hand.indexOf(cardId);
  if (handIndex !== -1) {
    next.hand.splice(handIndex, 1);
    next.discard.push(cardId);
  }
  next.energy -= card.cost;
  return {state: next, events: applied.events };
}

function applyRite(
  state: CombatState,
  cardId: string,
  targetUnitId: string | null,
  targetTile: GridPos | null,
): { state: CombatState; events: CombatEvent[] } | null {
  switch (cardId) {
    case 'las-prayer': {
      const enemy = targetUnitId
        ? state.enemies.find((e) => e.id === targetUnitId && e.hp > 0)
        : undefined;
      if (!enemy) return null;
      const range = LAS_PRAYER_RANGE
        + (tileAt(state.board, state.player.pos) === 'raised' ? RAISED_RANGE_BONUS : 0);
      if (chebyshev(state.player.pos, enemy.pos) > range) return null;
      if (!losClear(state.board, state.player.pos, enemy.pos)) return null;
      return resolveAttack(state, state.player, enemy, LAS_PRAYER_DAMAGE);
    }
    case 'cog-step': {
      if (!targetTile) return null;
      if (chebyshev(state.player.pos, targetTile) !== 1) return null;
      if (isBlocked(state.board, targetTile.x, targetTile.y)) return null;
      if (isOccupied(state, targetTile, 'player')) return null;
      const next = cloneState(state);
      next.player.pos = { ...targetTile };
      next.player.facing = facingFromDelta(targetTile.x - state.player.pos.x, targetTile.y - state.player.pos.y);
      return { state: next, events: [{ type: 'move', unitId: 'player', path: [{ ...targetTile }] }] };
    }
    case 'binharic-lash': {
      let cur = cloneState(state);
      const events: CombatEvent[] = [];
      for (const snapshot of state.enemies) {
        if (chebyshev(snapshot.pos, state.player.pos) > BINHARIC_LASH_RADIUS) continue;
        const enemy = cur.enemies.find((e) => e.id === snapshot.id);
        if (!enemy || enemy.hp <= 0) continue;
        const result = resolveAttack(cur, cur.player, enemy, BINHARIC_LASH_DAMAGE);
        cur = result.state;
        events.push(...result.events);
      }
      return { state: cur, events };
    }
    case 'servo-skull': {
      const next = cloneState(state);
      next.scannedTurns = SCAN_TURNS;
      return { state: next, events: [] };
    }
    case 'machine-blessing': {
      const next = cloneState(state);
      next.player.armor += BLESSING_ARMOR;
      return { state: next, events: [] };
    }
    default:
      return null;
  }
}