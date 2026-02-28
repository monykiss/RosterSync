import { BadRequestException } from '@nestjs/common';
import { CoversService } from '../covers.service';
import { PrismaService } from '../../../prisma.service';
import { OpportunityStatus } from '@prisma/client';

describe('Cover State Machine', () => {
  let service: CoversService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(() => {
    prisma = {
      coverOpportunity: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      sessionOccurrence: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      auditLog: { create: jest.fn() },
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 'user-1' }),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      $transaction: jest.fn(),
    } as any;

    service = new CoversService(
      prisma,
      {} as any, // compatibilityService
      {} as any, // syncService
      {} as any, // coverEngine
      {} as any, // notificationsService
    );
  });

  describe('cancelCoverRequest', () => {
    it('blocks cancellation of ASSIGNED opportunities', async () => {
      (prisma.coverOpportunity.findUnique as jest.Mock).mockResolvedValue({
        id: 'opp-1',
        status: OpportunityStatus.ASSIGNED,
        sessionId: 'session-1',
        session: { studioId: 'studio-1' },
      } as any);

      await expect(
        service.cancelCoverRequest('opp-1', 'user-1'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.cancelCoverRequest('opp-1', 'user-1'),
      ).rejects.toThrow(
        'Invalid cover status transition: ASSIGNED → CANCELLED',
      );
    });

    it('allows cancellation of OPEN opportunities', async () => {
      (prisma.coverOpportunity.findUnique as jest.Mock).mockResolvedValue({
        id: 'opp-1',
        status: OpportunityStatus.OPEN,
        sessionId: 'session-1',
        session: { studioId: 'studio-1' },
      } as any);
      prisma.$transaction.mockResolvedValue([]);

      await expect(
        service.cancelCoverRequest('opp-1', 'user-1'),
      ).resolves.toEqual({ message: 'Cover request cancelled' });
    });

    it('allows cancellation of OFFERED opportunities', async () => {
      (prisma.coverOpportunity.findUnique as jest.Mock).mockResolvedValue({
        id: 'opp-1',
        status: OpportunityStatus.OFFERED,
        sessionId: 'session-1',
        session: { studioId: 'studio-1' },
      } as any);
      prisma.$transaction.mockResolvedValue([]);

      await expect(
        service.cancelCoverRequest('opp-1', 'user-1'),
      ).resolves.toEqual({ message: 'Cover request cancelled' });
    });
  });

  describe('createCoverRequest', () => {
    it('blocks re-opening an ASSIGNED opportunity', async () => {
      (prisma.sessionOccurrence.findUnique as jest.Mock).mockResolvedValue({
        id: 'session-1',
        status: 'SCHEDULED',
        studioId: 'studio-1',
      } as any);
      (prisma.coverOpportunity.findUnique as jest.Mock).mockResolvedValue({
        id: 'opp-1',
        status: OpportunityStatus.ASSIGNED,
      } as any);

      await expect(
        service.createCoverRequest('user-1', { sessionId: 'session-1' }),
      ).rejects.toThrow('Cover already assigned');
    });

    it('blocks duplicate cover for OPEN opportunity', async () => {
      (prisma.sessionOccurrence.findUnique as jest.Mock).mockResolvedValue({
        id: 'session-1',
        status: 'SCHEDULED',
        studioId: 'studio-1',
      } as any);
      (prisma.coverOpportunity.findUnique as jest.Mock).mockResolvedValue({
        id: 'opp-1',
        status: OpportunityStatus.OPEN,
      } as any);

      await expect(
        service.createCoverRequest('user-1', { sessionId: 'session-1' }),
      ).rejects.toThrow('already exists');
    });
  });
});
