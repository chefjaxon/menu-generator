import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function ChefClientProfilePage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      name: true,
      chefNotes: true,
      servingsPerDish: true,
      dishCount: true,
      proteins: { select: { protein: true }, orderBy: { protein: 'asc' } },
      restrictions: { select: { restriction: true }, orderBy: { restriction: 'asc' } },
      cuisinePreferences: {
        select: { cuisineType: true, weight: true },
        orderBy: { weight: 'desc' },
      },
    },
  });

  if (!client) notFound();

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-foreground text-background px-4 py-4 sticky top-0 z-10">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Link href="/chef" className="text-background/70 hover:text-background transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-base font-semibold">{client.name}</h1>
            <p className="text-xs opacity-70">Client Profile</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-5">
        {client.chefNotes && (
          <div className="border border-border rounded-xl p-4">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Chef Notes
            </h2>
            <p className="text-sm whitespace-pre-wrap">{client.chefNotes}</p>
          </div>
        )}

        <div className="border border-border rounded-xl p-4 space-y-4">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Cooking Details
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Dishes per menu</p>
              <p className="text-sm font-medium mt-0.5">{client.dishCount}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Servings per dish</p>
              <p className="text-sm font-medium mt-0.5">{client.servingsPerDish}</p>
            </div>
          </div>
        </div>

        {client.restrictions.length > 0 && (
          <div className="border border-border rounded-xl p-4">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Dietary Restrictions
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {client.restrictions.map((r) => (
                <span
                  key={r.restriction}
                  className="px-2 py-0.5 bg-destructive/10 text-destructive text-xs rounded-full font-medium"
                >
                  {r.restriction}
                </span>
              ))}
            </div>
          </div>
        )}

        {client.proteins.length > 0 && (
          <div className="border border-border rounded-xl p-4">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Preferred Proteins
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {client.proteins.map((p) => (
                <span
                  key={p.protein}
                  className="px-2 py-0.5 bg-muted text-foreground text-xs rounded-full"
                >
                  {p.protein}
                </span>
              ))}
            </div>
          </div>
        )}

        {client.cuisinePreferences.length > 0 && (
          <div className="border border-border rounded-xl p-4">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Cuisine Preferences
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {client.cuisinePreferences.map((c) => (
                <span
                  key={c.cuisineType}
                  className="px-2 py-0.5 bg-muted text-foreground text-xs rounded-full"
                >
                  {c.cuisineType}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
