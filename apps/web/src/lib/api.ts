import axios, { AxiosError } from 'axios';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';

const API_PROXY_BASE_URL = '/api';
const API_TIMEOUT_MS = 8000;

function isHtmlResponse(error: AxiosError) {
    const contentType = error.response?.headers?.['content-type'];
    return typeof contentType === 'string' && contentType.includes('text/html');
}

function isReachabilityError(error: AxiosError) {
    return !error.response || error.code === 'ECONNABORTED';
}

export function isApiOfflineError(error: unknown) {
    return axios.isAxiosError(error) && isReachabilityError(error);
}

export function shouldRetryQuery(failureCount: number, error: unknown) {
    if (failureCount >= 1) {
        return false;
    }

    if (!axios.isAxiosError(error)) {
        return false;
    }

    if (isReachabilityError(error)) {
        return false;
    }

    const status = error.response?.status ?? 0;
    return status >= 500;
}

export const api = axios.create({
    baseURL: API_PROXY_BASE_URL,
    timeout: API_TIMEOUT_MS,
    headers: {
        'Content-Type': 'application/json',
    },
});

api.interceptors.response.use(
    (response) => response,
    (error: unknown) => {
        if (!axios.isAxiosError(error)) {
            return Promise.reject(error);
        }

        if (error.code === 'ECONNABORTED') {
            error.message = 'Request timed out while contacting the RosterSync API.';
            return Promise.reject(error);
        }

        if (!error.response) {
            error.message =
                'RosterSync could not reach the API. Check the backend deployment or API proxy configuration.';
            return Promise.reject(error);
        }

        if (error.response.status === 404 && isHtmlResponse(error)) {
            error.message =
                'RosterSync web is running, but the API proxy is not configured for this deployment.';
        }

        return Promise.reject(error);
    },
);

// Types based on the backend
export interface SessionConflict {
    sessionId: string;
    type: string;
    severity: string;
    message: string;
}

export interface SyncStatus {
    id: string;
    status: 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED';
    lastAttemptAt?: string;
    errorMessage?: string;
    payloadHash?: string;
    payloadPreview?: Record<string, unknown>;
}

export interface SyncJob {
    id: string;
    studioId: string;
    sessionId?: string;
    jobType: string;
    idempotencyKey: string;
    status: string;
    attempts: number;
    lastError?: string;
    lastAttemptAt?: string;
    errorMessage?: string;
    correlationId?: string;
    payloadHash?: string;
    createdAt: string;
    updatedAt: string;
}

export interface NotificationRecord {
    id: string;
    type: 'COVER_OPPORTUNITY' | 'COVER_ASSIGNED' | 'SCHEDULE_PUBLISHED' | 'SYNC_FAILED';
    title: string;
    body: string;
    read: boolean;
    createdAt: string;
}

export interface SessionRecord {
    id: string;
    status: 'SCHEDULED' | 'NEEDS_COVER' | 'COVER_PENDING' | 'COVER_ASSIGNED' | 'CANCELLED';
    startDateTimeUTC: string;
    endDateTimeUTC: string;
    baseClassTypeId: string;
    overrideClassTypeId: string | null;
    baseInstructorId: string;
    overrideInstructorId: string | null;
    overrideReason: string | null;
    syncStatus: SyncStatus | null;
    baseClassType: { name: string };
    overrideClassType?: { name: string };
    baseInstructor?: { fullName: string };
    overrideInstructor?: { fullName: string };
    coverOpportunity?: {
        id: string;
        status: string;
    } | null;
}

export interface WeekPlannerResponse {
    id: string;
    status: 'DRAFT' | 'PUBLISHED';
    weekStartDate: string;
    weekHash: string | null;
    publishVersion: number;
    studio?: { id: string; name: string; timezone: string } | null;
    sessions: SessionRecord[];
    conflicts: SessionConflict[];
}

export interface CoverOffer {
    id: string;
    opportunityId: string;
    instructorId: string;
    rankScore: number | null;
    reason: string | null;
    response: 'PENDING' | 'ACCEPT' | 'DECLINE';
    opportunity: {
        id: string;
        status: string;
        session: {
            id: string;
            startDateTimeUTC: string;
            endDateTimeUTC: string;
            baseClassType: { name: string };
            baseInstructor?: { fullName: string };
        };
    };
}

