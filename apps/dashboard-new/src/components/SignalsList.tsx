import { useEffect, useState } from 'react';
import { api, formatRelativeTime, formatAddress, type Signal } from '../lib/data';

const SEVERITY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
	critical: { bg: 'bg-red-900/30', text: 'text-red-400', border: 'border-red-700/50' },
	high: { bg: 'bg-orange-900/30', text: 'text-orange-400', border: 'border-orange-700/50' },
	medium: { bg: 'bg-yellow-900/30', text: 'text-yellow-400', border: 'border-yellow-700/50' },
	low: { bg: 'bg-blue-900/30', text: 'text-blue-400', border: 'border-blue-700/50' },
	info: { bg: 'bg-gray-700/30', text: 'text-gray-400', border: 'border-gray-600' },
};

export default function SignalsList() {
	const [signals, setSignals] = useState<Signal[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [page, setPage] = useState(1);
	const [totalPages, setTotalPages] = useState(1);
	const [filters, setFilters] = useState({ severity: '', acknowledged: '' });

	const fetchSignals = async () => {
		try {
			setLoading(true);
			const params: Record<string, string> = { page: page.toString(), limit: '20' };
			if (filters.severity) params.severity = filters.severity;
			if (filters.acknowledged) params.acknowledged = filters.acknowledged;
			
			const data = await api.getSignals(params);
			setSignals(data.data);
			setTotalPages(data.pagination.totalPages);
			setError(null);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to load signals');
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchSignals();
	}, [page, filters]);

	// Listen for filter changes from the page
	useEffect(() => {
		const severitySelect = document.getElementById('filter-severity') as HTMLSelectElement;
		const acknowledgedSelect = document.getElementById('filter-acknowledged') as HTMLSelectElement;

		const handleSeverityChange = () => {
			setFilters(f => ({ ...f, severity: severitySelect.value }));
			setPage(1);
		};

		const handleAcknowledgedChange = () => {
			setFilters(f => ({ ...f, acknowledged: acknowledgedSelect.value }));
			setPage(1);
		};

		severitySelect?.addEventListener('change', handleSeverityChange);
		acknowledgedSelect?.addEventListener('change', handleAcknowledgedChange);

		return () => {
			severitySelect?.removeEventListener('change', handleSeverityChange);
			acknowledgedSelect?.removeEventListener('change', handleAcknowledgedChange);
		};
	}, []);

	const handleAcknowledge = async (id: string) => {
		try {
			await api.acknowledgeSignal(id);
			fetchSignals();
		} catch (err) {
			console.error('Acknowledge failed:', err);
		}
	};

	if (loading && signals.length === 0) {
		return (
			<div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
				<div className="divide-y divide-gray-700">
					{[...Array(5)].map((_, i) => (
						<div key={i} className="p-4 animate-pulse">
							<div className="flex items-start gap-4">
								<div className="w-3 h-3 rounded-full bg-gray-700 mt-1.5"></div>
								<div className="flex-1">
									<div className="h-4 bg-gray-700 rounded w-1/2 mb-2"></div>
									<div className="h-3 bg-gray-700 rounded w-3/4 mb-2"></div>
									<div className="h-3 bg-gray-700 rounded w-1/4"></div>
								</div>
							</div>
						</div>
					))}
				</div>
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

	if (signals.length === 0) {
		return (
			<div className="bg-gray-800 rounded-xl border border-gray-700 p-8 text-center">
				<svg className="w-16 h-16 mx-auto text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
				</svg>
				<h3 className="text-lg font-medium text-white mb-2">No signals found</h3>
				<p className="text-gray-400">Signals will appear when your strategies detect activity.</p>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			<div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
				<div className="divide-y divide-gray-700">
					{signals.map((signal) => {
						const colors = SEVERITY_COLORS[signal.severity] || SEVERITY_COLORS.info;
						
						return (
							<div
								key={signal.id}
								className={`p-4 hover:bg-gray-700/30 transition-colors ${
									!signal.acknowledged ? 'border-l-2 border-l-primary-500' : ''
								}`}
							>
								<div className="flex items-start gap-4">
									{/* Severity Badge */}
									<div className={`px-2 py-1 rounded text-xs font-medium ${colors.bg} ${colors.text} ${colors.border} border`}>
										{signal.severity.toUpperCase()}
									</div>
									
									{/* Content */}
									<div className="flex-1 min-w-0">
										<div className="flex items-center gap-2 mb-1">
											<h3 className="font-medium text-white">{signal.title}</h3>
											{!signal.acknowledged && (
												<span className="px-1.5 py-0.5 text-xs bg-primary-600 text-white rounded">New</span>
											)}
										</div>
										<p className="text-sm text-gray-400 mb-2">{signal.summary}</p>
										
										{/* Meta */}
										<div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
											<span>{formatRelativeTime(signal.ts)}</span>
											{signal.chain && (
												<span className="px-1.5 py-0.5 bg-gray-700 rounded">{signal.chain}</span>
											)}
											{signal.tokenSymbol && (
												<span className="font-mono">${signal.tokenSymbol}</span>
											)}
											{signal.token && (
												<span className="font-mono text-gray-600">{formatAddress(signal.token)}</span>
											)}
											{signal.wallet && (
												<span className="font-mono text-gray-600">Wallet: {formatAddress(signal.wallet)}</span>
											)}
											<span className="text-gray-600">Strategy: {signal.strategyId}</span>
										</div>
									</div>
									
									{/* Actions */}
									<div className="flex items-center gap-2">
										{!signal.acknowledged && (
											<button
												onClick={() => handleAcknowledge(signal.id)}
												className="px-3 py-1.5 text-sm text-gray-300 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"
											>
												Acknowledge
											</button>
										)}
										<button className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors">
											<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
											</svg>
										</button>
									</div>
								</div>
							</div>
						);
					})}
				</div>
			</div>

			{/* Pagination */}
			{totalPages > 1 && (
				<div className="flex items-center justify-between">
					<p className="text-sm text-gray-400">
						Page {page} of {totalPages}
					</p>
					<div className="flex items-center gap-2">
						<button
							onClick={() => setPage(p => Math.max(1, p - 1))}
							disabled={page === 1}
							className="px-3 py-1.5 text-sm text-gray-300 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
						>
							Previous
						</button>
						<button
							onClick={() => setPage(p => Math.min(totalPages, p + 1))}
							disabled={page === totalPages}
							className="px-3 py-1.5 text-sm text-gray-300 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
						>
							Next
						</button>
					</div>
				</div>
			)}
		</div>
	);
}


