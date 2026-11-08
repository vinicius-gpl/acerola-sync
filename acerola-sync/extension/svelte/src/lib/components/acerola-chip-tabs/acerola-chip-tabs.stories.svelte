<script lang="ts" module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import AcerolaChipTabs from './acerola-chip-tabs.svelte';

	const { Story } = defineMeta({
		title: 'Sync/AcerolaChipTabs',
		component: AcerolaChipTabs,
		tags: ['autodocs']
	});

	const items = [
		{ id: 'CURRENT', label: 'Assistindo', count: 12 },
		{ id: 'COMPLETED', label: 'Completo', count: 340 },
		{ id: 'PLANNING', label: 'Planejado', count: 48 },
		{ id: 'PAUSED', label: 'Pausado', count: 3 }
	];
</script>

<Story name="Default" asChild>
	<AcerolaChipTabs data={{ items, active: 'CURRENT' }} />
</Story>

<Story name="Pequeno" asChild>
	<AcerolaChipTabs data={{ items: items.slice(0, 2), active: 'COMPLETED' }} ui={{ size: 'sm' }} />
</Story>
