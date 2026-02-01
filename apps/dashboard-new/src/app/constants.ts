// ClawFi Dashboard Constants

export const API_URL = 'https://api.clawfi.ai';

export const SITE_TITLE = 'ClawFi';

export const SITE_DOMAIN = 'clawfi.ai';

export const SITE_DESCRIPTION = 'All-Access Crypto Intelligence Agent';

// Clanker API for Base chain launchpad tokens
// Docs: https://clanker.gitbook.io/clanker-documentation
export const CLANKER_API_URL = 'https://www.clanker.world/api';

// Navigation structure for the sidebar
export const NAV_ITEMS = [
	{
		title: 'Dashboard',
		href: '/',
		icon: 'dashboard',
	},
	{
		title: 'Agent',
		href: '/agent',
		icon: 'terminal',
	},
	{
		title: 'Connections',
		href: '/connections',
		icon: 'plug',
	},
	{
		title: 'Signals',
		href: '/signals',
		icon: 'bell',
	},
	{
		title: 'Launchpads',
		href: '/launchpads',
		icon: 'rocket',
	},
	{
		title: 'Strategies',
		href: '/strategies',
		icon: 'brain',
	},
	{
		title: 'Risk',
		href: '/risk',
		icon: 'shield',
	},
	{
		title: 'Audit Log',
		href: '/audit',
		icon: 'clipboard',
	},
	{
		title: 'Settings',
		href: '/settings',
		icon: 'cog',
	},
] as const;

// Chain configurations
export const CHAINS = {
	base: { name: 'Base', color: '#0052FF' },
	ethereum: { name: 'Ethereum', color: '#627EEA' },
	bsc: { name: 'BSC', color: '#F0B90B' },
	solana: { name: 'Solana', color: '#9945FF' },
	arbitrum: { name: 'Arbitrum', color: '#28A0F0' },
	polygon: { name: 'Polygon', color: '#8247E5' },
} as const;

// Signal severity colors
export const SEVERITY_COLORS = {
	critical: 'bg-red-500',
	high: 'bg-orange-500',
	medium: 'bg-yellow-500',
	low: 'bg-blue-500',
	info: 'bg-gray-500',
} as const;

// Connector status colors
export const STATUS_COLORS = {
	connected: 'bg-emerald-500',
	degraded: 'bg-yellow-500',
	offline: 'bg-red-500',
	disconnected: 'bg-gray-500',
} as const;
