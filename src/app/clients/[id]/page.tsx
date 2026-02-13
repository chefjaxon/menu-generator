import { notFound } from 'next/navigation';
import { getClientById } from '@/lib/queries/clients';
import { ClientForm } from '@/components/clients/client-form';

export const dynamic = 'force-dynamic';

export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = getClientById(id);

  if (!client) {
    notFound();
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Edit Client</h1>
      <ClientForm client={client} />
    </div>
  );
}