export interface CoverOpportunity {
    id: string;
    sessionId: string;
    status: string;
    session: SessionRecord;
    offers: Array<{
        id: string;
        instructorId: string;
        rankScore: number | null;
        reason: string | null;
        response: string;
        instructor: { id: string; fullName: string };
    }>;
}

function extractErrorMessage(err: unknown, fallback: string): string {
    if (axios.isAxiosError(err) && typeof err.message === 'string' && err.message.trim()) {
        return err.message;
    }
    if (err && typeof err === 'object' && 'response' in err) {
        const res = (err as { response?: { data?: { message?: string } } }).response;
        if (typeof res?.data?.message === 'string') return res.data.message;
    }
    return fallback;
}

// --- Publish Precheck ---

export interface BlockerGroup {
    type: string;
    label: string;
    description: string;
    fixHint: string;
    sessionIds: string[];
    count: number;
    examples: string[];
}

export interface PublishPrecheck {
    canPublish: boolean;
    sessionCount: number;
    criticalCount: number;
    warningCount: number;
    blockers: BlockerGroup[];
    warnings: BlockerGroup[];
    weekStatus: string;
    publishVersion: number;
    isRepublish: boolean;
}

// --- Version Diff ---

export interface VersionSnapshot {
    id: string;
    publishVersion: number;
    weekHash: string;
    publishedBy: string;
    publishedAt: string;
}

export interface SessionChange {
    sessionId: string;
    changeType: 'added' | 'removed' | 'modified' | 'unchanged';
    fields?: string[];
}

export interface VersionDiff {
    publishVersion: number;
    publishedAt: string;
    totalSessions: number;
    added: number;
    removed: number;
    modified: number;
    unchanged: number;
    changes: SessionChange[];
}

// --- Hooks ---

export const useVersionHistory = (weekId: string, enabled: boolean) => {
    return useQuery({
        queryKey: ['versionHistory', weekId],
        queryFn: async () => {
            const { data } = await api.get<VersionSnapshot[]>(`/weeks/${weekId}/versions`);
            return data;
        },
        enabled,
    });
};

export const useVersionDiff = (weekId: string, version: number, enabled: boolean) => {
    return useQuery({
        queryKey: ['versionDiff', weekId, version],
        queryFn: async () => {
            const { data } = await api.get<VersionDiff>(`/weeks/${weekId}/diff?version=${version}`);
            return data;
        },
        enabled,
    });
};

export const usePrepublishCheck = (weekId: string, enabled: boolean) => {
    return useQuery({
        queryKey: ['prepublishCheck', weekId],
        queryFn: async () => {
            const { data } = await api.get<PublishPrecheck>(`/weeks/${weekId}/prepublish-check`);
            return data;
        },
        enabled,
    });
};

export interface DashboardStats {
    totalSessions: number;
    fillRate: number;
    needsCover: number;
    cancelled: number;
    syncRate: number;
    syncFailed: number;
    activeInstructors: number;
}

export interface ApiHealthResponse {
    ok: boolean;
    timestamp: string;
}

export const useApiHealth = () => {
    return useQuery({
        queryKey: ['apiHealth'],
        queryFn: async () => {
            const { data } = await api.get<ApiHealthResponse>('/health');
            return data;
        },
        retry: false,
        staleTime: 30 * 1000,
        refetchInterval: 30 * 1000,
    });
};

export const useDashboardStats = () => {
    return useQuery({
        queryKey: ['dashboardStats'],
        queryFn: async () => {
            const { data } = await api.get<DashboardStats>('/weeks/dashboard-stats');
            return data;
        },
    });
};

export const usePlannerWeek = (weekId: string) => {
    return useQuery({
        queryKey: ['plannerWeek', weekId],
        queryFn: async () => {
            const { data } = await api.get<WeekPlannerResponse>(`/weeks/${weekId}/planner`);
            return data;
        },
    });
};

export const usePublishWeek = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ weekId, force }: { weekId: string; force?: boolean }) => {
            const { data } = await api.post(`/weeks/${weekId}/publish`, { force });
            return data;
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: ['plannerWeek'] });
            queryClient.invalidateQueries({ queryKey: ['prepublishCheck'] });
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
            toast({
                title: variables.force ? "Force Published" : "Week Published",
                description: variables.force
                    ? "Published with overridden blockers. Sync jobs enqueued."
                    : "Sync jobs have been enqueued.",
            });
        },
        onError: (err: unknown) => {
            toast({ title: "Week Not Published", description: extractErrorMessage(err, 'Could not publish week'), variant: "destructive" });
        },
    });
};

