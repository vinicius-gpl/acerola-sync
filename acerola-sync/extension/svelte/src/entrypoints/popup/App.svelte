<script lang="ts">
	import AcerolaLogo from '$lib/assets/icons/acerola.svg?component';
	import AcerolaModePicker from '$lib/components/acerola-mode-picker/acerola-mode-picker.svelte';
</script>

<main class="flex w-80 items-center justify-between gap-3 p-4">
	<div class="flex items-center gap-2">
		<AcerolaLogo class="size-6" />
		<h1 class="font-semibold text-base">Acerola Sync</h1>
	</div>

	<AcerolaModePicker />
</main>
