import { PLAYER_MAX_HP, facingFromDelta, type CombatEvent, type CombatState, type Fighter } from './combat';
import { ENEMY_TYPES, type EnemyTypeId } from './enemies';
import { BONE, BRASS, DEEP_RED, NEAR_BLACK, SIGNAL_GREEN } from './palette';
import { PRIEST_FOOT_OFFSET, TURRET_FOOT_OFFSET, tileFoot, type FloaterView, type GlowView, type ProjectileView, type UnitView } from './render';
import type { GridPos, ScreenPos } from './projection';
import type { TileKind } from './board';
import type { Facing, UnitTypeId } from './units';

export const PLAYER_STEP_SECONDS = 0.25;
const ENEMY_STEP_SECONDS = 0.15;
const PUSH_SECONDS = 0.15;
const STRIKE_SECONDS = 0.2;
const DAMAGE_HOLD_SECONDS = 0.35;
const PROJECTILE_SECONDS = 0.15;
const HIT_FLASH_SECONDS = 0.1;
const FADE_SECONDS = 0.2;
const GLOW_SECONDS = 0.3;
const RING_SECONDS = 0.25;
const FLOAT_SECONDS = 0.8;
const FLOAT_STAGGER_PX = 14;
const LUNGE_PX = 6;
const FLOAT_LIFT = 30;
const MUZZLE_LIFT = 40;
const IMPACT_LIFT = 12;

export interface EffectsView {
  floaters: FloaterView[];
  projectile: ProjectileView | null;
  ring: {grid: GridPos; age: number } | null;
  glows: GlowView[];
}

export function nextFloaterPos(pos: ScreenPos, existing: FloaterView[]): ScreenPos {
  const crowd = existing.filter(
    (f) => Math.abs(f.pos.x - pos.x) < 20 && Math.abs(f.pos.y - pos.y) < 20,
  ).length;
  return { x: pos.x + crowd * FLOAT_STAGGER_PX, y: pos.y };
}

export interface PlayOptions {
  projectile?: boolean;
  ring: boolean;
  priestGlowColor?: string;
}

interface Anim {
  typeId: UnitTypeId;
  grid: GridPos;
  facing: Facing;
  hpRatio: number,
  phase: number;
  moving: boolean;
  flashTimer: number;
  alpha: number;
  fading: boolean;
  birth: boolean;
  lunge: ScreenPos;
  walk: { path: GridPos[]; index: number; timer: number; stepTime: number } | null;
}

interface StrikeInit {
  dir: ScreenPos;
  targetFoot: ScreenPos;
}

type Seg =
  | { kind: 'walk'; anim: Anim }
  | {
      kind: 'strike';
      anim: Anim;
      targetAnim: Anim;
      targetId: string;
      damage: number;
      killed: boolean;
      shot: boolean;
      timer: number;
      hit: boolean;
      init: StrikeInit | null;
    }
  | { kind: 'damage'; anim: Anim; unitId: string; amount: number; killed: boolean; timer: number; hit: boolean }
  | { kind: 'spawn'; unitId: string; puff: boolean; timer: number }
  | { kind: 'pause'; timer: number; duration: number };

function maxHpOf(fighter: Fighter): number {
  return fighter.id === 'player' ? PLAYER_MAX_HP : ENEMY_TYPES[fighter.typeId as EnemyTypeId].maxHp;
}

function footOf(board: TileKind[][], anim: Anim): ScreenPos {
  const offset = anim.typeId === 'techpriest'
  ? PRIEST_FOOT_OFFSET
  : anim.typeId === 'turret'
    ? TURRET_FOOT_OFFSET
    : ENEMY_TYPES[anim.typeId as EnemyTypeId].footOffset;
  return tileFoot(board, anim.grid, offset);
}

export class Presenter {
  private anims = new Map<string, Anim>();
  private segs: Seg[] = [];
  private floaters: FloaterView[] = [];
  private projectile: ProjectileView | null = null;
  private glows: GlowView[] = [];
  private ring: { grid: GridPos; age: number } | null = null;
  private time = 0;
  private finalHp = new Map<string, number>();
  private onDone: (() => void) | null = null;

  get busy(): boolean {
    return this.segs.length > 0;
  }

  reset(state: CombatState): void {
    this.anims.clear();
    this.segs = [];
    this.floaters = [];
    this.projectile = null;
    this.glows = [];
    this.ring = null;
    this.onDone = null;
    this.snap(state);
  }

