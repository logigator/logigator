import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiBaseService } from './api-base.service';
import type { UserData, UpdateUserRequest } from '../models/user';

@Injectable({ providedIn: 'root' })
export class UserApiService {
	private readonly path = '/api/user';
	private readonly api = inject(ApiBaseService);

	/** GET /api/user — current user with private data. */
	get(): Observable<UserData> {
		return this.api.get<UserData>(this.path);
	}

	/** PATCH /api/user — update username, email, password, or shortcuts. */
	update(body: UpdateUserRequest): Observable<UserData> {
		return this.api.patch<UserData>(this.path, body);
	}
}
