import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import jwt from 'jsonwebtoken';

/**
 * Issues a short-lived HS256 JWT that NestJS can independently validate
 * using the shared AUTH_SECRET — no JWKS endpoint needed.
 */
export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = jwt.sign(
    {
      sub: session.user.id,
      email: session.user.email ?? '',
      name: session.user.name ?? '',
    },
    process.env.AUTH_SECRET!,
    { expiresIn: '1h', algorithm: 'HS256' },
  );

  return NextResponse.json({ token, expiresIn: 3600 });
}
