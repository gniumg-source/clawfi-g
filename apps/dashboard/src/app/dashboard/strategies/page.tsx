'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Brain, Play, Pause, Settings, Loader2 } from 'lucide-react';
import type { StrategyInfo } from '@clawfi/sdk';

export default function StrategiesPage() {
  const { client } = useAuth();
  const [strategies, setStrategies] = useState<StrategyInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchStrategies = async () => {
    if (!client) return;
    try {
      const data = await client.getStrategies();
      setStrategies(data);
    } catch (error) {
      console.error('Failed to fetch strategies:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStrategies();
  }, [client]);

  const handleToggleStrategy = async (id: string, currentStatus: string) => {
    if (!client) return;
    setTogglingId(id);
    try {
      const newStatus = currentStatus === 'enabled' ? 'disabled' : 'enabled';
      await client.updateStrategy(id, { status: newStatus });
      await fetchStrategies();
    } catch (error) {
      console.error('Failed to toggle strategy:', error);
    } finally {
      setTogglingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-claw-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Strategies</h1>
        <p className="text-muted-foreground">Configure and manage your trading strategies</p>
      </div>

      {strategies.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Brain className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No strategies configured</p>
            <p className="text-muted-foreground">Run the seed script to create default strategies</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {strategies.map((strategy) => (
            <Card key={strategy.id} className={strategy.status === 'enabled' ? 'border-claw-500/50' : ''}>
              <CardHeader className="flex flex-row items-center justify-between">
                <div className="flex items-center gap-4">
                  <div
                    className={`p-3 rounded-lg ${
                      strategy.status === 'enabled' ? 'bg-claw-500/20' : 'bg-secondary'
                    }`}
                  >
                    <Brain
                      className={`w-6 h-6 ${
                        strategy.status === 'enabled' ? 'text-claw-500' : 'text-muted-foreground'
                      }`}
                    />
                  </div>
                  <div>
                    <CardTitle className="text-xl">{strategy.name}</CardTitle>
                    <CardDescription>{strategy.description}</CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    {togglingId === strategy.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : strategy.status === 'enabled' ? (
                      <Play className="w-4 h-4 text-claw-500" />
                    ) : (
                      <Pause className="w-4 h-4 text-muted-foreground" />
                    )}
                    <Switch
                      checked={strategy.status === 'enabled'}
                      onCheckedChange={() => handleToggleStrategy(strategy.id, strategy.status)}
                      disabled={togglingId === strategy.id}
                    />
                    <Label>{strategy.status === 'enabled' ? 'Running' : 'Stopped'}</Label>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="p-4 rounded-lg bg-secondary/50">
                    <p className="text-sm text-muted-foreground">Type</p>
                    <p className="font-medium capitalize">{strategy.strategyType}</p>
                  </div>
                  <div className="p-4 rounded-lg bg-secondary/50">
                    <p className="text-sm text-muted-foreground">Status</p>
                    <p
                      className={`font-medium capitalize ${
                        strategy.status === 'enabled'
                          ? 'text-claw-500'
                          : strategy.status === 'error'
                          ? 'text-destructive'
                          : ''
                      }`}
                    >
                      {strategy.status}
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-secondary/50">
                    <p className="text-sm text-muted-foreground">Last Updated</p>
                    <p className="font-medium">
                      {new Date(strategy.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {strategy.strategyType === 'moltwatch' && (
                  <div className="mt-4 p-4 rounded-lg bg-secondary/30">
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <Settings className="w-4 h-4" />
                      Configuration
                    </h4>
                    <div className="grid gap-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Molt Threshold</span>
                        <span>{(strategy.config as Record<string, unknown>).moltThresholdPercent ?? 20}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Rotation Window</span>
                        <span>{(strategy.config as Record<string, unknown>).rotationWindowMinutes ?? 30} minutes</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Poll Interval</span>
                        <span>{(strategy.config as Record<string, unknown>).pollIntervalSeconds ?? 60} seconds</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Watched Wallets</span>
                        <span>{((strategy.config as Record<string, unknown>).watchedWallets as unknown[])?.length ?? 0}</span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}


