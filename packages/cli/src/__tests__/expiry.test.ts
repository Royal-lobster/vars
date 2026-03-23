import { describe, it, expect } from "vitest";
import { checkExpiry, formatExpiryMessage } from "../utils/expiry.js";

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

describe("checkExpiry", () => {
  it("returns expired=true for a date in the past", () => {
    const status = checkExpiry(daysFromNow(-5));
    expect(status.expired).toBe(true);
    expect(status.expiringSoon).toBe(false);
    expect(status.daysUntil).toBeLessThan(0);
  });

  it("returns expiringSoon=true for a date within 30 days", () => {
    const status = checkExpiry(daysFromNow(15));
    expect(status.expired).toBe(false);
    expect(status.expiringSoon).toBe(true);
    expect(status.daysUntil).toBeGreaterThan(0);
    expect(status.daysUntil).toBeLessThanOrEqual(30);
  });

  it("returns expiringSoon=true for exactly 30 days from now", () => {
    const status = checkExpiry(daysFromNow(30));
    expect(status.expired).toBe(false);
    expect(status.expiringSoon).toBe(true);
  });

  it("returns expiringSoon=false for a date beyond 30 days", () => {
    const status = checkExpiry(daysFromNow(60));
    expect(status.expired).toBe(false);
    expect(status.expiringSoon).toBe(false);
    expect(status.daysUntil).toBeGreaterThan(30);
  });
});

describe("formatExpiryMessage", () => {
  it("formats an expired message", () => {
    const dateStr = daysFromNow(-5);
    const status = checkExpiry(dateStr);
    const msg = formatExpiryMessage("API_KEY", status, dateStr);
    expect(msg).toMatch(/expired \d+ day\(s\) ago/);
    expect(msg).toContain("API_KEY");
    expect(msg).toContain(dateStr);
  });

  it("formats an expiring-soon message", () => {
    const dateStr = daysFromNow(12);
    const status = checkExpiry(dateStr);
    const msg = formatExpiryMessage("DB_PASSWORD", status, dateStr);
    expect(msg).toMatch(/expires in \d+ day\(s\)/);
    expect(msg).toContain("DB_PASSWORD");
    expect(msg).toContain(dateStr);
  });
});
