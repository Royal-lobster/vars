import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveAllEnvs } from "../resolve-multi-env.js";

describe("resolveAllEnvs", () => {
	it("returns one ResolvedVars per declared env", () => {
		const dir = mkdtempSync(join(tmpdir(), "vars-multi-"));
		const file = join(dir, "config.vars");
		writeFileSync(
			file,
			`env(dev, prod)\n\npublic APP_NAME = "x"\nSECRET : z.string() {\n  dev = "dev-val"\n  prod = "prod-val"\n}\n`,
		);

		const byEnv = resolveAllEnvs(file);

		expect(Object.keys(byEnv).sort()).toEqual(["dev", "prod"]);
		expect(byEnv.dev.vars.find((v) => v.name === "SECRET")?.value).toBe("dev-val");
		expect(byEnv.prod.vars.find((v) => v.name === "SECRET")?.value).toBe("prod-val");
	});
});
