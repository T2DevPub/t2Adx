import { NextResponse } from 'next/server';
import { z } from 'zod';
import { clearLoginFailures, createSession, loginIsBlocked, recordLoginFailure, verifyAdmin } from '@/lib/auth';

const schema = z.object({
  username: z.string().min(1).max(128),
  password: z.string().min(1).max(1024),
}).strict();

function clientAddress(req: Request) {
  // Coolify's reverse proxy supplies x-real-ip. Avoid trusting arbitrary forwarded lists.
  return req.headers.get('x-real-ip')?.trim()
    || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || 'unknown';
}

export async function POST(req: Request) {
  const origin = req.headers.get('origin');
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) {
        return NextResponse.json({ error: 'Request rejected.' }, { status: 403, headers: { 'Cache-Control': 'no-store' } });
      }
    } catch {
      return NextResponse.json({ error: 'Request rejected.' }, { status: 403, headers: { 'Cache-Control': 'no-store' } });
    }
  }

  const address = clientAddress(req);
  try {
    if (await loginIsBlocked(address)) {
      return NextResponse.json(
        { error: 'Too many sign-in attempts. Try again in 15 minutes.' },
        { status: 429, headers: { 'Cache-Control': 'no-store', 'Retry-After': '900' } },
      );
    }

    const contentType = req.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('application/json')) {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 415, headers: { 'Cache-Control': 'no-store' } });
    }
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid username or password.' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
    }

    if (!await verifyAdmin(parsed.data.username, parsed.data.password)) {
      await recordLoginFailure(address);
      return NextResponse.json({ error: 'Invalid username or password.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
    }

    await clearLoginFailures(address);
    await createSession();
    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    // Fail closed if the rate-limit store or auth configuration is unavailable.
    return NextResponse.json({ error: 'Sign-in is temporarily unavailable.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
