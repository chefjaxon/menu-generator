import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { validateClientSession } from '@/lib/client-auth';
import { prisma } from '@/lib/prisma';
import { ChefHat, Calendar, CheckCircle2, ShoppingBag } from 'lucide-react';
import { ClientLogout } from './ClientLogout';

export const dynamic = 'force-dynamic';

export default async function ClientPortalPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('client-session')?.value;

  if (!token) {
    redirect('/client/login');
  }

  const session = await validateClientSession(token);
  if (!session) {
    redirect('/client/login');
  }

  const client = await prisma.client.findUnique({
    where: { id: session.clientId },
    select: {
      name: true,
      menus: {
        where: { finalized: true },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          weekLabel: true,
          createdAt: true,
          publishedAt: true,
          clientToken: true,
          pantryToken: true,
          pantrySubmitted: true,
          groceryGenerated: true,
          items: {
            where: { clientSelected: true },
            select: {
              id: true,
              clientNote: true,
              recipe: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  if (!client) {
    redirect('/client/login');
  }

  return (
    <div className="min-h-screen bg-muted/20">
      {/* Header */}
      <div className="bg-background border-b border-border px-4 py-4">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ChefHat className="h-5 w-5" />
            <span className="font-semibold">{client.name}</span>
          </div>
          <ClientLogout />
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 py-6">
        <h1 className="text-xl font-bold mb-1">Your Menus</h1>
        <p className="text-sm text-muted-foreground mb-6">
          View your past and current meal selections
        </p>

        {client.menus.length === 0 ? (
          <div className="border border-border rounded-xl p-8 text-center text-sm text-muted-foreground">
            No menus yet. Your chef will share one with you soon.
          </div>
        ) : (
          <div className="space-y-4">
            {client.menus.map((menu) => {
              const label = menu.weekLabel ||
                new Date(menu.createdAt).toLocaleDateString('en-US', {
                  month: 'long', day: 'numeric', year: 'numeric',
                });

              return (
                <div key={menu.id} className="bg-background border border-border rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {menu.clientToken && menu.items.length === 0 && (
                        <Link
                          href={`/client/menu/${menu.clientToken}`}
                          className="text-xs px-2.5 py-1 bg-primary text-primary-foreground rounded font-medium hover:opacity-90"
                        >
                          Make selections
                        </Link>
                      )}
                      {menu.pantryToken && !menu.pantrySubmitted && (
                        <Link
                          href={`/client/pantry/${menu.pantryToken}`}
                          className="text-xs px-2.5 py-1 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 flex items-center gap-1"
                        >
                          <ShoppingBag className="h-3 w-3" />
                          Pantry check
                        </Link>
                      )}
                      {menu.pantrySubmitted && (
                        <span className="text-xs text-green-700 flex items-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Pantry done
                        </span>
                      )}
                    </div>
                  </div>

                  {menu.items.length > 0 ? (
                    <div className="px-4 py-3">
                      <p className="text-xs font-medium text-muted-foreground mb-2">
                        Your selections ({menu.items.length})
                      </p>
                      <div className="space-y-1.5">
                        {menu.items.map((item) => (
                          <div key={item.id} className="flex items-start gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                            <div>
                              <p className="text-sm font-medium">{item.recipe?.name ?? '—'}</p>
                              {item.clientNote && (
                                <p className="text-xs text-muted-foreground italic">{item.clientNote}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : menu.clientToken ? (
                    <div className="px-4 py-3">
                      <p className="text-xs text-muted-foreground">
                        Your chef has shared this menu. Tap &quot;Make selections&quot; to choose your meals.
                      </p>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
