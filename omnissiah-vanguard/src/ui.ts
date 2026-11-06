import type {CardDef} from './cards';

const DRAG_THRESHOLD_PX = 6;

export interface HandHandlers {
	onLift(cardId: string): void;
	onLand(cardId: string): void;
  onDrop(cardId: string, canvasX: number, canvasY: number): void;
  onSelect(cardId: string): void;
}

export function setEnergy(current: number, max: number): void {
  requireElement('energy').textContent = `ENERGY ${current}/${max}`;
}

export function flashEnergy(): void {
  const el = requireElement('energy');
  el.classList.remove('flash');
  void el.offsetWidth;
  el.classList.add('flash');
}

export function setIntegrity(hp: number, max: number, armor: number): void {
  const suffix = armor > 0 ? ` +${armor}` : '';
  requireElement('integrity').textContent = `INTEGRITY ${hp}/${max}${suffix}`;
}

export function setMessage(text: string): void {
  requireElement('msg').textContent = text;
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
  for (const card of cards) {
    const el = document.createElement('div');
    el.className =
      'card' +
      (card.id === selectedId ? ' selected' : '') +
      (card.cost > energy ? ' dead' : '');
    el.innerHTML =
      `<span class="cost">${card.cost}</span>` +
      `<span class="name">${card.name}</span>` +
      `<span class="kind">${card.kind}</span>` +
      `<p class="blurb">${card.blurb}</p>`;
    hand.appendChild(el);
    attachCard(el, card.id, canvas, handlers);
  }
}

function requireElement(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id} element`);
  return el;
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
	let lifted= false;

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
		el.setPointerCapture(ev.pointerId);
		startX = ev.clientX;
		startY = ev.clientY;
		el.addEventListener('pointermove', onMove);
		el.addEventListener('pointerup', onUp);
		el.addEventListener('pointercancel', onCancel)''
  });
}