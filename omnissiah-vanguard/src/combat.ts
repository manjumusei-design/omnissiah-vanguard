import { isBlocked, type TileKind } from './board';
import { CARDS, type CardDef, type CardEffect } from './cards';
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

export interface Turret {
  id: string;
  pos: GridPos;
}

export interface CombatState {
  board: TileKind[][];
  sanctified: string[];
  player: Fighter;
  enemies: Fighter[];
  turrets: Turret[];
  turn: 'player' | 'enemy' | 'won' | 'lost';
  turnCount: number;
  energy: number;
  deck: string[];
  hand: string[];
  discard: string[];
  scannedTurns: number;
  stasisNext: boolean;
}

export type CombatEvent =
  | { type: 'move'; unitId: string; path: GridPos[] }
  | { type: 'attack'; attackerId: string; targetId: string; from: GridPos; damage: number; rear: boolean; killed: boolean }
  | { type: 'damage'; unitId: string; amount: number; killed: boolean }
  | { type: 'status'; unitId: string; status: StatusId }
  | { type: 'tile'; key: string; kind: 'sanctify' }
  | { type: 'summon'; unitId: string; pos: GridPos }
  | { type: 'turnEnd'; turn: CombatState['turn'] };

export const MOVE_RANGE = 3;
export const ENERGY_PER_TURN = 3;
export const HAND_SIZE = 5;
export const HAZARD_DAMAGE = 2;
export const RAISE_RANGE_BONUS = 1;
export const SANCTIFIED_BONUS = 2;
export const PLAYER_MAX_HP = 30;
export const TURRET_CAP = 3;
export const TURRET_PLACE_RANGE = 2;
export const TURRET_RANGE = 3;
export const TURRET_DAMAGE = 2;

const REAR_MULTIPLIER = 1.5;
const CORRUPTED_DAMAGE = 2;

const FACING_DELTAS: ReadonlyArray<readonly [number, number]> = [
  [0, 1], [1, 0], [0, -1], [-1, 0],
];

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
    turrets: [],
    turn: 'player',
    turnCount: 1,
    energy: ENERGY_PER_TURN,
    deck: [...deck],
    hand: [],
    discard: [],
    scannedTurns: 0,
    stasisNext: false,
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
    turrets: state.turrets.map((t) => ({ id: t.id, pos: { ...t.pos } })),
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
  ) || state.turrets.some((t) => t.pos.x === pos.x && pos.y === pos.y);
}

export function isTileFree(state: CombatState, pos: GridPos): boolean {
  if (isBlocked(state.board, pos.x, pos.y)) return false;
  return !isOccupied(state, pos, 'none');
}

function tileAt(board: TileKind[][], pos: GridPos): TileKind | undefined {
  return board[pos.y]?.[pos.x];
}

export function castRange(state: CombatState, range: number): number {
  return range + (tileAt(state.board, state.player.pos) === 'raised' ? RAISED_RANGE_BONUS : 0);
}

function enemyStats(typeId: Fighter['typeId']): EnemyType {
  return ENEMY_TYPES[typeId as EnemyTypeId];
}

export function coneTiles(pos: GridPos, facing: Facing): GridPos[] {
  const [fx, fy] = FACING_DELTAS[facing]!;
  const ahead = { x: pos.x + fx, y: pos.y + fy };
  const sx = fx === 0 ? 1 : 0;
  const sy = fy === 0 ? 1: 0;
  return [
    ahead,
    { x: ahead.x + sx, y: ahead.y + sy },
    { x: ahead.x - sx, y: ahead.y - sy },
  ];
}

export function lineTiles(board: TileKind[][], from: GridPos, range: number): GridPos[] {
  const titles: GridPos[] = [];
  for (const [dx, dy] of FACING_DELTAS) {
    for (let i = 1; i <=range; i++) {
      const tile = { x: from.x + dx * i, y: from.y + dy * i };
      if (isBlocked(board, tile.x, tile.y)) break;
      tiles.push(tile);
    }
  }
  return tiles;
}

