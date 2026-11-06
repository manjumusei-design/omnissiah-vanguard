export type EnemyTypeId = 'scarab' | 'warrior' | 'immortal' | 'wraith' |'sentinel';

export type EnemyIdleAxis = 'x' | 'y' | 'none';

export interface EnemyIdle {
  axis: EnemyIdleAxis;
  lift: number;
  amplitude: number;
  cycles: number;
}

export interface EnemyType {
  name: string;
  maxHp: number;
  moveRange: number;
  attackDamage: number;
  attackRange: number;
  sprite: string;
  scale: number;
  footOffset: number;
  idle: EnemyIdle;
  shadowScale: number;
  shadowAlpha: number;
}

export const ENEMY_TYPE: Record<EnemyTypeId, EnemyType> = {
  scarab: {
    name: 'Scarab Swarm',
    maxHp: 6,
    moveRange: 4,
    attackDamage: 2,
    attackRange: 1,
    sprite: 'scarab',
    scale: 1.6,
    footOffset: 4,
    idle: { axis: 'y', lift: 1, amplitude: 1, cycles: 3 },
    shadowScale: 0.8,
    shadowAlpha: 0.35
  },
  immortal: {
    name: 'Immortal',
    maxHp: 10,
    moveRange: 2,
    attackDamage: 3,
    attackRange: 4,
    sprite: 'immortal',
    scale: 2.5,
    footOffset: 6,
    idle: { axis: 'x', lift: 0, amplitude: 1, cycles: 1 },
    shadowScale: 1,
    shadowAlpha: 0.4,
  },
  warrior: {
    name: 'Necron Warrior',
    maxHp: 12,
    moveRange: 2,
    attackDamage: 2,
    attackRange: 1,
    sprite: 'immortal',
    scale: 2.5,
    footOffset: 6,
    idle: { axis: 'x', lift: 0, amplitude: 1, cycles: 1 },
    shadowScale: 1,
    shadowAlpha: 0.4,
  },
  wraith: {
    name: 'Canoptek Wraith',
    maxHp: 16,
    moveRange: 3,
    attackDamage: 3,
    attackRange: 1,
    sprite: 'canoptek-wraith',
    scale: 2.5,
    footOffset: 5,
    idle: { axis: 'y', lift: 3, amplitude: 2.5, cycles: 1 },
    shadowScale: 0.6,
    shadowAlpha: 0.2,
  },
  sentinel: {
    name: 'Canoptek Tomb Sentinel',
    maxHp: 60,
    moveRange: 2,
    attackDamage: 6,
    attackRange: 1,
    sprite: 'tomb-sentinel',
    scale: 4.5,
    footOffset: 9,
    idle: { axis: 'none', lift: 0, amplitude: 0, cycles: 0 },
    shadowScale: 1.5,
    shadowAlpha: 0.4,
  },
};

const ART_ROOT = '/art/processed/';

export function spriteFile(id: EnemyTypeId): string {
  return ART_ROOT + ENEMY_TYPES[id].sprite + '.png';
}