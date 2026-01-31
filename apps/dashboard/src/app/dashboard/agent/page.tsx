'use client';

import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Terminal,
  Send,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  Wifi,
  WifiOff,
  ShieldCheck,
  ShieldAlert,
  Eye,
  Brain,
  Activity,
  Zap,
} from 'lucide-react';

// ============================================
// Types
// ============================================

interface AgentStatus {
  version: string;
  uptimeSeconds: number;
  uptimeFormatted: string;
  killSwitchActive: boolean;
  dryRunMode: boolean;
  connectors: {
    total: number;
    connected: number;
    degraded: number;
    offline: number;
    error: number;
  };
  strategies: {
    total: number;
    enabled: number;
    disabled: number;
    error: number;
  };
  signalsToday: number;
  watchedTokens: number;
  watchedWallets: number;
  responseTimeMs: number;
}

interface CommandResult {
  success: boolean;
  action: string;
  message: string;
  data?: Record<string, unknown>;
}

interface CommandHistoryEntry {
  id: string;
  command: string;
  result: CommandResult;
  timestamp: number;
}

// ============================================
// Component
// ============================================

export default function AgentPage() {
  const { token, nodeUrl } = useAuth();
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [command, setCommand] = useState('');
  const [executing, setExecuting] = useState(false);
  const [history, setHistory] = useState<CommandHistoryEntry[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  const fetchStatus = async () => {
    if (!token || !nodeUrl) return;
    try {
      const response = await fetch(`${nodeUrl}/agent/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setStatus(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch agent status:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    // Refresh every 10 seconds
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, [token, nodeUrl]);

  // Scroll to bottom when history changes
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [history]);

  const executeCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!command.trim() || !token || !nodeUrl || executing) return;

    const cmd = command.trim();
    setCommand('');
    setExecuting(true);

    try {
      const response = await fetch(`${nodeUrl}/agent/command`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ command: cmd }),
      });
      const data = await response.json();

      const entry: CommandHistoryEntry = {
        id: Date.now().toString(),
        command: cmd,
        result: data.data || { success: false, action: 'error', message: 'Unknown error' },
        timestamp: Date.now(),
      };

      setHistory(prev => [...prev, entry]);
      
      // Refresh status after command
      await fetchStatus();
    } catch (error) {
      const entry: CommandHistoryEntry = {
        id: Date.now().toString(),
        command: cmd,
        result: {
          success: false,
          action: 'error',
          message: error instanceof Error ? error.message : 'Command failed',
        },
        timestamp: Date.now(),
      };
      setHistory(prev => [...prev, entry]);
    } finally {
      setExecuting(false);
      inputRef.current?.focus();
    }
  };

  const quickCommands = [
    { label: 'Status', command: 'status' },
    { label: 'Help', command: 'help' },
    { label: 'Kill Switch On', command: 'killswitch on' },
    { label: 'Kill Switch Off', command: 'killswitch off' },
  ];

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
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Zap className="w-8 h-8 text-claw-500" />
          Agent Control
        </h1>
        <p className="text-muted-foreground">
          Command your crypto intelligence agent
        </p>
      </div>

      {/* Status Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Uptime */}
        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="p-3 rounded-lg bg-claw-500/20">
              <Clock className="w-5 h-5 text-claw-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Uptime</p>
              <p className="text-xl font-bold">{status?.uptimeFormatted || '--'}</p>
            </div>
          </CardContent>
        </Card>

        {/* Kill Switch */}
        <Card className={status?.killSwitchActive ? 'border-red-500/50' : ''}>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className={`p-3 rounded-lg ${status?.killSwitchActive ? 'bg-red-500/20' : 'bg-emerald-500/20'}`}>
              {status?.killSwitchActive ? (
                <ShieldAlert className="w-5 h-5 text-red-500" />
              ) : (
                <ShieldCheck className="w-5 h-5 text-emerald-500" />
              )}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Kill Switch</p>
              <p className={`text-xl font-bold ${status?.killSwitchActive ? 'text-red-500' : 'text-emerald-500'}`}>
                {status?.killSwitchActive ? 'ACTIVE' : 'OFF'}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Connectors */}
        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="p-3 rounded-lg bg-blue-500/20">
              <Wifi className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Connectors</p>
              <p className="text-xl font-bold">
                <span className="text-emerald-500">{status?.connectors.connected}</span>
                <span className="text-muted-foreground"> / {status?.connectors.total}</span>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Signals */}
        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="p-3 rounded-lg bg-purple-500/20">
              <Activity className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Signals Today</p>
              <p className="text-xl font-bold">{status?.signalsToday ?? 0}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Status */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Strategies */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Brain className="w-4 h-4" />
              Strategies
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Enabled: {status?.strategies.enabled ?? 0}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-gray-500" />
                <span>Disabled: {status?.strategies.disabled ?? 0}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                <span>Error: {status?.strategies.error ?? 0}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                <span>Total: {status?.strategies.total ?? 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Watchlists */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Eye className="w-4 h-4" />
              Watchlists
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-claw-500 font-bold">{status?.watchedTokens ?? 0}</span>
                <span className="text-muted-foreground">Tokens</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-claw-500 font-bold">{status?.watchedWallets ?? 0}</span>
                <span className="text-muted-foreground">Wallets</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* System Info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Terminal className="w-4 h-4" />
              System
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Version</span>
                <span className="font-mono">{status?.version ?? '--'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Mode</span>
                <span className={status?.dryRunMode ? 'text-yellow-500' : 'text-red-500'}>
                  {status?.dryRunMode ? 'Dry Run' : 'LIVE'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Latency</span>
                <span className="font-mono">{status?.responseTimeMs ?? '--'}ms</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Command Terminal */}
      <Card className="border-claw-900/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-claw-500" />
            Command Terminal
          </CardTitle>
          <CardDescription>
            Type commands to control ClawFi. Try "help" for available commands.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Quick Commands */}
          <div className="flex flex-wrap gap-2">
            {quickCommands.map((qc) => (
              <Button
                key={qc.command}
                variant="outline"
                size="sm"
                onClick={() => setCommand(qc.command)}
                className="text-xs"
              >
                {qc.label}
              </Button>
            ))}
          </div>

          {/* Output Area */}
          <div
            ref={outputRef}
            className="h-64 overflow-y-auto bg-black/50 rounded-lg p-4 font-mono text-sm space-y-3"
          >
            {history.length === 0 ? (
              <div className="text-muted-foreground">
                <p>ClawFi Agent v{status?.version ?? '0.2.0'}</p>
                <p className="text-claw-500">Ready for commands. Type "help" to get started.</p>
              </div>
            ) : (
              history.map((entry) => (
                <div key={entry.id} className="space-y-1">
                  <div className="flex items-center gap-2 text-claw-400">
                    <span className="text-claw-500">❯</span>
                    <span>{entry.command}</span>
                  </div>
                  <div className={`ml-4 ${entry.result.success ? 'text-emerald-400' : 'text-red-400'}`}>
                    {entry.result.success ? (
                      <CheckCircle className="w-3 h-3 inline mr-1" />
                    ) : (
                      <XCircle className="w-3 h-3 inline mr-1" />
                    )}
                    {entry.result.message}
                  </div>
                  {entry.result.data && Object.keys(entry.result.data).length > 0 && (
                    <pre className="ml-4 text-xs text-muted-foreground overflow-x-auto">
                      {JSON.stringify(entry.result.data, null, 2)}
                    </pre>
                  )}
                </div>
              ))
            )}
            {executing && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Executing...</span>
              </div>
            )}
          </div>

          {/* Input */}
          <form onSubmit={executeCommand} className="flex gap-2">
            <div className="flex-1 relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-claw-500 font-mono">
                ❯
              </span>
              <Input
                ref={inputRef}
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                placeholder="watch token 0x... | enable strategy moltwatch | killswitch on"
                className="pl-8 bg-black/50 font-mono border-claw-900/50 focus:border-claw-500"
                disabled={executing}
                autoComplete="off"
              />
            </div>
            <Button
              type="submit"
              disabled={!command.trim() || executing}
              className="bg-claw-600 hover:bg-claw-500"
            >
              {executing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}


