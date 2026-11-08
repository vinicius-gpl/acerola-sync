import gsap from 'gsap';
import type { Action } from 'svelte/action';
import { cn } from '$lib/utils/cn.utils';

type TrackedProp = 'x' | 'y' | 'width' | 'height';

export type SlidingIndicatorOptions = {
	/// Seletor (relativo ao container) do item atualmente ativo — lido via atributo, não via
	/// valor reativo (`aria-current="page"` na sidebar, `data-state="on"` no toggle group), pra
	/// action ficar pura DOM e não precisar de um `update()` amarrado a uma rune.
	selector: string;
	/// Classes do elemento indicador injetado — controla a aparência (pill atrás de um ícone,
	/// barra fina embaixo de uma aba). Propriedades de posição/tamanho que a classe já fixa via
	/// CSS (ex.: `bottom-0 h-1` numa barra) devem ficar de fora de `track` abaixo.
	indicatorClass: string;
	duration?: number;
	/// Quais propriedades da caixa do item ativo espelhar no indicador — o resto fica fixo pelas
	/// classes CSS acima. Default: todas (caso "pill" que cobre a caixa inteira).
	track?: TrackedProp[];
};

const DEFAULT_TRACK: TrackedProp[] = ['x', 'y', 'width', 'height'];
const DEFAULT_DURATION = 0.22;

/// Substitui uma troca instantânea de classe (ex.: `bg-primary` pulando de item pra item) por um
/// indicador que desliza até a posição/tamanho do item ativo — reaplicado sempre que o atributo
/// que marca "ativo" muda no container (via `MutationObserver`, não via prop reativa).
export const slidingIndicator: Action<HTMLElement, SlidingIndicatorOptions> = (node, opts) => {
	node.classList.add('relative');

	const indicator = document.createElement('div');
	indicator.className = cn(
		'pointer-events-none absolute top-0 left-0 -z-10 opacity-0',
		opts.indicatorClass
	);
	node.prepend(indicator);

	const track = opts.track ?? DEFAULT_TRACK;
	let tween: gsap.core.Tween | undefined;

	function snap(animate: boolean) {
		const active = node.querySelector<HTMLElement>(opts.selector);
		tween?.kill();

		if (!active) {
			gsap.set(indicator, { opacity: 0 });
			return;
		}

		const containerRect = node.getBoundingClientRect();
		const rect = active.getBoundingClientRect();
		// `getBoundingClientRect` vem com a escala de quem está em volta: medido no meio do
		// zoom de entrada de um diálogo (95%), o indicador ficava com o tamanho errado para
		// sempre. Dividir pela escala atual devolve a medida de layout, a mesma do `transform`.
		// Largura de layout com fração (`offsetWidth` arredonda e criava erro próprio).
		const style = getComputedStyle(node);
		const layoutWidth = parseFloat(style.width);
		const layoutHeight = parseFloat(style.height);
		const scaleX = layoutWidth > 0 ? containerRect.width / layoutWidth : 1;
		const scaleY = layoutHeight > 0 ? containerRect.height / layoutHeight : 1;
		// O indicador mora dentro do container: num container com rolagem (fichas que não cabem),
		// a posição é a do conteúdo, então soma o quanto já rolou.
		const full: Record<TrackedProp, number> = {
			x: (rect.left - containerRect.left) / (scaleX || 1) + node.scrollLeft,
			y: (rect.top - containerRect.top) / (scaleY || 1) + node.scrollTop,
			width: rect.width / (scaleX || 1),
			height: rect.height / (scaleY || 1)
		};

		// `autoRound: false`: o GSAP arredonda px para inteiro e a pílula ficava até meio pixel
		// fora da ficha (cortada reta pelo overflow da faixa).
		const target: Record<string, number | boolean> = { opacity: 1, autoRound: false };
		for (const key of track) target[key] = full[key];

		if (animate) {
			tween = gsap.to(indicator, {
				...target,
				duration: opts.duration ?? DEFAULT_DURATION,
				ease: 'power2.out'
			});
		} else {
			gsap.set(indicator, target);
		}
	}

	snap(false);
	// Bibliotecas de aba/toggle (bits-ui) resolvem qual item começa "ativo" através da própria
	// reatividade interna delas, não de uma prop direta — não dá pra garantir que o atributo já
	// está no DOM no instante síncrono deste `use:`. Um re-snap no próximo frame cobre essa
	// janela sem esperar por uma mutação que talvez nunca aconteça (o item já nasce ativo).
	requestAnimationFrame(() => snap(false));
	// Métricas de fonte só assentam depois do primeiro paint — sem isso, um item com texto
	// pode medir a largura errada até o layout se estabilizar de vez.
	document.fonts?.ready?.then(() => snap(false));

	// O tamanho de cada item conta, não só o do container: trocar Anime ↔ Mangá muda o texto
	// da ficha ativa ("Assistindo" ↔ "Lendo") sem mudar qual está ativa, e um container com
	// `max-w-full` nem muda de largura. Sem isso, a pílula ficava com a largura antiga.
	const resizeObserver =
		typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => snap(false));
	const observed = new Set<Element>();
	function observeItems() {
		if (!resizeObserver) return;
		for (const child of node.children) {
			if (child === indicator || observed.has(child)) continue;
			observed.add(child);
			resizeObserver.observe(child);
		}
		for (const child of observed) {
			if (child.parentElement !== node) {
				observed.delete(child);
				resizeObserver.unobserve(child);
			}
		}
	}
	resizeObserver?.observe(node);
	observeItems();

	const mutationObserver = new MutationObserver((mutations) => {
		// Item que entra ou sai (ex.: aba "Reassistindo" só aparece com contagem) também move os
		// outros; texto que muda dentro de um item muda a largura dele.
		if (mutations.some((mutation) => mutation.type === 'childList')) observeItems();
		snap(mutations.some((mutation) => mutation.type === 'attributes'));
	});
	mutationObserver.observe(node, {
		attributes: true,
		childList: true,
		characterData: true,
		subtree: true,
		attributeFilter: ['aria-current', 'aria-selected', 'data-state']
	});

	return {
		destroy() {
			mutationObserver.disconnect();
			resizeObserver?.disconnect();
			tween?.kill();
			indicator.remove();
		}
	};
};
