import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/lib/auth';
import {
  getScheduleForWeek,
  createScheduleEntry,
} from '@/lib/queries/schedule';

export async function GET(request: NextRequest) {
  const sessionToken = request.cookies.get('menu-gen-session')?.value;
  if (!sessionToken || !(await validateSession(sessionToken))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const weekParam = searchParams.get('week');

  let weekStart: Date;
  if (weekParam) {
    weekStart = new Date(weekParam + 'T00:00:00Z');
  } else {
    // Default to current week's Monday
    weekStart = new Date();
    weekStart.setUTCHours(0, 0, 0, 0);
    const day = weekStart.getUTCDay();
    const diff = day === 0 ? -6 : 1 - day;
    weekStart.setUTCDate(weekStart.getUTCDate() + diff);
  }

  const entries = await getScheduleForWeek(weekStart);
  return NextResponse.json({ entries });
}

export async function POST(request: NextRequest) {
  const sessionToken = request.cookies.get('menu-gen-session')?.value;
  if (!sessionToken || !(await validateSession(sessionToken))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { chefId, clientId, scheduledDate, scheduledTime, notes } = body;

  if (!chefId || !clientId || !scheduledDate || !scheduledTime) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const entry = await createScheduleEntry({ chefId, clientId, scheduledDate, scheduledTime, notes });
  return NextResponse.json({ entry }, { status: 201 });
}
