import {
  computed,
  inject,
  Injectable,
  makeStateKey,
  signal
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { MetaResponse } from '@logigator/contract';
import { MetaApiService } from './services/meta-api.service';
import { TransferHandoffService } from '../transfer/transfer-handoff.service';

/** Where the server render leaves what the deployment says about itself. */
const META_STATE = makeStateKey<MetaResponse | null>('meta');

/**
 * What this deployment offers, as the API reports it from `GET /meta`: the
 * sign-in methods, the Turnstile site key and the PostHog key. The site
 * carries none of them itself, so one build serves any deployment, and a
 * client that guessed would find out from a refused request, after the
 * visitor had already acted.
 *
 * Resolved once and kept — the answer is a property of the deployment, not of
 * the request — and read through the hand-off so the server render's copy
 * arrives with the page rather than costing the browser a second request. An
 * unreachable API reads as a deployment offering nothing beyond a password
 * sign-in, and is asked again on the next {@link resolve}.
 */
@Injectable({ providedIn: 'root' })
export class DeploymentService {
  private readonly metaApi = inject(MetaApiService);
  private readonly handoff = inject(TransferHandoffService);

  /** `undefined` until resolved, `null` when the API could not be reached. */
  private readonly meta = signal<MetaResponse | null | undefined>(undefined);
  private pending: Promise<MetaResponse | null> | null = null;

  /** Whether {@link resolve} has settled, successfully or not. */
  public readonly resolved = computed(() => this.meta() !== undefined);

  public readonly googleAvailable = computed(
    () => this.meta()?.authProviders.includes('google') ?? false
  );

  public readonly turnstileSiteKey = computed(
    () => this.meta()?.turnstileSiteKey ?? null
  );

  public readonly posthogKey = computed(() => this.meta()?.posthogKey ?? null);

  public async resolve(): Promise<void> {
    if (this.meta()) return;

    this.pending ??= this.handoff
      .resolve(META_STATE, () => this.fetch())
      .finally(() => (this.pending = null));
    this.meta.set(await this.pending);
  }

  /**
   * Never throws: an unreachable API costs the Google button, the challenge
   * and analytics, not the page — and resolving to a value rather than
   * rejecting is what lets the answer cross to the browser instead of being
   * asked for again.
   */
  private async fetch(): Promise<MetaResponse | null> {
    try {
      return await firstValueFrom(this.metaApi.get());
    } catch {
      return null;
    }
  }
}
