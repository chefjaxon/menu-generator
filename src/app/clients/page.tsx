import Link from 'next/link';
import { Plus } from 'lucide-react';
import { getAllClients } from '@/lib/queries/clients';
import { ClientTable } from '@/components/clients/client-table';

export const dynamic = 'force-dynamic';

export default function ClientsPage() {
  const clients = getAllClients();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Clients</h1>
        <Link
          href="/clients/new"
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Add Client
        </Link>
      </div>
      <ClientTable clients={clients} />
    </div>
  );
}
