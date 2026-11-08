<script lang="ts" module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import AcerolaTimePicker from './acerola-time-picker.svelte';

	const { Story } = defineMeta({
		title: 'Sync/AcerolaTimePicker',
		component: AcerolaTimePicker,
		tags: ['autodocs']
	});
</script>

<Story name="Padrão" args={{ data: { value: '09:00', label: 'Novo horário' } }} />
<Story name="Fora do passo" args={{ data: { value: '21:07', label: 'Novo horário' } }} />
