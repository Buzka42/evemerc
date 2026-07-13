import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('svelte/compiler').Options} */
const config = {
  preprocess: vitePreprocess(),
};

export default config;
