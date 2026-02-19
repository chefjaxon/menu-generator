'use client';

import { useState } from 'react';
import { Send, Link2, ShoppingBag, CheckCircle2, Copy } from 'lucide-react';

interface Props {
  menuId: string;
  initialClientToken: string | null;
  initialPantryToken: string | null;
  pantrySubmitted: boolean;
  groceryGenerated: boolean;
}

export function PublishControls({
  menuId,
  initialClientToken,
  initialPantryToken,
  pantrySubmitted,
  groceryGenerated,
}: Props) {
  const [clientToken, setClientToken] = useState(initialClientToken);
  const [pantryToken, setPantryToken] = useState(initialPantryToken);
  const [publishing, setPublishing] = useState(false);
  const [sendingPantry, setSendingPantry] = useState(false);
  const [copied, setCopied] = useState<'menu' | 'pantry' | null>(null);

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  async function handlePublish() {
    setPublishing(true);
    const res = await fetch(`/api/menus/${menuId}/publish`, { method: 'POST' });
    setPublishing(false);
    if (res.ok) {
      const data = await res.json();
      setClientToken(data.clientToken);
    }
  }

  async function handleSendPantry() {
    setSendingPantry(true);
    const res = await fetch(`/api/menus/${menuId}/send-pantry`, { method: 'POST' });
    setSendingPantry(false);
    if (res.ok) {
      const data = await res.json();
      setPantryToken(data.pantryToken);
    }
  }

  function copyLink(type: 'menu' | 'pantry') {
    const token = type === 'menu' ? clientToken : pantryToken;
    const path = type === 'menu' ? `/client/menu/${token}` : `/client/pantry/${token}`;
    navigator.clipboard.writeText(`${baseUrl}${path}`);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="border border-border rounded-lg p-4 space-y-3 bg-muted/20">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Client Sharing
      </p>

      {/* Menu link */}
      <div className="flex items-center gap-2">
        {clientToken ? (
          <>
            <span className="flex-1 text-xs text-muted-foreground truncate font-mono bg-background border border-border rounded px-2 py-1">
              {`${baseUrl}/client/menu/${clientToken}`}
            </span>
            <button
              onClick={() => copyLink('menu')}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded border border-border hover:bg-muted"
            >
              {copied === 'menu' ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
              {copied === 'menu' ? 'Copied' : 'Copy'}
            </button>
          </>
        ) : (
          <button
            onClick={handlePublish}
            disabled={publishing}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-foreground text-background text-xs font-medium rounded hover:opacity-90 disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" />
            {publishing ? 'Publishing…' : 'Publish & Get Menu Link'}
          </button>
        )}
      </div>

      {/* Pantry link — only shown after grocery list is generated */}
      {groceryGenerated && (
        <div className="flex items-center gap-2">
          {pantryToken ? (
            <>
              {pantrySubmitted && (
                <span className="text-xs text-green-700 font-medium flex items-center gap-1 mr-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Pantry submitted
                </span>
              )}
              <span className="flex-1 text-xs text-muted-foreground truncate font-mono bg-background border border-border rounded px-2 py-1">
                {`${baseUrl}/client/pantry/${pantryToken}`}
              </span>
              <button
                onClick={() => copyLink('pantry')}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded border border-border hover:bg-muted"
              >
                {copied === 'pantry' ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                {copied === 'pantry' ? 'Copied' : 'Copy'}
              </button>
            </>
          ) : (
            <button
              onClick={handleSendPantry}
              disabled={sendingPantry}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border border-border hover:bg-muted disabled:opacity-50"
            >
              <ShoppingBag className="h-3.5 w-3.5" />
              {sendingPantry ? 'Generating…' : 'Get Pantry Checklist Link'}
            </button>
          )}
        </div>
      )}

      {!groceryGenerated && clientToken && (
        <p className="text-xs text-muted-foreground">
          Generate the grocery list first to enable the pantry checklist link.
        </p>
      )}
    </div>
  );
}
