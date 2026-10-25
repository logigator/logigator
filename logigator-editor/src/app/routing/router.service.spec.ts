import { describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Location } from '@angular/common';
import { PersistenceService } from '../persistence/persistence.service';
import { ToastService } from '../logging/toast.service';
import { configureTestBed } from '../../testing/configure-test-bed';
import { RouterService } from './router.service';
import { ProjectRoute } from './routes/project.route';
import { Route } from './route.model';

const ID = '11111111-1111-4111-8111-111111111111';

/** What campaign links and social sites append to an address. */
const QUERIES = ['?utm_source=x', '?fbclid=abc&utm_medium=social', '#top'];

describe('RouterService', () => {
  let persistence: Record<string, ReturnType<typeof vi.fn>>;
  let replaceState: ReturnType<typeof vi.fn>;
  let toastError: ReturnType<typeof vi.fn>;
  let path: string;

  function setup(address: string): RouterService {
    path = address;
    persistence = {
      loadProjectAsMain: vi.fn().mockResolvedValue(undefined),
      loadComponentAsMain: vi.fn().mockResolvedValue(undefined),
      loadLocalProjectAsMain: vi.fn().mockResolvedValue(undefined),
      loadShareAsMain: vi.fn().mockResolvedValue({ loaded: true })
    };
    replaceState = vi.fn();
    toastError = vi.fn();

    configureTestBed([
      { provide: PersistenceService, useValue: persistence },
      { provide: ToastService, useValue: { error: toastError } },
      {
        provide: Location,
        useValue: { path: () => path, replaceState, go: vi.fn() }
      }
    ]);
    return TestBed.inject(RouterService);
  }

  // Every route, with the loader it ends in and the id that loader must get.
  const ROUTES: [string, string, unknown[]][] = [
    [`/project/${ID}`, 'loadProjectAsMain', [ID]],
    [`/component/${ID}`, 'loadComponentAsMain', [ID]],
    [`/local/${ID}`, 'loadLocalProjectAsMain', [ID]],
    [`/share/projects/${ID}`, 'loadShareAsMain', ['project', ID]],
    [`/share/components/${ID}`, 'loadShareAsMain', ['component', ID]],
    [`/share/${ID}`, 'loadShareAsMain', ['project', ID]]
  ];

  describe.each(QUERIES)('with %s on the address', (suffix) => {
    it.each(ROUTES)(
      'opens %s with the bare id',
      async (route, loader, args) => {
        const router = setup(route + suffix);

        expect(router.matches(route + suffix)).toBe(true);
        await router.processCurrentRoute();

        expect(persistence[loader].mock.calls[0].slice(0, args.length)).toEqual(
          args
        );
        expect(toastError).not.toHaveBeenCalled();
      }
    );

    it('opens the root without a not-found', async () => {
      const router = setup('/' + suffix);

      // No pattern matching is what gives the root its blank draft.
      expect(router.matches('/' + suffix)).toBe(false);
      await router.processCurrentRoute();

      expect(toastError).not.toHaveBeenCalled();
      expect(replaceState).not.toHaveBeenCalled();
    });
  });

  it('leaves the query in the address of a route that keeps its URL', async () => {
    const router = setup(`/project/${ID}?utm_source=x`);

    await router.processCurrentRoute();

    expect(replaceState).not.toHaveBeenCalled();
  });

  it('hands the parsed query to the route', async () => {
    const router = setup(`/project/${ID}?utm_source=x&ref=a%20b`);
    const onActivation = vi.spyOn(
      TestBed.inject(ProjectRoute) as Route,
      'onActivation'
    );

    await router.processCurrentRoute();

    const [params, query] = onActivation.mock.calls[0];
    expect(params).toEqual({ uuid: ID });
    expect(query.get('utm_source')).toBe('x');
    expect(query.get('ref')).toBe('a b');
  });

  it('still answers not-found for an unknown path carrying a query', async () => {
    const router = setup('/nonsense?utm_source=x');

    expect(router.matches('/nonsense?utm_source=x')).toBe(false);
    await router.processCurrentRoute();

    expect(toastError).toHaveBeenCalledTimes(1);
    expect(replaceState).toHaveBeenCalledWith('/');
  });
});
