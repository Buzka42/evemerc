import { mount } from 'svelte';
import App from './App.svelte';
import PanelWindow from './windows/PanelWindow.svelte';
import type { PanelId } from './lib/layout/profiles';
import './app.css';

const target = document.getElementById('app');

if (target === null) {
  throw new Error('Application root element was not found.');
}

const parameters = new URLSearchParams(window.location.search);
const requestedPanel = parameters.get('panel');
const allowedPanels: PanelId[] = ['fleet-command', 'wormhole-chain', 'account', 'telemetry'];
const panelId = allowedPanels.find((candidate) => candidate === requestedPanel) ?? null;
const opacity = Math.min(1, Math.max(0.35, Number(parameters.get('opacity') ?? 0.94)));

if (parameters.get('window') === 'panel' && panelId) {
  mount(PanelWindow, { target, props: { panelId, opacity } });
} else {
  mount(App, { target });
}