export const useSyncDashboard = (studioId?: string) => {
    return useQuery({
        queryKey: ['syncDashboard', studioId],
        queryFn: async () => {
            const { data } = await api.get(`/sync/status?studioId=${studioId}`);
            return data;
        },
        refetchInterval: 5000,
        enabled: !!studioId,
    });
};

export interface QueueHealth {
    connected: boolean;
    waiting: number;
    active: number;
    completed: number;
    failed: number;
}

export const useQueueHealth = () => {
    return useQuery({
        queryKey: ['queueHealth'],
        queryFn: async () => {
            const { data } = await api.get<QueueHealth>('/sync/queue/health');
            return data;
        },
        refetchInterval: 10000,
    });
};

export const useNotifications = () => {
    return useQuery({
        queryKey: ['notifications'],
        queryFn: async () => {
            const { data } = await api.get<NotificationRecord[]>('/notifications');
            return data;
        },
    });
};

export const useUnreadNotificationCount = () => {
    const notificationsQuery = useNotifications();
    const unreadCount = (notificationsQuery.data ?? []).filter(notification => !notification.read).length;

    return {
        ...notificationsQuery,
        unreadCount,
    };
};

export const useMarkNotificationRead = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (notificationId: string) => {
            const { data } = await api.put(`/notifications/${notificationId}/read`);
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
        },
    });
};

export const useRetryJob = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (jobId: string) => {
            const { data } = await api.post(`/sync/job/${jobId}/retry`);
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['syncDashboard'] });
            queryClient.invalidateQueries({ queryKey: ['plannerWeek'] });
            toast({
                title: "Job Retry Queued",
                description: "Sync job has been re-enqueued for upstream Wix processing.",
            });
        },
        onError: () => {
            toast({
                title: "Sync Retry Failed",
                description: "Could not re-enqueue job. Check the sync controller connection.",
                variant: "destructive",
            });
        }
    });
};

export const useMyCoverOffers = (instructorId?: string) => {
    return useQuery({
        queryKey: ['myCoverOffers', instructorId],
        queryFn: async () => {
            const { data } = await api.get<CoverOffer[]>('/opportunities/mine');
            return data;
        },
        enabled: !!instructorId,
    });
};

export const useStudioCovers = (studioId?: string) => {
    return useQuery({
        queryKey: ['studioCovers', studioId],
        queryFn: async () => {
            const { data } = await api.get<CoverOpportunity[]>(`/opportunities/studio/${studioId}`);
            return data;
        },
        enabled: !!studioId,
    });
};

export const useCancelCover = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (opportunityId: string) => {
            const { data } = await api.post(`/opportunities/${opportunityId}/cancel`);
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['studioCovers'] });
            queryClient.invalidateQueries({ queryKey: ['myCoverOffers'] });
            queryClient.invalidateQueries({ queryKey: ['plannerWeek'] });
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
            toast({ title: "Cover Request Cancelled" });
        },
        onError: (err: unknown) => {
            toast({ title: "Cover Not Cancelled", description: extractErrorMessage(err, 'Could not cancel cover request'), variant: "destructive" });
        },
    });
};

export const useRespondCover = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ opportunityId, instructorId, response, reason }: {
            opportunityId: string;
            instructorId: string;
            response: 'ACCEPT' | 'DECLINE';
            reason?: string;
        }) => {
            const { data } = await api.post(`/opportunities/${opportunityId}/respond`, {
                instructorId,
                response,
                reason,
            });
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['studioCovers'] });
            queryClient.invalidateQueries({ queryKey: ['myCoverOffers'] });
            queryClient.invalidateQueries({ queryKey: ['plannerWeek'] });
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
            toast({ title: "Response Submitted" });
        },
        onError: (err: unknown) => {
            toast({
                title: "Cover Response Not Submitted",
                description: extractErrorMessage(err, 'Could not process response'),
                variant: "destructive",
            });
        },
    });
};