  snap(state: CombatState): void {
    this.syncTurrets(state);
    for (const fighter of [state.player, ...state.enemies]) {
      const existing = this.anims.get(fighter.id);
      const typeId: UnitTypeId = fighter.id === 'player' ? 'techpriest' : fighter.typeId;
      if (existing) {
        existing.grid = { ...fighter.pos };
        existing.facing = fighter.facing;
        existing.hpRatio = fighter.hp / maxHpOf(fighter);
        existing.moving = false;
        existing.walk = null;
        existing.lunge = { x: 0, y: 0 };
      } else {
        this.anims.set(fighter.id, {
          typeId,
          grid: { ...fighter.pos },
          facing: fighter.facing,
          hpRatio: fighter.hp / maxHpOf(fighter),
          phase: Math.random(),
          moving: false,
          flashTimer: 0,
          alpha: 1,
          fading: false,
          birth: false,
          lunge: { x: 0, y: 0 },
          walk: null,
        });
      }
    }
  }

  play(events: CombatEvent[], final: CombatState, opts: PlayOptions, onDone: () => void): void {
    this.onDone = onDone;
    this.finalHp = new Map(
      [final.player, ...final.enemies].map((f) => [f.id, f.hp / maxHpOf(f)]),
    );
    this.syncTurrets(final);
    const segs: Seg[] = [];
    if (opts.priestGlowColor) {
      this.addGlow('player', opts.priestGlowColor);
      segs.push({ kind: 'pause', timer: 0, duration: GLOW_SECONDS });
    }
    if (opts.ring) {
      this.ring = { grid: { ...final.player.pos }, age: 0 };
    }
    for (const event of events) {
      if (event.type === 'move') {
        const anim = this.anims.get(event.unitId);
        if (!anim || event.path.length === 0) continue;
        anim.walk = {
          path: event.path.map((p) => ({ ...p })),
          index: 0,
          timer: 0,
          stepTime: event.unitId === 'player' ? PLAYER_STEP_SECONDS : ENEMY_STEP_SECONDS,
        };
        anim.moving = true;
        segs.push({ kind: 'walk', anim });
      } else if (event.type === 'attack') {
        const attacker = this.anims.get(event.attackerId);
        const target = this.anims.get(event.targetId);
        if (!attacker || !target) continue;
        segs.push({
          kind: 'strike',
          anim: attacker,
          targetAnim: target,
          targetId: event.targetId,
          damage: event.damage,
          killed: event.killed,
          shot: opts.projectile === true || attacker.typeId === 'turret',
          timer: 0,
          hit: false,
          init: null,
        });
      } else if (event.type === 'summon') {
        this.glows.push({ grid: { ...event.pos }, color: BRASS, age: 0 });
      } else if (event.type === 'damage') {
        const anim = this.anims.get(event.unitId);
        if (!anim) continue;
        segs.push({
          kind: 'damage',
          anim,
          unitId: event.unitId,
          amount: event.amount,
          killed: event.killed,
          timer: 0,
          hit: false,
        });
      } else if (event.type === 'spawn') {
        const fighter = final.enemies.find((f) => f.id === event.unitId);
        if (!fighter) continue;
        this.anims.set(event.unitId, {
          typeId: fighter.typeId,
          grid: { ...event.pos },
          facing: fighter.facing,
          hpRatio: 1,
          phase: 0,
          moving: false,
          flashTimer: 0,
          alpha: 0,
          fading: false,
          birth: false,
          lunge: { x: 0, y: 0 },
          walk: null,
        });
        segs.push({ kind: 'spawn', unitId: event.unitId, puff: false, timer: 0 });
      } else if (event.type === 'push') {
        const anim = this.anims.get(event.unitId);
        if (!anim) continue;
        anim.walk = { path: [{ ...event.to }], index: 0, timer: 0, stepTime: PUSH_SECONDS };
        anim.moving = true;
        segs.push({ kind: 'walk', anim });
      }
    }
    this.segs = segs;
    if (this.segs.length === 0) {
      const done = this.onDone;
      this.onDone = null;
      done?.();
    }
  }

