/**
 * ClawFi Dashboard - Quick Stats Component
 * Real-time market statistics overview
 */

import { useEffect, useState } from 'react';
import { dexscreenerApi, type BoostToken } from '../lib/dexscreener';

interface Stats {
  trendingCount: number;
  topChains: { chain: string; count: number }[];
  totalBoosts: number;
}

export default function QuickStats() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const boosted = await dexscreenerApi.getBoostedTokens();
        
        // Count by chain
        const chainCounts = boosted.reduce((acc, token) => {
          acc[token.chainId] = (acc[token.chainId] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        
        const topChains = Object.entries(chainCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([chain, count]) => ({ chain, count }));
        
        const totalBoosts = boosted.reduce((sum, t) => sum + (t.amount || 0), 0);
        
        setStats({
          trendingCount: boosted.length,
          topChains,
          totalBoosts,
        });
      } catch (error) {
        console.error('Stats error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 60000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="card-glass p-4 animate-pulse">
            <div className="h-3 bg-white/10 rounded w-1/2 mb-3"></div>
            <div className="h-8 bg-white/10 rounded w-1/3"></div>
          </div>
        ))}
      </div>
    );
  }

  const statCards = [
    {
      label: 'Trending Tokens',
      value: stats?.trendingCount || 0,
      icon: '🔥',
      color: 'from-orange-500/20 to-red-500/20',
    },
    {
      label: 'Total Boosts',
      value: stats?.totalBoosts || 0,
      icon: '🚀',
      color: 'from-blue-500/20 to-purple-500/20',
    },
    {
      label: 'Top Chain',
      value: stats?.topChains[0]?.chain || '-',
      subValue: stats?.topChains[0]?.count ? `${stats.topChains[0].count} tokens` : '',
      icon: '⛓️',
      color: 'from-emerald-500/20 to-teal-500/20',
    },
    {
      label: 'Market Activity',
      value: 'High',
      icon: '📈',
      color: 'from-yellow-500/20 to-orange-500/20',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {statCards.map((stat, i) => (
        <div 
          key={i} 
          className={`card-glass p-4 bg-gradient-to-br ${stat.color}`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-secondary">{stat.label}</span>
            <span className="text-xl">{stat.icon}</span>
          </div>
          <p className="text-2xl font-bold text-white">
            {typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
          </p>
          {stat.subValue && (
            <p className="text-xs text-tertiary mt-1">{stat.subValue}</p>
          )}
        </div>
      ))}
    </div>
  );
}
