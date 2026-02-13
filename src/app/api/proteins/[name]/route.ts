import { NextRequest, NextResponse } from 'next/server';
import { removeProtein, getProteinUsageCount } from '@/lib/queries/proteins';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const decoded = decodeURIComponent(name);
  const usage = getProteinUsageCount(decoded);
  return NextResponse.json({ name: decoded, usage });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const decoded = decodeURIComponent(name);

  const usage = getProteinUsageCount(decoded);
  if (usage > 0) {
    return NextResponse.json(
      { error: `Cannot delete: protein is used by ${usage} client(s)/recipe(s)` },
      { status: 409 }
    );
  }

  const deleted = removeProtein(decoded);
  if (!deleted) {
    return NextResponse.json({ error: 'Protein not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
