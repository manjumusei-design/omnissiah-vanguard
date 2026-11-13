import { CARDS, type CardDef, type CardKind } from './cards';
import { DOCTRINES, type DoctrineId } from './run';

const DRAG_THRESHOLD_PX = 6;
const INTEGRITY_SEGMENTS = 10;
const KIND_ORDER: CardKind[] = ['Rite', 'Benediction', 'Ritual', 'Protocol'];
const ART_ROOT = '/art/processed/';

export interface HandHandlers {
  onLift(cardId: string): void;
  onLand(cardId: string): void;
  onDrop(cardId: string, canvasX: number, canvasY: number): void;
  onSelect(cardId: string): void;
}

export function energyLabel(current: number, max: number): string {
  if (current > max) return `ENERGY ${current} (+${current - max})`;
  return `ENERGY ${current}/${max}`;
}

export interface EnergyPips {
  lit: number;
  dimmed: number;
  bonus: number;
}

export function energyPips(current: number, max: number): EnergyPips {
  const lit = Math.min(current, max);
  return { lit, dimmed: max - lit, bonus: Math.max(0, current - max) };
}

export function integritySegments(hp: number, max: number): number {
  if (max <= 0) return 0;
  const filled = Math.ceil((hp / max) * INTEGRITY_SEGMENTS);
  return Math.max(0, Math.min(INTEGRITY_SEGMENTS, filled));
}

export function armorLabel(armor: number): string {
  return armor > 0 ? `+${armor}` : '';
}

export function doctrineOf(cardId: string): DoctrineId | null {
  return DOCTRINES[cardId] ?? null;
}

const DOCTRINE_COLOR_VARS: Record<DoctrineId, string> = {
  sanctifier: 'var(--deep-red)',
  'lash-dancer': 'var(--rust)',
  warden: 'var(--tomb-teal)',
  skirmisher: 'var(--signal-green)',
};

export function doctrineColor(doctrine: DoctrineId | null): string {
  return doctrine ? DOCTRINE_COLOR_VARS[doctrine] : 'var(--ash-gray)';
}

export function setEnergy(current: number, max: number): void {
  const el = requireElement('energy');
  const pips = energyPips(current, max);
  let markup = '';
  for (let i = 0; i < pips.lit; i++) markup += '<i class="pip lit"></i>';
  for (let i = 0; i < pips.dimmed; i++) markup += '<i class="pip spent"></i>';
  for (let i = 0; i < pips.bonus; i++) markup += '<i class="pip bonus"></i>';
  el.innerHTML = markup;
  el.setAttribute('aria-label', energyLabel(current, max));
  el.setAttribute('title', energyLabel(current, max));
}

export function flashEnergy(): void {
  const el = requireElement('energy');
  el.classList.remove('flash');
  void el.offsetWidth;
  el.classList.add('flash');
}

export function setIntegrity(hp: number, max: number, armor: number): void {
  const filled = integritySegments(hp, max);
  let segments = '';
  for (let i = 0; i < INTEGRITY_SEGMENTS; i++) {
    segments += `<i class="seg${i < filled ? ' filled' : ''}"></i>`;
  }
  requireElement('integrity').innerHTML =
    `<span class="bar">${segments}</span>` +
    `<span class="value">${hp}/${max}</span>` +
    (armor > 0 ? `<span class="armor">${armorLabel(armor)}</span>` : '');
}

export function setMessage(text: string): void {
  requireElement('msg').textContent = text;
}

function cardMarkup(card: CardDef, kindLabel: string): string {
  return (
    `<span class="art" style="background-image:url('${ART_ROOT}card-${card.id}.png')"></span>` +
    `<span class="name">${card.name}</span>` +
    `<span class="kind">${kindLabel}</span>` +
    `<span class="cost">${card.cost}</span>` +
    (card.hpCost ? `<span class="hpcost">${card.hpCost} HP</span>` : '') +
    `<p class="blurb">${card.blurb}</p>`
  );
}

function tipMarkup(card: CardDef, kindLabel: string): string {
  return (
    `<span class="tip-name">${card.name}</span>` +
    `<span class="tip-cost">${card.cost}${card.hpCost ? ` +${card.hpCost} HP` : ''}</span>` +
    `<span class="tip-kind">${kindLabel}</span>` +
    `<p class="tip-blurb">${card.blurb}</p>`
  );
}

export function setHand(
  cards: CardDef[],
  energy: number,
  selectedId: string | null,
  canvas: HTMLCanvasElement,
  handlers: HandHandlers,
): void {
  const hand = requireElement('hand');
  hand.textContent = '';
  hideTip();
  for (const card of cards) {
    const el = document.createElement('div');
    el.className =
      'card' +
      (card.id === selectedId ? ' selected' : '') +
      (card.cost > energy ? ' dead' : '');
    el.innerHTML = cardMarkup(card, card.kind);
    el.style.setProperty('--doctrine-color', doctrineColor(doctrineOf(card.id)));
    hand.appendChild(el);
    attachCard(el, card.id, canvas, handlers);
    attachTip(el, card, card.kind);
  }
}

export interface RewardChoice {
  card: CardDef;
  doctrine: string | null;
}

export interface RewardHandlers {
  onTake(cardId: string): void;
  onDecline(): void;
}

