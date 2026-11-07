import { PLAYER_MAX_HP, facingFromDelta, type CombatEvent, type CombatState, type Fighter } from './combat';
import { ENEMY_TYPES, type EnemyTypeId } from './enemies';
import { BONE, DEEP_RED, NEAR_BLACK } from './palette';
import { PRIEST_FOOT_OFFSET, tileFoot, type FloaterView, type GlowView, type ProjectileView, type UnitView } from './render';
import type { GridPos, ScreenPos } from './projection';
import type { TileKind } from './board';
import type { Facing, UnitTypeId } from './units';

export const PLAYER_STEP_SECONDS = 0.25;
const ENEMY_STEP_SECONDS = 0.15;
const STRIKE_SECONDS = 0.2;
const DAMAGE_HOLD_SECONDS = 0.35;
const PROJECTILE_SECONDS = 0.15;
const HIT_FLASH_SECONDS = 0.1;
const FADE_SECONDS = 0.2;
const GLOW_SECONDS = 0.3;
const RING_SECONDS = 0.25;
const FLOAT_SECONDS = 0.8;
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
  | { kind: 'pause'; timer: number; duration: number };

function maxHpOf(fighter: Fighter): number {
  return fighter.id === 'player' ? PLAYER_MAX_HP : ENEMY_TYPES[fighter.typeId as EnemyTypeId].maxHp;
}

function footOf(board: TileKind[][], anim: Anim): ScreenPos {
  const offset = anim.typeId === 'techpriest' ? PRIEST_FOOT_OFFSET : ENEMY_TYPES[anim.typeId as EnemyTypeId].footOffset;
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
          shot: opts.projectile ?? false,
          timer: 0,
          hit: false,
          init: null,
        });
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
    const live = new Set([state.player.id, ...state.enemies.map((e) => e.id)]);
    for (const [id, anim] of this.anims) {
      if (!live.has(id) && !(anim.fading && anim.alpha > 0)) this.anims.delete(id);
    }
    const views: UnitView[] = [];
    for (const [id, anim] of this.anims) {
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
    this.floaters.push({
      pos: { x: seg.init!.targetFoot.x, y: seg.init!.targetFoot.y - FLOAT_LIFT },
      text: String(seg.damage),
      color: onPlayer ? DEEP_RED : BONE,
      outline: onPlayer ? BONE : NEAR_BLACK,
      age: 0,
    });
    if (seg.killed && !onPlayer) {
      target.fading = true;
    }
  }