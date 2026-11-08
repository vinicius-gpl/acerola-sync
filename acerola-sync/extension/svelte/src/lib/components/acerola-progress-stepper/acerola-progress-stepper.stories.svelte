<script lang="ts" module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import AcerolaProgressStepper from './acerola-progress-stepper.svelte';

	const { Story } = defineMeta({
		title: 'Sync/AcerolaProgressStepper',
		component: AcerolaProgressStepper,
		tags: ['autodocs']
	});

	let value = $state(3);
</script>

<Story name="Default" asChild>
	<div class="w-80">
		<AcerolaProgressStepper
			data={{ value, max: 12, caption: 'de 12 episódios' }}
			events={{ onChange: (next) => (value = next) }}
		/>
	</div>
</Story>
