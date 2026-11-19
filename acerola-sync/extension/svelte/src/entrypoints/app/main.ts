import { mount } from 'svelte';
import '$theme/layout.css';
import AppShell from '$lib/screens/app-shell.svelte';

// The same interface as the popup, in a full tab (`chrome-extension://<id>/app.html`).
const app = mount(AppShell, { target: document.getElementById('app')!, props: { mode: 'page' } });

export default app;
