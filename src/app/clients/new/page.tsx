import { ClientForm } from '@/components/clients/client-form';

export default function NewClientPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">New Client</h1>
      <ClientForm />
    </div>
  );
}
