import { beforeEach, describe, expect, it, vi } from 'vitest';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CloudSessionService } from './cloud-session.service';
import { UserService } from './user.service';
import { ProjectMetadataStore } from '../persistence/project-metadata.store';
import { Project } from '../project/project';
import type { UserData } from '../api/models/user';
import { configureTestBed } from '../../testing/configure-test-bed';

function makeUser(id: string): UserData {
  return { id, memberSince: '2024-01-01', username: id, image: null };
}

describe('CloudSessionService', () => {
  let service: CloudSessionService;
  let metadataStore: ProjectMetadataStore;
  let user: ReturnType<typeof signal<UserData | null>>;

  function registerServerDoc(): Project {
    const project = new Project();
    metadataStore.register(project, {
      id: 'doc-1',
      name: 'Doc',
      type: 'project',
      source: 'server',
      hash: '',
      isPublic: false
    });
    return project;
  }

  beforeEach(() => {
    user = signal<UserData | null>(null);
    configureTestBed([
      { provide: UserService, useValue: { user, sessionExpired: vi.fn() } }
    ]);
    service = TestBed.inject(CloudSessionService);
    metadataStore = TestBed.inject(ProjectMetadataStore);
  });

  it('reports signed-in from the user signal', () => {
    expect(service.isSignedIn()).toBe(false);
    user.set(makeUser('user-1'));
    expect(service.isSignedIn()).toBe(true);
  });

  it('verdicts logged-out for any document while signed out', () => {
    const project = registerServerDoc();
    expect(service.verdict(project)).toBe('logged-out');
  });

  it('stamps a server document with the signed-in user and verdicts ok', () => {
    user.set(makeUser('user-1'));
    const project = registerServerDoc();
    TestBed.tick();
    expect(service.verdict(project)).toBe('ok');
  });

  it('stamps a document registered before the user data resolved', () => {
    const project = registerServerDoc();
    TestBed.tick(); // signed out — nothing to stamp yet
    user.set(makeUser('user-1'));
    TestBed.tick();

    // The stamp belongs to user-1: a different user now reads it as foreign.
    user.set(makeUser('user-2'));
    expect(service.verdict(project)).toBe('foreign');
  });

  it('keeps the original owner across a logout, so their re-login matches again', () => {
    user.set(makeUser('user-1'));
    const project = registerServerDoc();
    TestBed.tick();

    user.set(null);
    TestBed.tick();
    expect(service.verdict(project)).toBe('logged-out');

    user.set(makeUser('user-2'));
    TestBed.tick();
    expect(service.verdict(project)).toBe('foreign');

    user.set(makeUser('user-1'));
    TestBed.tick();
    expect(service.verdict(project)).toBe('ok');
  });

  it('does not re-stamp a foreign document for the newly signed-in user', () => {
    user.set(makeUser('user-1'));
    const project = registerServerDoc();
    TestBed.tick();

    user.set(makeUser('user-2'));
    TestBed.tick(); // effect runs for user-2 but the stamp must not change
    expect(service.verdict(project)).toBe('foreign');
  });

  it('treats an unstamped document with a signed-in user as the current user’s', () => {
    user.set(makeUser('user-1'));
    const project = registerServerDoc();
    // No tick — the stamping effect has not run yet.
    expect(service.verdict(project)).toBe('ok');
  });
});
