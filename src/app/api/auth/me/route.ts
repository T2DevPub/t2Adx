import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';

export async function GET() {
  return NextResponse.json(
    { authenticated: await isAdmin() },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