export const useCreateUnavailability = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (dto: {
            instructorId: string;
            startDateTimeUTC: string;
            endDateTimeUTC: string;
            type: string;
            note?: string;
        }) => {
            const { data } = await api.post('/unavailability', dto);
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['plannerWeek'] });
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
            toast({ title: "Unavailability Recorded" });
        },
        onError: (err: unknown) => {
            toast({ title: "Unavailability Not Recorded", description: extractErrorMessage(err, 'Could not save unavailability'), variant: "destructive" });
        },
    });
};

// Bulk status update
export const useBulkUpdateStatus = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ studioId, sessionIds, status }: { studioId: string; sessionIds: string[]; status: string }) => {
            const { data } = await api.patch(`/sessions/bulk-status?studioId=${studioId}`, { sessionIds, status });
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['plannerWeek'] });
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
            toast({ title: "Sessions Updated" });
        },
        onError: (err: unknown) => {
            toast({ title: "Sessions Not Updated", description: extractErrorMessage(err, 'Could not update sessions'), variant: "destructive" });
        },
    });
};

// Session detail + audit trail
export interface AuditEvent {
    id: string;
    action: string;
    reason: string | null;
    beforeJson: Record<string, unknown> | null;
    afterJson: Record<string, unknown> | null;
    correlationId: string | null;
    createdAt: string;
    actor: { email: string; role: string };
}

export interface SessionDetailResponse {
    session: SessionRecord & {
        week: { status: string; weekStartDate: string; publishVersion: number; weekHash: string | null };
        coverOpportunity: {
            id: string;
            status: string;
            offers: Array<{
                id: string;
                instructorId: string;
                rankScore: number | null;
                reason: string | null;
                response: string;
                respondedAt: string | null;
                instructor: { id: string; fullName: string };
            }>;
        } | null;
    };
    auditTrail: AuditEvent[];
    syncHistory: SyncJob[];
    explainability: {
        steps: Array<{ layer: string; label: string; detail: string }>;
        skillMatch: { qualified: boolean; detail: string } | null;
        weeklyLoad: { current: number; max: number | null } | null;
        confidence: number;
        riskFlags: Array<{ level: 'HIGH' | 'MEDIUM' | 'LOW'; label: string; fix: string }>;
    };
}

export const useSessionDetail = (sessionId: string | null) => {
    return useQuery({
        queryKey: ['sessionDetail', sessionId],
        queryFn: async () => {
            const { data } = await api.get<SessionDetailResponse>(`/sessions/${sessionId}/detail`);
            return data;
        },
        enabled: !!sessionId,
    });
};

export const useOverrideSession = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ sessionId, classTypeId, instructorId, reason }: {
            sessionId: string;
            classTypeId?: string;
            instructorId?: string;
            reason: string;
        }) => {
            const { data } = await api.put(`/sessions/${sessionId}/override`, {
                classTypeId,
                instructorId,
                reason,
            });
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['plannerWeek'] });
            queryClient.invalidateQueries({ queryKey: ['sessionDetail'] });
            toast({ title: "Override Applied", description: "Session updated with override." });
        },
        onError: (err: unknown) => {
            toast({ title: "Override Not Applied", description: extractErrorMessage(err, 'Could not apply session override'), variant: "destructive" });
        },
    });
};

export const useWeeksList = () => {
    return useQuery({
        queryKey: ['weeksList'],
        queryFn: async () => {
            const { data } = await api.get('/weeks');
            return data;
        },
    });
};

// --- Slot Templates CRUD ---

export interface SlotTemplateRecord {
    id: string;
    studioId: string;
    name: string;
    weekday: number;
    startTime: string;
    durationMins: number;
    locationLabel?: string | null;
    isActive: boolean;
    defaultClassTypeId: string;
    defaultInstructorId?: string | null;
    defaultClassType: { id: string; name: string };
    defaultInstructor?: { id: string; fullName: string } | null;
}

export const useSlotTemplates = (studioId?: string) => {
    return useQuery({
        queryKey: ['slotTemplates', studioId],
        queryFn: async () => {
            const { data } = await api.get<SlotTemplateRecord[]>(`/slots?studioId=${studioId}`);
            return data;
        },
        enabled: !!studioId,
    });
};

