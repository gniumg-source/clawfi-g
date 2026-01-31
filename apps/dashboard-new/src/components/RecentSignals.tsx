import { useEffect, useState } from 'react';
import { api, formatRelativeTime, type Signal } from '../lib/data';

const SEVERITY_COLORS: Record<string, string> = {
	critical: 'bg-red-500',
	high: 'bg-orange-500',
	medium: 'bg-yellow-500',
	low: 'bg-blue-500',
	info: 'bg-gray-500',
};

export default function RecentSignals() {
	const [signals, setSignals] = useState<Signal[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const fetchSignals = async () => {
			try {
				const data = await api.getSignals({ limit: '5' });
				setSignals(data.data);
				setError(null);
			} catch (err) {
				setError(err instanceof Error ? err.message : 'Failed to load signals');
			} finally {
				setLoading(false);
			}
		};

		fetchSignals();
		const interval = setInterval(fetchSignals, 15000);
		return () => clearInterval(interval);
	}, []);

	if (loading) {
		return (
			<div className="p-6 space-y-4">
				{[...Array(3)].map((_, i) => (
					<div key={i} className="flex items-start gap-4 animate-pulse">
						<div className="w-3 h-3 rounded-full bg-gray-700 mt-1.5"></div>
						<div className="flex-1">
							<div className="h-4 bg-gray-700 rounded w-3/4 mb-2"></div>
							<div className="h-3 bg-gray-700 rounded w-1/2"></div>
						</div>
					</div>
				))}
			</div>
		);
	}

	if (error) {
		return (
			<div className="p-6 text-red-400 text-sm">{error}</div>
		);
	}

	if (signals.length === 0) {
		return (
			<div className="p-6 text-center">
				<svg className="w-12 h-12 mx-auto text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
				</svg>
				<p className="text-gray-500">No signals yet</p>
				<p className="text-xs text-gray-600">Signals will appear when your strategies detect activity</p>
			</div>
		);
	}

	return (
		<div className="divide-y divide-gray-700">
			{signals.map((signal) => (
				<div key={signal.id} className="p-4 hover:bg-gray-700/30 transition-colors">
					<div className="flex items-start gap-3">
						<div className={`w-2.5 h-2.5 rounded-full mt-1.5 ${SEVERITY_COLORS[signal.severity] || 'bg-gray-500'}`}></div>
						<div className="flex-1 min-w-0">
							<div className="flex items-center gap-2 mb-1">
								<span className="font-medium text-white truncate">{signal.title}</span>
								{!signal.acknowledged && (
									<span className="flex-shrink-0 px-1.5 py-0.5 text-xs bg-primary-600 text-white rounded">New</span>
								)}
							</div>
							<p className="text-sm text-gray-400 line-clamp-2">{signal.summary}</p>
							<div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
								<span>{formatRelativeTime(signal.ts)}</span>
								{signal.chain && (
									<span className="px-1.5 py-0.5 bg-gray-700 rounded">{signal.chain}</span>
								)}
								{signal.tokenSymbol && (
									<span className="font-mono">${signal.tokenSymbol}</span>
								)}
							</div>
						</div>
					</div>
				</div>
			))}
		</div>
	);
}


