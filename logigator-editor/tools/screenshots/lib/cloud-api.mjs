import { fixture } from './contract.mjs';

/**
 * A fake Logigator backend for the shots that show cloud state. A live account
 * would put a drifting project list and a moving "Last edited" date into the
 * docs, so everything here is frozen and no request leaves the machine. Only
 * the reads those dialogs perform are modelled; writes echo back so a dialog
 * can be photographed mid-flow, but nothing persists.
 *
 * Every fixture is parsed against the schema the editor validates its own reads
 * with, so the mock cannot answer in a shape the app does not read — which is
 * what it did for a while, and what nothing noticed: the run succeeded, and the
 * picture was of a dialog saying the request had failed. The API's bodies are
 * not enveloped, so a response *is* the resource.
 */

/** The signed-in user shown in the account menu. */
const USER = fixture('user', {
  id: '00000000-0000-4000-8000-000000000001',
  username: 'Demo',
  email: 'demo@logigator.com',
  emailVerified: true,
  avatar: null,
  memberSince: '2024-03-04T09:00:00.000Z',
  hasPassword: true,
  googleLinked: false
});

const SHARE_LINK = 'b3cad62c-aa17-4f0e-9c2f-5a1d8e77c410';
const CREATED_AT = '2026-01-04T12:00:00.000Z';

/** The fields a listing and a single read share. */
function circuitFields(id, name, lastEditedAt, extra = {}) {
  return {
    id,
    name,
    description: '',
    public: true,
    link: SHARE_LINK,
    version: 1,
    componentCount: 0,
    wireCount: 0,
    preview: null,
    createdAt: CREATED_AT,
    lastEditedAt,
    ...extra
  };
}

const PROJECTS = [
  [
    '11111111-1111-4111-8111-111111111111',
    'Example',
    '2026-07-22T08:30:00.000Z'
  ],
  ['22222222-2222-4222-8222-222222222222', 'CPU', '2026-07-19T16:05:00.000Z'],
  ['33333333-3333-4333-8333-333333333333', 'Test', '2026-07-09T11:20:00.000Z'],
  [
    '44444444-4444-4444-8444-444444444444',
    'Untitled',
    '2026-07-09T09:45:00.000Z'
  ]
].map((fields) => fixture('projectSummary', circuitFields(...fields)));

const COMPONENTS = [
  [
    'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',
    'Memory',
    '2026-07-21T14:00:00.000Z',
    { symbol: 'MEM', numInputs: 6, numOutputs: 4, labels: [], version: 3 }
  ],
  [
    'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb',
    'Register',
    '2026-07-18T10:30:00.000Z',
    { symbol: 'REG', numInputs: 5, numOutputs: 4, labels: [], version: 2 }
  ]
].map((fields) => fixture('componentSummary', circuitFields(...fields)));

const pageOf = (entries) => ({
  entries,
  page: 0,
  pageSize: Math.max(entries.length, 1),
  total: entries.length
});

/**
 * Routes `/api/**` to the fixtures and marks the session as signed in. The
 * editor watches the `isAuthenticated` cookie: flipping it true is what fetches
 * the user and brings the cloud tabs alive.
 */
export async function installApiMocks(page, { baseUrl }) {
  await page
    .context()
    .addCookies([{ name: 'isAuthenticated', value: 'true', url: baseUrl }]);

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;

    if (path === '/api/user') return fulfil(route, USER);

    // Both routes are the plural ones the services declare, and a listing is
    // always the paged envelope — the editor validates it against
    // `projectPageSchema`, so a bare array is a boundary failure, not a list.
    if (path === '/api/projects') {
      if (request.method() !== 'GET') return fulfil(route, PROJECTS[0]);
      return fulfil(route, pageOf(filtered(PROJECTS, url)));
    }
    if (path.startsWith('/api/projects/')) {
      const id = path.slice('/api/projects/'.length);
      const project = PROJECTS.find((p) => p.id === id) ?? PROJECTS[0];
      return fulfil(route, single('project', project));
    }

    if (path === '/api/components') {
      if (request.method() !== 'GET') return fulfil(route, COMPONENTS[0]);
      return fulfil(route, pageOf(filtered(COMPONENTS, url)));
    }
    if (path.startsWith('/api/components/')) {
      const id = path.slice('/api/components/'.length);
      const component = COMPONENTS.find((c) => c.id === id) ?? COMPONENTS[0];
      return fulfil(route, single('component', component));
    }

    return fulfil(route, null);
  });
}

/** A listing entry as the single-document read answers it. */
function single(kind, summary) {
  return fixture(kind, {
    ...summary,
    document: {},
    dependencies: [],
    attribution: []
  });
}

function filtered(entries, url) {
  const search = url.searchParams.get('search');
  if (!search) return entries;
  const needle = search.toLowerCase();
  return entries.filter((entry) => entry.name.toLowerCase().includes(needle));
}

function fulfil(route, body) {
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(body)
  });
}

export const FIXTURES = { USER, PROJECTS, COMPONENTS, SHARE_LINK };