export const useCreateSlotTemplate = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (dto: {
            studioId: string; name: string; weekday: number; startTime: string;
            durationMins: number; defaultClassTypeId: string; defaultInstructorId?: string;
            locationLabel?: string;
        }) => {
            const { data } = await api.post('/slots', dto);
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['slotTemplates'] });
            toast({ title: "Slot Template Created" });
        },
        onError: (err: unknown) => {
            toast({ title: "Slot Template Not Created", description: extractErrorMessage(err, 'Could not create slot template'), variant: "destructive" });
        },
    });
};

export const useUpdateSlotTemplate = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, ...dto }: {
            id: string; studioId: string; name: string; weekday: number; startTime: string;
            durationMins: number; defaultClassTypeId: string; defaultInstructorId?: string;
            locationLabel?: string;
        }) => {
            const { data } = await api.put(`/slots/${id}`, dto);
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['slotTemplates'] });
            toast({ title: "Slot Template Updated" });
        },
        onError: (err: unknown) => {
            toast({ title: "Slot Template Not Updated", description: extractErrorMessage(err, 'Could not update slot template'), variant: "destructive" });
        },
    });
};

export const useDeleteSlotTemplate = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => {
            await api.delete(`/slots/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['slotTemplates'] });
            toast({ title: "Slot Template Deleted" });
        },
        onError: (err: unknown) => {
            toast({ title: "Slot Template Not Deleted", description: extractErrorMessage(err, 'Could not delete slot template'), variant: "destructive" });
        },
    });
};

// --- Studios CRUD ---

export interface StudioRecord {
    id: string;
    name: string;
    timezone: string;
    wixSiteId?: string | null;
    wixAccountId?: string | null;
    createdAt: string;
    _count?: { classTypes: number; instructors: number; slots: number };
}

export const useStudios = () => {
    return useQuery({
        queryKey: ['studios'],
        queryFn: async () => {
            const { data } = await api.get<StudioRecord[]>('/studios');
            return data;
        },
    });
};

export const useCreateStudio = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (dto: { name: string; timezone: string; wixSiteId?: string; wixAccountId?: string }) => {
            const { data } = await api.post('/studios', dto);
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['studios'] });
            toast({ title: "Studio Created" });
        },
        onError: (err: unknown) => {
            toast({ title: "Studio Not Created", description: extractErrorMessage(err, 'Could not create studio'), variant: "destructive" });
        },
    });
};

export const useUpdateStudio = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, ...dto }: { id: string; name: string; timezone: string; wixSiteId?: string; wixAccountId?: string }) => {
            const { data } = await api.put(`/studios/${id}`, dto);
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['studios'] });
            toast({ title: "Studio Updated" });
        },
        onError: (err: unknown) => {
            toast({ title: "Studio Not Updated", description: extractErrorMessage(err, 'Could not update studio'), variant: "destructive" });
        },
    });
};

export const useDeleteStudio = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => {
            await api.delete(`/studios/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['studios'] });
            toast({ title: "Studio Deleted" });
        },
        onError: (err: unknown) => {
            toast({ title: "Studio Not Deleted", description: extractErrorMessage(err, 'Could not delete studio'), variant: "destructive" });
        },
    });
};

// --- Class Types CRUD ---

export interface ClassTypeRecord {
    id: string;
    studioId: string;
    name: string;
    description?: string | null;
    tags: string[];
    isActive: boolean;
}

export const useClassTypes = (studioId?: string) => {
    return useQuery({
        queryKey: ['classTypes', studioId],
        queryFn: async () => {
            const { data } = await api.get<ClassTypeRecord[]>(`/class-types?studioId=${studioId}`);
            return data;
        },
        enabled: !!studioId,
    });
};

export const useCreateClassType = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (dto: { studioId: string; name: string; description?: string; tags?: string[] }) => {
            const { data } = await api.post('/class-types', dto);
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['classTypes'] });
            toast({ title: "Class Type Created" });
        },
        onError: (err: unknown) => {
            toast({ title: "Class Type Not Created", description: extractErrorMessage(err, 'Could not create class type'), variant: "destructive" });
        },
    });
};

export const useUpdateClassType = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, ...dto }: { id: string; studioId: string; name: string; description?: string; tags?: string[] }) => {
            const { data } = await api.put(`/class-types/${id}`, dto);
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['classTypes'] });
            toast({ title: "Class Type Updated" });
        },
        onError: (err: unknown) => {
            toast({ title: "Class Type Not Updated", description: extractErrorMessage(err, 'Could not update class type'), variant: "destructive" });
        },
    });
};

