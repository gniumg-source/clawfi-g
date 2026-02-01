/**
 * ClawFi Dashboard - Alerts Manager Component
 * Create and manage price alerts for tokens
 */

import { useEffect, useState } from 'react';
import { 
  dexscreenerApi, 
  formatPrice, 
  formatChange,
  getChainName,
  getChainColor,
  type DexscreenerPair
} from '../lib/dexscreener';

interface PriceAlert {
  id: string;
  tokenAddress: string;
  chain: string;
  symbol: string;
  name: string;
  type: 'above' | 'below' | 'change';
  targetValue: number;
  currentPrice?: number;
  createdAt: number;
  triggered: boolean;
  triggeredAt?: number;
  enabled: boolean;
}

const STORAGE_KEY = 'clawfi_alerts';

export default function AlertsManager() {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<DexscreenerPair[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedToken, setSelectedToken] = useState<DexscreenerPair | null>(null);
  const [alertType, setAlertType] = useState<'above' | 'below' | 'change'>('above');
  const [targetValue, setTargetValue] = useState('');

  // Load alerts from storage
  const loadAlerts = async () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const items: PriceAlert[] = stored ? JSON.parse(stored) : [];
      
      // Update current prices
      for (const alert of items) {
        if (!alert.triggered) {
          const pairs = await dexscreenerApi.getTokenPairs(alert.tokenAddress);
          const pair = pairs.find(p => p.chainId === alert.chain) || pairs[0];
          if (pair?.priceUsd) {
            alert.currentPrice = parseFloat(pair.priceUsd);
            
            // Check if alert should trigger
            if (alert.enabled && !alert.triggered) {
              const shouldTrigger = 
                (alert.type === 'above' && alert.currentPrice >= alert.targetValue) ||
                (alert.type === 'below' && alert.currentPrice <= alert.targetValue);
              
              if (shouldTrigger) {
                alert.triggered = true;
                alert.triggeredAt = Date.now();
                // Show notification
                if ('Notification' in window && Notification.permission === 'granted') {
                  new Notification(`ClawFi Alert: ${alert.symbol}`, {
                    body: `Price ${alert.type === 'above' ? 'above' : 'below'} ${formatPrice(alert.targetValue)}`,
                    icon: '/favicon.svg',
                  });
                }
              }
            }
          }
        }
      }
      
      // Save updated alerts
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      setAlerts(items);
    } catch (error) {
      console.error('Error loading alerts:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Save alerts to storage
  const saveAlerts = (items: PriceAlert[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    setAlerts(items);
  };

  // Create new alert
  const createAlert = () => {
    if (!selectedToken || !targetValue) return;
    
    const newAlert: PriceAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      tokenAddress: selectedToken.baseToken.address,
      chain: selectedToken.chainId,
      symbol: selectedToken.baseToken.symbol,
      name: selectedToken.baseToken.name,
      type: alertType,
      targetValue: parseFloat(targetValue),
      currentPrice: selectedToken.priceUsd ? parseFloat(selectedToken.priceUsd) : undefined,
      createdAt: Date.now(),
      triggered: false,
      enabled: true,
    };
    
    saveAlerts([newAlert, ...alerts]);
    setShowCreateModal(false);
    setSelectedToken(null);
    setTargetValue('');
    setSearchQuery('');
    setSearchResults([]);
  };

  // Delete alert
  const deleteAlert = (id: string) => {
    saveAlerts(alerts.filter(a => a.id !== id));
  };

  // Toggle alert enabled
  const toggleAlert = (id: string) => {
    const updated = alerts.map(a => 
      a.id === id ? { ...a, enabled: !a.enabled } : a
    );
    saveAlerts(updated);
  };

  // Search tokens
  const searchTokens = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    
    setSearching(true);
    try {
      const results = await dexscreenerApi.searchPairs(searchQuery);
      const seen = new Set<string>();
      const unique = results.filter(p => {
        const key = `${p.chainId}-${p.baseToken.address}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      setSearchResults(unique.slice(0, 8));
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    loadAlerts();
    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    
    // Check alerts every 30 seconds
    const interval = setInterval(loadAlerts, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const timer = setTimeout(searchTokens, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const refresh = () => {
    setRefreshing(true);
    loadAlerts();
  };

  const activeAlerts = alerts.filter(a => a.enabled && !a.triggered);
  const triggeredAlerts = alerts.filter(a => a.triggered);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="h-8 w-48 bg-white/5 rounded-lg animate-pulse"></div>
          <div className="h-10 w-32 bg-white/5 rounded-xl animate-pulse"></div>
        </div>
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card-glass p-4 animate-pulse">
              <div className="h-16 bg-white/5 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="text-2xl">🔔</span>
            Price Alerts
          </h2>
          <p className="text-sm text-secondary mt-1">
            {activeAlerts.length} active • {triggeredAlerts.length} triggered
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={refresh}
            disabled={refreshing}
            className="btn-glass px-4 py-2 disabled:opacity-50"
          >
            {refreshing ? (
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
          </button>
          <button 
            onClick={() => setShowCreateModal(true)}
            className="btn-glass btn-glass-primary flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Alert
          </button>
        </div>
      </div>

      {/* Alerts List */}
      {alerts.length === 0 ? (
        <div className="card-glass p-12 text-center">
          <div className="text-5xl mb-4">🔔</div>
          <h3 className="text-xl font-semibold text-white mb-2">No price alerts</h3>
          <p className="text-secondary mb-6">Get notified when tokens hit your target price</p>
          <button 
            onClick={() => setShowCreateModal(true)}
            className="btn-glass btn-glass-primary"
          >
            Create Your First Alert
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Active Alerts */}
          {activeAlerts.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-secondary">Active Alerts</h3>
              {activeAlerts.map((alert) => (
                <AlertCard 
                  key={alert.id} 
                  alert={alert} 
                  onToggle={() => toggleAlert(alert.id)}
                  onDelete={() => deleteAlert(alert.id)}
                />
              ))}
            </div>
          )}

          {/* Triggered Alerts */}
          {triggeredAlerts.length > 0 && (
            <div className="space-y-3 mt-6">
              <h3 className="text-sm font-medium text-secondary">Triggered Alerts</h3>
              {triggeredAlerts.map((alert) => (
                <AlertCard 
                  key={alert.id} 
                  alert={alert} 
                  onToggle={() => toggleAlert(alert.id)}
                  onDelete={() => deleteAlert(alert.id)}
                />
              ))}
            </div>
          )}

          {/* Disabled Alerts */}
          {alerts.filter(a => !a.enabled && !a.triggered).length > 0 && (
            <div className="space-y-3 mt-6">
              <h3 className="text-sm font-medium text-secondary">Disabled Alerts</h3>
              {alerts.filter(a => !a.enabled && !a.triggered).map((alert) => (
                <AlertCard 
                  key={alert.id} 
                  alert={alert} 
                  onToggle={() => toggleAlert(alert.id)}
                  onDelete={() => deleteAlert(alert.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create Alert Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowCreateModal(false)}
          ></div>
          <div className="glass-elevated w-full max-w-lg p-6 relative z-10">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">Create Price Alert</h3>
              <button 
                onClick={() => setShowCreateModal(false)}
                className="text-white/60 hover:text-white"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {!selectedToken ? (
              <>
                {/* Search Input */}
                <div className="relative mb-4">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search token by name or address..."
                    className="input-glass w-full pl-10"
                    autoFocus
                  />
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  {searching && (
                    <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 animate-spin text-primary" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  )}
                </div>

                {/* Search Results */}
                <div className="max-h-[300px] overflow-y-auto space-y-2">
                  {searchResults.map((pair) => {
                    const change = formatChange(pair.priceChange?.h24);
                    return (
                      <button
                        key={`${pair.chainId}-${pair.pairAddress}`}
                        onClick={() => setSelectedToken(pair)}
                        className="w-full card-glass p-3 flex items-center gap-3 text-left hover:scale-[1.02] transition-all"
                      >
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500/30 to-purple-500/30 flex items-center justify-center flex-shrink-0">
                          <span className="text-lg">🪙</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-white">{pair.baseToken.symbol}</span>
                            <span 
                              className="px-2 py-0.5 text-[10px] font-medium rounded-full"
                              style={{ 
                                backgroundColor: `${getChainColor(pair.chainId)}20`,
                                color: getChainColor(pair.chainId)
                              }}
                            >
                              {getChainName(pair.chainId)}
                            </span>
                          </div>
                          <p className="text-tertiary text-xs truncate">{pair.baseToken.name}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-white font-medium">{formatPrice(pair.priceUsd)}</p>
                          <p className={`text-xs ${change.positive ? 'text-emerald-400' : 'text-red-400'}`}>
                            {change.text}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <>
                {/* Selected Token */}
                <div className="card-glass p-4 mb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500/30 to-purple-500/30 flex items-center justify-center">
                        <span className="text-lg">🪙</span>
                      </div>
                      <div>
                        <p className="font-medium text-white">{selectedToken.baseToken.symbol}</p>
                        <p className="text-xs text-tertiary">{selectedToken.baseToken.name}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setSelectedToken(null)}
                      className="text-tertiary hover:text-white"
                    >
                      Change
                    </button>
                  </div>
                  <div className="mt-3 pt-3 border-t border-white/10">
                    <p className="text-secondary text-sm">Current Price: <span className="text-white font-medium">{formatPrice(selectedToken.priceUsd)}</span></p>
                  </div>
                </div>

                {/* Alert Type */}
                <div className="mb-4">
                  <label className="text-sm text-secondary mb-2 block">Alert Type</label>
                  <div className="flex gap-2">
                    {(['above', 'below'] as const).map((type) => (
                      <button
                        key={type}
                        onClick={() => setAlertType(type)}
                        className={`flex-1 py-3 rounded-xl font-medium transition-all ${
                          alertType === type
                            ? 'bg-primary/30 text-primary border border-primary/50'
                            : 'bg-white/5 text-secondary border border-white/10 hover:bg-white/10'
                        }`}
                      >
                        {type === 'above' ? '📈 Price Above' : '📉 Price Below'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Target Price */}
                <div className="mb-6">
                  <label className="text-sm text-secondary mb-2 block">Target Price (USD)</label>
                  <input
                    type="number"
                    value={targetValue}
                    onChange={(e) => setTargetValue(e.target.value)}
                    placeholder="0.00"
                    step="any"
                    className="input-glass w-full text-lg"
                  />
                </div>

                {/* Create Button */}
                <button
                  onClick={createAlert}
                  disabled={!targetValue}
                  className="w-full btn-glass btn-glass-primary py-3 disabled:opacity-50"
                >
                  Create Alert
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Alert Card Component
function AlertCard({ 
  alert, 
  onToggle, 
  onDelete 
}: { 
  alert: PriceAlert; 
  onToggle: () => void; 
  onDelete: () => void;
}) {
  const progress = alert.currentPrice && !alert.triggered
    ? alert.type === 'above'
      ? Math.min((alert.currentPrice / alert.targetValue) * 100, 100)
      : Math.min((alert.targetValue / alert.currentPrice) * 100, 100)
    : alert.triggered ? 100 : 0;

  return (
    <div className={`card-glass p-4 ${alert.triggered ? 'border-yellow-500/30' : ''} ${!alert.enabled ? 'opacity-60' : ''}`}>
      <div className="flex items-center gap-4">
        {/* Token Icon */}
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
          alert.triggered 
            ? 'bg-yellow-500/30' 
            : alert.type === 'above' 
              ? 'bg-emerald-500/30' 
              : 'bg-red-500/30'
        }`}>
          <span className="text-xl">
            {alert.triggered ? '🔔' : alert.type === 'above' ? '📈' : '📉'}
          </span>
        </div>

        {/* Alert Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-white">{alert.symbol}</h3>
            <span 
              className="px-2 py-0.5 text-[10px] font-medium rounded-full"
              style={{ 
                backgroundColor: `${getChainColor(alert.chain)}20`,
                color: getChainColor(alert.chain)
              }}
            >
              {getChainName(alert.chain)}
            </span>
            {alert.triggered && (
              <span className="badge-glass badge-glass-orange text-[10px]">
                Triggered!
              </span>
            )}
          </div>
          <p className="text-secondary text-sm">
            {alert.type === 'above' ? 'Price above' : 'Price below'} {formatPrice(alert.targetValue)}
          </p>
          {alert.currentPrice && !alert.triggered && (
            <div className="mt-2">
              <div className="flex items-center justify-between text-xs text-tertiary mb-1">
                <span>Current: {formatPrice(alert.currentPrice)}</span>
                <span>{progress.toFixed(0)}%</span>
              </div>
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all ${
                    alert.type === 'above' ? 'bg-emerald-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={onToggle}
            className={`w-12 h-6 rounded-full transition-all ${
              alert.enabled ? 'bg-emerald-500' : 'bg-white/20'
            }`}
          >
            <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
              alert.enabled ? 'translate-x-6' : 'translate-x-0.5'
            }`}></div>
          </button>
          <button
            onClick={onDelete}
            className="btn-glass p-2 hover:bg-red-500/20 hover:border-red-500/50"
            title="Delete alert"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
