<script lang="ts" module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import TrashIcon from '@lucide/svelte/icons/trash-2';
	import AcerolaConfirmDialog from './acerola-confirm-dialog.svelte';

	const { Story } = defineMeta({
		title: 'Sync/AcerolaConfirmDialog',
		component: AcerolaConfirmDialog,
		tags: ['autodocs']
	});
</script>

<Story
	name="Remover"
	args={{
		state: { open: true },
		data: {
			title: 'Remover da lista?',
			description: 'A entrada some daqui e do AniList.',
			actionText: 'Remover da lista',
			cancelText: 'Cancelar',
			icon: TrashIcon
		}
	}}
/>
