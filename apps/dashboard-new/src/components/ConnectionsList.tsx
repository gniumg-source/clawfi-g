import { useEffect, useState } from 'react';
import { api, type Connection } from '../lib/data';

const STATUS_COLORS: Record<string, string> = {
	connected: 'bg-emerald-500',
	degraded: 'bg-yellow-500',
	offline: 'bg-red-500',
	disconnected: 'bg-gray-500',
};

const STATUS_TEXT: Record<string, string> = {
	connected: 'text-emerald-400',
	degraded: 'text-yellow-400',
	offline: 'text-red-400',
	disconnected: 'text-gray-400',
};

export default function ConnectionsList() {
	const [connections, setConnections] = useState<Connection[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [testingId, setTestingId] = useState<string | null>(null);

	const fetchConnections = async () => {
		try {
			const data = await api.getConnections();
			setConnections(data);
			setError(null);
			
			// Update stats
			const total = data.length;
			const connected = data.filter(c => c.status === 'connected').length;
			const degraded = data.filter(c => c.status === 'degraded').length;
			const offline = data.filter(c => c.status === 'offline' || c.status === 'disconnected').length;
			
			document.getElementById('stat-total')?.textContent !== undefined && 
				(document.getElementById('stat-total')!.textContent = total.toString());
			document.getElementById('stat-connected')?.textContent !== undefined && 
				(document.getElementById('stat-connected')!.textContent = connected.toString());
			document.getElementById('stat-degraded')?.textContent !== undefined && 
				(document.getElementById('stat-degraded')!.textContent = degraded.toString());
			document.getElementById('stat-offline')?.textContent !== undefined && 
				(document.getElementById('stat-offline')!.textContent = offline.toString());
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to load connections');
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchConnections();
	}, []);

	const handleTest = async (id: string) => {
		setTestingId(id);
		try {
			const result = await api.testConnection(id);
			if (result.success) {
				fetchConnections();
			}
		} catch (err) {
			console.error('Test failed:', err);
		} finally {
			setTestingId(null);
		}
	};

	const handleToggle = async (id: string, enabled: boolean) => {
		try {
			if (enabled) {
				await api.stopConnection(id);
			} else {
				await api.startConnection(id);
			}
			fetchConnections();
		} catch (err) {
			console.error('Toggle failed:', err);
		}
	};

	if (loading) {
		return (
			<div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
				<div className="divide-y divide-gray-700">
					{[...Array(3)].map((_, i) => (
						<div key={i} className="p-4 animate-pulse">
							<div className="flex items-center gap-4">
								<div className="w-10 h-10 rounded-lg bg-gray-700"></div>
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

	if (connections.length === 0) {
		return (
			<div className="bg-gray-800 rounded-xl border border-gray-700 p-8 text-center">
				<svg className="w-16 h-16 mx-auto text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
				</svg>
				<h3 className="text-lg font-medium text-white mb-2">No connections configured</h3>
				<p className="text-gray-400 mb-4">Add your first exchange, wallet, or launchpad connection to get started.</p>
				<button className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">
					Add Connection
				</button>
			</div>
		);
	}

	// Group by type
	const grouped = connections.reduce((acc, conn) => {
		acc[conn.type] = acc[conn.type] || [];
		acc[conn.type].push(conn);
		return acc;
	}, {} as Record<string, Connection[]>);

	const typeLabels: Record<string, string> = {
		cex: 'Centralized Exchanges',
		dex: 'Decentralized Exchanges',
		launchpad: 'Launchpads',
		wallet: 'Wallets',
	};

	return (
		<div className="space-y-6">
			{Object.entries(grouped).map(([type, conns]) => (
				<div key={type} className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
					<div className="px-6 py-4 border-b border-gray-700 bg-gray-800/50">
						<h3 className="font-medium text-white">{typeLabels[type] || type}</h3>
					</div>
					<div className="divide-y divide-gray-700">
						{conns.map((conn) => (
							<div key={conn.id} className="p-4 hover:bg-gray-700/30 transition-colors">
								<div className="flex items-center gap-4">
									{/* Status Indicator */}
									<div className={`w-10 h-10 rounded-lg bg-gray-700 flex items-center justify-center`}>
										<div className={`w-3 h-3 rounded-full ${STATUS_COLORS[conn.status]}`}></div>
									</div>
									
									{/* Info */}
									<div className="flex-1 min-w-0">
										<div className="flex items-center gap-2">
											<span className="font-medium text-white">{conn.name}</span>
											{conn.chain && (
												<span className="px-1.5 py-0.5 text-xs bg-gray-700 text-gray-300 rounded">
													{conn.chain}
												</span>
											)}
										</div>
										<div className="flex items-center gap-3 text-sm text-gray-400 mt-1">
											<span className={STATUS_TEXT[conn.status]}>
												{conn.status.charAt(0).toUpperCase() + conn.status.slice(1)}
											</span>
											<span>•</span>
											<span>{conn.venue}</span>
											{conn.lastError && (
												<>
													<span>•</span>
													<span className="text-red-400 truncate max-w-[200px]" title={conn.lastError}>
														{conn.lastError}
													</span>
												</>
											)}
										</div>
									</div>
									
									{/* Actions */}
									<div className="flex items-center gap-2">
										<button
											onClick={() => handleTest(conn.id)}
											disabled={testingId === conn.id}
											className="px-3 py-1.5 text-sm text-gray-300 bg-gray-700 rounded-lg hover:bg-gray-600 disabled:opacity-50 transition-colors"
										>
											{testingId === conn.id ? (
												<svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
													<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
													<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
												</svg>
											) : (
												'Test'
											)}
										</button>
										<button
											onClick={() => handleToggle(conn.id, conn.enabled)}
											className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
												conn.enabled
													? 'text-red-400 bg-red-900/30 hover:bg-red-900/50'
													: 'text-emerald-400 bg-emerald-900/30 hover:bg-emerald-900/50'
											}`}
										>
											{conn.enabled ? 'Disable' : 'Enable'}
										</button>
									</div>
								</div>
							</div>
						))}
					</div>
				</div>
			))}
		</div>
	);
}


