'use client';

import { usePathname } from 'next/navigation';

export function AdminMain({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPortal = (pathname === '/client' || pathname.startsWith('/client/')) || pathname.startsWith('/chef');

  if (isPortal) {
    return <div className="flex-1">{children}</div>;
  }

  return (
    <main className="flex-1 ml-64">
      <div className="p-8 max-w-6xl">
        {children}
      </div>
    </main>
  );
}
