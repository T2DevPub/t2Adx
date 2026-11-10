import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { createHash, timingSafeEqual } from 'node:crypto';
import { prisma } from './prisma';

const cookieName = 't2dev_session';
function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error('AUTH_SECRET must be at least 32 characters.');
  return new TextEncoder().encode(s);
}
function passwordDigest(value: string) {
  return createHash('sha256').update(value, 'utf8').digest();
}
export async function verifyAdmin(username: string, password: string) {
  const expectedUser = process.env.ADMIN_USERNAME;
  const expectedPassword = process.env.ADMIN_PASSWORD;
  if (!expectedUser || !expectedPassword) throw new Error('Admin credentials are not configured.');
  const usernameMatches = username === expectedUser;
  const passwordMatches = timingSafeEqual(passwordDigest(password), passwordDigest(expectedPassword));
  return usernameMatches && passwordMatches;
}
export async function createSession() {
  const token = await new SignJWT({ role:'admin' }).setProtectedHeader({alg:'HS256'}).setIssuer('t2dev-monetization-center').setAudience('t2dev-admin').setSubject('administrator').setIssuedAt().setExpirationTime('4h').sign(secret());
  const jar = await cookies();
  jar.set(cookieName, token, { httpOnly:true, secure:process.env.NODE_ENV==='production', sameSite:'strict', path:'/', maxAge:14400 });
}
export async function destroySession() {
  const jar = await cookies(); jar.delete(cookieName);
}
export async function isAdmin() {
  try {
    const jar = await cookies(); const token = jar.get(cookieName)?.value;
    if (!token) return false;
    const {payload} = await jwtVerify(token, secret(), { issuer:'t2dev-monetization-center', audience:'t2dev-admin' });
    return payload.role === 'admin';
  } catch { return false; }
}

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILURES = 3;
const LOGIN_BLOCK_MS = 15 * 60 * 1000;

function hashClientAddress(address: string) {
  const salt = process.env.AUTH_SECRET;
  if (!salt || salt.length < 32) throw new Error('AUTH_SECRET must be at least 32 characters.');
  return createHash('sha256').update(`${salt}:${address}`).digest('hex');
}

export async function loginIsBlocked(address: string) {
  const ipHash = hashClientAddress(address);
  const attempt = await prisma.authLoginAttempt.findUnique({ where: { ipHash } });
  if (!attempt) return false;
  const now = Date.now();
  if (attempt.blockedUntil && attempt.blockedUntil.getTime() > now) return true;
  if (now - attempt.windowStartedAt.getTime() > LOGIN_WINDOW_MS) {
    await prisma.authLoginAttempt.deleteMany({ where: { ipHash } });
    return false;
  }
  return attempt.failures >= LOGIN_MAX_FAILURES;
}

export async function recordLoginFailure(address: string) {
  const ipHash = hashClientAddress(address);
  const now = new Date();
  await prisma.authLoginAttempt.deleteMany({ where: { updatedAt: { lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) } } });
  const existing = await prisma.authLoginAttempt.findUnique({ where: { ipHash } });
  if (!existing || now.getTime() - existing.windowStartedAt.getTime() > LOGIN_WINDOW_MS) {
    await prisma.authLoginAttempt.upsert({
      where: { ipHash },
      create: { ipHash, failures: 1, windowStartedAt: now },
      update: { failures: 1, windowStartedAt: now, blockedUntil: null },
    });
    return;
  }
  const failures = existing.failures + 1;
  await prisma.authLoginAttempt.update({
    where: { ipHash },
    data: {
      failures,
      blockedUntil: failures >= LOGIN_MAX_FAILURES ? new Date(now.getTime() + LOGIN_BLOCK_MS) : null,
    },
  });
}

export async function clearLoginFailures(address: string) {
  const ipHash = hashClientAddress(address);
  await prisma.authLoginAttempt.deleteMany({ where: { ipHash } });
}
