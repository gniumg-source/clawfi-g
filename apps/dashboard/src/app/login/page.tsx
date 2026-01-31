'use client';

import { useState, useRef, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const email = emailRef.current?.value || '';
    const password = passwordRef.current?.value || '';

    if (!email || !password) {
      setError('Please enter both email and password');
      setLoading(false);
      return;
    }

    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-grid p-4">
      <div className="absolute inset-0 bg-gradient-to-br from-claw-950/50 via-background to-background" />
      
      <Card className="w-full max-w-md relative z-10 bg-card/80 backdrop-blur border-claw-900/50">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-claw-500 to-claw-600 flex items-center justify-center glow-claw">
              <span className="text-3xl font-bold text-white">C</span>
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-gradient">ClawFi</CardTitle>
          <CardDescription>
            Sign in to your crypto intelligence dashboard
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="admin@clawfi.io"
                ref={emailRef}
                required
                className="bg-secondary/50"
                autoComplete="email"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                ref={passwordRef}
                required
                className="bg-secondary/50"
                autoComplete="current-password"
              />
            </div>

            <Button type="submit" className="w-full bg-claw-600 hover:bg-claw-500" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign in'
              )}
            </Button>

            <p className="text-xs text-center text-muted-foreground mt-4">
              Default credentials: admin@clawfi.io / admin123
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

