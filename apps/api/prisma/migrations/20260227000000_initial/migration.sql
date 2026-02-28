-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'SCHEDULER', 'INSTRUCTOR');

-- CreateEnum
CREATE TYPE "WeekStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('SCHEDULED', 'NEEDS_COVER', 'COVER_PENDING', 'COVER_ASSIGNED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "UnavailabilityType" AS ENUM ('HOLIDAY', 'SICK', 'PERSONAL', 'OTHER');

-- CreateEnum
CREATE TYPE "OpportunityStatus" AS ENUM ('OPEN', 'OFFERED', 'ACCEPTED', 'ASSIGNED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OfferResponse" AS ENUM ('PENDING', 'ACCEPT', 'DECLINE');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('COVER_OPPORTUNITY', 'COVER_ASSIGNED', 'SCHEDULE_PUBLISHED', 'SYNC_FAILED');

-- CreateEnum
CREATE TYPE "WixMode" AS ENUM ('STUB', 'LIVE');

-- CreateEnum
CREATE TYPE "WixJobType" AS ENUM ('UPSERT_SESSION', 'CANCEL_SESSION', 'RECONCILE_PULL');

-- CreateEnum
CREATE TYPE "WixJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "instructorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Studio" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "wixSiteId" TEXT,
    "wixAccountId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Studio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassType" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClassType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Instructor" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "maxWeeklySlots" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Instructor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstructorSkill" (
    "id" TEXT NOT NULL,
    "instructorId" TEXT NOT NULL,
    "classTypeId" TEXT NOT NULL,
    "canTeach" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InstructorSkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompatibilityRule" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "fromClassTypeId" TEXT NOT NULL,
    "toClassTypeId" TEXT NOT NULL,
    "priority" INTEGER NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "reasonTemplate" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompatibilityRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecurringSlotTemplate" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "durationMins" INTEGER NOT NULL,
    "locationLabel" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "defaultClassTypeId" TEXT NOT NULL,
    "defaultInstructorId" TEXT,

    CONSTRAINT "RecurringSlotTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Week" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "weekStartDate" TIMESTAMP(3) NOT NULL,
    "status" "WeekStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "publishedBy" TEXT,
    "publishVersion" INTEGER NOT NULL DEFAULT 0,
    "weekHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Week_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionOccurrence" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "weekId" TEXT NOT NULL,
    "slotTemplateId" TEXT NOT NULL,
    "sessionDate" TIMESTAMP(3) NOT NULL,
    "startDateTimeUTC" TIMESTAMP(3) NOT NULL,
    "endDateTimeUTC" TIMESTAMP(3) NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "baseClassTypeId" TEXT NOT NULL,
    "baseInstructorId" TEXT,
    "overrideClassTypeId" TEXT,
    "overrideInstructorId" TEXT,
    "overrideReason" TEXT,
    "wixEventId" TEXT,
    "wixInstanceId" TEXT,
    "wixRevision" TEXT,
    "lastSyncedHash" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionOccurrence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Unavailability" (
    "id" TEXT NOT NULL,
    "instructorId" TEXT NOT NULL,
    "startDateTimeUTC" TIMESTAMP(3) NOT NULL,
    "endDateTimeUTC" TIMESTAMP(3) NOT NULL,
    "type" "UnavailabilityType" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Unavailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoverOpportunity" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "requestedByUserId" TEXT NOT NULL,
    "status" "OpportunityStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoverOpportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoverOffer" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "instructorId" TEXT NOT NULL,
    "offeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "response" "OfferResponse" NOT NULL DEFAULT 'PENDING',
    "rankScore" DOUBLE PRECISION,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoverOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WixIntegration" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "mode" "WixMode" NOT NULL DEFAULT 'STUB',
    "wixSiteId" TEXT,
    "wixAppInstanceId" TEXT,
    "accessTokenEncrypted" TEXT,
    "refreshTokenEncrypted" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WixIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WixSyncJob" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "sessionId" TEXT,
    "jobType" "WixJobType" NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" "WixJobStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "correlationId" TEXT,
    "payloadJson" JSONB,
    "payloadHash" TEXT,
    "publishVersion" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WixSyncJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "beforeJson" JSONB,
    "afterJson" JSONB,
    "reason" TEXT,
    "correlationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublishSnapshot" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "weekId" TEXT NOT NULL,
    "publishVersion" INTEGER NOT NULL,
    "weekHash" TEXT NOT NULL,
    "effectiveJson" JSONB NOT NULL,
    "diffSummary" JSONB,
    "publishedBy" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "correlationId" TEXT,

    CONSTRAINT "PublishSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_instructorId_key" ON "User"("instructorId");

-- CreateIndex
CREATE INDEX "ClassType_studioId_idx" ON "ClassType"("studioId");

-- CreateIndex
CREATE UNIQUE INDEX "ClassType_studioId_name_key" ON "ClassType"("studioId", "name");

-- CreateIndex
CREATE INDEX "Instructor_studioId_idx" ON "Instructor"("studioId");

-- CreateIndex
CREATE UNIQUE INDEX "Instructor_studioId_email_key" ON "Instructor"("studioId", "email");

-- CreateIndex
CREATE INDEX "InstructorSkill_classTypeId_idx" ON "InstructorSkill"("classTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "InstructorSkill_instructorId_classTypeId_key" ON "InstructorSkill"("instructorId", "classTypeId");

-- CreateIndex
CREATE INDEX "CompatibilityRule_studioId_fromClassTypeId_idx" ON "CompatibilityRule"("studioId", "fromClassTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "CompatibilityRule_studioId_fromClassTypeId_toClassTypeId_key" ON "CompatibilityRule"("studioId", "fromClassTypeId", "toClassTypeId");

-- CreateIndex
CREATE INDEX "RecurringSlotTemplate_studioId_weekday_idx" ON "RecurringSlotTemplate"("studioId", "weekday");

-- CreateIndex
CREATE INDEX "Week_studioId_status_idx" ON "Week"("studioId", "status");

-- CreateIndex
CREATE INDEX "Week_studioId_weekHash_idx" ON "Week"("studioId", "weekHash");

-- CreateIndex
CREATE UNIQUE INDEX "Week_studioId_weekStartDate_key" ON "Week"("studioId", "weekStartDate");

-- CreateIndex
CREATE INDEX "SessionOccurrence_studioId_weekId_idx" ON "SessionOccurrence"("studioId", "weekId");

-- CreateIndex
CREATE INDEX "SessionOccurrence_status_idx" ON "SessionOccurrence"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SessionOccurrence_slotTemplateId_startDateTimeUTC_key" ON "SessionOccurrence"("slotTemplateId", "startDateTimeUTC");

-- CreateIndex
CREATE INDEX "Unavailability_instructorId_startDateTimeUTC_idx" ON "Unavailability"("instructorId", "startDateTimeUTC");

-- CreateIndex
CREATE UNIQUE INDEX "CoverOpportunity_sessionId_key" ON "CoverOpportunity"("sessionId");

-- CreateIndex
CREATE INDEX "CoverOffer_instructorId_idx" ON "CoverOffer"("instructorId");

-- CreateIndex
CREATE UNIQUE INDEX "CoverOffer_opportunityId_instructorId_key" ON "CoverOffer"("opportunityId", "instructorId");

-- CreateIndex
CREATE INDEX "Notification_userId_read_idx" ON "Notification"("userId", "read");

-- CreateIndex
CREATE UNIQUE INDEX "WixIntegration_studioId_key" ON "WixIntegration"("studioId");

-- CreateIndex
CREATE UNIQUE INDEX "WixSyncJob_idempotencyKey_key" ON "WixSyncJob"("idempotencyKey");

-- CreateIndex
CREATE INDEX "WixSyncJob_studioId_status_idx" ON "WixSyncJob"("studioId", "status");

-- CreateIndex
CREATE INDEX "WixSyncJob_correlationId_idx" ON "WixSyncJob"("correlationId");

-- CreateIndex
CREATE INDEX "WixSyncJob_sessionId_idx" ON "WixSyncJob"("sessionId");

-- CreateIndex
CREATE INDEX "AuditLog_studioId_createdAt_idx" ON "AuditLog"("studioId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_correlationId_idx" ON "AuditLog"("correlationId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "PublishSnapshot_studioId_weekHash_idx" ON "PublishSnapshot"("studioId", "weekHash");

-- CreateIndex
CREATE UNIQUE INDEX "PublishSnapshot_studioId_weekId_publishVersion_key" ON "PublishSnapshot"("studioId", "weekId", "publishVersion");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "Instructor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassType" ADD CONSTRAINT "ClassType_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Instructor" ADD CONSTRAINT "Instructor_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstructorSkill" ADD CONSTRAINT "InstructorSkill_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "Instructor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstructorSkill" ADD CONSTRAINT "InstructorSkill_classTypeId_fkey" FOREIGN KEY ("classTypeId") REFERENCES "ClassType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompatibilityRule" ADD CONSTRAINT "CompatibilityRule_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompatibilityRule" ADD CONSTRAINT "CompatibilityRule_fromClassTypeId_fkey" FOREIGN KEY ("fromClassTypeId") REFERENCES "ClassType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompatibilityRule" ADD CONSTRAINT "CompatibilityRule_toClassTypeId_fkey" FOREIGN KEY ("toClassTypeId") REFERENCES "ClassType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringSlotTemplate" ADD CONSTRAINT "RecurringSlotTemplate_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringSlotTemplate" ADD CONSTRAINT "RecurringSlotTemplate_defaultClassTypeId_fkey" FOREIGN KEY ("defaultClassTypeId") REFERENCES "ClassType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringSlotTemplate" ADD CONSTRAINT "RecurringSlotTemplate_defaultInstructorId_fkey" FOREIGN KEY ("defaultInstructorId") REFERENCES "Instructor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Week" ADD CONSTRAINT "Week_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionOccurrence" ADD CONSTRAINT "SessionOccurrence_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionOccurrence" ADD CONSTRAINT "SessionOccurrence_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "Week"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionOccurrence" ADD CONSTRAINT "SessionOccurrence_slotTemplateId_fkey" FOREIGN KEY ("slotTemplateId") REFERENCES "RecurringSlotTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionOccurrence" ADD CONSTRAINT "SessionOccurrence_baseClassTypeId_fkey" FOREIGN KEY ("baseClassTypeId") REFERENCES "ClassType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionOccurrence" ADD CONSTRAINT "SessionOccurrence_overrideClassTypeId_fkey" FOREIGN KEY ("overrideClassTypeId") REFERENCES "ClassType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionOccurrence" ADD CONSTRAINT "SessionOccurrence_baseInstructorId_fkey" FOREIGN KEY ("baseInstructorId") REFERENCES "Instructor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionOccurrence" ADD CONSTRAINT "SessionOccurrence_overrideInstructorId_fkey" FOREIGN KEY ("overrideInstructorId") REFERENCES "Instructor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unavailability" ADD CONSTRAINT "Unavailability_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "Instructor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoverOpportunity" ADD CONSTRAINT "CoverOpportunity_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "SessionOccurrence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoverOpportunity" ADD CONSTRAINT "CoverOpportunity_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoverOffer" ADD CONSTRAINT "CoverOffer_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "CoverOpportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoverOffer" ADD CONSTRAINT "CoverOffer_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "Instructor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WixIntegration" ADD CONSTRAINT "WixIntegration_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WixSyncJob" ADD CONSTRAINT "WixSyncJob_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

