'use client';

import { usePathname } from 'next/navigation';

export function AdminMain({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPortal = (pathname === '/client' || pathname.startsWith('/client/')) || pathname.startsWith('/chef');

  if (isPortal) {
    return <div className="flex-1">{children}</div>;
  }

  return (
    <main className="flex-1 lg:ml-64">
      <div className="pt-14 lg:pt-0">
        <div className="p-6 lg:p-8 max-w-6xl">
          {children}
        </div>
      </div>
    </main>
  );
}
