'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { History, CheckCircle, XCircle } from 'lucide-react';
import type { AuditLog } from '@clawfi/sdk';
import { formatDate } from '@/lib/utils';

export default function AuditPage() {
  const { client } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchLogs = async () => {
    if (!client) return;
    setLoading(true);
    try {
      const data = await client.getAuditLogs({}, { page, limit: 20 });
      setLogs(data.data);
      setTotalPages(data.pagination.totalPages);
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [client, page]);

  const formatAction = (action: string) => {
    return action
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase());
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
        <h1 className="text-3xl font-bold">Audit Log</h1>
        <p className="text-muted-foreground">View all actions and policy decisions</p>
      </div>

      {logs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <History className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No audit logs yet</p>
            <p className="text-muted-foreground">Actions will be recorded here</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="p-0">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                      Timestamp
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                      Action
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                      Resource
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                      Details
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b last:border-0">
                      <td className="px-4 py-3 text-sm font-mono">
                        {formatDate(log.ts)}
                      </td>
                      <td className="px-4 py-3 text-sm">{formatAction(log.action)}</td>
                      <td className="px-4 py-3 text-sm">
                        {log.resource && (
                          <span className="px-2 py-1 rounded bg-secondary text-xs">
                            {log.resource}
                            {log.resourceId && `: ${log.resourceId.slice(0, 8)}...`}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {log.success ? (
                          <CheckCircle className="w-4 h-4 text-claw-500" />
                        ) : (
                          <XCircle className="w-4 h-4 text-destructive" />
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {log.errorMessage ||
                          (log.details
                            ? Object.entries(log.details as Record<string, unknown>)
                                .slice(0, 2)
                                .map(([k, v]) => `${k}: ${v}`)
                                .join(', ')
                            : '—')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

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


