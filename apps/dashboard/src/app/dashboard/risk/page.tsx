'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Shield, Save, Loader2, AlertCircle } from 'lucide-react';
import type { RiskPolicy } from '@clawfi/sdk';

export default function RiskPolicyPage() {
  const { client } = useAuth();
  const [policy, setPolicy] = useState<RiskPolicy | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state
  const [maxOrderUsd, setMaxOrderUsd] = useState('100');
  const [maxPositionUsd, setMaxPositionUsd] = useState('1000');
  const [maxDailyLossUsd, setMaxDailyLossUsd] = useState('500');
  const [maxSlippageBps, setMaxSlippageBps] = useState('100');
  const [cooldownSeconds, setCooldownSeconds] = useState('60');
  const [dryRunMode, setDryRunMode] = useState(true);

  const fetchPolicy = async () => {
    if (!client) return;
    try {
      const data = await client.getRiskPolicy();
      setPolicy(data);
      setMaxOrderUsd(String(data.maxOrderUsd));
      setMaxPositionUsd(String(data.maxPositionUsd));
      setMaxDailyLossUsd(String(data.maxDailyLossUsd));
      setMaxSlippageBps(String(data.maxSlippageBps));
      setCooldownSeconds(String(data.cooldownSeconds));
      setDryRunMode(data.dryRunMode);
    } catch (error) {
      console.error('Failed to fetch risk policy:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPolicy();
  }, [client]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client) return;

    setError('');
    setSuccess('');
    setSaving(true);

    try {
      await client.updateRiskPolicy({
        maxOrderUsd: parseFloat(maxOrderUsd),
        maxPositionUsd: parseFloat(maxPositionUsd),
        maxDailyLossUsd: parseFloat(maxDailyLossUsd),
        maxSlippageBps: parseInt(maxSlippageBps),
        cooldownSeconds: parseInt(cooldownSeconds),
        dryRunMode,
      });
      setSuccess('Risk policy updated successfully');
      await fetchPolicy();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to update policy');
    } finally {
      setSaving(false);
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
        <h1 className="text-3xl font-bold">Risk Policy</h1>
        <p className="text-muted-foreground">Configure trading constraints and safety limits</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Trading Constraints
          </CardTitle>
          <CardDescription>
            These limits are enforced before any trading action is executed
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-6">
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            {success && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-claw-500/10 text-claw-500 text-sm">
                <Shield className="w-4 h-4" />
                {success}
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="maxOrderUsd">Max Order Size (USD)</Label>
                <Input
                  id="maxOrderUsd"
                  type="number"
                  min="0"
                  step="0.01"
                  value={maxOrderUsd}
                  onChange={(e) => setMaxOrderUsd(e.target.value)}
                  className="bg-secondary/50"
                />
                <p className="text-xs text-muted-foreground">
                  Maximum USD value for a single order
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxPositionUsd">Max Position Size (USD)</Label>
                <Input
                  id="maxPositionUsd"
                  type="number"
                  min="0"
                  step="0.01"
                  value={maxPositionUsd}
                  onChange={(e) => setMaxPositionUsd(e.target.value)}
                  className="bg-secondary/50"
                />
                <p className="text-xs text-muted-foreground">
                  Maximum USD value for any single position
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxDailyLossUsd">Max Daily Loss (USD)</Label>
                <Input
                  id="maxDailyLossUsd"
                  type="number"
                  min="0"
                  step="0.01"
                  value={maxDailyLossUsd}
                  onChange={(e) => setMaxDailyLossUsd(e.target.value)}
                  className="bg-secondary/50"
                />
                <p className="text-xs text-muted-foreground">
                  Trading stops when daily losses reach this limit
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxSlippageBps">Max Slippage (basis points)</Label>
                <Input
                  id="maxSlippageBps"
                  type="number"
                  min="0"
                  max="10000"
                  value={maxSlippageBps}
                  onChange={(e) => setMaxSlippageBps(e.target.value)}
                  className="bg-secondary/50"
                />
                <p className="text-xs text-muted-foreground">
                  100 bps = 1%. Trades exceeding this are blocked
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cooldownSeconds">Cooldown (seconds)</Label>
                <Input
                  id="cooldownSeconds"
                  type="number"
                  min="0"
                  value={cooldownSeconds}
                  onChange={(e) => setCooldownSeconds(e.target.value)}
                  className="bg-secondary/50"
                />
                <p className="text-xs text-muted-foreground">
                  Minimum time between trades
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 rounded-lg bg-secondary/50">
              <Switch checked={dryRunMode} onCheckedChange={setDryRunMode} id="dryRunMode" />
              <div>
                <Label htmlFor="dryRunMode" className="text-base font-medium">
                  Dry Run Mode
                </Label>
                <p className="text-sm text-muted-foreground">
                  When enabled, orders are simulated and logged but not executed
                </p>
              </div>
            </div>

            <Button type="submit" disabled={saving} className="bg-claw-600 hover:bg-claw-500">
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Policy
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}


