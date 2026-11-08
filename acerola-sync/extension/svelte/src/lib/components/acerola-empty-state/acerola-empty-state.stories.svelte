<script lang="ts" module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import InboxIcon from '@lucide/svelte/icons/inbox';
	import AcerolaEmptyState from './acerola-empty-state.svelte';

	const { Story } = defineMeta({
		title: 'Sync/AcerolaEmptyState',
		component: AcerolaEmptyState,
		tags: ['autodocs']
	});
</script>

<Story name="Default" asChild>
	<AcerolaEmptyState
		data={{ title: 'Nada em andamento', hint: 'Busque algo ou sincronize.', icon: InboxIcon }}
	/>
</Story>
