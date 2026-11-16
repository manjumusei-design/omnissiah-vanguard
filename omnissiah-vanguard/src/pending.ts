import type { CardDef } from './cards';
import type { GridPos } from './projection';

export type PendingAction = 
  | { kind: 'move'; path: GridPos[] }
  | { kind: 'cast'; cardId: string; targetUnitId: string | null; targetTile: GridPos | null };

export const CONFIRM_HINT = 'ENTER CONFIRMS - ESC CANCELS';

export function canConfirm(pending: PendingAction, energy: number, card: CardDef | undefined): boolean {
  if (pending.kind === 'move') return pending.path.length <= energy;
  return card !== undefined && card.cost <= energy;
}

export function pendingStatus(
  pending: PendingAction,
  cardName: (id: string) => string,
  showHint: boolean,
): string {
  const base = pending.kind === 'move'
    ? 'CONFIRM TO MOVE'
    : `CONFIRM TO CAST ${cardName(pending.cardId).toUpperCase()}`;
  return showHint ? `${base} - ${CONFIRM_HINT}` : base;
}

export function blocksNewAction(pending: PendingAction | null): boolean {
  return pending !== null;
}