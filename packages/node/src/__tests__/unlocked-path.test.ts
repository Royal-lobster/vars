import { describe, expect, it } from "vitest";
import {
	isLocalPath,
	isUnlockedPath,
	toCanonicalPath,
	toLocalPath,
	toLockedPath,
	toUnlockedPath,
} from "../unlocked-path.js";

describe("unlocked-path", () => {
	it("toUnlockedPath converts .vars to .unlocked.vars", () => {
		expect(toUnlockedPath("/project/config.vars")).toBe("/project/config.unlocked.vars");
		expect(toUnlockedPath("vars.vars")).toBe("vars.unlocked.vars");
	});

	it("toLockedPath converts .unlocked.vars to .vars", () => {
		expect(toLockedPath("/project/config.unlocked.vars")).toBe("/project/config.vars");
	});

	it("isUnlockedPath detects unlocked paths", () => {
		expect(isUnlockedPath("config.unlocked.vars")).toBe(true);
		expect(isUnlockedPath("config.vars")).toBe(false);
	});

	it("toCanonicalPath normalizes both variants", () => {
		expect(toCanonicalPath("config.unlocked.vars")).toBe("config.vars");
		expect(toCanonicalPath("config.vars")).toBe("config.vars");
	});
});

describe("toLocalPath", () => {
	it("converts locked .vars path to .local.vars", () => {
		expect(toLocalPath("config.vars")).toBe("config.local.vars");
	});

	it("converts unlocked .vars path to .local.vars", () => {
		expect(toLocalPath("config.unlocked.vars")).toBe("config.local.vars");
	});

	it("handles nested paths", () => {
		expect(toLocalPath("services/api/vars.vars")).toBe("services/api/vars.local.vars");
	});

	it("handles unlocked nested paths", () => {
		expect(toLocalPath("services/api/vars.unlocked.vars")).toBe("services/api/vars.local.vars");
	});
});

describe("isLocalPath", () => {
	it("returns true for .local.vars files", () => {
		expect(isLocalPath("config.local.vars")).toBe(true);
	});

	it("returns false for regular .vars files", () => {
		expect(isLocalPath("config.vars")).toBe(false);
	});

	it("returns false for unlocked .vars files", () => {
		expect(isLocalPath("config.unlocked.vars")).toBe(false);
	});
});
