export const dynamic = 'force-dynamic';

import { getAllGroceryListSummaries } from '@/lib/queries/grocery';
import { getAllClients } from '@/lib/queries/clients';
import { GroceryListsTable } from '@/components/grocery/GroceryListsTable';

export default async function GroceryListsPage() {
  const [summaries, clients] = await Promise.all([
    getAllGroceryListSummaries(),
    getAllClients(),
  ]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Grocery Lists</h1>
      </div>
      <GroceryListsTable summaries={summaries} clients={clients} />
    </div>
  );
}