export function tilesWithin(center: GridPos, radius: number): GridPos[] {
  const tiles: GridPos[] = [];
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      tiles.push({ x: center.x + dx, y: center.y + dy });
    }
  }
  return tiles;
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

function drawOne(state: CombatState, rng: () => number): boolean {
  if (state.deck.length === 0) {
    if (state.deck.length === 0) return false;
    const reshuffled: string[] = [];
    while (state.discard.length > 0) {
      const index = Math.floor(rng() * state.discard.length);
      reshuffled.push(state.discard.splice(index, 1)[0]!);
    }
    state.deck = reshuffled;
  }
  const index = Math.floor(rng() * state.deck.length);
  state.hand.push(...state.deck.splice(index, 1));
  return true;
}

export function drawCards(state: CombatState, rng: () => number): CombatState {
  const next = cloneState(state);
  while (next.hand.length < HAND_SIZE && drawOne(next, rng)) {
  }
  return next;
}

export function castRite(
  state: CombatState,
  cardId: string,
  targetUnitId: string | null,
  targetTile: GridPos | null,
  rng: () => number = Math.random,
): { state: CombatState; events: CombatEvent[] } {
  if (state.turn !== 'player') return { state, events: [] };
  if (!state.hand.includes(cardId)) return { state, events: [] };
  const card = CARDS.find((c) => c.id === cardId);
  if (!card || state.energy < card.cost) return { state, events: [] };

  const applied = applyEffect(state, card, targetUnitId, targetTile, rng);
  if (!applied) return { state, events: [] };

  const next = applied.state;
  const handIndex = next.hand.indexOf(cardId);
  if (handIndex !== -1) {
    next.hand.splice(handIndex, 1);
    next.discard.push(cardId);
  }
  next.energy -= card.cost;
  if (card.hpCost) {
    next.player.hp = Math.max(0, next.player.hp - card.hpCost);
    applied.events.push({
      type: 'damage',
      unitId: 'player',
      amount: card.hpCost,
      killed: next.player.hp === 0,
    });
    if (next.player.hp === 0) next.turn = 'lost';
  }
  return {state: next, events: applied.events };
}

function applyEffect(
  state: CombatState,
  card: CardDef,
  targetUnitId: string | null,
  targetTile: GridPos | null,
  rng: () => number,
): { state: CombatState; events: CombatEvent[] } | null {
  const effect = card.effect;
  switch (effect.kind) {
    case 'damage': return applyDamageEffect(state, effect, targetUnitId, rng);
    case 'heal': {
      const next = cloneState(state);
      next.player.hp = Math.min(PLAYER_MAX_HP, next.player.hp + effect.amount);
      return { state: next, events: [] };
    }
    case 'armor': {
      const next = cloneState(state);
      next.player.armor += effect.amount;
      return { state: next, events: [] };
    }
    case 'energy': {
      const next = cloneState(state);
      next.energy += effect.amount;
      return { state: next, events: [] };
    }
    case 'draw': {
      const next = cloneState(state);
      for (let i = 0; i < effect.amount && drawOne(next, rng); i++) {
      }
      return { state: next, events: [] };
    }
    case 'scan': {
      const next = cloneState(state);
      next.scannedTurns = effect.turns;
      return { state: next, events: [] };
    }
    case 'sanctify': return applySanctify(state, effect, targetTile);
    case 'summonTurret': return applySummonTurret(state, targetTile);
    case 'pull': return applyPull(state, effect, targetUnitId);
    case 'stasis': {
      const next = cloneState(state);
      next.stasisNext = true;
      return { state: next, events: [] };
    }
    case 'moveStep': return applyMoveStep(state, targetTile);
  }
}