export function setDeckLabel(size: number, cap: number): void {
  requireElement('reward-deck').textContent = `DECK ${size}/${cap}`;
}

export function setRewardCards(choices: RewardChoice[], handlers: RewardHandlers): void {
  const host = requireElement('reward-cards');
  host.textContent = '';
  for (const choice of choices) {
    const kindLabel = choice.doctrine ? choice.doctrine.toUpperCase() : choice.card.kind;
    const el = document.createElement('div');
    el.className = 'card reward';
    el.innerHTML = cardMarkup(choice.card, kindLabel);
    el.style.setProperty(
      '--doctrine-color',
      doctrineColor(doctrineOf(choice.card.id) ?? (choice.doctrine as DoctrineId | null)),
    );
    const take = document.createElement('button');
    take.type = 'button';
    take.textContent = 'TAKE';
    take.addEventListener('click', () => handlers.onTake(choice.card.id));
    el.appendChild(take);
    attachTip(el, choice.card, kindLabel);
    host.appendChild(el);
  }
}

export interface DeckEntry {
  name: string;
  count: number;
}

export interface DeckGroup {
  kind: CardKind;
  entries: DeckEntry[];
}

export function deckGroups(deck: string[], defs: CardDef[]): DeckGroup[] {
  const counts = new Map<string, number>();
  for (const id of deck) counts.set(id, (counts.get(id) ?? 0) + 1);
  return KIND_ORDER.map((kind) => ({
    kind,
    entries: defs
      .filter((def) => def.kind === kind && counts.has(def.id))
      .map((def) => ({ name: def.name, count: counts.get(def.id)! })),
  })).filter((group) => group.entries.length > 0);
}

export function setDeckViewer(deck: string[]): void {
  const groups = deckGroups(deck, CARDS);
  const markup = groups
    .map(
      (group) =>
        `<p class="deck-kind">${group.kind.toUpperCase()}</p>` +
        group.entries
          .map((entry) => `<p class="deck-entry">${entry.name}${entry.count > 1 ? ` x${entry.count}` : ''}</p>`)
          .join(''),
    )
    .join('');
  requireElement('deck-viewer-list').innerHTML = markup;
}

export function showDeckViewer(show: boolean): void {
  requireElement('deck-viewer').classList.toggle('hidden', !show);
}

function requireElement(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id} element`);
  return el;
}

const tip = () => requireElement('card-tip');

function showTip(el: HTMLElement, card: CardDef, kindLabel: string): void {
  const tipEl = tip();
  tipEl.innerHTML = tipMarkup(card, kindLabel);
  tipEl.classList.remove('hidden');
  const cardRect = el.getBoundingClientRect();
  const tipRect = tipEl.getBoundingClientRect();
  const left = Math.max(4, cardRect.left + cardRect.width / 2 - tipRect.width / 2);
  tipEl.style.left = `${Math.min(left, window.innerWidth - tipRect.width - 4)}px`;
  tipEl.style.top = `${Math.max(4, cardRect.top - tipRect.height - 8)}px`;
}

function hideTip(): void {
  tip().classList.add('hidden');
}

function attachTip(el: HTMLElement, card: CardDef, kindLabel: string): void {
  el.addEventListener('pointerenter', () => showTip(el, card, kindLabel));
  el.addEventListener('pointerleave', hideTip);
}

function attachCard(
  el: HTMLElement,
  cardId: string,
  canvas: HTMLCanvasElement,
  handlers: HandHandlers,
): void {
  let ghost: HTMLElement | null = null;
  let startX = 0;
  let startY = 0;
  let lifted = false;

  const placeGhost = (ev: PointerEvent) => {
    if (!ghost) return;
    ghost.style.left = `${ev.clientX + 10}px`;
    ghost.style.top = `${ev.clientY + 10}px`;
  };

  const cleanup = () => {
    el.removeEventListener('pointermove', onMove);
    el.removeEventListener('pointerup', onUp);
    el.removeEventListener('pointercancel', onCancel);
    if (lifted) {
      el.classList.remove('lifted');
      handlers.onLand(cardId);
    }
    ghost?.remove();
    ghost = null;
    lifted = false;
  };

  const onMove = (ev: PointerEvent) => {
    if (!lifted) {
      if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < DRAG_THRESHOLD_PX) return;
      lifted = true;
      el.classList.add('lifted');
      hideTip();
      ghost = el.cloneNode(true) as HTMLElement;
      ghost.className = 'card ghost';
      document.body.appendChild(ghost);
      handlers.onLift(cardId);
    }
    placeGhost(ev);
  };

  const onUp = (ev: PointerEvent) => {
    const wasLifted = lifted;
    cleanup();
    if (wasLifted) {
      if (document.elementFromPoint(ev.clientX, ev.clientY) === canvas) {
        const rect = canvas.getBoundingClientRect();
        handlers.onDrop(cardId, ev.clientX - rect.left, ev.clientY - rect.top);
      }
    } else {
      handlers.onSelect(cardId);
    }
  };

  const onCancel = () => cleanup();

  el.addEventListener('pointerdown', (ev) => {
    if (ev.button !== 0) return;
    ev.preventDefault();
    hideTip();
    el.setPointerCapture(ev.pointerId);
    startX = ev.clientX;
    startY = ev.clientY;
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onCancel);
  });
}
