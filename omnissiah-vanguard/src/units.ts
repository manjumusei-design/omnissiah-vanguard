import { ENEMY_TYPES, type EnemyTypeId } from './enemies';
import type { GridPos } from './projection';

export type Facing = 0 | 1 | 2 | 3 |;

export type UnitTypeId = 'techpriest' | EnemyTypeId;

export interface Unit {
    id: string;
    typeId: UnitTypeId,
    pos: GridPos;
    hp: number;
    facing: Facing;
}

function enemy(id: string, typeId: EnemyTypeId, pos: GridPos, facing: Facing): Unit {
  return {id, typeId, pos, hp: ENEMY_TYPES[typeId].maxHp, facing };
}

export function makeDemoUnits(): Unit[] {
  return [
    { id: 'techpriest', typeId: 'techpriest', pos: { x: 6, y: 4 }, hp: 30, facing: 0 },
    enemy('warrior-1', 'warrior', { x: 3, y: 2 }, 2),
    enemy('scarab-1', 'scarab', { x: 9, y: 6 }, 1),
    enemy('scarab-2', 'scarab', { x: 2, y: 7 }, 1),
    enemy('immortal-1', 'immortal', { x: 11, y: 1 }, 2),
    enemy('wraith-1', 'wraith', { x: 9, y: 4 }, 3),
  ];
}
