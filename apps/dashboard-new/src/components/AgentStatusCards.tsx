import { useEffect, useState } from 'react';
import { api, formatUptime, type AgentStatus } from '../lib/data';

export default function AgentStatusCards() {
	const [status, setStatus] = useState<AgentStatus | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const fetchStatus = async () => {
			try {
				const data = await api.getAgentStatus();
				setStatus(data);
				setError(null);
			} catch (err) {
				setError(err instanceof Error ? err.message : 'Failed to load status');
			} finally {
				setLoading(false);
			}
		};

		fetchStatus();
		const interval = setInterval(fetchStatus, 10000);
		return () => clearInterval(interval);
	}, []);

	if (loading) {
		return (
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
				{[...Array(8)].map((_, i) => (
					<div key={i} className="bg-gray-800 rounded-xl border border-gray-700 p-4 animate-pulse">
						<div className="h-4 bg-gray-700 rounded w-1/2 mb-3"></div>
						<div className="h-8 bg-gray-700 rounded w-1/3"></div>
					</div>
				))}
			</div>
		);
	}

	if (error) {
		return (
			<div className="p-4 rounded-lg bg-red-900/30 border border-red-700/50 text-red-400">
				{error}
			</div>
		);
	}

	const cards = [
		{
			label: 'Uptime',
			value: status?.uptimeFormatted || formatUptime(status?.uptimeSeconds || 0),
			icon: (
				<svg className="w-5 h-5 text-primary-400" fill="currentColor" viewBox="0 0 20 20">
					<path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
				</svg>
			),
		},
		{
			label: 'Kill Switch',
			value: status?.killSwitchActive ? 'ACTIVE' : 'OFF',
			color: status?.killSwitchActive ? 'text-red-400' : 'text-emerald-400',
			icon: (
				<svg className={`w-5 h-5 ${status?.killSwitchActive ? 'text-red-400' : 'text-emerald-400'}`} fill="currentColor" viewBox="0 0 20 20">
					<path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
				</svg>
			),
		},
		{
			label: 'Connectors',
			value: `${status?.connectors.connected || 0}/${status?.connectors.total || 0}`,
			subtext: status?.connectors.degraded ? `${status.connectors.degraded} degraded` : undefined,
			icon: (
				<svg className="w-5 h-5 text-primary-400" fill="currentColor" viewBox="0 0 20 20">
					<path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
				</svg>
			),
		},
		{
			label: 'Signals Today',
			value: status?.signalsToday || 0,
			icon: (
				<svg className="w-5 h-5 text-primary-400" fill="currentColor" viewBox="0 0 20 20">
					<path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
				</svg>
			),
		},
		{
			label: 'Strategies',
			value: `${status?.strategies.enabled || 0}/${status?.strategies.total || 0}`,
			icon: (
				<svg className="w-5 h-5 text-primary-400" fill="currentColor" viewBox="0 0 20 20">
					<path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
				</svg>
			),
		},
		{
			label: 'Watched Tokens',
			value: status?.watchedTokens || 0,
			icon: (
				<svg className="w-5 h-5 text-primary-400" fill="currentColor" viewBox="0 0 20 20">
					<path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
					<path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
				</svg>
			),
		},
		{
			label: 'Watched Wallets',
			value: status?.watchedWallets || 0,
			icon: (
				<svg className="w-5 h-5 text-primary-400" fill="currentColor" viewBox="0 0 20 20">
					<path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
					<path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
				</svg>
			),
		},
		{
			label: 'Response Time',
			value: `${status?.responseTimeMs || '--'}ms`,
			icon: (
				<svg className="w-5 h-5 text-primary-400" fill="currentColor" viewBox="0 0 20 20">
					<path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
				</svg>
			),
		},
	];

	return (
		<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
			{cards.map((card, i) => (
				<div key={i} className="bg-gray-800 rounded-xl border border-gray-700 p-4">
					<div className="flex items-center justify-between mb-3">
						<span className="text-sm text-gray-400">{card.label}</span>
						{card.icon}
					</div>
					<span className={`text-2xl font-bold ${card.color || 'text-white'}`}>
						{card.value}
					</span>
					{card.subtext && (
						<p className="text-xs text-yellow-400 mt-1">{card.subtext}</p>
					)}
				</div>
			))}
		</div>
	);
}


