'use client';

import { useState } from 'react';
import type { Menu, GroceryItem, RemovedItem } from '@/lib/types';
import { findDuplicatePairs } from '@/lib/grocery-similarity';
import { ClientSelectionSection } from './ClientSelectionSection';
import { GroceryListSection } from './GroceryListSection';
import { PastePanelSection } from './PastePanelSection';
import { RemovedItemsPanel } from './RemovedItemsPanel';
import { ApproveGroceryBanner } from './ApproveGroceryBanner';

interface Props {
  menu: Menu;
  initialGroceryItems: GroceryItem[];
  initialRemovedItems: RemovedItem[];
  initialGroceryApproved: boolean;
}

export function GroceryPageClient({ menu, initialGroceryItems, initialRemovedItems, initialGroceryApproved }: Props) {
  const [menuItems, setMenuItems] = useState(menu.items);
  const [groceryItems, setGroceryItems] = useState<GroceryItem[]>(initialGroceryItems);
  const [removedItems, setRemovedItems] = useState<RemovedItem[]>(initialRemovedItems);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  const duplicatePairs = findDuplicatePairs(groceryItems);

  async function handleToggleSelected(menuItemId: string, selected: boolean) {
    // Optimistic update
    setMenuItems((prev) =>
      prev.map((i) => (i.id === menuItemId ? { ...i, clientSelected: selected } : i))
    );
    const res = await fetch(`/api/menus/${menu.id}/items`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ menuItemId, selected }),
    });
    if (!res.ok) {
      // Revert on failure
      setMenuItems((prev) =>
        prev.map((i) => (i.id === menuItemId ? { ...i, clientSelected: !selected } : i))
      );
    }
  }

  async function handleGenerate() {
    setGenerating(true);
    setError('');
    try {
      const res = await fetch(`/api/menus/${menu.id}/grocery/generate`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Generate failed');
      const { items, removedItems: removed } = await res.json();
      setGroceryItems(items);
      setRemovedItems(removed);
    } catch {
      setError('Failed to generate grocery list. Please try again.');
    } finally {
      setGenerating(false);
    }
  }

  async function handleUpdateItem(itemId: string, data: Partial<GroceryItem>) {
    const res = await fetch(`/api/menus/${menu.id}/grocery/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const updated: GroceryItem = await res.json();
      setGroceryItems((prev) =>
        prev.map((i) => (i.id === itemId ? updated : i))
      );
    }
  }

  async function handleDeleteItem(itemId: string) {
    const res = await fetch(`/api/menus/${menu.id}/grocery/${itemId}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      setGroceryItems((prev) => prev.filter((i) => i.id !== itemId));
    }
  }

  async function handleMerge(
    keepId: string,
    deleteId: string,
    mergedData: {
      name: string;
      quantity: string | null;
      unit: string | null;
      notes: string | null;
    }
  ) {
    const res = await fetch(`/api/menus/${menu.id}/grocery/merge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keepId, deleteId, ...mergedData }),
    });
    if (res.ok) {
      const updated: GroceryItem = await res.json();
      setGroceryItems((prev) =>
        prev
          .filter((i) => i.id !== deleteId)
          .map((i) => (i.id === keepId ? updated : i))
      );
    }
  }

  async function handleRestoreItem(itemId: string) {
    const res = await fetch(`/api/menus/${menu.id}/grocery/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId }),
    });
    if (res.ok) {
      const restored: GroceryItem = await res.json();
      setRemovedItems((prev) => prev.filter((i) => i.id !== itemId));
      setGroceryItems((prev) => [...prev, restored]);
    }
  }

  async function handleAddParsedItems(
    parsed: Array<{ name: string; quantity: string | null; unit: string | null }>
  ) {
    const results: GroceryItem[] = [];
    for (const p of parsed) {
      const res = await fetch(`/api/menus/${menu.id}/grocery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...p, source: 'manual' }),
      });
      if (res.ok) {
        results.push(await res.json());
      }
    }
    setGroceryItems((prev) => [...prev, ...results]);
  }

  return (
    <div className="space-y-8">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
          {error}
        </div>
      )}

      {groceryItems.length > 0 && (
        <ApproveGroceryBanner menuId={menu.id} initialApproved={initialGroceryApproved} />
      )}

      <ClientSelectionSection
        menuItems={menuItems}
        onToggle={handleToggleSelected}
      />

      <GroceryListSection
        menuId={menu.id}
        items={groceryItems}
        duplicatePairs={duplicatePairs}
        generating={generating}
        onGenerate={handleGenerate}
        onUpdate={handleUpdateItem}
        onDelete={handleDeleteItem}
        onMerge={handleMerge}
      />

      <RemovedItemsPanel
        items={removedItems}
        onRestore={handleRestoreItem}
      />

      <PastePanelSection
        menuId={menu.id}
        onAdd={handleAddParsedItems}
      />
    </div>
  );
}
