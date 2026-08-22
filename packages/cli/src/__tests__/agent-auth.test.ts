import { execFileSync } from "node:child_process";
import { afterEach, describe, expect, it, vi } from "vitest";
import { requestAgentApproval } from "../utils/agent-auth.js";

vi.mock("node:os", () => ({ platform: () => "linux" }));
vi.mock("node:child_process", () => ({
	execFileSync: vi.fn(() => {
		throw new Error("dialog must not be spawned on a headless box");
	}),
}));

describe("requestAgentApproval on headless Linux", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("returns null without spawning a dialog when no display server exists", () => {
		vi.stubEnv("DISPLAY", "");
		vi.stubEnv("WAYLAND_DISPLAY", "");
		expect(requestAgentApproval("vars run --env dev -- node server.js")).toBeNull();
		expect(execFileSync).not.toHaveBeenCalled();
	});
});
