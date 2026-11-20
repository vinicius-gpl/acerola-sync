<script module lang="ts">
	import type { ScreenError } from '$lib/utils/error-screen.utils';

	export type AcerolaErrorScreenProps = {
		data: ScreenError;
		events?: {
			onRetry?: () => void;
			onHome?: () => void;
		};
	};
</script>

<script lang="ts">
	import AcerolaBrandImage from '$lib/components/acerola-brand-image/acerola-brand-image.svelte';
	import { m } from '$lib/paraglide/messages';
	import { errorAction, type ErrorKind } from '$lib/utils/error-screen.utils';
	import gsap from 'gsap';
	import { onMount } from 'svelte';

	// The acerola-brand error screen (App → Error screen), sized for the extension: in the popup
	// it is always the small version (stage on top, copy centered, actions splitting the width);
	// in the full tab it gets the two columns. The layout follows the container, not the window.

	let { data, events }: AcerolaErrorScreenProps = $props();

	let root: HTMLElement;
	const uid = $props.id();
	const titleId = `${uid}-error-title`;

	const TEXT: Record<ErrorKind, { title: () => string; text: () => string }> = {
		badRequest: {
			title: m['sync.errorScreen.badRequest.title'],
			text: m['sync.errorScreen.badRequest.text']
		},
		unauthorized: {
			title: m['sync.errorScreen.unauthorized.title'],
			text: m['sync.errorScreen.unauthorized.text']
		},
		forbidden: {
			title: m['sync.errorScreen.forbidden.title'],
			text: m['sync.errorScreen.forbidden.text']
		},
		notFound: {
			title: m['sync.errorScreen.notFound.title'],
			text: m['sync.errorScreen.notFound.text']
		},
		timeout: {
			title: m['sync.errorScreen.timeout.title'],
			text: m['sync.errorScreen.timeout.text']
		},
		tooMany: {
			title: m['sync.errorScreen.tooMany.title'],
			text: m['sync.errorScreen.tooMany.text']
		},
		server: {
			title: m['sync.errorScreen.server.title'],
			text: m['sync.errorScreen.server.text']
		},
		unavailable: {
			title: m['sync.errorScreen.unavailable.title'],
			text: m['sync.errorScreen.unavailable.text']
		},
		offline: {
			title: m['sync.errorScreen.offline.title'],
			text: m['sync.errorScreen.offline.text']
		},
		unknown: {
			title: m['sync.errorScreen.unknown.title'],
			text: m['sync.errorScreen.unknown.text']
		}
	};

	const action = $derived(errorAction(data.kind));
	const text = $derived(TEXT[data.kind]);
	const eyebrow = $derived(
		data.kind === 'offline'
			? m['sync.errorScreen.eyebrowOffline']()
			: m['sync.errorScreen.eyebrow']({ status: data.status })
	);
	/** Each digit with its own tilt, like the hero lettering. Offline has no code. */
	const digits = $derived(
		data.kind === 'offline'
			? []
			: [...String(data.status)].map((char, i) => ({ char, tilt: [-7, 4, -3][i % 3] }))
	);
	/** The tape repeats the title and the eyebrow. */
	const tape = $derived([text.title(), eyebrow, text.title(), eyebrow]);

	/** Sticker star as a clip-path: the stamp behind the mascot (same shape as the hero). */
	const burst = Array.from({ length: 40 }, (_, i) => {
		const angle = (i / 40) * Math.PI * 2;
		const r = i % 2 ? 42 : 50;
		return `${(50 + r * Math.cos(angle)).toFixed(2)}% ${(50 + r * Math.sin(angle)).toFixed(2)}%`;
	}).join(', ');

	onMount(() => {
		const mm = gsap.matchMedia();
		mm.add('(prefers-reduced-motion: no-preference)', () => {
			const q = gsap.utils.selector(root);
			gsap.timeline({ defaults: { ease: 'back.out(1.8)' } })
				.from(q('.burst'), { scale: 0, rotate: -90, duration: 0.9, ease: 'expo.out' })
				.from(
					q('.digit'),
					{
						yPercent: 110,
						rotate: () => gsap.utils.random(-30, 30),
						opacity: 0,
						duration: 0.8,
						stagger: 0.08
					},
					0.1
				)
				.from(q('.art'), { yPercent: 30, scale: 0.85, opacity: 0, duration: 0.9 }, 0.3)
				.from(q('.tape'), { scaleX: 0, duration: 0.7, ease: 'expo.out' }, 0.5)
				.from(q('.sticker'), { scale: 0, rotate: -45, duration: 0.55 }, 0.75)
				.from(
					q('.copy > *'),
					{ y: 20, opacity: 0, duration: 0.5, stagger: 0.07, ease: 'power3.out' },
					0.2
				);

			// Life after the intro: the mascot breathes, the stamp spins, the tape runs.
			gsap.to(q('.art'), {
				y: -10,
				duration: 2.4,
				ease: 'sine.inOut',
				yoyo: true,
				repeat: -1
			});
			gsap.to(q('.burst'), { rotate: 360, duration: 50, ease: 'none', repeat: -1 });
			gsap.fromTo(
				q('.track'),
				{ xPercent: 0 },
				{ xPercent: -50, duration: 18, ease: 'none', repeat: -1 }
			);
		});
		return () => mm.revert();
	});

	const primary =
		'h-12 flex-1 cursor-pointer rounded-full bg-primary px-6 text-sm font-black text-primary-foreground transition-transform active:scale-[0.98]';
	const secondary =
		'h-12 flex-1 cursor-pointer rounded-full bg-surface px-6 text-sm font-black transition-transform active:scale-[0.98]';
