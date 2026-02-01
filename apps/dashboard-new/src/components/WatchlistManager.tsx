/**
 * ClawFi Dashboard - Watchlist Manager Component
 * Manage and track your favorite tokens
 */

import { useEffect, useState } from 'react';
import { 
  dexscreenerApi, 
  formatPrice, 
  formatMarketCap, 
  formatVolume, 
  formatChange,
  getChainName,
  getChainColor,
  type DexscreenerPair
} from '../lib/dexscreener';

interface WatchlistItem {
  id: string;
  tokenAddress: string;
  chain: string;
  symbol?: string;
  name?: string;
  addedAt: number;
  entryPrice?: number;
  notes?: string;
}

interface WatchlistItemWithData extends WatchlistItem {
  pair: DexscreenerPair | null;
  pnl?: { value: number; percent: number };
}

const STORAGE_KEY = 'clawfi_watchlist';

export default function WatchlistManager() {
  const [watchlist, setWatchlist] = useState<WatchlistItemWithData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newToken, setNewToken] = useState({ address: '', chain: 'ethereum', notes: '' });
  const [searchResults, setSearchResults] = useState<DexscreenerPair[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);

  // Load watchlist from storage
  const loadWatchlist = async () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const items: WatchlistItem[] = stored ? JSON.parse(stored) : [];
      
      // Fetch latest data for all items
      const withData: WatchlistItemWithData[] = [];
      
      for (const item of items) {
        const pairs = await dexscreenerApi.getTokenPairs(item.tokenAddress);
        const pair = pairs.find(p => p.chainId === item.chain) || pairs[0] || null;
        
        let pnl = undefined;
        if (item.entryPrice && pair?.priceUsd) {
          const currentPrice = parseFloat(pair.priceUsd);
          const value = currentPrice - item.entryPrice;
          const percent = ((currentPrice - item.entryPrice) / item.entryPrice) * 100;
          pnl = { value, percent };
        }
        
        withData.push({
          ...item,
          symbol: pair?.baseToken?.symbol || item.symbol,
          name: pair?.baseToken?.name || item.name,
          pair,
          pnl,
        });
      }
      
      setWatchlist(withData);
    } catch (error) {
      console.error('Error loading watchlist:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Save watchlist to storage
  const saveWatchlist = (items: WatchlistItem[]) => {
    const toStore = items.map(({ id, tokenAddress, chain, symbol, name, addedAt, entryPrice, notes }) => ({
      id, tokenAddress, chain, symbol, name, addedAt, entryPrice, notes
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
  };

  // Add token to watchlist
  const addToWatchlist = async (pair: DexscreenerPair) => {
    const newItem: WatchlistItem = {
      id: `${pair.chainId}-${pair.baseToken.address}-${Date.now()}`,
      tokenAddress: pair.baseToken.address,
      chain: pair.chainId,
      symbol: pair.baseToken.symbol,
      name: pair.baseToken.name,
      addedAt: Date.now(),
      entryPrice: pair.priceUsd ? parseFloat(pair.priceUsd) : undefined,
      notes: '',
    };
    
    const updatedList = [newItem, ...watchlist.map(w => ({
      id: w.id,
      tokenAddress: w.tokenAddress,
      chain: w.chain,
      symbol: w.symbol,
      name: w.name,
      addedAt: w.addedAt,
      entryPrice: w.entryPrice,
      notes: w.notes,
    }))];
    
    saveWatchlist(updatedList);
    setShowAddModal(false);
    setSearchQuery('');
    setSearchResults([]);
    loadWatchlist();
  };

  // Remove from watchlist
  const removeFromWatchlist = (id: string) => {
    const updated = watchlist
      .filter(w => w.id !== id)
      .map(w => ({
        id: w.id,
        tokenAddress: w.tokenAddress,
        chain: w.chain,
        symbol: w.symbol,
        name: w.name,
        addedAt: w.addedAt,
        entryPrice: w.entryPrice,
        notes: w.notes,
      }));
    saveWatchlist(updated);
    setWatchlist(prev => prev.filter(w => w.id !== id));
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
      // Dedupe by token address + chain
      const seen = new Set<string>();
      const unique = results.filter(p => {
        const key = `${p.chainId}-${p.baseToken.address}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      setSearchResults(unique.slice(0, 10));
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    loadWatchlist();
  }, []);

  useEffect(() => {
    const timer = setTimeout(searchTokens, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const refresh = () => {
    setRefreshing(true);
    loadWatchlist();
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="h-8 w-48 bg-white/5 rounded-lg animate-pulse"></div>
          <div className="h-10 w-32 bg-white/5 rounded-xl animate-pulse"></div>
        </div>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="card-glass p-4 animate-pulse">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-white/10"></div>
                <div className="flex-1">
                  <div className="h-4 bg-white/10 rounded w-1/3 mb-2"></div>
                  <div className="h-3 bg-white/10 rounded w-1/4"></div>
                </div>
              </div>
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
            <span className="text-2xl">⭐</span>
            Your Watchlist
          </h2>
          <p className="text-sm text-secondary mt-1">
            {watchlist.length} token{watchlist.length !== 1 ? 's' : ''} tracked
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
            onClick={() => setShowAddModal(true)}
            className="btn-glass btn-glass-primary flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Token
          </button>
        </div>
      </div>

      {/* Watchlist */}
      {watchlist.length === 0 ? (
        <div className="card-glass p-12 text-center">
          <div className="text-5xl mb-4">⭐</div>
          <h3 className="text-xl font-semibold text-white mb-2">No tokens in watchlist</h3>
          <p className="text-secondary mb-6">Start tracking your favorite tokens</p>
          <button 
            onClick={() => setShowAddModal(true)}
            className="btn-glass btn-glass-primary"
          >
            Add Your First Token
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {watchlist.map((item) => {
            const change = formatChange(item.pair?.priceChange?.h24);
            
            return (
              <div
                key={item.id}
                className="card-glass p-4 flex items-center gap-4 group"
              >
                {/* Token Icon */}
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-500/30 to-orange-500/30 flex items-center justify-center flex-shrink-0">
                  <span className="text-xl">⭐</span>
                </div>

                {/* Token Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-white">
                      {item.symbol || item.tokenAddress.slice(0, 8)}
                    </h3>
                    <span 
                      className="px-2 py-0.5 text-[10px] font-medium rounded-full"
                      style={{ 
                        backgroundColor: `${getChainColor(item.chain)}20`,
                        color: getChainColor(item.chain)
                      }}
                    >
                      {getChainName(item.chain)}
                    </span>
                  </div>
                  <p className="text-tertiary text-sm truncate">{item.name}</p>
                </div>

                {/* Stats */}
                <div className="hidden md:grid grid-cols-3 gap-6 text-right">
                  <div>
                    <p className="text-tertiary text-xs">Price</p>
                    <p className="text-white font-medium">{formatPrice(item.pair?.priceUsd)}</p>
                  </div>
                  <div>
                    <p className="text-tertiary text-xs">Market Cap</p>
                    <p className="text-secondary font-medium">{formatMarketCap(item.pair?.marketCap || item.pair?.fdv)}</p>
                  </div>
                  <div>
                    <p className="text-tertiary text-xs">Volume 24h</p>
                    <p className="text-secondary font-medium">{formatVolume(item.pair?.volume?.h24)}</p>
                  </div>
                </div>

                {/* PNL */}
                {item.pnl && (
                  <div className="text-right">
                    <p className="text-tertiary text-xs">Since Added</p>
                    <p className={`font-bold ${item.pnl.percent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {item.pnl.percent >= 0 ? '+' : ''}{item.pnl.percent.toFixed(2)}%
                    </p>
                  </div>
                )}

                {/* 24h Change */}
                <div className="text-right">
                  <p className="text-tertiary text-xs">24h</p>
                  <p className={`font-bold ${change.positive ? 'text-emerald-400' : 'text-red-400'}`}>
                    {change.text}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <a
                    href={item.pair?.url || `https://dexscreener.com/${item.chain}/${item.tokenAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-glass p-2"
                    title="View on Dexscreener"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                  <button
                    onClick={() => removeFromWatchlist(item.id)}
                    className="btn-glass p-2 hover:bg-red-500/20 hover:border-red-500/50"
                    title="Remove from watchlist"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Token Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowAddModal(false)}
          ></div>
          <div className="glass-elevated w-full max-w-lg p-6 relative z-10">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">Add Token to Watchlist</h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-white/60 hover:text-white"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Search Input */}
            <div className="relative mb-4">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, symbol, or address..."
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
            <div className="max-h-[400px] overflow-y-auto space-y-2">
              {searchResults.length === 0 && searchQuery && !searching ? (
                <div className="text-center py-8 text-secondary">
                  No tokens found. Try a different search term.
                </div>
              ) : (
                searchResults.map((pair) => {
                  const change = formatChange(pair.priceChange?.h24);
                  const isInWatchlist = watchlist.some(
                    w => w.tokenAddress.toLowerCase() === pair.baseToken.address.toLowerCase() && w.chain === pair.chainId
                  );
                  
                  return (
                    <button
                      key={`${pair.chainId}-${pair.pairAddress}`}
                      onClick={() => !isInWatchlist && addToWatchlist(pair)}
                      disabled={isInWatchlist}
                      className={`w-full card-glass p-3 flex items-center gap-3 text-left transition-all ${
                        isInWatchlist ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[1.02]'
                      }`}
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
                          {isInWatchlist && (
                            <span className="badge-glass badge-glass-green text-[10px]">
                              ✓ In Watchlist
                            </span>
                          )}
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
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
