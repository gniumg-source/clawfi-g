/**
 * ClawFi Dashboard - Token Search Component
 * Global token search with instant results
 */

import { useEffect, useState, useRef } from 'react';
import { 
  dexscreenerApi, 
  formatPrice, 
  formatMarketCap, 
  formatChange,
  getChainName,
  getChainColor,
  type DexscreenerPair
} from '../lib/dexscreener';

interface Props {
  onSelect?: (pair: DexscreenerPair) => void;
  placeholder?: string;
  className?: string;
}

export default function TokenSearch({ onSelect, placeholder = 'Search tokens...', className = '' }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DexscreenerPair[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const search = async () => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    
    setLoading(true);
    try {
      const pairs = await dexscreenerApi.searchPairs(query);
      // Dedupe by token
      const seen = new Set<string>();
      const unique = pairs.filter(p => {
        const key = `${p.chainId}-${p.baseToken.address}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      setResults(unique.slice(0, 8));
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(search, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (pair: DexscreenerPair) => {
    if (onSelect) {
      onSelect(pair);
    } else {
      window.open(pair.url, '_blank');
    }
    setQuery('');
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className="input-glass w-full pl-10 pr-4"
        />
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        {loading && (
          <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-primary" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        )}
      </div>

      {/* Results Dropdown */}
      {isOpen && (query || results.length > 0) && (
        <div className="absolute top-full left-0 right-0 mt-2 glass-elevated max-h-[400px] overflow-y-auto z-50">
          {results.length === 0 && query && !loading ? (
            <div className="p-4 text-center text-secondary text-sm">
              No tokens found
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {results.map((pair) => {
                const change = formatChange(pair.priceChange?.h24);
                
                return (
                  <button
                    key={`${pair.chainId}-${pair.pairAddress}`}
                    onClick={() => handleSelect(pair)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/10 transition-colors text-left"
                  >
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500/30 to-purple-500/30 flex items-center justify-center flex-shrink-0">
                      {pair.info?.imageUrl ? (
                        <img 
                          src={pair.info.imageUrl} 
                          alt="" 
                          className="w-full h-full rounded-lg object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <span className="text-lg">🪙</span>
                      )}
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
                    <div className="text-right flex-shrink-0">
                      <p className="text-white font-medium">{formatPrice(pair.priceUsd)}</p>
                      <p className={`text-xs ${change.positive ? 'text-emerald-400' : 'text-red-400'}`}>
                        {change.text}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
