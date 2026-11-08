<script module lang="ts">
	import type { Component } from 'svelte';

	export type AcerolaPillNavItem = {
		id: string;
		label: string;
		icon: Component<{ size?: number }>;
	};

	export type AcerolaPillNavProps = {
		data: {
			items: AcerolaPillNavItem[];
			active: string | null;
		};
		events?: {
			onSelect?: (id: string) => void;
		};
		ui?: {
			class?: string;
		};
	};
</script>

<script lang="ts">
	import gsap from 'gsap';
	import { tick, untrack } from 'svelte';
	import { cn } from '$lib/utils/cn.utils';
	import { prefersReducedMotion } from '$lib/utils/motion.utils';

	let { data, events, ui }: AcerolaPillNavProps = $props();

	let nav = $state<HTMLElement>();
	let indicator = $state<HTMLElement>();
	let first = true;

	/// A pílula ativa desliza e estica até o item novo enquanto o nome dele abre — tudo no
	/// mesmo tempo, para a troca de aba parecer um movimento só.
	async function moveTo(id: string | null) {
		await tick();
		if (!nav || !indicator) return;
		const button = nav.querySelector<HTMLElement>(`[data-nav="${id}"]`);
		if (!button) {
			gsap.set(indicator, { opacity: 0 });
			return;
		}
		const label = button.querySelector('[data-nav-label]');
		const target = { x: button.offsetLeft, width: button.offsetWidth, opacity: 1 };

		if (first || prefersReducedMotion()) {
			gsap.set(indicator, target);
			first = false;
			return;
		}
		gsap.to(indicator, { ...target, duration: 0.42, ease: 'power3.out' });
		if (label) {
			gsap.fromTo(
				label,
				{ opacity: 0, x: -6 },
				{ opacity: 1, x: 0, duration: 0.3, delay: 0.08, ease: 'power2.out' }
			);
		}
	}

	$effect(() => {
		const active = data.active;
		untrack(() => void moveTo(active));
	});
</script>

<!-- Barra em pílula: o item ativo vira uma pílula com o nome, e ela desliza entre os itens. -->
<nav
	bind:this={nav}
	class={cn(
		'relative isolate flex items-center gap-1 rounded-full bg-card/95 p-1.5 shadow-float backdrop-blur-xl',
		ui?.class
	)}
>
	<span
		bind:this={indicator}
		class="pointer-events-none absolute top-1.5 left-0 -z-10 h-10 rounded-full bg-primary opacity-0"
		aria-hidden="true"
	></span>
	{#each data.items as item (item.id)}
		{@const active = item.id === data.active}
		<button
			type="button"
			data-nav={item.id}
			aria-current={active ? 'page' : undefined}
			aria-label={item.label}
			title={item.label}
			onclick={() => events?.onSelect?.(item.id)}
			class={cn(
				'flex h-10 cursor-pointer items-center gap-2 rounded-full px-3 text-sm font-bold transition-colors duration-300 outline-none focus-visible:ring-2 focus-visible:ring-ring',
				active ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
			)}
		>
			<item.icon size={18} />
			{#if active}
				<span data-nav-label>{item.label}</span>
			{/if}
		</button>
	{/each}
</nav>
