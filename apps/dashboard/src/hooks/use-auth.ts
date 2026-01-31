'use client';

import { useAuthContext } from '@/components/providers';

export function useAuth() {
  return useAuthContext();
}


