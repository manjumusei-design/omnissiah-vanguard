import type {GridPos} from './projection';

export type Facing = 0 | 1 | 2 | 3 |;

export type UnitKind = 'techpriest' | 'warrior' | 'scarab';

export interface Unit {
    id: string;
    kind: UnitKind;
    pos: GridPos;
    hp: number;
    facing: Facing;
}

export function makeDemoUnits(): Unit[] {
  return [
    { id: 'techpriest', kind: 'techpriest', pos: { x: 6, y: 4 }, hp: 30, facing: 0 },
    { id: 'warrior-1', kind: 'warrior', pos: { x: 3, y: 2 }, hp: 12, facing: 2 },
    { id: 'scarab-1', kind: 'scarab', pos: { x: 9, y: 6 }, hp: 6, facing: 1 },
  ];
}
