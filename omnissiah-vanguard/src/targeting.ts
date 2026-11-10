import { isBlocked } from './board';
import { CARDS } from './cards';
import {
  TURRET_CAP,
  TURRET_PLACE_RANGE,
  castRange,
  chebyshev,
  coneTiles,
  isTileFree,
  lineTiles,
  losClear,
  tilesWithin,
  type CombatState,
} from './combat';
import type { GridPos } from './projection';
import { tileKey } from './threat';

export interface CastTargeting {
  tiles: Set<string>;
  enemies: Set<string>;
}

export function castTargeting(state: CombatState, cardId: string): CastTargeting {
  const targeting: CastTargeting = { tiles: new Set(), enemies: new Set() };
  const card = CARDS.find((c) => c.id === cardId);
  if (!card || state.turn !== 'player') return targeting;
  const player = state.player.pos;
  const effect = card.effect;

  switch (effect.kind) {
    case 'damage': {
      if (effect.shape === 'line') {
        for (const tile of lineTiles(state.board, player, castRange(state, effect.range))) {
          const key = tileKey(tile.x, tile.y);
          targeting.tiles.add(key);
          if (state.enemies.some((e) => e.hp > 0 && e.pos.x === tile.x && e.pos.y === tile.y)) {
            targeting.enemies.add(key);
          }
        }
      } else if (effect.shape === 'cone') {
        for (const tile of coneTiles(player, state.player.facing)) {
          if (!isBlocked(state.board, tile.x, tile.y)) targeting.tiles.add(tileKey(tile.x, tile.y));
        } 
      } else if (effect.shape === 'arc1') {
        for (const enemy of state.enemies) {
          if(enemy.hp > 0 && chebyshev(player,enemy.pos) === 1) {
            targeting.enemies.add(tileKey(enemy.pos.x, enemy.pos.y));
          }
        }
      } else {
        const range = castRange(state, effect.range);
        for (const enemy of state.enemies) {
          if (enemy.hp <= 0 || chebyshev(player, enemy.pos) > range) continue;
          if (effect.los && !losClear(state.board, player, enemy.pos)) continue;
          targeting.enemies.add(tileKey(enemy.pos.x, enemy.pos.y));
        }
      }
      break;
    }
    case 'pull': {
      const range = castRange(state, effect.range);
      for (const enemy of state.enemies) {
        if (enemy.hp <= 0 || chebyshev(player, enemy.pos) > range) continue;
        if (!losClear(state.board, player, enemy.pos)) continue;
        targeting.enemies.add(tileKey(enemy.pos.x, enemy.pos.y));
      }
      break;
    }
    case 'sanctify': {
      const radius = effect.shape === 'tile' ? castRange(state, effect.range) : effect.range;
      for (const tile of tilesWithin(player, radius)) {
        if (!isBlocked(state.board, tile.x, tile.y)) targeting.tiles.add(tileKey(tile.x, tile.y));
      }
      break;
    }
    case 'summonTurret': {
      if (state.turrets.length >= TURRET_CAP) break;
      for (const tile of tilesWithin(player, castRange(state, TURRET_PLACE_RANGE))) {
        if (isTileFree(state, tile)) targeting.tiles.add(tileKey(tile.x, tile.y));
      }
      break;
    }
    case 'moveStep': {
      for (const tile of tilesWithin(player, 1)) {
        if (isTileFree(state, tile)) targeting.tiles.add(tileKey(tile.x, tile.y));
      }
      break;
    }
  }
  return targeting;
}

export function castHint(cardId: string): string {
  const card = CARDS.find((c) => c.id === cardId);
  if (!card) return 'NO TARGET IN RANGE';
  switch (card.effect.kind) {
    case 'damage':
      if (card.effect.shape === 'line') return 'NOT IN THE LINE OF FIRE';
      if (card.effect.shape === 'cone') return 'OUTSIDE THE CLEAVE CONE';
      if (card.effect.shape === 'arc1') return 'NO ADJACENT ENEMY';
      return 'NO TARGET IN RANGE';
    case 'sanctify': return 'OUT OF SANCTIFY RANGE';
    case 'summonTurret': return 'INVALID TURRET PLACEMENT';
    case 'pull': return 'NO ENEMY IN PULL RANGE';
    case 'moveStep': return 'NOT AN ADJACENT TILE';
    default: return 'NO TARGET IN RANGE';
  }
}