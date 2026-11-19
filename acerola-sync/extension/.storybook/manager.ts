import { addons } from 'storybook/manager-api';
import { create } from 'storybook/theming';

addons.setConfig({
	theme: create({
		base: 'dark',
		brandTitle: 'Acerola',
		// The app's real logo (copy of svelte/src/lib/assets/icons/acerola.svg in
		// svelte/static/logo.svg: it must be a plain static file, Storybook's manager UI does
		// not process Vite imports like `?component`). The tab's real favicon.ico is set
		// separately in manager-head.html, not here.
		brandImage: 'logo.svg',
		brandTarget: '_self'
	})
});

const style = document.createElement('style');
style.textContent = `
  .sidebar-header a img {
    max-height: 34px;
    width: auto;
  }
`;
document.head.appendChild(style);
