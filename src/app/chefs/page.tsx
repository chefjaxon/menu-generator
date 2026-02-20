import Link from 'next/link';
import { Plus, CalendarDays } from 'lucide-react';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function ChefsPage() {
  const chefs = await prisma.chef.findMany({
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
      _count: { select: { assignments: true, schedules: true } },
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Chefs</h1>
        <Link
          href="/chefs/new"
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Add Chef
        </Link>
      </div>

      {chefs.length === 0 ? (
        <div className="text-muted-foreground text-sm">No chefs yet. Add one to get started.</div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Name</th>
                <th className="text-left px-4 py-3 font-medium">Email</th>
                <th className="text-left px-4 py-3 font-medium">Menus assigned</th>
                <th className="text-left px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {chefs.map((chef) => (
                <tr key={chef.id} className="hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium">{chef.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{chef.email}</td>
                  <td className="px-4 py-3 text-muted-foreground">{chef._count.assignments}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(chef.createdAt).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric',
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href="/schedule"
                      className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 border border-border rounded-md hover:bg-muted transition-colors"
                    >
                      <CalendarDays className="h-3.5 w-3.5" />
                      Schedule
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