export const useDeleteClassType = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => {
            await api.delete(`/class-types/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['classTypes'] });
            toast({ title: "Class Type Deleted" });
        },
        onError: (err: unknown) => {
            toast({ title: "Class Type Not Deleted", description: extractErrorMessage(err, 'Could not delete class type'), variant: "destructive" });
        },
    });
};

// --- Instructors CRUD ---

export interface InstructorRecord {
    id: string;
    studioId: string;
    fullName: string;
    email: string;
    phone?: string | null;
    isActive: boolean;
    maxWeeklySlots: number;
    skills: Array<{ id: string; classType: { id: string; name: string } }>;
}

export const useInstructors = (studioId?: string) => {
    return useQuery({
        queryKey: ['instructors', studioId],
        queryFn: async () => {
            const { data } = await api.get<InstructorRecord[]>(`/instructors?studioId=${studioId}`);
            return data;
        },
        enabled: !!studioId,
    });
};

export const useCreateInstructor = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (dto: { studioId: string; fullName: string; email: string; phone?: string; maxWeeklySlots?: number }) => {
            const { data } = await api.post('/instructors', dto);
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['instructors'] });
            toast({ title: "Instructor Created" });
        },
        onError: (err: unknown) => {
            toast({ title: "Instructor Not Created", description: extractErrorMessage(err, 'Could not create instructor'), variant: "destructive" });
        },
    });
};

export const useUpdateInstructor = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, ...dto }: { id: string; studioId: string; fullName: string; email: string; phone?: string; maxWeeklySlots?: number }) => {
            const { data } = await api.put(`/instructors/${id}`, dto);
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['instructors'] });
            toast({ title: "Instructor Updated" });
        },
        onError: (err: unknown) => {
            toast({ title: "Instructor Not Updated", description: extractErrorMessage(err, 'Could not update instructor'), variant: "destructive" });
        },
    });
};

export const useDeleteInstructor = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => {
            await api.delete(`/instructors/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['instructors'] });
            toast({ title: "Instructor Deleted" });
        },
        onError: (err: unknown) => {
            toast({ title: "Instructor Not Deleted", description: extractErrorMessage(err, 'Could not delete instructor'), variant: "destructive" });
        },
    });
};

// --- Instructor Skills ---

export const useUpdateInstructorSkills = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ instructorId, skills }: {
            instructorId: string;
            skills: Array<{ classTypeId: string; canTeach: boolean }>;
        }) => {
            const { data } = await api.put(`/instructors/${instructorId}/skills`, skills);
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['instructors'] });
            toast({ title: "Skills Updated" });
        },
        onError: (err: unknown) => {
            toast({ title: "Skills Not Updated", description: extractErrorMessage(err, 'Could not update skills'), variant: "destructive" });
        },
    });
};

// --- Compatibility Rules CRUD ---

export interface CompatibilityRuleRecord {
    id: string;
    studioId: string;
    fromClassTypeId: string;
    toClassTypeId: string;
    priority: number;
    isEnabled: boolean;
    reasonTemplate?: string | null;
    fromClassType: { id: string; name: string };
    toClassType: { id: string; name: string };
}

export const useCompatibilityRules = (studioId?: string) => {
    return useQuery({
        queryKey: ['compatibilityRules', studioId],
        queryFn: async () => {
            const { data } = await api.get<CompatibilityRuleRecord[]>(`/compatibility-rules?studioId=${studioId}`);
            return data;
        },
        enabled: !!studioId,
    });
};

export const useCreateCompatibilityRule = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (dto: { studioId: string; fromClassTypeId: string; toClassTypeId: string; priority: number; reasonTemplate?: string }) => {
            const { data } = await api.post('/compatibility-rules', dto);
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['compatibilityRules'] });
            toast({ title: "Rule Created" });
        },
        onError: (err: unknown) => {
            toast({ title: "Rule Not Created", description: extractErrorMessage(err, 'Could not create rule'), variant: "destructive" });
        },
    });
};

export const useDeleteCompatibilityRule = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => {
            await api.delete(`/compatibility-rules/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['compatibilityRules'] });
            toast({ title: "Rule Deleted" });
        },
        onError: (err: unknown) => {
            toast({ title: "Rule Not Deleted", description: extractErrorMessage(err, 'Could not delete rule'), variant: "destructive" });
        },
    });
};
