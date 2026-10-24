import {
  computed,
  inject,
  Injectable,
  makeStateKey,
  signal
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { MetaApiService } from '../api/services/meta-api.service';
import { TransferHandoffService } from '../transfer/transfer-handoff.service';

/** Where the server render leaves the deployment's sign-in methods. */
const PROVIDERS_STATE = makeStateKey<string[]>('meta.authProviders');

/**
 * Which sign-in methods this deployment offers, so the auth pages show a Google
 * button only where the round trip actually works. The API reports it from
 * `GET /meta` for exactly this reason: a client that guessed would find out
 * from a route answering 501, after the visitor had already clicked.
 *
 * Resolved once and kept — the answer is a property of the deployment, not of
 * the request — and read through the hand-off so the server render's copy
 * arrives with the page rather than costing the browser a second request.
 */
@Injectable({ providedIn: 'root' })
export class AuthProvidersService {
  private readonly metaApi = inject(MetaApiService);
  private readonly handoff = inject(TransferHandoffService);

  private readonly providers = signal<string[] | null>(null);

  public readonly googleAvailable = computed(() =>
    (this.providers() ?? []).includes('google')
  );

  public async resolve(): Promise<void> {
    if (this.providers()) return;

    this.providers.set(
      await this.handoff.resolve(PROVIDERS_STATE, () => this.fetch())
    );
  }

  /**
   * Never throws: an unreachable API costs the Google button, not the sign-in
   * page — and resolving to a value rather than rejecting is what lets the
   * answer cross to the browser instead of being asked for again.
   */
  private async fetch(): Promise<string[]> {
    try {
      const meta = await firstValueFrom(this.metaApi.get());
      return meta.authProviders;
    } catch {
      return ['local'];
    }
  }
}
