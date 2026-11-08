<script lang="ts" module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { makeLog } from '../../../../tests/fixtures/media';
	import AcerolaLogConsole from './acerola-log-console.svelte';

	const { Story } = defineMeta({
		title: 'Sync/AcerolaLogConsole',
		component: AcerolaLogConsole,
		tags: ['autodocs']
	});

	const logs = [
		makeLog(1, 'Sync incremental started (MANUAL)'),
		makeLog(2, 'Page 1: 3 changed entr(ies)'),
		makeLog(3, '1 change(s) still pending; kept as they are', 'WARN')
	];
</script>

<Story name="Rodando" asChild>
	<div class="w-[420px]"><AcerolaLogConsole data={{ logs, running: true }} /></div>
</Story>

<Story name="Vazio" asChild>
	<div class="w-[420px]"><AcerolaLogConsole data={{ logs: [], empty: 'Nenhum sync ainda' }} /></div>
</Story>
