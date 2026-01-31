'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        router.replace('/dashboard');
      } else {
        router.replace('/login');
      }
    }
  }, [isAuthenticated, isLoading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-grid">
      <div className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 border-4 border-claw-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-muted-foreground">Loading ClawFi...</p>
      </div>
    </div>
  );
}


