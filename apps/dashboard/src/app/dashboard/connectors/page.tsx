'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Plug,
  Plus,
  Trash2,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Play,
  Square,
  Wifi,
  WifiOff,
  Activity,
  Rocket,
  TrendingUp,
} from 'lucide-react';
import { formatRelativeTime } from '@/lib/utils';

// ============================================
// Types
// ============================================

interface UnifiedConnection {
  id: string;
  name: string;
  type: 'cex' | 'dex' | 'launchpad' | 'wallet';
  venue: string;
  chain?: string;
  status: 'connected' | 'degraded' | 'offline' | 'error';
  enabled: boolean;
  lastSeen?: number;
  lastPoll?: number;
  latencyMs?: number;
  lastError?: string;
  meta?: Record<string, unknown>;
}

interface Balance {
  asset: string;
  free: string;
  locked: string;
  total: string;
}

// ============================================
// Component
// ============================================

export default function ConnectionsPage() {
  const { token, nodeUrl } = useAuth();
  const [connections, setConnections] = useState<UnifiedConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addingConnector, setAddingConnector] = useState(false);
  const [selectedConnector, setSelectedConnector] = useState<string | null>(null);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [loadingBalances, setLoadingBalances] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Form state
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [label, setLabel] = useState('');
  const [testnet, setTestnet] = useState(true);
  const [formError, setFormError] = useState('');

  const fetchConnections = async () => {
    if (!token || !nodeUrl) return;
    try {
      const response = await fetch(`${nodeUrl}/connections`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setConnections(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch connections:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConnections();
    // Refresh every 30 seconds
    const interval = setInterval(fetchConnections, 30000);
    return () => clearInterval(interval);
  }, [token, nodeUrl]);

  const handleAddConnector = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !nodeUrl) return;

    setFormError('');
    setAddingConnector(true);

    try {
      const response = await fetch(`${nodeUrl}/connectors/binance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ apiKey, apiSecret, label: label || undefined, testnet }),
      });
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to add connector');
      }
      
      // Reset form
      setApiKey('');
      setApiSecret('');
      setLabel('');
      setTestnet(true);
      setShowAddForm(false);
      
      // Refresh list
      await fetchConnections();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to add connector');
    } finally {
      setAddingConnector(false);
    }
  };

  const handleRemoveConnector = async (id: string) => {
    if (!token || !nodeUrl) return;
    if (!confirm('Are you sure you want to remove this connector?')) return;

    try {
      await fetch(`${nodeUrl}/connectors/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchConnections();
    } catch (error) {
      console.error('Failed to remove connector:', error);
    }
  };

  const handleStartConnector = async (id: string) => {
    if (!token || !nodeUrl) return;
    setActionLoading(id);
    try {
      await fetch(`${nodeUrl}/connections/${id}/start`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchConnections();
    } catch (error) {
      console.error('Failed to start connector:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleStopConnector = async (id: string) => {
    if (!token || !nodeUrl) return;
    setActionLoading(id);
    try {
      await fetch(`${nodeUrl}/connections/${id}/stop`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchConnections();
    } catch (error) {
      console.error('Failed to stop connector:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleHealthCheck = async (id: string) => {
    if (!token || !nodeUrl) return;
    setActionLoading(id);
    try {
      const response = await fetch(`${nodeUrl}/connections/${id}/health`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      
      if (data.success) {
        const health = data.data;
        alert(`Health Check: ${health.status}\n${health.latencyMs ? `Latency: ${health.latencyMs}ms` : ''}${health.error ? `\nError: ${health.error}` : ''}`);
      }
      await fetchConnections();
    } catch (error) {
      console.error('Failed to check health:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleViewBalances = async (id: string) => {
    if (!token || !nodeUrl) return;
    setSelectedConnector(id);
    setLoadingBalances(true);

    try {
      const response = await fetch(`${nodeUrl}/connectors/${id}/balances`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setBalances(data.data);
      } else {
        setBalances([]);
      }
    } catch (error) {
      console.error('Failed to fetch balances:', error);
      setBalances([]);
    } finally {
      setLoadingBalances(false);
    }
  };

  const getStatusIcon = (status: string, enabled: boolean) => {
    if (!enabled) return <WifiOff className="w-5 h-5 text-muted-foreground" />;
    switch (status) {
      case 'connected':
        return <CheckCircle className="w-5 h-5 text-emerald-500" />;
      case 'degraded':
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-destructive" />;
      default:
        return <WifiOff className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'cex':
        return <TrendingUp className="w-5 h-5" />;
      case 'launchpad':
        return <Rocket className="w-5 h-5" />;
      case 'dex':
        return <Activity className="w-5 h-5" />;
      default:
        return <Plug className="w-5 h-5" />;
    }
  };

  const getStatusBadgeColor = (status: string, enabled: boolean) => {
    if (!enabled) return 'bg-gray-500/20 text-gray-500';
    switch (status) {
      case 'connected':
        return 'bg-emerald-500/20 text-emerald-500';
      case 'degraded':
        return 'bg-yellow-500/20 text-yellow-500';
      case 'error':
        return 'bg-red-500/20 text-red-500';
      default:
        return 'bg-gray-500/20 text-gray-500';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-claw-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Group connections by type
  const launchpadConnections = connections.filter(c => c.type === 'launchpad');
  const cexConnections = connections.filter(c => c.type === 'cex');
  const dexConnections = connections.filter(c => c.type === 'dex');
  const walletConnections = connections.filter(c => c.type === 'wallet');

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Connections</h1>
          <p className="text-muted-foreground">Manage your exchange, DEX, and launchpad connections</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchConnections}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => setShowAddForm(true)} className="bg-claw-600 hover:bg-claw-500">
            <Plus className="w-4 h-4 mr-2" />
            Add Connection
          </Button>
        </div>
      </div>

      {/* Connection Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="p-3 rounded-lg bg-emerald-500/20">
              <Wifi className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{connections.filter(c => c.status === 'connected').length}</p>
              <p className="text-sm text-muted-foreground">Connected</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="p-3 rounded-lg bg-yellow-500/20">
              <AlertCircle className="w-5 h-5 text-yellow-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{connections.filter(c => c.status === 'degraded').length}</p>
              <p className="text-sm text-muted-foreground">Degraded</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="p-3 rounded-lg bg-gray-500/20">
              <WifiOff className="w-5 h-5 text-gray-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{connections.filter(c => c.status === 'offline' || !c.enabled).length}</p>
              <p className="text-sm text-muted-foreground">Offline</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="p-3 rounded-lg bg-red-500/20">
              <XCircle className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{connections.filter(c => c.status === 'error').length}</p>
              <p className="text-sm text-muted-foreground">Error</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add Connector Form */}
      {showAddForm && (
        <Card className="border-claw-900/50">
          <CardHeader>
            <CardTitle>Add Binance Connector</CardTitle>
            <CardDescription>
              <span className="text-destructive font-medium">⚠️ Important:</span> Only use API keys
              with withdrawals DISABLED. We recommend starting with the testnet.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddConnector} className="space-y-4">
              {formError && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                  <AlertCircle className="w-4 h-4" />
                  {formError}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="label">Label (optional)</Label>
                <Input
                  id="label"
                  placeholder="My Binance Account"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  className="bg-secondary/50"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="apiKey">API Key</Label>
                <Input
                  id="apiKey"
                  type="password"
                  placeholder="Enter your Binance API key"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  required
                  className="bg-secondary/50"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="apiSecret">API Secret</Label>
                <Input
                  id="apiSecret"
                  type="password"
                  placeholder="Enter your Binance API secret"
                  value={apiSecret}
                  onChange={(e) => setApiSecret(e.target.value)}
                  required
                  className="bg-secondary/50"
                />
              </div>

              <div className="flex items-center gap-2">
                <Switch checked={testnet} onCheckedChange={setTestnet} id="testnet" />
                <Label htmlFor="testnet">Use Testnet (recommended for testing)</Label>
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={addingConnector} className="bg-claw-600 hover:bg-claw-500">
                  {addingConnector ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    'Add Connector'
                  )}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowAddForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Launchpad Connections */}
      {launchpadConnections.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Rocket className="w-5 h-5 text-claw-500" />
            Launchpad Connectors
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {launchpadConnections.map((conn) => (
              <ConnectionCard
                key={conn.id}
                connection={conn}
                actionLoading={actionLoading}
                onStart={handleStartConnector}
                onStop={handleStopConnector}
                onHealthCheck={handleHealthCheck}
                onRemove={handleRemoveConnector}
                getStatusIcon={getStatusIcon}
                getTypeIcon={getTypeIcon}
                getStatusBadgeColor={getStatusBadgeColor}
              />
            ))}
          </div>
        </div>
      )}

      {/* CEX Connections */}
      {cexConnections.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-claw-500" />
            Exchange Connectors (CEX)
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {cexConnections.map((conn) => (
              <ConnectionCard
                key={conn.id}
                connection={conn}
                actionLoading={actionLoading}
                onStart={handleStartConnector}
                onStop={handleStopConnector}
                onHealthCheck={handleHealthCheck}
                onRemove={handleRemoveConnector}
                onViewBalances={handleViewBalances}
                getStatusIcon={getStatusIcon}
                getTypeIcon={getTypeIcon}
                getStatusBadgeColor={getStatusBadgeColor}
              />
            ))}
          </div>
        </div>
      )}

      {/* DEX Connections */}
      {dexConnections.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Activity className="w-5 h-5 text-claw-500" />
            DEX Connectors
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {dexConnections.map((conn) => (
              <ConnectionCard
                key={conn.id}
                connection={conn}
                actionLoading={actionLoading}
                onStart={handleStartConnector}
                onStop={handleStopConnector}
                onHealthCheck={handleHealthCheck}
                onRemove={handleRemoveConnector}
                getStatusIcon={getStatusIcon}
                getTypeIcon={getTypeIcon}
                getStatusBadgeColor={getStatusBadgeColor}
              />
            ))}
          </div>
        </div>
      )}

      {/* No Connections */}
      {connections.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Plug className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No connections configured</p>
            <p className="text-muted-foreground">Add a connector to start monitoring</p>
          </CardContent>
        </Card>
      )}

      {/* Balances Modal */}
      {selectedConnector && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Balances</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setSelectedConnector(null)}>
              Close
            </Button>
          </CardHeader>
          <CardContent>
            {loadingBalances ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : balances.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No balances found</p>
            ) : (
              <div className="space-y-2">
                {balances.map((balance) => (
                  <div
                    key={balance.asset}
                    className="flex items-center justify-between p-3 rounded-lg bg-secondary/50"
                  >
                    <span className="font-medium">{balance.asset}</span>
                    <div className="text-right">
                      <p className="font-mono">{parseFloat(balance.total).toFixed(8)}</p>
                      <p className="text-xs text-muted-foreground">
                        Free: {parseFloat(balance.free).toFixed(8)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============================================
// Connection Card Component
// ============================================

interface ConnectionCardProps {
  connection: UnifiedConnection;
  actionLoading: string | null;
  onStart: (id: string) => void;
  onStop: (id: string) => void;
  onHealthCheck: (id: string) => void;
  onRemove: (id: string) => void;
  onViewBalances?: (id: string) => void;
  getStatusIcon: (status: string, enabled: boolean) => JSX.Element;
  getTypeIcon: (type: string) => JSX.Element;
  getStatusBadgeColor: (status: string, enabled: boolean) => string;
}

function ConnectionCard({
  connection,
  actionLoading,
  onStart,
  onStop,
  onHealthCheck,
  onRemove,
  onViewBalances,
  getStatusIcon,
  getTypeIcon,
  getStatusBadgeColor,
}: ConnectionCardProps) {
  const isLoading = actionLoading === connection.id;
  
  return (
    <Card className={connection.status === 'error' ? 'border-red-500/50' : ''}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-secondary">
            {getTypeIcon(connection.type)}
          </div>
          <div>
            <CardTitle className="text-lg">{connection.name}</CardTitle>
            <CardDescription className="flex items-center gap-2">
              <span className="capitalize">{connection.venue}</span>
              {connection.chain && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-500">
                  {connection.chain}
                </span>
              )}
            </CardDescription>
          </div>
        </div>
        {getStatusIcon(connection.status, connection.enabled)}
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Status Badge */}
          <div className="flex items-center justify-between">
            <span className={`text-xs px-2 py-1 rounded-full ${getStatusBadgeColor(connection.status, connection.enabled)}`}>
              {connection.enabled ? connection.status.toUpperCase() : 'DISABLED'}
            </span>
            {connection.lastSeen && (
              <span className="text-xs text-muted-foreground">
                Last seen: {formatRelativeTime(connection.lastSeen)}
              </span>
            )}
          </div>

          {/* Error Message */}
          {connection.lastError && (
            <div className="text-xs text-red-400 bg-red-500/10 px-2 py-1 rounded">
              {connection.lastError}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 flex-wrap">
            {connection.enabled ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onStop(connection.id)}
                disabled={isLoading}
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4 mr-1" />}
                Stop
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onStart(connection.id)}
                disabled={isLoading}
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 mr-1" />}
                Start
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onHealthCheck(connection.id)}
              disabled={isLoading}
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              Test
            </Button>
            {onViewBalances && connection.type === 'cex' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onViewBalances(connection.id)}
              >
                Balances
              </Button>
            )}
            {connection.type === 'cex' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onRemove(connection.id)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
