<script lang="ts" module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import AcerolaSection from './acerola-section.svelte';

	const { Story } = defineMeta({
		title: 'Sync/AcerolaSection',
		component: AcerolaSection,
		tags: ['autodocs']
	});
</script>

<Story name="Default" asChild>
	<AcerolaSection data={{ title: 'Agenda', hint: 'Horário de Brasília' }}>
		<p class="text-sm">Conteúdo da seção</p>
	</AcerolaSection>
</Story>
