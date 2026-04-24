import { randomBytes } from 'crypto';

export function generateToken(): string {
	return randomBytes(32).toString('base64url');
}
