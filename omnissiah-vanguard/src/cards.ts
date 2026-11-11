export type CardKind = 'Rite' | 'Benediction' | 'Ritual' | 'Protocol';

export type DamageShape = 'single' | 'line' | 'cone'| 'arc1';

export type CardEffect =
  | {
      kind: 'damage';
      amount: number;
      range: number;
      los: boolean;
      shape: DamageShape;
      ignoreArmor?: boolean;
      corrupt?: boolean;
    }
  | { kind: 'heal'; amount: number }
  | { kind: 'armor'; amount: number }
  | { kind: 'energy'; amount: number }
  | { kind: 'draw'; amount: number }
  | { kind: 'scan'; turns: number }
  | { kind: 'sanctify'; shape: 'tile' | 'burst1'; range: number }
  | { kind: 'summonTurret' }
  | { kind: 'pull'; range: number }
  | { kind: 'stasis' }
  | { kind: 'moveStep' };

export interface CardDef {
  id: string;
  name: string;
  cost: number;
  hpCost?: number;
  kind: CardKind;
  blurb: string;
  effect: CardEffect;
}

export const CARDS: CardDef[] = [
  { id: 'las-prayer', name: 'Las-Prayer', cost: 1, kind: 'Rite', blurb: '3 damage, range 5, LOS.', effect: { kind: 'damage', amount: 3, range: 5, los: true, shape: 'single' } },
  { id: 'las-volley', name: 'Las-Volley', cost: 2, kind: 'Rite', blurb: '2 damage to every enemy in a straight line, range 6, LOS.', effect: { kind: 'damage', amount: 2, range: 6, los: true, shape: 'line' } },
  { id: 'severance', name: 'Severance', cost: 1, kind: 'Rite', blurb: '4 damage, melee, single target.', effect: { kind: 'damage', amount: 4, range: 1, los: false, shape: 'single' } },
  { id: 'plasmic-hymn', name: 'Plasmic Hymn', cost: 3, kind: 'Rite', blurb: '5 damage, range 3, ignores armor.', effect: { kind: 'damage', amount: 5, range: 3, los: true, shape: 'single', ignoreArmor: true } },
  { id: 'rad-cleansing', name: 'Rad-Cleansing', cost: 2, kind: 'Rite', blurb: '2 damage and Corrupted, range 3.', effect: { kind: 'damage', amount: 2, range: 3, los: true, shape: 'single', corrupt: true } },
  { id: 'skull-reaper', name: 'Skull-Reaper', cost: 2, kind: 'Rite', blurb: '2 damage, cleaves the 3-tile cone in front.', effect: { kind: 'damage', amount: 2, range: 1, los: false, shape: 'cone' } },
  { id: 'melta-chant', name: 'Melta-Chant', cost: 3, kind: 'Rite', blurb: '6 damage, adjacent only.', effect: { kind: 'damage', amount: 6, range: 1, los: false, shape: 'single' } },
  { id: 'binharic-lash', name: 'Binharic Lash', cost: 2, kind: 'Rite', blurb: 'Arc of severing code. 3 damage to every adjacent enemy.', effect: { kind: 'damage', amount: 3, range: 1, los: false, shape: 'arc1' } },
  { id: 'machine-blessing', name: 'Machine Blessing', cost: 1, kind: 'Benediction', blurb: '+2 armor this turn.', effect: { kind: 'armor', amount: 2 } },
  { id: 'repair-litany', name: 'Repair Litany', cost: 2, kind: 'Benediction', blurb: 'Heal 5.', effect: { kind: 'heal', amount: 5 } },
  { id: 'litany-of-defiance', name: 'Litany of Defiance', cost: 1, kind: 'Benediction', blurb: '+3 armor this turn.', effect: { kind: 'armor', amount: 3 } },
  { id: 'overcharge-grid', name: 'Overcharge Grid', cost: 0, hpCost: 2, kind: 'Benediction', blurb: '+2 energy this turn. Costs 2 HP.', effect: { kind: 'energy', amount: 2 } },
  { id: 'flesh-is-weak', name: 'Flesh Is Weak', cost: 0, hpCost: 2, kind: 'Benediction', blurb: 'Draw 2 cards. Costs 2 HP.', effect: { kind: 'draw', amount: 2 } },
  { id: 'servo-skull', name: 'Servo-Skull', cost: 1, kind: 'Ritual', blurb: 'Scan: 2 turns of enemy stats and always-on threat.', effect: { kind: 'scan', turns: 2 } },
  { id: 'consecrate', name: 'Consecrate', cost: 1, kind: 'Ritual', blurb: 'Sanctify one tile within range 2.', effect: { kind: 'sanctify', shape: 'tile', range: 2 } },
  { id: 'consecrated-ground', name: 'Consecrated Ground', cost: 2, kind: 'Ritual', blurb: 'Sanctify all tiles within 1 of the priest.', effect: { kind: 'sanctify', shape: 'burst1', range: 1 } },
  { id: 'servitor-turret', name: 'Servitor Turret', cost: 2, kind: 'Ritual', blurb: 'Static turret, 2 damage to nearest enemy in range 3, fires after the enemy turn.', effect: { kind: 'summonTurret' } },
  { id: 'grav-anchor', name: 'Grav-Anchor', cost: 1, kind: 'Ritual', blurb: 'Pull target enemy 1 tile toward the priest. Blocked pulls are wasted.', effect: { kind: 'pull', range: 3 } },
  { id: 'cog-step', name: 'Cog-Step', cost: 0, kind: 'Protocol', blurb: 'Move 1 tile free.', effect: { kind: 'moveStep' } },
  { id: 'binary-chant', name: 'Binary Chant', cost: 1, kind: 'Protocol', blurb: 'Draw 2 cards.', effect: { kind: 'draw', amount: 2 } },
  { id: 'rite-of-calculation', name: 'Rite of Calculation', cost: 1, kind: 'Protocol', blurb: '+2 energy this turn.', effect: { kind: 'energy', amount: 2 } },
  { id: 'stasis-hymn', name: 'Stasis Hymn', cost: 1, kind: 'Protocol', blurb: 'Enemies have moveRange -1 next enemy turn (min 1).', effect: { kind: 'stasis' } },
];
