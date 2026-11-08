<script lang="ts" module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import HistoryIcon from '@lucide/svelte/icons/activity';
	import ListIcon from '@lucide/svelte/icons/list';
	import SearchIcon from '@lucide/svelte/icons/search';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import AcerolaPillNav from './acerola-pill-nav.svelte';

	const { Story } = defineMeta({
		title: 'Sync/AcerolaPillNav',
		component: AcerolaPillNav,
		tags: ['autodocs']
	});

	const items = [
		{ id: 'list', label: 'Lista', icon: ListIcon },
		{ id: 'search', label: 'Buscar', icon: SearchIcon },
		{ id: 'activity', label: 'Sync', icon: HistoryIcon },
		{ id: 'settings', label: 'Ajustes', icon: SettingsIcon }
	];
</script>

<Story name="Default" asChild>
	<AcerolaPillNav data={{ items, active: 'list' }} />
</Story>
