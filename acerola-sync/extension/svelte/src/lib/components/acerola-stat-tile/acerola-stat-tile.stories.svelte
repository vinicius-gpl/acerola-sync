<script lang="ts" module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import AcerolaStatTile from './acerola-stat-tile.svelte';

	const { Story } = defineMeta({
		title: 'Sync/AcerolaStatTile',
		component: AcerolaStatTile,
		tags: ['autodocs']
	});
</script>

<Story name="Tons" asChild>
	<div class="grid w-[420px] grid-cols-3 gap-2">
		<AcerolaStatTile data={{ label: 'Assistindo', value: 12 }} ui={{ tone: 'primary' }} />
		<AcerolaStatTile data={{ label: 'Completo', value: 340 }} ui={{ tone: 'success' }} />
		<AcerolaStatTile data={{ label: 'Pendente', value: 2 }} ui={{ tone: 'warning' }} />
	</div>
</Story>
