import Link from 'next/link';
import { Plus } from 'lucide-react';
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
      _count: { select: { assignments: true } },
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
