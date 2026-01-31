'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface LaunchpadToken {
  id: string;
  chain: string;
  launchpad: string;
  tokenAddress: string;
  tokenName?: string;
  tokenSymbol?: string;
  creatorAddress: string;
  factoryAddress?: string;
  txHash: string;
  blockNumber: string;
  blockTimestamp?: string;
  version?: string;
  verified: boolean;
  createdAt: string;
}

interface LaunchpadStats {
  totalTokens: number;
  tokensLast24h: number;
  tokensLast7d: number;
  topCreators: { address: string; count: number }[];
}

export default function LaunchpadsPage() {
  const { token, nodeUrl } = useAuth();
  const [tokens, setTokens] = useState<LaunchpadToken[]>([]);
  const [stats, setStats] = useState<LaunchpadStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    if (!token) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const [tokensRes, statsRes] = await Promise.all([
          fetch(`${nodeUrl}/launchpads/tokens?launchpad=clanker&chain=base&page=${page}&limit=20`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${nodeUrl}/launchpads/stats?launchpad=clanker&chain=base`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (!tokensRes.ok || !statsRes.ok) {
          throw new Error('Failed to fetch launchpad data');
        }

        const tokensData = await tokensRes.json();
        const statsData = await statsRes.json();

        if (tokensData.success) {
          setTokens(tokensData.data);
          setTotalPages(tokensData.pagination?.totalPages || 1);
        }

        if (statsData.success) {
          setStats(statsData.data);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token, nodeUrl, page]);

  const formatAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  const formatTime = (ts: string) => {
    const date = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Launchpads</h1>
        <p className="text-muted-foreground">
          Clanker token launches on Base
        </p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardHeader className="pb-2">
              <CardDescription>Total Tokens</CardDescription>
              <CardTitle className="text-2xl">{stats.totalTokens}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardHeader className="pb-2">
              <CardDescription>Last 24h</CardDescription>
              <CardTitle className="text-2xl text-emerald-400">{stats.tokensLast24h}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardHeader className="pb-2">
              <CardDescription>Last 7 Days</CardDescription>
              <CardTitle className="text-2xl">{stats.tokensLast7d}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardHeader className="pb-2">
              <CardDescription>Top Creators</CardDescription>
              <CardTitle className="text-2xl">{stats.topCreators.length}</CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      {/* Token List */}
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="text-2xl">🚀</span>
            Recent Clanker Launches
          </CardTitle>
          <CardDescription>
            New tokens deployed via Clanker on Base
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400" />
            </div>
          ) : error ? (
            <div className="text-center py-12 text-red-400">
              {error}
            </div>
          ) : tokens.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No tokens found. Configure the Clanker connector to start indexing.
            </div>
          ) : (
            <div className="space-y-3">
              {tokens.map((token) => (
                <div
                  key={token.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-background/50 hover:bg-background/80 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-blue-500 flex items-center justify-center text-white font-bold">
                      {token.tokenSymbol?.[0] || '?'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {token.tokenSymbol || token.tokenName || 'Unknown'}
                        </span>
                        {token.verified && (
                          <span className="px-1.5 py-0.5 text-xs rounded bg-emerald-500/20 text-emerald-400">
                            ✓ Verified
                          </span>
                        )}
                        {token.version && (
                          <span className="px-1.5 py-0.5 text-xs rounded bg-purple-500/20 text-purple-400">
                            {token.version}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <a
                          href={`https://basescan.org/token/${token.tokenAddress}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-emerald-400 font-mono"
                        >
                          {formatAddress(token.tokenAddress)}
                        </a>
                        <span>•</span>
                        <a
                          href={`https://clanker.world/clanker/${token.tokenAddress}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-emerald-400"
                        >
                          Clanker
                        </a>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-muted-foreground">
                      {formatTime(token.createdAt)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      by{' '}
                      <a
                        href={`https://basescan.org/address/${token.creatorAddress}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-emerald-400 font-mono"
                      >
                        {formatAddress(token.creatorAddress)}
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top Creators */}
      {stats && stats.topCreators.length > 0 && (
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader>
            <CardTitle>Top Creators</CardTitle>
            <CardDescription>
              Most active token deployers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.topCreators.slice(0, 5).map((creator, idx) => (
                <div
                  key={creator.address}
                  className="flex items-center justify-between p-3 rounded-lg bg-background/50"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground text-sm">#{idx + 1}</span>
                    <a
                      href={`https://basescan.org/address/${creator.address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-sm hover:text-emerald-400"
                    >
                      {formatAddress(creator.address)}
                    </a>
                  </div>
                  <span className="text-emerald-400 font-medium">
                    {creator.count} tokens
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}