function applyDamageEffect(
  state: CombatState,
  effect: Extract<CardEffect, { kind: 'damage' }>,
  targetUnitId: string | null,
  rng: () => number,
): { state: CombatState; events: CombatEvent[] } | null {
  if (effect.shape === 'single') {
    const enemy = targetUnitId
      ? state.enemies.find((e) => e.id === targetUnitId && e.hp > 0)
      : undefined;
    if (!enemy) return null;
    if (chebyshev(state.player.pos, enemy.pos) > castRange(state, effect.range)) return null;
    if (effect.los && !losClear(state.board, state.player.pos, enemy.pos)) return null;
    return strike(state, enemy, effect, rng);
  }
  let cur = cloneState(state);
  const events: CombatEvent[] = [];
  for (const snapshot of state.enemies) {
    if (!inDamageShape(state, effect, snapshot.pos)) continue;
    const enemy = cur.enemies.find((e) => e.id === snapshot.id);
    if (!enemy || enemy.hp <= 0) continue;
    const result = strike(cur, enemy, effects, rng);
    cur = result.state;
    events.push(...result.events);
  }
  return {state: cur, events };
}

function inDamageShape(
  state: CombatState,
  effect: Extract<CardEffect, { kind: 'damage' }>,
  pos: GridPos,
): boolean {
  const player = state.player.pos;
  switch (effect.shape) {
    case 'single':
      return false;
    case 'line': {
      if (pos.x !== player.x && pos.y !== player.y) return false;
      if (chebyshev(player, pos) > castRange(state, effect.range)) return false;
      return losClear(state.board, player, pos);
    }
    case 'cone':
      return coneTiles(player, state.player.facing).some((t) => t.x === pos.x && t.y === pos.y);
    case 'arc1':
      return chebyshev(player, pos) === 1;
  }
}

function strike(
  cur: CombatState,
  enemy: Fighter,
  effect: Extract<CardEffect, { kind: 'damage' }>,
  rng: () => number,
): { state: CombatState; events: CombatEvent[] } {
  const result = resolveAttack(cur, cur.player, enemy, effect.amount, rng, {
    ignoreArmor: effect.ignoreArmor,
  });
  if (effect.corrupt) {
    const survivor = result.state.enemies.find((e) => e.id === enemy.id);
    if (survivor) {
      survivor.statuses.push('corrupted');
      result.events.push({ type: 'status', unitId: survivor.id, status: 'corrupted' });
    }
  }
  return result;
}

function applySanctify(
  state: CombatState,
  effect: Extract<CardEffect, { kind: 'sanctify' }>,
  targetTile: GridPos | null,
): { state: CombatState; events: CombatEvent[] } | null {
  let centers: GridPos[];
  if (effect.shape === 'tile') {
    if (!targetTile) return null;
    if (chebyshev(state.player.pos, targetTile) > castRange(state, effect.range)) return null;
    if (isBlocked(state.board, targetTile.x, targetTile.y)) return null;
    centers = [targetTile];
  } else {
    centers = tilesWithin(state.player.pos, effect.range);
  }
  const next = cloneState(state);
  const events: CombatEvent[] = [];
  for (const tile of centers) {
    if (isBlocked(state.board, tile.x, tile.y)) continue;
    const key = tileKey(tile.x, tile.y);
    if (next.sanctified.includes(key)) continue;
    next.sanctified.push(key);
    events.push({ type: 'tile', key, kind: 'sanctify' });
  }
  if (events.length === 0) return null;
  return { state: next, events };
}

function applySummonTurret(
  state: CombatState,
  targetTile: GridPos | null,
): { state: CombatState; events: CombatEvent[] } | null {
  if (!targetTile) return null;
  if (state.turrets.length >= TURRET_CAP) return null;
  if (chebyshev(state.player.pos, targetTile) > castRange(state, TURRET_PLACE_RANGE)) return null;
  if (!isTileFree(state, targetTile)) return null;
  const next = cloneState(state);
  const turret: Turret = { id: `turret-${next.turrets.length + 1}`, pos: { ...targetTile } };
  next.turrets.push(turret);
  return { state: next, events: [{ type: 'summon', unitId: turret.id, pos: { ...turret.pos } }] };
}

