import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import react from '@astrojs/react';

const DEV_PORT = 3000;

export default defineConfig({
	site: process.env.SITE_URL || `http://localhost:${DEV_PORT}`,

	server: {
		port: DEV_PORT,
		host: true,
	},

	integrations: [
		tailwind(),
		react(),
	],

	vite: {
		define: {
			'import.meta.env.PUBLIC_API_URL': JSON.stringify(process.env.PUBLIC_API_URL || 'http://localhost:3001'),
		},
	},
});
