'use client';

import { LogOut } from 'lucide-react';

export function ClientLogout() {
  async function handleLogout() {
    await fetch('/api/client/auth', { method: 'DELETE' });
    window.location.href = '/client/login';
  }

  return (
    <button
      onClick={handleLogout}
      className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
    >
      <LogOut className="h-4 w-4" />
      Sign out
    </button>
  );
}
