// Ícones SVG como componente (`?component`), pelo `@poppanator/sveltekit-svg`.
declare module '*.svg?component' {
	import type { Component } from 'svelte';
	import type { SVGAttributes } from 'svelte/elements';
	const content: Component<SVGAttributes<SVGSVGElement>>;
	export default content;
}