function applyPull(
  state: CombatState,
  effect: Extract<CardEffect, { kind: 'pull' }>,
  targetUnitId: string | null,
): { state: CombatState; events: CombatEvent[] } | null {
  const enemy = targetUnitId
    ? state.enemies.find((e) => e.id === targetUnitId && e.hp > 0)
    : undefined;
  if (!enemy) return null;
  if (chebyshev(state.player.pos, enemy.pos) > castRange(state, effect.range)) return null;
  if (!losClear(state.board, state.player.pos, enemy.pos)) return null;

  const next = cloneState(state);
  const pulled = next.enemies.find((e) => e.id === enemy.id)!;
  const dx = next.player.pos.x - pulled.pos.x;
  const dy = next.player.pos.y - pulled.pos.y;
  const step = Math.abs(dx) >= Math.abs(dy)
    ? { x: Math.sign(dx), y: 0 }
    : { x: 0, y: Math.sign(dy) };
  const dest = { x: pulled.pos.x + step.x, y: pulled.pos.y + step.y };
  if (!isTileFree(next, dest)) return { state: next, events: [] };
  pulled.facing = facingFromDelta(step.x, step.y);
  pulled.pos = dest;
  return { state: next, events: [{ type: 'move', unitId: pulled.id, path: [{ ...dest }] }] };
}

function applyMoveStep(
  state: CombatState,
  targetTile: GridPos | null,
): { state: CombatState; events: CombatEvent[] } | null {
  if (!targetTile) return null;
  if (chebyshev(state.player.pos, targetTile) !==1) return null;
  if (!isTileFree(state, targetTile)) return null;
  const next = cloneState(state);
  next.player.pos = {...targetTile };
  next.player.facing = facingFromDelta(targetTile.x - state.player.pos.x, targetTile.y - state.player.pos.y);
  return { state: next, events: [{ type: 'move', unitId: 'player', path: [{ ...targetTile }] }] };
}

export interface AttackOptions {
  ignoreArmor?: boolean;
}

export function resolveAttack(
  state: CombatState,
  attacker: Fighter,
  target: Fighter,
  base: number,
  rng: () => number = Math.random,
  opts: AttackingOptions = {},
): { state: CombatState; events: CombatEvent[] } {
  const next = cloneState(state);
  const attackerRef = findFighter(next, attacker.id);
  const targetRef = findFighter(next, target.id);
  if (!attackerRef || !targetRef || attackerRef.hp <= 0 || targetRef.hp <= 0) {
    return { state, events: [] };
  }

  let actualTarget = targetRef;
  if (attackerRef.statuses.includes('malfunctioning') && rng() < 0.5) {
    const allies = attackerRef.id === 'player'
      ? []
      : next.enemies.filter(
          (e) => e.id !== attackerRef.id && e.hp > 0 && chebyshev(e.pos, attackerRef.pos) === 1,
        );
    if (allies.length > 0) {
      actualTarget = allies[Math.floor(rng() * allies.length)]!;
    }
  }

  const rear = isRear(attackerRef.pos, actualTarget);
  let damage = Math.floor(base * (rear ? REAR_MULTIPLIER : 1));
  if (
    attackerRef.id === 'player'
    && next.sanctified.includes(tileKey(attackerRef.pos.x, attackerRef.pos.y))
  ) {
    damage += SANCTIFIED_BONUS;
  }
  const killed = applyWound(next, actualTarget, damage, opts.ignoreArmor ?? false);
  if (next.enemies.length === 0) {
    next.turn = 'won';
  }
  const events: CombatEvent[] = [{
    type: 'attack',
    attackerId: attackerRef.id,
    targetId: actualTarget.id,
    from: { ...attackerRef.pos },
    damage,
    rear,
    killed,
  }];
  return { state: next, events };
}

function applyWound(state: CombatState, target: Fighter, damage: number, ignoreArmor: boolean): boolean {
  const absorbed = ignoreArmor ? 0 : Math.min(target.armor, damage);
  target.armor -= absorbed;
  target.hp = Math.max(0, target.hp - (damage - absorbed));
  if (target.hp === 0 && target.id !== 'player') {
    state.enemies = state.enemies.filter((e) => e.id !== target.id);
  }
  return target.hp === 0;
}

