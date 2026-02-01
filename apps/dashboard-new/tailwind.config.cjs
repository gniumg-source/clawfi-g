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
				// ClawFi brand colors - royal blue with glass accents
				primary: {
					50: '#eff6ff',
					100: '#dbeafe',
					200: '#bfdbfe',
					300: '#93c5fd',
					400: '#60a5fa',
					500: '#3b82f6',
					600: '#2563eb',
					700: '#1d4ed8',
					800: '#1e40af',
					900: '#1e3a8a',
				},
				claw: {
					50: '#eff6ff',
					100: '#dbeafe',
					200: '#bfdbfe',
					300: '#93c5fd',
					400: '#60a5fa',
					500: '#3b82f6',
					600: '#2563eb',
					700: '#1d4ed8',
					800: '#1e40af',
					900: '#1e3a8a',
					950: '#172554',
				},
				// Glass colors
				glass: {
					light: 'rgba(255, 255, 255, 0.05)',
					medium: 'rgba(255, 255, 255, 0.1)',
					heavy: 'rgba(255, 255, 255, 0.15)',
					border: 'rgba(255, 255, 255, 0.1)',
					glow: 'rgba(59, 130, 246, 0.2)',
				},
			},
			fontFamily: {
				sans: [
					'Inter',
					'ui-sans-serif',
					'system-ui',
					'-apple-system',
					'Segoe UI',
					'Roboto',
					'sans-serif',
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
				'pulse-glow': 'pulse-glow 3s ease-in-out infinite',
				'gradient-shift': 'gradient-shift 8s ease infinite',
				'float': 'float 6s ease-in-out infinite',
				'shimmer': 'shimmer 2s linear infinite',
				'glass-reflect': 'glass-reflect 3s ease-in-out infinite',
				'liquid': 'liquid 4s ease-in-out infinite',
			},
			keyframes: {
				'pulse-glow': {
					'0%, 100%': { boxShadow: '0 0 20px rgba(59, 130, 246, 0.2), 0 0 60px rgba(59, 130, 246, 0.1)' },
					'50%': { boxShadow: '0 0 40px rgba(59, 130, 246, 0.4), 0 0 80px rgba(59, 130, 246, 0.2)' },
				},
				'gradient-shift': {
					'0%, 100%': { backgroundPosition: '0% 50%' },
					'50%': { backgroundPosition: '100% 50%' },
				},
				'float': {
					'0%, 100%': { transform: 'translateY(0px)' },
					'50%': { transform: 'translateY(-10px)' },
				},
				'shimmer': {
					'0%': { backgroundPosition: '-200% 0' },
					'100%': { backgroundPosition: '200% 0' },
				},
				'glass-reflect': {
					'0%, 100%': { opacity: '0.5' },
					'50%': { opacity: '0.8' },
				},
				'liquid': {
					'0%, 100%': { borderRadius: '60% 40% 30% 70% / 60% 30% 70% 40%' },
					'50%': { borderRadius: '30% 60% 70% 40% / 50% 60% 30% 60%' },
				},
			},
			backgroundImage: {
				'claw-gradient': 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 25%, #1d4ed8 50%, #2563eb 75%, #3b82f6 100%)',
				'glass-gradient': 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
				'glass-shine': 'linear-gradient(135deg, rgba(255,255,255,0.2) 0%, transparent 50%, rgba(255,255,255,0.05) 100%)',
				'mesh-gradient': 'radial-gradient(at 40% 20%, rgba(59, 130, 246, 0.3) 0px, transparent 50%), radial-gradient(at 80% 0%, rgba(96, 165, 250, 0.2) 0px, transparent 50%), radial-gradient(at 0% 50%, rgba(37, 99, 235, 0.2) 0px, transparent 50%), radial-gradient(at 80% 50%, rgba(59, 130, 246, 0.15) 0px, transparent 50%), radial-gradient(at 0% 100%, rgba(29, 78, 216, 0.2) 0px, transparent 50%)',
				'grid-pattern': 'linear-gradient(rgba(59, 130, 246, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(59, 130, 246, 0.03) 1px, transparent 1px)',
				'noise': "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")",
			},
			backdropBlur: {
				xs: '2px',
			},
			boxShadow: {
				'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
				'glass-sm': '0 4px 16px 0 rgba(0, 0, 0, 0.25)',
				'glass-lg': '0 12px 48px 0 rgba(0, 0, 0, 0.45)',
				'glass-glow': '0 0 40px rgba(59, 130, 246, 0.15), 0 8px 32px rgba(0, 0, 0, 0.3)',
				'glass-inset': 'inset 0 1px 1px rgba(255, 255, 255, 0.1)',
				'neon': '0 0 5px rgba(59, 130, 246, 0.5), 0 0 20px rgba(59, 130, 246, 0.3), 0 0 40px rgba(59, 130, 246, 0.1)',
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
		'backdrop-blur-xl',
		'backdrop-blur-2xl',
	],

	plugins: [
		require('flowbite/plugin'),
		require('flowbite-typography'),
		require('tailwind-scrollbar')({ nocompatible: true }),
	],
};
