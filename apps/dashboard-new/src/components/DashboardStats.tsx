import { useEffect, useState } from 'react';
import { api, type SystemStatus } from '../lib/data';

export default function DashboardStats() {
	const [status, setStatus] = useState<SystemStatus | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const fetchStatus = async () => {
			try {
				const data = await api.getStatus();
				setStatus(data);
				setError(null);
			} catch (err) {
				setError(err instanceof Error ? err.message : 'Failed to load status');
			} finally {
				setLoading(false);
			}
		};

		fetchStatus();
		const interval = setInterval(fetchStatus, 30000);
		return () => clearInterval(interval);
	}, []);

	if (loading) {
		return (
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
				{[...Array(5)].map((_, i) => (
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

	const stats = [
		{
			label: 'Active Connectors',
			value: status?.activeConnectors ?? 0,
			icon: (
				<svg className="w-5 h-5 text-primary-400" fill="currentColor" viewBox="0 0 20 20">
					<path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
				</svg>
			),
		},
		{
			label: 'Active Strategies',
			value: status?.activeStrategies ?? 0,
			icon: (
				<svg className="w-5 h-5 text-primary-400" fill="currentColor" viewBox="0 0 20 20">
					<path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
				</svg>
			),
		},
		{
			label: 'Signals Today',
			value: status?.signalsToday ?? 0,
			icon: (
				<svg className="w-5 h-5 text-primary-400" fill="currentColor" viewBox="0 0 20 20">
					<path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
				</svg>
			),
		},
		{
			label: 'Dry Run Mode',
			value: status?.dryRunMode ? 'ON' : 'OFF',
			color: status?.dryRunMode ? 'text-yellow-400' : 'text-gray-400',
			icon: (
				<svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
					<path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
				</svg>
			),
		},
		{
			label: 'Kill Switch',
			value: status?.killSwitchActive ? 'ACTIVE' : 'OFF',
			color: status?.killSwitchActive ? 'text-red-400' : 'text-emerald-400',
			icon: status?.killSwitchActive ? (
				<svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
					<path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
				</svg>
			) : (
				<svg className="w-5 h-5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
					<path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
				</svg>
			),
		},
	];

	return (
		<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
			{stats.map((stat, i) => (
				<div key={i} className="bg-gray-800 rounded-xl border border-gray-700 p-4">
					<div className="flex items-center justify-between mb-3">
						<span className="text-sm text-gray-400">{stat.label}</span>
						{stat.icon}
					</div>
					<span className={`text-2xl font-bold ${stat.color || 'text-white'}`}>
						{stat.value}
					</span>
				</div>
			))}
		</div>
	);
}