  update(dt: number, board: TileKind[][]): void {
    this.time += dt;
    for (const anim of this.anims.values()) {
      if (anim.flashTimer > 0) anim.flashTimer = Math.max(0, anim.flashTimer - dt);
      if (anim.fading) {
        anim.alpha = Math.max(0, anim.alpha - dt / FADE_SECONDS);
      } else if (anim.birth) {
        anim.alpha = Math.min(1, anim.alpha + dt / FADE_SECONDS);
        if (anim.alpha >= 1) anim.birth = false;
      } else if (!anim.walk) {
        anim.phase = (anim.phase + dt * 0.6) % 1;
      }
    }
    for (const [id, anim] of this.anims) {
      if (anim.fading && anim.alpha <= 0) this.anims.delete(id);
    }
    this.floaters = this.floaters.filter((f) => (f.age += dt / FLOAT_SECONDS) < 1);
    if (this.projectile) {
      this.projectile.t += dt / PROJECTILE_SECONDS;
      if (this.projectile.t >= 1) this.projectile = null;
    }
    this.glows = this.glows.filter((g) => (g.age += dt / GLOW_SECONDS) < 1);
    if (this.ring && (this.ring.age += dt / RING_SECONDS) >= 1) this.ring = null;
    if (this.segs.length > 0) this.advanceSegs(dt, board);
  }

  unitViews(state: CombatState, scanned: boolean): UnitView[] {
    const live = new Set([
      state.player.id,
      ...state.enemies.map((e) => e.id),
      ...state.turrets.map((t) => t.id),
    ]);
    for (const [id, anim] of this.anims) {
      if (!live.has(id) && !(anim.fading && anim.alpha > 0)) this.anims.delete(id);
    }
    const views: UnitView[] = [];
    for (const [id, anim] of this.anims) {
      if (anim.typeId === 'turret') continue;
      const foot = footOf(state.board, anim);
      views.push({
        id,
        typeId: anim.typeId,
        foot: { x: foot.x + anim.lunge.x, y: foot.y + anim.lunge.y },
        facing: anim.facing,
        phase: anim.typeId === 'techpriest'
          ? anim.phase
          : (this.time * 0.5 + anim.grid.x * 0.37 + anim.grid.y * 0.53) % 1,
        moving: anim.moving,
        hpRatio: anim.hpRatio,
        label: scanned && anim.typeId !== 'techpriest'
          ? ENEMY_TYPES[anim.typeId as EnemyTypeId].name
          : null,
        showHpBar: anim.typeId !== 'techpriest' && (anim.hpRatio < 1 || scanned),
        flash: anim.flashTimer / HIT_FLASH_SECONDS,
        alpha: anim.alpha,
        tint: state.stasisNext && anim.typeId !== 'techpriest' ? 1 : undefined,
      });
    }
    return views;
  }

  effects(): EffectsView {
    return { floaters: this.floaters, projectile: this.projectile, ring: this.ring, glows: this.glows };
  }

  private addGlow(unitId: string, color: string): void{
    const anim = this.anims.get(unitId);
    if (!anim) return;
    this.glows.push({ grid: { ...anim.grid }, color, age: 0 });
  }
  
  private addFloater(pos: ScreenPos, damage: number, onPlayer: boolean): void {
    this.floaters.push({
      pos: nextFloaterPos(pos, this.floaters),
      text: String(damage),
      color: onPlayer ? DEEP_RED : BONE,
      outline: onPlayer ? BONE : NEAR_BLACK,
      age: 0,
    });
  }

  private syncTurrets(state: CombatState): void {
    const live = new Set(state.turrets.map((t) => t.id));
    for (const turret of state.turrets) {
      const existing = this.anims.get(turret.id);
      if (existing) {
        existing.grid = { ...turret.pos };
        continue;
      }
      this.anims.set(turret.id, {
        typeId: 'turret',
        grid: { ...turret.pos },
        facing: 0,
        hpRatio: 1,
        phase: 0,
        moving: false,
        flashTimer: 0,
        alpha: 1,
        fading: false,
        birth: false,
        lunge: { x: 0, y: 0 },
        walk: null,
      });
    }
    for (const id of [...this.anims.keys()]) {
      if (id.startsWith('turret-') && !live.has(id)) this.anims.delete(id);
    }
  }

  private advanceWalk(anim: Anim, dt: number): void {
    const walk = anim.walk;
    if (!walk) return;
    walk.timer += dt;
    while (walk.timer >= walk.stepTime && walk.index < walk.path.length) {
      walk.timer -= walk.stepTime;
      const to = walk.path[walk.index]!;
      anim.facing = facingFromDelta(to.x - anim.grid.x, to.y - anim.grid.y);
      anim.grid = to;
      walk.index += 1;
    }
    if (walk.index >= walk.path.length) {
      anim.moving = false;
      anim.walk = null;
      anim.phase = 0;
    } else {
      anim.phase = walk.timer / walk.stepTime;
    }
  }

