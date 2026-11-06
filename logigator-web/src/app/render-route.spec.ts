import { beforeEach, describe, expect, it } from 'vitest';
import { Component, inject, REQUEST_CONTEXT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import type { RenderContext } from '../render-context';
import { provideRenderRoute } from './render-route';

@Component({ template: '' })
class Page {}

describe('the render route', () => {
  let context: RenderContext;
  let router: Router;

  beforeEach(() => {
    context = { cspNonce: 'nonce', requestId: 'request' };
    TestBed.configureTestingModule({
      providers: [
        // Shaped like the app's: a componentless `:lang`, an empty-path page,
        // a multi-segment template, a nested child and a wildcard.
        provideRouter([
          {
            path: ':lang',
            children: [
              { path: '', component: Page },
              {
                path: 'login',
                component: Page,
                canActivate: [() => inject(Router).parseUrl('/en')]
              },
              {
                path: 'community/projects/:link',
                children: [
                  { path: '', component: Page },
                  { path: 'stargazers', component: Page }
                ]
              },
              { path: '**', component: Page }
            ]
          }
        ]),
        { provide: REQUEST_CONTEXT, useValue: context },
        provideRenderRoute()
      ]
    });
    router = TestBed.inject(Router);
  });

  it('is the joined template of every matched level', async () => {
    await router.navigateByUrl('/en/community/projects/x7Kq2/stargazers');

    expect(context.route).toBe('/:lang/community/projects/:link/stargazers');
  });

  it('leaves out an empty path', async () => {
    await router.navigateByUrl('/de/community/projects/x7Kq2');

    expect(context.route).toBe('/:lang/community/projects/:link');
  });

  it('names a wildcard match by its wildcard', async () => {
    await router.navigateByUrl('/en/no/such/page');

    expect(context.route).toBe('/:lang/**');
  });

  it('stays the requested page when a guard redirects', async () => {
    await router.navigateByUrl('/en/login');

    expect(router.url).toBe('/en');
    expect(context.route).toBe('/:lang/login');
  });
});
