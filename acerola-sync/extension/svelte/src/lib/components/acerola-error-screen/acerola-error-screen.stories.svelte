<script lang="ts" module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import AcerolaErrorScreen from './acerola-error-screen.svelte';

	const { Story } = defineMeta({
		title: 'Sync/AcerolaErrorScreen',
		component: AcerolaErrorScreen,
		tags: ['autodocs']
	});
</script>

<Story name="Server fora do ar" asChild>
	<div class="w-[440px] bg-background px-5">
		<AcerolaErrorScreen data={{ status: 503, kind: 'unavailable' }} />
	</div>
</Story>

<Story name="Não encontrada" asChild>
	<div class="w-[440px] bg-background px-5">
		<AcerolaErrorScreen data={{ status: 404, kind: 'notFound' }} />
	</div>
</Story>

<Story name="Sem conexão (aba cheia)" asChild>
	<div class="w-[1100px] bg-background px-8">
		<AcerolaErrorScreen data={{ status: 0, kind: 'offline' }} />
	</div>
</Story>
