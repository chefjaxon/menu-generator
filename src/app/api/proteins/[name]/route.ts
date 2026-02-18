import { NextRequest, NextResponse } from 'next/server';
import { removeProtein, forceRemoveProtein, getProteinUsageCount } from '@/lib/queries/proteins';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const decoded = decodeURIComponent(name);
  const usage = await getProteinUsageCount(decoded);
  return NextResponse.json({ name: decoded, usage });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const decoded = decodeURIComponent(name);
  const force = request.nextUrl.searchParams.get('force') === 'true';

  if (force) {
    const deleted = await forceRemoveProtein(decoded);
    if (!deleted) {
      return NextResponse.json({ error: 'Protein not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  }

  const usage = await getProteinUsageCount(decoded);
  if (usage > 0) {
    return NextResponse.json(
      { error: `Cannot delete: protein is used by ${usage} client(s)/recipe(s)` },
      { status: 409 }
    );
  }

  const deleted = await removeProtein(decoded);
  if (!deleted) {
    return NextResponse.json({ error: 'Protein not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