function nearestTurretTarget(state: CombatState, from: GridPos): Fighter | null {
  let best: Fighter | null = null;
  for (const enemy of state.enemies) {
    if (enemy.hp <= 0) continue;
    if (chebyshev(enemy.pos, from) > TURRET_RANGE) continue;
    if (!losClear(state.board, from, enemy.pos)) continue;
    if (!best || betterCandidate(enemy.pos, best.pos, from) === enemy.pos) best = enemy;
  }
  return best;
}

export function endPlayerTurn(state: CombatState): { state: CombatState; events: CombatEvent[] } {
  if (state.turn !== 'player') return { state, events: [] };
  const next = cloneState(state);
  next.turn = 'enemy';
  next.discard.push(...next.hand);
  next.hand = [];
  const events: CombatEvent[] = [{ type: 'turnEnd', turn: 'enemy' }];

  if (tileAt(next.board, next.player.pos) === 'hazard') {
    next.player.hp = Math.max(0, next.player.hp - HAZARD_DAMAGE);
    events.push({ type: 'damage', unitId: next.player.id, amount: HAZARD_DAMAGE, killed: next.player.hp === 0 });
  }
  for (const fighter of [next.player, ...next.enemies]) {
    if (fighter.statuses.includes('corrupted')) {
      fighter.hp = Math.max(0, fighter.hp - CORRUPTED_DAMAGE);
      events.push({ type: 'damage', unitId: fighter.id, amount: CORRUPTED_DAMAGE, killed: fighter.hp === 0 });
    }
  }
  next.enemies = next.enemies.filter((e) => e.hp > 0);
  if (next.player.hp <= 0) {
    next.turn = 'lost';
  }
  return { state: next, events };
}

export function enemyTurn(
  state: CombatState,
  rng: () => number,
): { state: CombatState; events: CombatEvent[] } {
  if (state.turn !== 'enemy') return { state, events: [] };
  let cur = cloneState(state);
  const events: CombatEvent[] = [];
  const stasis = cur.stasisNext;
  cur.stasisNext = false;

  for (const snapshot of state.enemies) {
    const enemy = cur.enemies.find((e) => e.id === snapshot.id);
    if (!enemy || enemy.hp <= 0) continue;
    if (enemy.statuses.includes('scrambled')) {
      enemy.statuses = enemy.statuses.filter((s) => s !== 'scrambled');
      events.push({ type: 'status', unitId: enemy.id, status: 'scrambled'});
      continue;
    }
    const stats = enemyStats(enemy.typeId);
    const effStats = stasis
      ? { ...stats, moveRange: Math.max(1, stats.moveRange - 1) }
      : stats;
    const dist = chebyshev(enemy.pos, cur.player.pos);
    if (dist <= effStats.attackRange && (effStats.attackRange === 1 || losClear(cur.board, enemy.pos, cur.player.pos))) {
      const result = resolveAttack(cur, enemy, cur.player, effStats.attackDamage, rng);
      cur = result.state;
      events.push(...result.events);
    } else {
      const path = approach(cur, enemy, effStats);
      if (path.length > 0) {
        enemy.pos = path[path.length - 1]!;
        enemy.facing = facingFromDelta(cur.player.pos.x - enemy.pos.x, cur.player.pos.y - enemy.pos.y);
        events.push({ type: 'move', unitId: enemy.id, path });
      }
      if (tileAt(cur.board, enemy.pos) === 'hazard') {
        enemy.hp = Math.max(0, enemy.hp - HAZARD_DAMAGE);
        events.push({ type: 'damage', unitId: enemy.id, amount: HAZARD_DAMAGE, killed: enemy.hp === 0 });
        if (enemy.hp === 0) {
          cur.enemies = cur.enemies.filter((e) => e.id !== enemy.id);
        }
      }
    }
    if (cur.player.hp <= 0 || cur.enemies.length === 0) break;
  }

  if (cur.player.hp > 0) {
    for (const turret of cur.turrets) {
      const target = nearestTurretTarget(cur, turret.pos);
      if (!target) continue;
      const next = cloneState(cur);
      const victim = next.enemies.find((e) => e.id === target.id)!;
      const killed = applyWound(next, victim, TURRET_DAMAGE, false);
      events.push({
        type: 'attack',
        attackerId: turret.id,
        targetId: victim.id,
        from: { ...turret.pos },
        damage: TURRET_DAMAGE,
        rear: false,
        killed,
      });
      cur = next;
      if (cur.enemies.length === 0) break;
    }
  }

  if (cur.player.hp <= 0) {
    cur.turn = 'lost';
  } else if (cur.enemies.length === 0) {
    cur.turn = 'won';
  } else {
    cur.turn = 'player';
    cur.turnCount += 1;
    cur.energy = ENERGY_PER_TURN;
    cur.player.armor = 0;
    cur.scannedTurns = Math.max(0, cur.scannedTurns - 1);
  }
  return { state: cur, events };
}

