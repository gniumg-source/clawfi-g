/**
 * Metrics Dashboard Component
 * 
 * Displays system metrics, performance data, and health status
 */

import { useEffect, useState } from 'react';
import { API_URL } from '../app/constants';
import { getAuthToken } from '../lib/data';

interface SystemMetrics {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: number;
  version: string;
  uptime: number;
  dependencies: Array<{
    name: string;
    status: 'connected' | 'degraded' | 'disconnected';
    latencyMs?: number;
    error?: string;
  }>;
  system: {
    platform: string;
    nodeVersion: string;
    cpuUsage: number;
    memoryUsage: {
      used: number;
      total: number;
      percentage: number;
    };
    loadAverage: number[];
  };
  services: {
    signalsToday: number;
    activeConnectors: number;
    activeStrategies: number;
    activeWebSockets: number;
  };
}

interface WebSocketStats {
  activeConnections: number;
  totalConnections: number;
  totalMessages: number;
  lastActivity: number;
}

export default function MetricsDashboard() {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [wsStats, setWsStats] = useState<WebSocketStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchMetrics = async () => {
    try {
      const token = getAuthToken();
      if (!token) {
        setError('Not authenticated');
        setLoading(false);
        return;
      }

      const [healthRes, wsRes] = await Promise.all([
        fetch(`${API_URL}/health/detailed`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_URL}/ws/stats`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (healthRes.ok) {
        const data = await healthRes.json();
        setMetrics(data.data);
      }

      if (wsRes.ok) {
        const data = await wsRes.json();
        setWsStats(data.data);
      }

      setError(null);
    } catch (err) {
      setError('Failed to fetch metrics');
      console.error('Metrics error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchMetrics();
  };

  const formatUptime = (seconds: number): string => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (days > 0) return `${days}d ${hours}h ${mins}m`;
    if (hours > 0) return `${hours}h ${mins}m ${secs}s`;
    return `${mins}m ${secs}s`;
  };

  const formatBytes = (bytes: number): string => {
    const units = ['B', 'KB', 'MB', 'GB'];
    let value = bytes;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex++;
    }
    return `${value.toFixed(1)} ${units[unitIndex]}`;
  };

  const formatTime = (ts: number): string => {
    return new Date(ts).toLocaleTimeString();
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'healthy':
      case 'connected':
        return 'text-green-500';
      case 'degraded':
        return 'text-yellow-500';
      default:
        return 'text-red-500';
    }
  };

  const getStatusBg = (status: string): string => {
    switch (status) {
      case 'healthy':
      case 'connected':
        return 'bg-green-500/10 border-green-500/30';
      case 'degraded':
        return 'bg-yellow-500/10 border-yellow-500/30';
      default:
        return 'bg-red-500/10 border-red-500/30';
    }
  };

  if (loading) {
    return (
      <div className="p-6 text-center text-gray-400">
        <div className="animate-spin inline-block w-6 h-6 border-2 border-gray-500 border-t-primary-500 rounded-full mb-2"></div>
        <p>Loading metrics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-400 mb-4">{error}</p>
        <button
          onClick={handleRefresh}
          className="px-4 py-2 bg-primary-600 hover:bg-primary-700 rounded-lg text-white text-sm"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!metrics) {
    return <div className="p-6 text-center text-gray-400">No metrics available</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-white">System Metrics</h2>
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusBg(metrics.status)} ${getStatusColor(metrics.status)}`}>
            {metrics.status.toUpperCase()}
          </span>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
        >
          <svg className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <p className="text-gray-400 text-xs mb-1">Uptime</p>
          <p className="text-xl font-semibold text-white">{formatUptime(metrics.uptime)}</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <p className="text-gray-400 text-xs mb-1">Signals Today</p>
          <p className="text-xl font-semibold text-primary-400">{metrics.services.signalsToday}</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <p className="text-gray-400 text-xs mb-1">Active Connectors</p>
          <p className="text-xl font-semibold text-green-400">{metrics.services.activeConnectors}</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <p className="text-gray-400 text-xs mb-1">WebSocket Clients</p>
          <p className="text-xl font-semibold text-blue-400">{wsStats?.activeConnections || metrics.services.activeWebSockets}</p>
        </div>
      </div>

      {/* System Resources */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <h3 className="text-sm font-medium text-gray-300 mb-4">System Resources</h3>
        <div className="space-y-4">
          {/* Memory */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-400">Memory</span>
              <span className="text-white">
                {formatBytes(metrics.system.memoryUsage.used)} / {formatBytes(metrics.system.memoryUsage.total)}
              </span>
            </div>
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  metrics.system.memoryUsage.percentage > 80 ? 'bg-red-500' :
                  metrics.system.memoryUsage.percentage > 60 ? 'bg-yellow-500' : 'bg-green-500'
                }`}
                style={{ width: `${metrics.system.memoryUsage.percentage}%` }}
              />
            </div>
          </div>

          {/* Load Average */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-400">Load Average</span>
              <span className="text-white">
                {metrics.system.loadAverage.map(l => l.toFixed(2)).join(' / ')}
              </span>
            </div>
            <div className="text-xs text-gray-500">
              1m / 5m / 15m
            </div>
          </div>

          {/* System Info */}
          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-700">
            <div>
              <p className="text-xs text-gray-500">Platform</p>
              <p className="text-sm text-gray-300">{metrics.system.platform}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Node.js</p>
              <p className="text-sm text-gray-300">{metrics.system.nodeVersion}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Dependencies */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <h3 className="text-sm font-medium text-gray-300 mb-4">Dependencies</h3>
        <div className="space-y-2">
          {metrics.dependencies.map((dep, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-gray-700 last:border-0">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${
                  dep.status === 'connected' ? 'bg-green-500' :
                  dep.status === 'degraded' ? 'bg-yellow-500' : 'bg-red-500'
                }`} />
                <span className="text-sm text-gray-300">{dep.name}</span>
              </div>
              <div className="flex items-center gap-3">
                {dep.latencyMs !== undefined && (
                  <span className="text-xs text-gray-500">{dep.latencyMs}ms</span>
                )}
                <span className={`text-xs font-medium ${getStatusColor(dep.status)}`}>
                  {dep.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* WebSocket Stats */}
      {wsStats && (
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h3 className="text-sm font-medium text-gray-300 mb-4">WebSocket Statistics</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-gray-500">Active</p>
              <p className="text-lg font-semibold text-white">{wsStats.activeConnections}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Total Connections</p>
              <p className="text-lg font-semibold text-gray-300">{wsStats.totalConnections}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Messages Sent</p>
              <p className="text-lg font-semibold text-gray-300">{wsStats.totalMessages.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Last Activity</p>
              <p className="text-sm text-gray-300">{formatTime(wsStats.lastActivity)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="text-xs text-gray-500 text-center">
        Version {metrics.version} • Last updated {formatTime(metrics.timestamp)}
      </div>
    </div>
  );
}
