export const DEFAULT_EXPIRY_WARNING_DAYS = 30;

export interface ExpiryStatus {
	daysUntil: number;
	expired: boolean;
	expiringSoon: boolean;
	invalid: boolean;
}

/** Parse an expires string and return days until expiry (negative = already expired). */
export function checkExpiry(expiresStr: string): ExpiryStatus {
	const expiryDate = new Date(expiresStr);
	if (Number.isNaN(expiryDate.getTime())) {
		return { daysUntil: Number.NaN, expired: false, expiringSoon: false, invalid: true };
	}
	const now = new Date();
	const msPerDay = 1000 * 60 * 60 * 24;
	const daysUntil = Math.floor((expiryDate.getTime() - now.getTime()) / msPerDay);
	return {
		daysUntil,
		expired: daysUntil <= 0,
		expiringSoon: daysUntil > 0 && daysUntil <= DEFAULT_EXPIRY_WARNING_DAYS,
		invalid: false,
	};
}

/** Format an expiry warning message. */
export function formatExpiryMessage(
	varName: string,
	status: ExpiryStatus,
	expiresStr: string,
): string {
	if (status.invalid) {
		return `${varName}: invalid expiry date "${expiresStr}"`;
	}
	if (status.expired) {
		return `${varName}: expired ${-status.daysUntil} day(s) ago (${expiresStr})`;
	}
	return `${varName}: expires in ${status.daysUntil} day(s) (${expiresStr})`;
}