function approach(cur: CombatState, enemy: Fighter, stats: EnemyType): GridPos[] {
  const path: GridPos[] = [];
  let pos = enemy.pos;
  for (let step = 0; step < stats.moveRange; step++) {
    if (inAttackPosition(cur, pos, stats)) break;
    const candidate = greedyStep(cur, enemy.id, pos, cur.player.pos);
    if (!candidate || (candidate.x === pos.x && candidate.y === pos.y)) break;
    path.push(candidate);
    pos = candidate;
  }
  return path;
}

function inAttackPosition(cur: CombatState, pos: GridPos, stats: EnemyType): boolean {
  if (chebyshev(pos, cur.player.pos) > stats.attackRange) return false;
  return stats.attackRange === 1 || losClear(cur.board, pos, cur.player.pos);
}

function greedyStep(cur: CombatState, selfId: string, from: GridPos, playerPos: GridPos): GridPos | null {
  let best: GridPos = { ...from };
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const q = { x: from.x + dx, y: from.y + dy };
      if (isBlocked(cur.board, q.x, q.y) || isOccupied(cur, q, selfId)) continue;
      best = betterCandidate(best, q, playerPos);
    }
  }
  return best;
}

function betterCandidate(a: GridPos, b: GridPos, playerPos: GridPos): GridPos {
  const da = chebyshev(a, playerPos);
  const db = chebyshev(b, playerPos);
  if (da !== db) return da < db ? a : b;
  if (a.y !== b.y) return a.y < b.y ? a : b;
  return a.x < b.x ? a: b;1
}

export function threatFor(state: CombatState, enemy: Fighter): Set<string> {
  const stats = enemyStats(enemy.typeId);
  const moveRange = state.stasisNext ? Math.max(1, stats.moveRange - 1) : stats.moveRange;
  const occupied = [state.player, ...state.enemies.filter((e) => e.id !== enemy.id)]
  .filter((f) => f.hp >0)
  .map((f) => f.pos);
  const threat = new Set<string>();
  for (const source of reach(state.board, enemy.pos, stats.moveRange, occupied)) {
    for (let dy = -stats.attackRange; dy <= stats.attackRange; dy++) {
      for (let dx = -stats.attackRange; dx <= stats.attackRange; dx++) {
        const tile = { x: source.x + dx, y: source.y + dy };
        if (isBlocked(state.board, tile.x, tile.y)) continue;
        if (stats.attackRange > 1 && !losClear(state.board, source, tile)) continue;
        threat.add(tileKey(tile.x, tile.y));
      }
    }
  }
  return threat;
}

export function computeAllThreat(state: CombatState): Set<string> {
  const threat = new Set<string>();
  for (const enemy of state.enemies) {
    for (const key of threatFor(state, enemy)) threat.add(key);
  }
  return threat;
}