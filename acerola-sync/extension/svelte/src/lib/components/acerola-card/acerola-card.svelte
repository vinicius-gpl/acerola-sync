<script module lang="ts">
	import type { Snippet } from 'svelte';

	export type AcerolaCardProps = {
		data: {
			title: string;
			description?: string;
		};
		ui?: {
			size?: 'default' | 'sm';
			class?: string;
		};
	};

	export type AcerolaCardSnippets = {
		children?: Snippet;
		footer?: Snippet;
	};
</script>

<script lang="ts">
	import * as Card from '$lib/components/ui/card';

	let { data, ui, children, footer }: AcerolaCardProps & AcerolaCardSnippets = $props();
</script>

<Card.Root size={ui?.size ?? 'default'} class={ui?.class}>
	<Card.Header>
		<Card.Title class="font-semibold text-foreground">{data.title}</Card.Title>
		{#if data.description}
			<Card.Description>{data.description}</Card.Description>
		{/if}
	</Card.Header>

	{#if children}
		<Card.Content>
			{@render children()}
		</Card.Content>
	{/if}

	{#if footer}
		<Card.Footer>
			{@render footer()}
		</Card.Footer>
	{/if}
</Card.Root>
