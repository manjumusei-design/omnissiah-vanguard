export type CardKind = 'Rite' | 'Benediction' | 'Ritual' | 'Protocol';

export interface CardDef {
  id: string;
  name: string;
  cost: number;
  kind: CardKind;
  blurb: string
}

export const CARDS: CardDef[] = [
  { id: 'las-prayer', name: 'Las-Prayer', cost: 1, kind: 'Rite', blurb: 'Ranged prayer-lance. 3 damage.' },
  { id: 'cog-step', name: 'Cog-Step', cost: 0, kind: 'Protocol', blurb: 'Step one tile freely.' },
  { id: 'binharic-lash', name: 'Binharic Lash', cost: 2, kind: 'Rite', blurb: 'Arc of severing code. Melee cone.' },
  { id: 'servo-skull', name: 'Servo-Skull', cost: 1, kind: 'Ritual', blurb: 'Scan the room ahead.' },
  { id: 'machine-blessing', name: 'Machine Blessing', cost: 1, kind: 'Benediction', blurb: '+2 armor this turn.' },
];