  private initStrike(seg: Extract<Seg, { kind: 'strike' }>, board: TileKind[][]): void {
    const attackerFoot = footOf(board, seg.anim);
    const targetFoot = footOf(board, seg.targetAnim);
    const dx = targetFoot.x - attackerFoot.x;
    const dy = targetFoot.y - attackerFoot.y;
    const len = Math.hypot(dx, dy) || 1;
    seg.init = { dir: { x: (dx / len) * LUNGE_PX, y: (dy / len) * LUNGE_PX }, targetFoot };
    seg.anim.facing = facingFromDelta(
      seg.targetAnim.grid.x - seg.anim.grid.x,
      seg.targetAnim.grid.y - seg.anim.grid.x,
    );
    if (seg.shot) {
      this.projectile = {
        from: { x: attackerFoot.x, y: attackerFoot.y - MUZZLE_LIFT },
        to: { x: targetFoot.x, y: targetFoot.y - IMPACT_LIFT },
        t: 0,
      };
    }
  }

  private applyHit(seg: Extract<Seg, { kind: 'strike' }>): void {
    seg.hit = true;
    const target = seg.targetAnim;
    const onPlayer = seg.targetId === 'player';
    if (onPlayer) {
      this.addGlow('player', BONE);
    } else {
      target.flashTimer = HIT_FLASH_SECONDS;
    }
    target.hpRatio = this.finalHp.get(seg.targetId) ?? 0;
    this.addFloater(
      { x: seg.init!.targetFoot.x, y: seg.init!.targetFoot.y - FLOAT_LIFT },
      seg.damage,
      onPlayer,
    );
    if (seg.killed && !onPlayer) {
      target.fading = true;
    }
  }

  private applyDamage(seg: Extract<Seg, { kind: 'damage' }>, board: TileKind[][]): void {
    const anim = seg.anim;
    const onPlayer = seg.unitId === 'player';
    if (onPlayer) {
      this.addGlow('player', BONE);
    } else {
      anim.flashTimer = HIT_FLASH_SECONDS;
    }
    anim.hpRatio = this.finalHp.get(seg.unitId) ?? anim.hpRatio;
    const foot = footOf(board, anim);
    this.addFloater({ x: foot.x, y: foot.y - FLOAT_LIFT }, seg.amount, onPlayer);
    if (seg.killed && !onPlayer) {
      anim.fading = true;
    }
  }

  private advanceSegs(dt: number, board: TileKind[][]): void {
    const seg = this.segs[0]!;
    if (seg.kind === 'walk') {
      if (!seg.anim.walk) this.segs.shift();
      else this.advanceWalk(seg.anim, dt);
    } else if (seg.kind === 'strike') {
      if (!seg.init) this.initStrike(seg, board);
      seg.timer += dt;
      if (!seg.shot) {
        const t = Math.min(1, seg.timer / STRIKE_SECONDS);
        const swing = Math.sin(Math.PI * t);
        seg.anim.lunge = { x: seg.init!.dir.x * swing, y: seg.init!.dir.y * swing };
        if (!seg.hit && t >= 0.5) this.applyHit(seg);
      } else if (!seg.hit && seg.timer >= PROJECTILE_SECONDS) {
        this.applyHit(seg);
      }
      const base = seg.shot ? PROJECTILE_SECONDS + 0.1 : STRIKE_SECONDS;
      if (seg.timer >= base + (seg.killed ? FADE_SECONDS : 0)) {
        seg.anim.lunge = { x: 0, y: 0 };
        this.segs.shift();
      }
    } else if (seg.kind === 'damage') {
      seg.timer += dt;
      if(!seg.hit) {
        seg.hit = true;
        this.applyDamage(seg, board);
      }
      const hold = seg.killed && seg.unitId !== 'player' ? FADE_SECONDS : DAMAGE_HOLD_SECONDS;
      if (seg.timer >= hold) this.segs.shift();
    } else if (seg.kind === 'spawn') {
      seg.timer += dt;
      if (!seg.puff) {
        seg.puff = true;
        const anim = this.anims.get(seg.unitId);
        if (anim) anim.birth = true;
        const grid = anim ? anim.grid : null;
        if (grid) this.glows.push({ grid: { ...grid }, color: SIGNAL_GREEN, age: 0 });
      }
      if (seg.timer >= FADE_SECONDS) this.segs.shift();
    } else {
      seg.timer = dt;
      if (seg.timer >= seg.duration) this.segs.shift();
    }
    if (this.segs.length === 0 && this.onDone) {
      const done = this.onDone;
      this.onDone = null;
      done();
    }
  }
}