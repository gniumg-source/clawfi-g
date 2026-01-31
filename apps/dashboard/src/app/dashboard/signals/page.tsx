'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bell, AlertTriangle, TrendingUp, CheckCircle, ExternalLink } from 'lucide-react';
import type { Signal } from '@clawfi/sdk';
import { formatRelativeTime, formatAddress } from '@/lib/utils';

export default function SignalsPage() {
  const { client } = useAuth();
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchSignals = async () => {
    if (!client) return;
    setLoading(true);
    try {
      const data = await client.getSignals({}, { page, limit: 20 });
      setSignals(data.data);
      setTotalPages(data.pagination.totalPages);
    } catch (error) {
      console.error('Failed to fetch signals:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSignals();
  }, [client, page]);

  useEffect(() => {
    if (client) {
      const unsub = client.onSignal((signal) => {
        setSignals((prev) => [signal, ...prev]);
      });
      return unsub;
    }
  }, [client]);

  const handleAcknowledge = async (id: string) => {
    if (!client) return;
    try {
      await client.acknowledgeSignal(id);
      setSignals((prev) =>
        prev.map((s) => (s.id === id ? { ...s, acknowledged: true } : s))
      );
    } catch (error) {
      console.error('Failed to acknowledge signal:', error);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-destructive/20 text-destructive border-destructive/50';
      case 'high':
        return 'bg-orange-500/20 text-orange-500 border-orange-500/50';
      case 'medium':
        return 'bg-yellow-500/20 text-yellow-500 border-yellow-500/50';
      default:
        return 'bg-blue-500/20 text-blue-500 border-blue-500/50';
    }
  };

  if (loading && page === 1) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-claw-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Signals</h1>
        <p className="text-muted-foreground">View and manage alerts from your strategies</p>
      </div>

      {signals.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Bell className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No signals yet</p>
            <p className="text-muted-foreground">
              Signals will appear here when your strategies detect notable activity
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-4">
            {signals.map((signal) => (
              <Card
                key={signal.id}
                className={`transition-all ${
                  signal.acknowledged ? 'opacity-60' : ''
                } ${signal.severity === 'critical' ? 'border-destructive/50' : ''}`}
              >
                <CardContent className="py-4">
                  <div className="flex items-start gap-4">
                    <div
                      className={`p-3 rounded-lg ${
                        signal.severity === 'critical' || signal.severity === 'high'
                          ? 'bg-destructive/20'
                          : 'bg-claw-500/20'
                      }`}
                    >
                      {signal.severity === 'critical' || signal.severity === 'high' ? (
                        <AlertTriangle
                          className={`w-5 h-5 ${
                            signal.severity === 'critical' ? 'text-destructive' : 'text-orange-500'
                          }`}
                        />
                      ) : (
                        <TrendingUp className="w-5 h-5 text-claw-500" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold">{signal.title}</h3>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full border ${getSeverityColor(
                            signal.severity
                          )}`}
                        >
                          {signal.severity}
                        </span>
                        {(signal as { signalType?: string }).signalType === 'LaunchDetected' && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/50">
                            🚀 Launch
                          </span>
                        )}
                        {(signal as { signalType?: string }).signalType === 'MoltDetected' && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/50">
                            🦀 Molt
                          </span>
                        )}
                        {(signal as { signalType?: string }).signalType === 'EarlyDistribution' && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/50">
                            ⚠️ Concentration
                          </span>
                        )}
                        {(signal as { signalType?: string }).signalType === 'LiquidityRisk' && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/50">
                            🔥 Liquidity Risk
                          </span>
                        )}
                        {signal.acknowledged && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-claw-500/20 text-claw-500">
                            <CheckCircle className="w-3 h-3 inline mr-1" />
                            Acknowledged
                          </span>
                        )}
                      </div>

                      <p className="text-sm text-muted-foreground mt-1">{signal.summary}</p>

                      <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                        {signal.token && (
                          <span className="font-mono bg-secondary px-2 py-1 rounded">
                            Token: {formatAddress(signal.token)}
                          </span>
                        )}
                        {signal.wallet && (
                          <span className="font-mono bg-secondary px-2 py-1 rounded">
                            Wallet: {formatAddress(signal.wallet)}
                          </span>
                        )}
                        {signal.chain && (
                          <span className="capitalize bg-secondary px-2 py-1 rounded">
                            {signal.chain}
                          </span>
                        )}
                        <span>{formatRelativeTime(signal.ts)}</span>
                      </div>

                      {signal.evidence && signal.evidence.length > 0 && (
                        <div className="mt-3 space-y-1">
                          {signal.evidence.map((e, i) => (
                            <div key={i} className="text-xs">
                              <span className="text-muted-foreground">{e.type}:</span>{' '}
                              <span className="font-mono">{e.value}</span>
                              {e.link && (
                                <a
                                  href={e.link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="ml-1 text-claw-500 hover:underline"
                                >
                                  <ExternalLink className="w-3 h-3 inline" />
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {!signal.acknowledged && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAcknowledge(signal.id)}
                      >
                        Acknowledge
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

