import { BadRequestException } from '@nestjs/common';
import { SessionsService } from '../sessions.service';
import { PrismaService } from '../../../prisma.service';

describe('Session State Machine', () => {
  let service: SessionsService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(() => {
    prisma = {
      sessionOccurrence: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      auditLog: { create: jest.fn() },
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 'user-1' }),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      coverOpportunity: { upsert: jest.fn() },
    } as any;

    service = new SessionsService(prisma, {
      generateOffersForOpportunity: jest.fn(),
    } as any);
  });

  describe('updateStatus', () => {
    it('allows SCHEDULED → NEEDS_COVER', async () => {
      (prisma.sessionOccurrence.findUnique as jest.Mock).mockResolvedValue({
        id: 's-1',
        status: 'SCHEDULED',
        studioId: 'studio-1',
      } as any);
      (prisma.sessionOccurrence.update as jest.Mock).mockResolvedValue({
        id: 's-1',
      } as any);
      (prisma.coverOpportunity.upsert as jest.Mock).mockResolvedValue({
        id: 'opp-1',
      } as any);

      await expect(
        service.updateStatus('s-1', { status: 'NEEDS_COVER' }, 'user-1'),
      ).resolves.toBeDefined();
    });

    it('blocks SCHEDULED → COVER_ASSIGNED', async () => {
      (prisma.sessionOccurrence.findUnique as jest.Mock).mockResolvedValue({
        id: 's-1',
        status: 'SCHEDULED',
        studioId: 'studio-1',
      } as any);

      await expect(
        service.updateStatus('s-1', { status: 'COVER_ASSIGNED' }, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('blocks CANCELLED → COVER_ASSIGNED', async () => {
      (prisma.sessionOccurrence.findUnique as jest.Mock).mockResolvedValue({
        id: 's-1',
        status: 'CANCELLED',
        studioId: 'studio-1',
      } as any);

      await expect(
        service.updateStatus('s-1', { status: 'COVER_ASSIGNED' }, 'user-1'),
      ).rejects.toThrow('Invalid session status transition');
    });

    it('allows CANCELLED → SCHEDULED (restore)', async () => {
      (prisma.sessionOccurrence.findUnique as jest.Mock).mockResolvedValue({
        id: 's-1',
        status: 'CANCELLED',
        studioId: 'studio-1',
      } as any);
      (prisma.sessionOccurrence.update as jest.Mock).mockResolvedValue({
        id: 's-1',
      } as any);

      await expect(
        service.updateStatus('s-1', { status: 'SCHEDULED' }, 'user-1'),
      ).resolves.toBeDefined();
    });
  });

  describe('bulkUpdateStatus', () => {
    it('rejects bulk update with mixed invalid transitions', async () => {
      (prisma.sessionOccurrence.findMany as jest.Mock).mockResolvedValue([
        { id: 's-1', status: 'SCHEDULED' },
        { id: 's-2', status: 'CANCELLED' }, // can't go to NEEDS_COVER
      ] as any);

      await expect(
        service.bulkUpdateStatus(
          'studio-1',
          { sessionIds: ['s-1', 's-2'], status: 'NEEDS_COVER' },
          'user-1',
        ),
      ).rejects.toThrow('Invalid status transition for 1 session(s)');
    });
  });
});
