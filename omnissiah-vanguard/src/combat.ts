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