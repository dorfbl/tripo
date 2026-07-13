import { prisma } from './prisma';

const DEFAULT_SUPER_ADMINS = ['dorfbl@gmail.com'];

export function superAdminEmails(): string[] {
  return (process.env.PLAN_ADMIN_EMAILS || DEFAULT_SUPER_ADMINS.join(','))
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export async function isSuperAdmin(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  if (!user?.email) return false;
  return superAdminEmails().includes(user.email.toLowerCase());
}

export async function requireSuperAdmin(userId: string): Promise<void> {
  const ok = await isSuperAdmin(userId);
  if (!ok) {
    const err: any = new Error('אין הרשאת סופר־אדמין');
    err.status = 403;
    err.code = 'SUPER_ADMIN_ONLY';
    throw err;
  }
}
