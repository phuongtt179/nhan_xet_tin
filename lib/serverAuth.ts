import { NextRequest } from 'next/server';
import { SESSION_COOKIE_NAME, SessionPayload, verifySessionToken } from '@/lib/session';

export async function getSession(req: NextRequest): Promise<SessionPayload | null> {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  return verifySessionToken(token);
}

export async function requireAdmin(req: NextRequest): Promise<SessionPayload | null> {
  const session = await getSession(req);
  if (!session || session.role !== 'admin') return null;
  return session;
}
