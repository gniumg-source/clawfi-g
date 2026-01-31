import { useEffect, useState } from 'react';
import { api, type Strategy } from '../lib/data';

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
	enabled: { bg: 'bg-emerald-900/30', text: 'text-emerald-400' },
	disabled: { bg: 'bg-gray-700', text: 'text-gray-400' },
	error: { bg: 'bg-red-900/30', text: 'text-red-400' },
};

export default function StrategiesList() {
	const [strategies, setStrategies] = useState<Strategy[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [togglingId, setTogglingId] = useState<string | null>(null);

	const fetchStrategies = async () => {
		try {
			const data = await api.getStrategies();
			setStrategies(data);
			setError(null);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to load strategies');
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchStrategies();
	}, []);

	const handleToggle = async (id: string, currentStatus: string) => {
		setTogglingId(id);
		try {
			if (currentStatus === 'enabled') {
				await api.disableStrategy(id);
			} else {
				await api.enableStrategy(id);
			}
			fetchStrategies();
		} catch (err) {
			console.error('Toggle failed:', err);
		} finally {
			setTogglingId(null);
		}
	};

	if (loading) {
		return (
			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
				{[...Array(2)].map((_, i) => (
					<div key={i} className="bg-gray-800 rounded-xl border border-gray-700 p-6 animate-pulse">
						<div className="h-6 bg-gray-700 rounded w-1/3 mb-3"></div>
						<div className="h-4 bg-gray-700 rounded w-2/3 mb-4"></div>
						<div className="h-8 bg-gray-700 rounded w-1/4"></div>
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

	if (strategies.length === 0) {
		return (
			<div className="bg-gray-800 rounded-xl border border-gray-700 p-8 text-center">
				<svg className="w-16 h-16 mx-auto text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
				</svg>
				<h3 className="text-lg font-medium text-white mb-2">No strategies configured</h3>
				<p className="text-gray-400">Strategies will appear here when configured.</p>
			</div>
		);
	}

	return (
		<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
			{strategies.map((strategy) => {
				const statusColors = STATUS_COLORS[strategy.status] || STATUS_COLORS.disabled;
				
				return (
					<div key={strategy.id} className="bg-gray-800 rounded-xl border border-gray-700 p-6">
						<div className="flex items-start justify-between mb-4">
							<div>
								<h3 className="text-lg font-medium text-white">{strategy.name}</h3>
								<span className="text-xs text-gray-500 font-mono">{strategy.strategyType}</span>
							</div>
							<span className={`px-2 py-1 text-xs rounded ${statusColors.bg} ${statusColors.text}`}>
								{strategy.status}
							</span>
						</div>
						
						{strategy.description && (
							<p className="text-sm text-gray-400 mb-4">{strategy.description}</p>
						)}
						
						{/* Config Preview */}
						<div className="mb-4 p-3 bg-gray-900/50 rounded-lg">
							<p className="text-xs text-gray-500 mb-2">Configuration</p>
							<pre className="text-xs text-gray-400 overflow-hidden">
								{JSON.stringify(strategy.config, null, 2).slice(0, 200)}...
							</pre>
						</div>
						
						<div className="flex items-center gap-2">
							<button
								onClick={() => handleToggle(strategy.id, strategy.status)}
								disabled={togglingId === strategy.id}
								className={`px-4 py-2 text-sm rounded-lg transition-colors ${
									strategy.status === 'enabled'
										? 'bg-red-900/30 text-red-400 hover:bg-red-900/50'
										: 'bg-emerald-900/30 text-emerald-400 hover:bg-emerald-900/50'
								} disabled:opacity-50`}
							>
								{togglingId === strategy.id ? 'Processing...' : strategy.status === 'enabled' ? 'Disable' : 'Enable'}
							</button>
							<button className="px-4 py-2 text-sm text-gray-300 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors">
								Configure
							</button>
						</div>
					</div>
				);
			})}
		</div>
	);
}


