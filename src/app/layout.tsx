import type { Metadata } from 'next';
import { Sidebar } from '@/components/layout/sidebar';
import { AdminMain } from '@/components/layout/AdminMain';
import './globals.css';

export const metadata: Metadata = {
  title: 'Menu Generator',
  description: 'Internal meal prep menu generator',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>
        <div className="flex min-h-screen">
          <Sidebar />
          <AdminMain>
            {children}
          </AdminMain>
        </div>
      </body>
    </html>
  );
}
