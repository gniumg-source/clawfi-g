import { useEffect, useState } from 'react';
import { api, type RiskPolicy as RiskPolicyType } from '../lib/data';

export default function RiskPolicy() {
	const [policy, setPolicy] = useState<RiskPolicyType | null>(null);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const fetchPolicy = async () => {
		try {
			const data = await api.getRiskPolicy();
			setPolicy(data);
			setError(null);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to load policy');
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchPolicy();
	}, []);

	const handleKillSwitch = async () => {
		if (!policy) return;
		setSaving(true);
		try {
			const newPolicy = await api.setKillSwitch(!policy.killSwitchActive);
			setPolicy(newPolicy);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to toggle kill switch');
		} finally {
			setSaving(false);
		}
	};

	if (loading) {
		return (
			<div className="space-y-6">
				{[...Array(3)].map((_, i) => (
					<div key={i} className="bg-gray-800 rounded-xl border border-gray-700 p-6 animate-pulse">
						<div className="h-6 bg-gray-700 rounded w-1/4 mb-4"></div>
						<div className="grid grid-cols-2 gap-4">
							<div className="h-10 bg-gray-700 rounded"></div>
							<div className="h-10 bg-gray-700 rounded"></div>
						</div>
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

	return (
		<div className="space-y-6">
			{/* Kill Switch */}
			<div className={`rounded-xl border overflow-hidden ${
				policy?.killSwitchActive 
					? 'bg-red-900/20 border-red-700/50' 
					: 'bg-gray-800 border-gray-700'
			}`}>
				<div className="px-6 py-4 border-b border-gray-700">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-3">
							<svg className={`w-6 h-6 ${policy?.killSwitchActive ? 'text-red-400' : 'text-emerald-400'}`} fill="currentColor" viewBox="0 0 20 20">
								<path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
							</svg>
							<h2 className="text-lg font-semibold text-white">Kill Switch</h2>
						</div>
						<span className={`px-3 py-1 text-sm font-medium rounded-lg ${
							policy?.killSwitchActive 
								? 'bg-red-500 text-white' 
								: 'bg-emerald-900/30 text-emerald-400'
						}`}>
							{policy?.killSwitchActive ? 'ACTIVE' : 'OFF'}
						</span>
					</div>
				</div>
				<div className="p-6">
					<p className="text-gray-400 mb-4">
						{policy?.killSwitchActive 
							? 'All trading actions are currently blocked. Signals and monitoring continue.'
							: 'The kill switch will immediately halt all trading actions when activated.'
						}
					</p>
					<button
						onClick={handleKillSwitch}
						disabled={saving}
						className={`px-6 py-2 text-sm font-medium rounded-lg transition-colors ${
							policy?.killSwitchActive
								? 'bg-emerald-600 text-white hover:bg-emerald-700'
								: 'bg-red-600 text-white hover:bg-red-700'
						} disabled:opacity-50`}
					>
						{saving ? 'Processing...' : policy?.killSwitchActive ? 'Disable Kill Switch' : 'Activate Kill Switch'}
					</button>
				</div>
			</div>

			{/* Order Limits */}
			<div className="bg-gray-800 rounded-xl border border-gray-700">
				<div className="px-6 py-4 border-b border-gray-700">
					<h2 className="text-lg font-semibold text-white">Order Limits</h2>
				</div>
				<div className="p-6">
					<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
						<div>
							<label className="block text-sm font-medium text-gray-300 mb-2">Max Order Size (USD)</label>
							<input
								type="number"
								value={policy?.maxOrderUsd || 0}
								className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white"
								readOnly
							/>
						</div>
						<div>
							<label className="block text-sm font-medium text-gray-300 mb-2">Max Position Size (USD)</label>
							<input
								type="number"
								value={policy?.maxPositionUsd || 0}
								className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white"
								readOnly
							/>
						</div>
						<div>
							<label className="block text-sm font-medium text-gray-300 mb-2">Max Daily Loss (USD)</label>
							<input
								type="number"
								value={policy?.maxDailyLossUsd || 0}
								className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white"
								readOnly
							/>
						</div>
						<div>
							<label className="block text-sm font-medium text-gray-300 mb-2">Max Slippage (bps)</label>
							<input
								type="number"
								value={policy?.maxSlippageBps || 0}
								className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white"
								readOnly
							/>
						</div>
					</div>
				</div>
			</div>

			{/* Mode Settings */}
			<div className="bg-gray-800 rounded-xl border border-gray-700">
				<div className="px-6 py-4 border-b border-gray-700">
					<h2 className="text-lg font-semibold text-white">Mode Settings</h2>
				</div>
				<div className="p-6">
					<div className="flex items-center justify-between p-4 rounded-lg bg-yellow-900/20 border border-yellow-700/50">
						<div className="flex items-center gap-3">
							<svg className="w-6 h-6 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
								<path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
							</svg>
							<div>
								<p className="font-medium text-white">Dry Run Mode</p>
								<p className="text-sm text-gray-400">Simulates trades without executing them</p>
							</div>
						</div>
						<span className={`px-3 py-1 text-sm font-medium rounded-lg ${
							policy?.dryRunMode 
								? 'bg-yellow-500 text-black' 
								: 'bg-gray-700 text-gray-400'
						}`}>
							{policy?.dryRunMode ? 'ENABLED' : 'OFF'}
						</span>
					</div>
				</div>
			</div>
		</div>
	);
}


