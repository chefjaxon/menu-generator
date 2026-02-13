import { getAllClients } from '@/lib/queries/clients';
import { MenuGenerator } from '@/components/menus/menu-generator';

export default function GenerateMenuPage() {
  const clients = getAllClients();

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Generate Menu</h1>
      <MenuGenerator clients={clients} />
    </div>
  );
}
