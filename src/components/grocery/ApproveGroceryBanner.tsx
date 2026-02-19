'use client';

import { useState } from 'react';
import { ClipboardCheck, CheckCircle2 } from 'lucide-react';

interface Props {
  menuId: string;
  initialApproved: boolean;
}

export function ApproveGroceryBanner({ menuId, initialApproved }: Props) {
  const [approved, setApproved] = useState(initialApproved);
  const [approving, setApproving] = useState(false);

  async function handleApprove() {
    setApproving(true);
    const res = await fetch(`/api/menus/${menuId}/approve-grocery`, { method: 'POST' });
    setApproving(false);
    if (res.ok) {
      setApproved(true);
    }
  }

  if (approved) {
    return (
      <div className="flex items-center gap-2 mb-6 px-4 py-2.5 rounded-lg border border-green-200 bg-green-50 text-green-700 text-sm font-medium">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        Grocery list approved — pantry checklist link is now available on the menu page.
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 mb-6 px-4 py-3 rounded-lg border border-green-300 bg-green-50">
      <ClipboardCheck className="h-5 w-5 text-green-700 shrink-0" />
      <div className="flex-1">
        <p className="text-sm font-medium text-green-800">Ready to share with the client?</p>
        <p className="text-xs text-green-700 mt-0.5">
          Review the list above, then approve it to unlock the pantry checklist link.
        </p>
      </div>
      <button
        onClick={handleApprove}
        disabled={approving}
        className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border border-green-600 text-green-700 bg-white hover:bg-green-50 disabled:opacity-50 transition-colors"
      >
        <ClipboardCheck className="h-3.5 w-3.5" />
        {approving ? 'Approving…' : 'Approve Grocery List'}
      </button>
    </div>
  );
}
