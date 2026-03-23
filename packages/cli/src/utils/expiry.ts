export interface ExpiryStatus {
  daysUntil: number;
  expired: boolean;
  expiringSoon: boolean; // within 30 days
}

/** Parse an expires string and return days until expiry (negative = already expired). */
export function checkExpiry(expiresStr: string): ExpiryStatus {
  const now = new Date();
  const expiryDate = new Date(expiresStr);
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysUntil = Math.ceil((expiryDate.getTime() - now.getTime()) / msPerDay);
  return {
    daysUntil,
    expired: daysUntil < 0,
    expiringSoon: daysUntil >= 0 && daysUntil <= 30,
  };
}

/** Format an expiry warning message. */
export function formatExpiryMessage(varName: string, status: ExpiryStatus, expiresStr: string): string {
  if (status.expired) {
    return `${varName}: expired ${-status.daysUntil} day(s) ago (${expiresStr})`;
  }
  return `${varName}: expires in ${status.daysUntil} day(s) (${expiresStr})`;
}
