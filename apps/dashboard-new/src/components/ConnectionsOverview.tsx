import { useEffect, useState } from 'react';
import { api, type Connection } from '../lib/data';

const STATUS_COLORS: Record<string, string> = {
	connected: 'bg-emerald-500',
	degraded: 'bg-yellow-500',
	offline: 'bg-red-500',
	disconnected: 'bg-gray-500',
};

const TYPE_ICONS: Record<string, JSX.Element> = {
	cex: (
		<svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
			<path d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" />
		</svg>
	),
	dex: (
		<svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
			<path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM4.332 8.027a6.012 6.012 0 011.912-2.706C6.512 5.73 6.974 6 7.5 6A1.5 1.5 0 019 7.5V8a2 2 0 004 0 2 2 0 011.523-1.943A5.977 5.977 0 0116 10c0 .34-.028.675-.083 1H15a2 2 0 00-2 2v2.197A5.973 5.973 0 0110 16v-2a2 2 0 00-2-2 2 2 0 01-2-2 2 2 0 00-1.668-1.973z" clipRule="evenodd" />
		</svg>
	),
	launchpad: (
		<svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
			<path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
		</svg>
	),
	wallet: (
		<svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
			<path d="M18 8a2 2 0 00-2-2h-1V5a3 3 0 00-3-3H6a3 3 0 00-3 3v1H2a2 2 0 00-2 2v8a2 2 0 002 2h16a2 2 0 002-2v-8zM5 5a1 1 0 011-1h6a1 1 0 011 1v1H5V5zm7 8a1 1 0 11-2 0 1 1 0 012 0z" />
		</svg>
	),
};

export default function ConnectionsOverview() {
	const [connections, setConnections] = useState<Connection[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const fetchConnections = async () => {
			try {
				const data = await api.getConnections();
				setConnections(data);
				setError(null);
			} catch (err) {
				setError(err instanceof Error ? err.message : 'Failed to load connections');
			} finally {
				setLoading(false);
			}
		};

		fetchConnections();
	}, []);

	if (loading) {
		return (
			<div className="p-6 space-y-4">
				{[...Array(3)].map((_, i) => (
					<div key={i} className="flex items-center gap-4 animate-pulse">
						<div className="w-8 h-8 rounded-lg bg-gray-700"></div>
						<div className="flex-1">
							<div className="h-4 bg-gray-700 rounded w-1/2 mb-2"></div>
							<div className="h-3 bg-gray-700 rounded w-1/4"></div>
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

	if (connections.length === 0) {
		return (
			<div className="p-6 text-center">
				<svg className="w-12 h-12 mx-auto text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
				</svg>
				<p className="text-gray-500">No connections configured</p>
				<a href="/connections" className="inline-block mt-2 text-sm text-primary-400 hover:text-primary-300">
					Add your first connection →
				</a>
			</div>
		);
	}

	// Group by type
	const grouped = connections.reduce((acc, conn) => {
		acc[conn.type] = acc[conn.type] || [];
		acc[conn.type].push(conn);
		return acc;
	}, {} as Record<string, Connection[]>);

	return (
		<div className="divide-y divide-gray-700">
			{Object.entries(grouped).map(([type, conns]) => (
				<div key={type} className="p-4">
					<div className="flex items-center gap-2 mb-3 text-xs font-medium text-gray-400 uppercase">
						{TYPE_ICONS[type]}
						<span>{type}s</span>
						<span className="ml-auto px-1.5 py-0.5 bg-gray-700 rounded">{conns.length}</span>
					</div>
					<div className="space-y-2">
						{conns.slice(0, 3).map((conn) => (
							<div key={conn.id} className="flex items-center gap-3 p-2 rounded-lg bg-gray-700/30">
								<div className={`w-2 h-2 rounded-full ${STATUS_COLORS[conn.status]}`}></div>
								<span className="text-sm text-white flex-1 truncate">{conn.name}</span>
								<span className="text-xs text-gray-500">{conn.venue}</span>
							</div>
						))}
						{conns.length > 3 && (
							<p className="text-xs text-gray-500 pl-5">+{conns.length - 3} more</p>
						)}
					</div>
				</div>
			))}
		</div>
	);
}


