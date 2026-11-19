import { mount } from 'svelte';
import '$theme/layout.css';
import App from './app.svelte';

const app = mount(App, { target: document.getElementById('app')! });

export default app;
