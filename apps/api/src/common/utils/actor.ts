import { BadRequestException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma.service';

export async function resolveActorUserId(
  prisma: PrismaService,
  userId?: string,
): Promise<string> {
  if (userId && !userId.startsWith('demo-')) {
    return userId;
  }

  if (userId) {
    const exactUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (exactUser) {
      return exactUser.id;
    }
  }

  const demoEmail = process.env.DEMO_USER_EMAIL ?? 'admin@rostersyncos.io';
  const demoUser = await prisma.user.findUnique({
    where: { email: demoEmail },
    select: { id: true },
  });
  if (demoUser) {
    return demoUser.id;
  }

  const fallbackUser = await prisma.user.findFirst({
    where: {
      role: {
        in: [Role.ADMIN, Role.SCHEDULER],
      },
    },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  if (fallbackUser) {
    return fallbackUser.id;
  }

  throw new BadRequestException(
    'No valid user is available for audit attribution.',
  );
}
