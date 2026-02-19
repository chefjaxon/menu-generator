import { notFound } from 'next/navigation';
import { getClientById } from '@/lib/queries/clients';
import { ClientForm } from '@/components/clients/client-form';
import { ClientAccountManager } from '@/components/clients/ClientAccountManager';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [client, account] = await Promise.all([
    getClientById(id),
    prisma.clientAccount.findUnique({
      where: { clientId: id },
      select: { email: true },
    }),
  ]);

  if (!client) {
    notFound();
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Edit Client</h1>
      <div className="grid gap-6">
        <ClientForm client={client} />
        <ClientAccountManager
          clientId={id}
          existingEmail={account?.email ?? null}
        />
      </div>
    </div>
  );
}
