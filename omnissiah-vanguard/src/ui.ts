import type {CardDef} from './cards';

export function setEnergy(current: number, max: number): void {
	const el = document.getElementById('energy');
	if (!el) throw new Error('missing #energy element');
  el.textContent = `ENERGY ${current}/${max}`;
}

export function renderHand(
	cards: CardDef [],
	canvas: HTMLCanvasElement,
	onDrop: (canvasX: number, canvasY: number) => void,
): void {
	const hand = document.getElementById('hand');
	if (!hand) throw new Error('missing #hand element');
	for (const card of cards) {
		const el = document.createElement('div');
		el.className = 'card';
		el.innerHTML = 
      `<span class="cost">${card.cost}</span>` +
      `<span class="name">${card.name}</span>` +
      `<span class="kind">${card.kind}</span>` +
      `<p class="blurb">${card.blurb}</p>`;
    hand.appendChild(el);
    attachDrag(el, canvas, onDrop);
	}
}

function attachDrag(
  el: HTMLElement,
  canvas: HTMLCanvasElement,
  onDrop: (canvasX: number, canvasY: number) => void,
): void {
  let ghost: HTMLElement | null = null;

  const placeGhost = (ev: PointerEvent) => {
    if (!ghost) return;
    ghost.style.left = `${ev.clientX + 10}px`;
    ghost.style.top = `${ev.clientY + 10}px`;
  };

  const cleanup = () => {
    el.removeEventListener('pointermove', placeGhost);
    el.removeEventListener('pointerup', finish);
    el.removeEventListener('pointercancel', cleanup);
    el.classList.remove('lifted');
    ghost?.remove();
    ghost = null;
  };

	const finish = (ev: PointerEvent) => {
		const overCanvas = document.elementFromPoint(ev.clientX, ev.clientY) === canvas;
		cleanup();
		if (overCanvas) {
			const rect = canvas.getBoundingClientRect();
			onDrop(ev.clientX - rect.left, ev.clientY - rect.top);
		}
	};

	el.addEventListener('pointerdown', (ev) => {
		if (ev.button !== 0) return;
		ev.preventDefault();
		el.setPointerCapture(ev.pointerId);
		el.classList.add('lifted');
		ghost = el.cloneNode(true) as HTMLElement;
		ghost.className = 'card ghost';
		document.body.appendChild(ghost);
		placeGhost(ev);
    el.addEventListener('pointermove', placeGhost);
    el.addEventListener('pointerup', finish);
    el.addEventListener('pointercancel', cleanup);
  });
}