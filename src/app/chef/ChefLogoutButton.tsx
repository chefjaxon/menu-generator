'use client';

import { useRouter } from 'next/navigation';

export function ChefLogoutButton() {
  const router = useRouter();

  async function logout() {
    await fetch('/api/chef/auth/logout', { method: 'DELETE' });
    router.push('/chef/login');
    router.refresh();
  }

  return (
    <button
      onClick={logout}
      className="text-xs opacity-70 hover:opacity-100"
    >
      Sign out
    </button>
  );
}
