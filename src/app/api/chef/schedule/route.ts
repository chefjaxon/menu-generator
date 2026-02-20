import { NextRequest, NextResponse } from 'next/server';
import { validateChefSession } from '@/lib/chef-auth';
import { getScheduleForChef } from '@/lib/queries/schedule';

export async function GET(request: NextRequest) {
  const chefToken = request.cookies.get('chef-session')?.value;
  if (!chefToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const chef = await validateChefSession(chefToken);
  if (!chef) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(from.getDate() + 14);

  const entries = await getScheduleForChef(chef.chefId, from, to);
  return NextResponse.json({ entries });
}
