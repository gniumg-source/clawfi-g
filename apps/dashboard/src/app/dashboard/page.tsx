'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Plug,
  Brain,
  Bell,
  ShieldAlert,
  ShieldCheck,
  Activity,
  TrendingUp,
  AlertTriangle,
  Target,
  Rocket,
} from 'lucide-react';
import type { SystemStatus, Signal } from '@clawfi/sdk';
import { formatRelativeTime } from '@/lib/utils';

interface CoverageData {
  percent: number;
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
}

interface ExtendedStatus extends SystemStatus {
  launchCoverage?: CoverageData;
  launchpadTokens?: number;
}

export default function DashboardPage() {
  const { client } = useAuth();
  const [status, setStatus] = useState<ExtendedStatus | null>(null);
  const [recentSignals, setRecentSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [killSwitchLoading, setKillSwitchLoading] = useState(false);

  const fetchData = async () => {
    if (!client) return;
    try {
      const [statusData, signalsData] = await Promise.all([
        client.getSystemStatus(),
        client.getSignals({}, { limit: 5 }),
      ]);
      setStatus(statusData);
      setRecentSignals(signalsData?.data || []);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    
    // Subscribe to real-time updates
    if (client) {
      const unsubStatus = client.onSystemStatus((newStatus) => {
        setStatus(newStatus);
      });
      const unsubSignals = client.onSignal((signal) => {
        setRecentSignals((prev) => [signal, ...prev].slice(0, 5));
      });

      return () => {
        unsubStatus();
        unsubSignals();
      };
    }
  }, [client]);

  const handleKillSwitch = async (active: boolean) => {
    if (!client) return;
    setKillSwitchLoading(true);
    try {
      await client.setKillSwitch({ active });
      setStatus((prev) => (prev ? { ...prev, killSwitchActive: active } : null));
    } catch (error) {
      console.error('Failed to toggle kill switch:', error);
    } finally {
      setKillSwitchLoading(false);
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Monitor your crypto intelligence agent</p>
        </div>
      </div>

      {/* Kill Switch Alert */}
      {status?.killSwitchActive && (
        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/50 flex items-center gap-4">
          <ShieldAlert className="w-6 h-6 text-destructive" />
          <div className="flex-1">
            <p className="font-semibold text-destructive">Kill Switch Active</p>
            <p className="text-sm text-muted-foreground">
              All trading actions are blocked. Alerts continue to flow.
            </p>
          </div>
          <Button
            variant="destructive"
            onClick={() => handleKillSwitch(false)}
            disabled={killSwitchLoading}
          >
            Disable Kill Switch
          </Button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Connectors
            </CardTitle>
            <Plug className="w-4 h-4 text-claw-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{status?.activeConnectors ?? 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Strategies
            </CardTitle>
            <Brain className="w-4 h-4 text-claw-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{status?.activeStrategies ?? 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Signals Today
            </CardTitle>
            <Bell className="w-4 h-4 text-claw-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{status?.signalsToday ?? 0}</div>
          </CardContent>
        </Card>

        {/* Launch Coverage Widget */}
        <Card className={
          status?.launchCoverage?.status === 'critical' ? 'border-red-500/50' :
          status?.launchCoverage?.status === 'warning' ? 'border-yellow-500/50' : ''
        }>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Launch Coverage
            </CardTitle>
            <Target className={`w-4 h-4 ${
              status?.launchCoverage?.status === 'healthy' ? 'text-emerald-500' :
              status?.launchCoverage?.status === 'warning' ? 'text-yellow-500' :
              status?.launchCoverage?.status === 'critical' ? 'text-red-500' : 'text-muted-foreground'
            }`} />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className={`text-2xl font-bold ${
                status?.launchCoverage?.status === 'healthy' ? 'text-emerald-500' :
                status?.launchCoverage?.status === 'warning' ? 'text-yellow-500' :
                status?.launchCoverage?.status === 'critical' ? 'text-red-500' : ''
              }`}>
                {status?.launchCoverage?.percent?.toFixed(0) ?? '--'}%
              </span>
              {status?.launchCoverage?.status === 'healthy' && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-500">
                  Healthy
                </span>
              )}
              {status?.launchCoverage?.status === 'warning' && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-500">
                  Warning
                </span>
              )}
              {status?.launchCoverage?.status === 'critical' && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-500">
                  Critical
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">24h detection rate</p>
          </CardContent>
        </Card>

        <Card className={status?.killSwitchActive ? 'border-destructive' : ''}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Kill Switch
            </CardTitle>
            {status?.killSwitchActive ? (
              <ShieldAlert className="w-4 h-4 text-destructive" />
            ) : (
              <ShieldCheck className="w-4 h-4 text-claw-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Switch
                checked={status?.killSwitchActive ?? false}
                onCheckedChange={handleKillSwitch}
                disabled={killSwitchLoading}
              />
              <Label className={status?.killSwitchActive ? 'text-destructive' : ''}>
                {status?.killSwitchActive ? 'ACTIVE' : 'Inactive'}
              </Label>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Launchpad Stats Row */}
      {status?.launchpadTokens !== undefined && status.launchpadTokens > 0 && (
        <Card className="bg-gradient-to-r from-emerald-500/10 to-blue-500/10 border-emerald-500/20">
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-emerald-500/20">
                <Rocket className="w-6 h-6 text-emerald-500" />
              </div>
              <div>
                <p className="text-lg font-semibold">{status.launchpadTokens} Clanker Tokens Indexed</p>
                <p className="text-sm text-muted-foreground">
                  View detailed analytics in the Launchpads page
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={() => window.location.href = '/dashboard/launchpads'}>
              View Launches
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Recent Signals */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Recent Signals
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentSignals.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No signals yet</p>
          ) : (
            <div className="space-y-4">
              {recentSignals.map((signal) => (
                <div
                  key={signal.id}
                  className="flex items-start gap-4 p-4 rounded-lg bg-secondary/50"
                >
                  <div
                    className={`p-2 rounded-lg ${
                      signal.severity === 'critical'
                        ? 'bg-destructive/20'
                        : signal.severity === 'high'
                        ? 'bg-orange-500/20'
                        : signal.severity === 'medium'
                        ? 'bg-yellow-500/20'
                        : 'bg-blue-500/20'
                    }`}
                  >
                    {signal.severity === 'critical' || signal.severity === 'high' ? (
                      <AlertTriangle
                        className={`w-4 h-4 ${
                          signal.severity === 'critical' ? 'text-destructive' : 'text-orange-500'
                        }`}
                      />
                    ) : (
                      <TrendingUp className="w-4 h-4 text-claw-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{signal.title}</span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          signal.severity === 'critical'
                            ? 'bg-destructive/20 text-destructive'
                            : signal.severity === 'high'
                            ? 'bg-orange-500/20 text-orange-500'
                            : signal.severity === 'medium'
                            ? 'bg-yellow-500/20 text-yellow-500'
                            : 'bg-blue-500/20 text-blue-500'
                        }`}
                      >
                        {signal.severity}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{signal.summary}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatRelativeTime(signal.ts)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

