import { useEffect, useState } from 'react';
import { api, formatRelativeTime, type AuditLog } from '../lib/data';

export default function AuditLogList() {
	const [logs, setLogs] = useState<AuditLog[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [page, setPage] = useState(1);
	const [totalPages, setTotalPages] = useState(1);

	const fetchLogs = async () => {
		try {
			setLoading(true);
			const data = await api.getAuditLogs({ page: page.toString(), limit: '20' });
			setLogs(data.data);
			setTotalPages(data.pagination.totalPages);
			setError(null);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to load audit logs');
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchLogs();
	}, [page]);

	if (loading && logs.length === 0) {
		return (
			<div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
				<div className="divide-y divide-gray-700">
					{[...Array(10)].map((_, i) => (
						<div key={i} className="p-4 animate-pulse">
							<div className="flex items-center gap-4">
								<div className="w-8 h-8 rounded bg-gray-700"></div>
								<div className="flex-1">
									<div className="h-4 bg-gray-700 rounded w-1/3 mb-2"></div>
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

	if (logs.length === 0) {
		return (
			<div className="bg-gray-800 rounded-xl border border-gray-700 p-8 text-center">
				<svg className="w-16 h-16 mx-auto text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
				</svg>
				<h3 className="text-lg font-medium text-white mb-2">No audit logs</h3>
				<p className="text-gray-400">System activity will be recorded here.</p>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			<div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
				<table className="w-full">
					<thead className="bg-gray-700/50">
						<tr>
							<th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Time</th>
							<th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Action</th>
							<th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Resource</th>
							<th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Status</th>
							<th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">IP</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-gray-700">
						{logs.map((log) => (
							<tr key={log.id} className="hover:bg-gray-700/30 transition-colors">
								<td className="px-4 py-3">
									<span className="text-sm text-gray-400">{formatRelativeTime(log.ts)}</span>
								</td>
								<td className="px-4 py-3">
									<span className="text-sm text-white font-mono">{log.action}</span>
								</td>
								<td className="px-4 py-3">
									<span className="text-sm text-gray-400">{log.resource || '-'}</span>
								</td>
								<td className="px-4 py-3">
									<span className={`px-2 py-1 text-xs rounded ${
										log.success 
											? 'bg-emerald-900/30 text-emerald-400' 
											: 'bg-red-900/30 text-red-400'
									}`}>
										{log.success ? 'Success' : 'Failed'}
									</span>
								</td>
								<td className="px-4 py-3">
									<span className="text-sm text-gray-500 font-mono">{log.ip || '-'}</span>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			{totalPages > 1 && (
				<div className="flex items-center justify-between">
					<p className="text-sm text-gray-400">Page {page} of {totalPages}</p>
					<div className="flex items-center gap-2">
						<button
							onClick={() => setPage(p => Math.max(1, p - 1))}
							disabled={page === 1}
							className="px-3 py-1.5 text-sm text-gray-300 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
						>
							Previous
						</button>
						<button
							onClick={() => setPage(p => Math.min(totalPages, p + 1))}
							disabled={page === totalPages}
							className="px-3 py-1.5 text-sm text-gray-300 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
						>
							Next
						</button>
					</div>
				</div>
			)}
		</div>
	);
}


