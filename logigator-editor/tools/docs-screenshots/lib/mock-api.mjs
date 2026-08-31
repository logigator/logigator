/**
 * A fake Logigator backend for the four shots that show cloud state. A live
 * account would put a drifting project list and a moving "Last edited" date
 * into the docs, so everything here is frozen and no request leaves the
 * machine. Only the reads those dialogs perform are modelled; writes echo back
 * so a dialog can be photographed mid-flow, but nothing persists.
 */

/** The signed-in user shown in the account menu. */
const USER = {
  id: '00000000-0000-4000-8000-000000000001',
  username: 'Demo',
  email: 'demo@logigator.com',
  memberSince: '2024-03-04T09:00:00.000Z',
  image: null,
  shortcuts: []
};

const SHARE_LINK = 'b3cad62c-aa17-4f0e-9c2f-5a1d8e77c410';

function resource(id, name, lastEdited, extra = {}) {
  return {
    id,
    name,
    description: '',
    createdOn: '2026-01-04T12:00:00.000Z',
    lastEdited,
    elementsFile: null,
    previewDark: null,
    previewLight: null,
    public: true,
    link: SHARE_LINK,
    ...extra
  };
}

const PROJECTS = [
  resource(
    '11111111-1111-4111-8111-111111111111',
    'Example',
    '2026-07-22T08:30:00.000Z'
  ),
  resource(
    '22222222-2222-4222-8222-222222222222',
    'CPU',
    '2026-07-19T16:05:00.000Z'
  ),
  resource(
    '33333333-3333-4333-8333-333333333333',
    'Test',
    '2026-07-09T11:20:00.000Z'
  ),
  resource(
    '44444444-4444-4444-8444-444444444444',
    'Untitled',
    '2026-07-09T09:45:00.000Z'
  )
];

const COMPONENTS = [
  resource(
    'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',
    'Memory',
    '2026-07-21T14:00:00.000Z',
    {
      symbol: 'MEM',
      numInputs: 6,
      numOutputs: 4,
      labels: [],
      version: 3
    }
  ),
  resource(
    'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb',
    'Register',
    '2026-07-18T10:30:00.000Z',
    {
      symbol: 'REG',
      numInputs: 5,
      numOutputs: 4,
      labels: [],
      version: 2
    }
  )
];

const envelope = (data) => ({ status: 200, data });
const pageOf = (entries) => ({
  page: 0,
  total: entries.length,
  count: entries.length,
  entries
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
    const method = request.method();

    if (path === '/api/user') return fulfil(route, envelope(USER));

    if (path === '/api/project') {
      if (method === 'GET') {
        return fulfil(route, envelope(pageOf(filtered(PROJECTS, url))));
      }
      return fulfil(route, envelope(PROJECTS[0]));
    }
    if (path.startsWith('/api/project/')) {
      const id = path.slice('/api/project/'.length);
      const project = PROJECTS.find((p) => p.id === id) ?? PROJECTS[0];
      return fulfil(
        route,
        envelope({ ...project, dependencies: [], elements: [] })
      );
    }

    if (path === '/api/component') {
      if (method === 'GET') {
        // Called with no paging params the endpoint returns a bare array.
        const paged =
          url.searchParams.has('page') || url.searchParams.has('size');
        const list = filtered(COMPONENTS, url);
        return fulfil(route, envelope(paged ? pageOf(list) : list));
      }
      return fulfil(route, envelope(COMPONENTS[0]));
    }
    if (path.startsWith('/api/component/')) {
      const id = path.slice('/api/component/'.length);
      const component = COMPONENTS.find((c) => c.id === id) ?? COMPONENTS[0];
      return fulfil(
        route,
        envelope({ ...component, dependencies: [], elements: [] })
      );
    }

    return fulfil(route, envelope(null));
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