</script>

<section bind:this={root} class="error" aria-labelledby={titleId} data-error-screen={data.kind}>
	<div class="layout">
		<div class="copy">
			<p class="eyebrow rounded-full">{eyebrow}</p>
			<h1 id={titleId} class="title">{text.title()}</h1>
			<p class="text">{text.text()}</p>
			<div class="actions">
				{#if action === 'retry'}
					<button type="button" class={primary} onclick={events?.onRetry}>
						{m['sync.errorScreen.actions.retry']()}
					</button>
					<button type="button" class={secondary} onclick={events?.onHome}>
						{m['sync.errorScreen.actions.home']()}
					</button>
				{:else}
					<button type="button" class={primary} onclick={events?.onHome}>
						{m['sync.errorScreen.actions.home']()}
					</button>
					<button type="button" class={secondary} onclick={events?.onRetry}>
						{m['sync.errorScreen.actions.retry']()}
					</button>
				{/if}
			</div>
		</div>

		<div class="stage" aria-hidden="true">
			<div class="burst" style:clip-path="polygon({burst})"></div>
			{#if digits.length}
				<p class="code">
					{#each digits as digit, i (i)}
						<span class="digit" style:--tilt="{digit.tilt}deg">{digit.char}</span>
					{/each}
				</p>
			{/if}
			<div class="art">
				<AcerolaBrandImage data={{ asset: 'mascot' }} ui={{ class: 'w-full' }} />
			</div>
			<div class="tape">
				<div class="track">
					{#each [0, 1] as copy (copy)}
						<span class="tape-text">
							{#each tape as phrase, i (i)}{phrase}<b>✦</b>{/each}
						</span>
					{/each}
				</div>
			</div>
			<span class="sticker rounded-full">{m['sync.errorScreen.sticker']()}</span>
		</div>
	</div>
</section>

<style>
	/* Copied from the acerola-brand `.ac-error*` rules (components.css), scoped to the component. */
	.error {
		container-type: inline-size;
		overflow-x: clip;
	}
	.layout {
		display: grid;
		align-items: center;
		gap: 3rem;
		padding: 2rem 0;
	}
	@container (min-width: 720px) {
		.layout {
			grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr);
		}
	}
	.copy {
		position: relative;
		z-index: 1;
	}
	.eyebrow {
		display: inline-flex;
		margin: 0;
		padding: 0.4rem 0.9rem;
		background: var(--destructive-soft);
		color: var(--destructive);
		font-size: 0.8rem;
		font-weight: 800;
	}
	.title {
		margin: 1rem 0 0;
		font: 900 clamp(2.75rem, 6.5cqi, 4.75rem) / 0.95 var(--font-sans);
		letter-spacing: -0.045em;
		text-wrap: balance;
	}
	.text {
		max-width: 30rem;
		margin: 1.25rem 0 0;
		color: var(--muted-foreground);
		font-size: 1.125rem;
		text-wrap: pretty;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		margin-top: 2.25rem;
	}
	.stage {
		position: relative;
		isolation: isolate;
		display: grid;
		place-items: center;
		width: min(100%, 34rem);
		aspect-ratio: 1;
		justify-self: center;
	}
	.burst {
		position: absolute;
		z-index: -1;
		inset: 6%;
		background: var(--primary);
	}
	.code {
		position: absolute;
		z-index: 0;
		top: 2%;
		left: 50%;
		display: flex;
		margin: 0;
		translate: -50% 0;
		font-family: var(--font-display);
		font-size: clamp(6rem, 14cqi, 11rem);
		line-height: 0.85;
		user-select: none;
	}
	.digit {
		display: inline-block;
		color: var(--accent-hero);
		-webkit-text-stroke: 0.05em var(--crust);
		paint-order: stroke fill;
		text-shadow:
			0.035em 0.035em 0 var(--primary-foreground),
			0.07em 0.07em 0 var(--crust);
		transform: rotate(var(--tilt));
	}
	.digit:nth-child(even) {
		color: var(--foreground);
	}
	.art {
		position: relative;
		z-index: 1;
		width: 62%;
		margin-top: 22%;
	}
	.tape {
		position: absolute;
		z-index: 2;
		left: -6%;
		bottom: 12%;
		width: 112%;
		overflow: hidden;
		padding: 0.55rem 0;
		rotate: -5deg;
		background: var(--foreground);
		color: var(--background);
		font-family: var(--font-display);
		font-size: clamp(1rem, 2vw, 1.6rem);
		text-transform: uppercase;
		white-space: nowrap;
		box-shadow: var(--shadow-float);
	}
	.track {
		display: flex;
		width: max-content;
	}
	.tape-text :global(b) {
		margin: 0 0.6em;
		color: var(--primary);
		font-weight: 400;
	}
	.sticker {
		position: absolute;
		z-index: 3;
		right: 4%;
		top: 30%;
		padding: 0.5em 0.9em;
		rotate: 10deg;
		background: var(--warning);
		color: var(--crust);
		font-family: var(--font-display);
		font-size: clamp(0.9rem, 1.6vw, 1.25rem);
		text-transform: uppercase;
		box-shadow:
			0 0 0 3px var(--crust),
			4px 5px 0 3px var(--crust);
	}

	/* Small version: the popup always, the full tab when narrow. Smaller stage than the brand
	 * book's (the popup is 600px tall) so stage, copy and actions fit without scrolling. */
	@container (max-width: 719.98px) {
		.layout {
			gap: 1rem;
			padding: 0.5rem 0 1rem;
			text-align: center;
		}
		.stage {
			order: -1;
			width: min(100%, 15rem);
		}
		.code {
			font-size: clamp(3.75rem, 20cqi, 5rem);
		}
		.tape {
			font-size: 0.8rem;
			padding: 0.35rem 0;
		}
		.sticker {
			right: 0;
			font-size: 0.75rem;
		}
		.copy {
			display: grid;
			justify-items: center;
		}
		.title {
			margin-top: 0.75rem;
			font-size: clamp(1.75rem, 8.5cqi, 2.5rem);
		}
		.text {
			margin-top: 0.5rem;
			font-size: 0.875rem;
		}
		.actions {
			width: 100%;
			margin-top: 1.25rem;
		}
	}
</style>
