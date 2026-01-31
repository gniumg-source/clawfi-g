/** @type {import('tailwindcss').Config} */
module.exports = {
	content: [
		'./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}',
		'./node_modules/flowbite/**/*.js',
	],

	darkMode: 'class',

	theme: {
		extend: {
			colors: {
				// ClawFi brand colors - vibrant cyber purple/magenta theme
				primary: {
					50: '#fdf4ff',
					100: '#fae8ff',
					200: '#f5d0fe',
					300: '#f0abfc',
					400: '#e879f9',
					500: '#d946ef',
					600: '#c026d3',
					700: '#a21caf',
					800: '#86198f',
					900: '#701a75',
				},
				claw: {
					50: '#fdf4ff',
					100: '#fae8ff',
					200: '#f5d0fe',
					300: '#f0abfc',
					400: '#e879f9',
					500: '#d946ef',
					600: '#c026d3',
					700: '#a21caf',
					800: '#86198f',
					900: '#701a75',
					950: '#4a044e',
				},
			},
			fontFamily: {
				sans: [
					'JetBrains Mono',
					'Fira Code',
					'ui-monospace',
					'SFMono-Regular',
					'Menlo',
					'Monaco',
					'Consolas',
					'monospace',
				],
				body: [
					'Inter',
					'ui-sans-serif',
					'system-ui',
					'-apple-system',
					'Segoe UI',
					'Roboto',
					'sans-serif',
				],
				mono: [
					'JetBrains Mono',
					'Fira Code',
					'ui-monospace',
					'SFMono-Regular',
					'Menlo',
					'Monaco',
					'Consolas',
					'monospace',
				],
			},
			transitionProperty: {
				width: 'width',
			},
			animation: {
				'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
				'gradient-shift': 'gradient-shift 8s ease infinite',
			},
			keyframes: {
				'pulse-glow': {
					'0%, 100%': { boxShadow: '0 0 20px rgba(217, 70, 239, 0.3)' },
					'50%': { boxShadow: '0 0 40px rgba(217, 70, 239, 0.6)' },
				},
				'gradient-shift': {
					'0%, 100%': { backgroundPosition: '0% 50%' },
					'50%': { backgroundPosition: '100% 50%' },
				},
			},
			backgroundImage: {
				'claw-gradient': 'linear-gradient(135deg, #701a75 0%, #86198f 25%, #a21caf 50%, #c026d3 75%, #d946ef 100%)',
				'grid-pattern': 'linear-gradient(rgba(217, 70, 239, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(217, 70, 239, 0.03) 1px, transparent 1px)',
			},
		},
	},

	safelist: [
		'justify-evenly',
		'overflow-hidden',
		'rounded-md',
		'w-64',
		'w-1/2',
		'rounded-l-lg',
		'rounded-r-lg',
		'bg-gray-200',
		'grid-cols-4',
		'grid-cols-7',
		'h-6',
		'leading-6',
		'h-9',
		'leading-9',
		'shadow-lg',
		'bg-opacity-50',
		'dark:bg-opacity-80',
		'grid',
	],

	plugins: [
		require('flowbite/plugin'),
		require('flowbite-typography'),
		require('tailwind-scrollbar')({ nocompatible: true }),
	],
};
