<script lang="ts" module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import AcerolaSheetDialog from './acerola-sheet-dialog.svelte';

	const { Story } = defineMeta({
		title: 'Sync/AcerolaSheetDialog',
		component: AcerolaSheetDialog,
		tags: ['autodocs']
	});
</script>

<Story name="Formulário" asChild>
	<AcerolaSheetDialog
		state={{ open: true }}
		data={{ title: 'Novo site', description: 'Rastreio pela URL, como no MALSync.' }}
	>
		<input class="h-11 rounded-full bg-surface px-4 text-sm" placeholder="Nome" />
	</AcerolaSheetDialog>
</Story>
