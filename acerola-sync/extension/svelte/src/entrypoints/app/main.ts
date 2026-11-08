import { mount } from 'svelte';
import '$theme/layout.css';
import AppShell from '$lib/screens/AppShell.svelte';

// A mesma interface do popup, numa aba inteira (`chrome-extension://<id>/app.html`).
const app = mount(AppShell, { target: document.getElementById('app')!, props: { mode: 'page' } });

export default app;
