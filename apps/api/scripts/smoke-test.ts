/**
 * RosterSyncOS API Smoke Test
 *
 * Validates the hosted demo surface using mostly read-only requests.
 * Usage: npx tsx scripts/smoke-test.ts [BASE_URL]
 */

const CLI_ARGS = process.argv.slice(2).filter((arg) => arg !== '--');
const BASE_URL = CLI_ARGS[0] || 'http://127.0.0.1:3001';
const REQUEST_TIMEOUT_MS = 5000;

interface CheckResult {
  name: string;
  passed: boolean;
  ms: number;
  detail?: string;
}

const results: CheckResult[] = [];

async function check(name: string, fn: () => Promise<void>) {
  const startedAt = Date.now();

  try {
    await fn();
    results.push({ name, passed: true, ms: Date.now() - startedAt });
  } catch (error) {
    results.push({
      name,
      passed: false,
      ms: Date.now() - startedAt,
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}

async function get(
  path: string,
  options?: { headers?: Record<string, string>; allowAnyStatus?: boolean },
) {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: options?.headers,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!options?.allowAnyStatus && !response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`${response.status} ${response.statusText}: ${body.slice(0, 200)}`);
  }

  return response;
}

async function getJson<T>(
  path: string,
  options?: { headers?: Record<string, string>; allowAnyStatus?: boolean },
) {
  const response = await get(path, options);
  const data = await response.json();
  return { response, data: data as T };
}

async function postJson<T>(
  path: string,
  body: unknown,
  options?: { headers?: Record<string, string> },
) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`${response.status} ${response.statusText}: ${text.slice(0, 200)}`);
  }

  return response.json() as Promise<T>;
}

async function run() {
  console.log(`\n  RosterSyncOS Smoke Test`);
  console.log(`  Target: ${BASE_URL}\n`);

  await check('GET /health', async () => {
    const { data } = await getJson<{ status: string }>('/health');
    if (data.status !== 'ok') {
      throw new Error(`Expected status=ok, received ${data.status}`);
    }
  });

  await check('GET /version', async () => {
    const { data } = await getJson<{ version?: string; startedAt?: string }>('/version');
    if (!data.version || !data.startedAt) {
      throw new Error('Version metadata missing required fields');
    }
  });

  await check('GET /ready', async () => {
    const { response, data } = await getJson<{ status?: string; checks?: Record<string, string> }>(
      '/ready',
      { allowAnyStatus: true },
    );
    if (![200, 503].includes(response.status)) {
      throw new Error(`Unexpected readiness status ${response.status}`);
    }
    if (!data.checks) {
      throw new Error('Missing readiness checks payload');
    }
  });

  let token = '';
  await check('POST /auth/login', async () => {
    const data = await postJson<{ access_token?: string }>('/auth/login', {
      email: 'admin@rostersyncos.io',
      password: 'Admin2026!',
    });
    if (!data.access_token) {
      throw new Error('Missing access_token');
    }
    token = data.access_token;
  });

  if (!token) {
    throw new Error('Smoke test cannot continue without an auth token');
  }

  const authHeaders = { Authorization: `Bearer ${token}` };
  let studioId = '';
  let weekId = '';

  await check('GET /auth/me', async () => {
    const { data } = await getJson<{
      id?: string;
      email?: string;
      studios?: Array<{ id: string }>;
    }>('/auth/me', { headers: authHeaders });
    if (!data.id || !data.email) {
      throw new Error('Profile payload missing id/email');
    }
    if (!Array.isArray(data.studios) || data.studios.length === 0) {
      throw new Error('Profile has no studios');
    }
    studioId = data.studios[0].id;
  });

  await check('GET /studios', async () => {
    const { data } = await getJson<Array<{ id: string }>>('/studios', {
      headers: authHeaders,
    });
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('Expected at least one studio');
    }
    studioId = data[0].id;
  });

  const studioHeaders = {
    ...authHeaders,
    'x-studio-id': studioId,
  };

  await check('GET /weeks', async () => {
    const { data } = await getJson<Array<{ id: string }>>('/weeks', {
      headers: studioHeaders,
    });
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('Expected at least one week');
    }
    weekId = data[0].id;
  });

  await check('GET /weeks/:id/planner', async () => {
    const { data } = await getJson<{ id?: string; sessions?: unknown[] }>(
      `/weeks/${weekId}/planner`,
      { headers: studioHeaders },
    );
    if (data.id !== weekId || !Array.isArray(data.sessions)) {
      throw new Error('Planner payload missing id/sessions');
    }
  });

  await check('GET /weeks/:id/prepublish-check', async () => {
    const { data } = await getJson<{ canPublish?: boolean; blockers?: unknown[] }>(
      `/weeks/${weekId}/prepublish-check`,
      { headers: studioHeaders },
    );
    if (typeof data.canPublish !== 'boolean' || !Array.isArray(data.blockers)) {
      throw new Error('Prepublish payload missing required fields');
    }
  });

  await check('GET /opportunities/studio/:id', async () => {
    const { data } = await getJson<unknown[]>(
      `/opportunities/studio/${studioId}`,
      { headers: authHeaders },
    );
    if (!Array.isArray(data)) {
      throw new Error('Expected cover opportunities array');
    }
  });

  await check('GET /sync/status', async () => {
    const { data } = await getJson<unknown[]>(
      `/sync/status?studioId=${studioId}`,
      { headers: authHeaders },
    );
    if (!Array.isArray(data)) {
      throw new Error('Expected sync status array');
    }
  });

  await check('GET /sync/queue/health', async () => {
    const { data } = await getJson<{ connected?: boolean }>('/sync/queue/health', {
      headers: authHeaders,
    });
    if (typeof data.connected !== 'boolean') {
      throw new Error('Queue health missing connected flag');
    }
  });

  await check('GET /notifications', async () => {
    const { data } = await getJson<unknown[]>('/notifications', {
      headers: authHeaders,
    });
    if (!Array.isArray(data)) {
      throw new Error('Expected notifications array');
    }
  });

  console.log('  Results:');
  let failed = 0;
  for (const result of results) {
    const icon = result.passed ? '\x1b[32m\x1b[0m' : '\x1b[31m\x1b[0m';
    const symbol = result.passed ? '✓' : '✗';
    console.log(`  ${icon}${symbol} ${String(result.ms).padStart(4)}ms  ${result.name}`);
    if (!result.passed && result.detail) {
      failed += 1;
      console.log(`        ${result.detail}`);
    }
  }

  console.log(
    `\n  ${results.length - failed}/${results.length} passed${failed > 0 ? `, ${failed} failed` : ''}\n`,
  );

  process.exit(failed > 0 ? 1 : 0);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
