import { existsSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { deriveOwnerKey } from "../crypto.js";
import { createMasterKey } from "../key-manager.js";
import { hideFile, showFile } from "../show-hide.js";

describe("show-hide", () => {
	let dir: string;
	let key: Buffer;

	beforeEach(async () => {
		dir = mkdtempSync(join(tmpdir(), "vars-test-"));
		key = await createMasterKey();
	});

	afterEach(() => rmSync(dir, { recursive: true }));

	it("hide encrypts secret values, keeps public unchanged", async () => {
		const content = `env(dev, prod)

public APP_NAME = "my-app"
SECRET : z.string() {
  dev = "dev-secret"
}`;
		const f = join(dir, "config.vars");
		writeFileSync(f, content);
		await hideFile(f, key);
		const result = readFileSync(f, "utf8");
		expect(result).toContain('APP_NAME = "my-app"');
		expect(result).toContain("enc:v2:aes256gcm-det:");
		expect(result).not.toContain("dev-secret");
	});

	it("show decrypts encrypted values", async () => {
		const content = `env(dev)

SECRET : z.string() {
  dev = "my-secret"
}`;
		const f = join(dir, "config.vars");
		writeFileSync(f, content);
		await hideFile(f, key);
		// hideFile on a .vars file (not .unlocked.vars) keeps it at .vars
		const unlocked = await showFile(f, key);
		const result = readFileSync(unlocked, "utf8");
		expect(result).toContain("my-secret");
	});

	it("hide is deterministic — same output on repeated hide", async () => {
		const content = `env(dev)

SECRET : z.string() {
  dev = "same-value"
}`;
		const f = join(dir, "config.vars");
		writeFileSync(f, content);
		await hideFile(f, key);
		const first = readFileSync(f, "utf8");
		const unlocked = await showFile(f, key);
		await hideFile(unlocked, key);
		const second = readFileSync(f, "utf8");
		expect(first).toBe(second);
	});

	it("encrypts grouped variables correctly", async () => {
		const content = `env(dev)

group stripe {
  SECRET_KEY : z.string() {
    dev = "sk_secret_value"
  }
  public PUB_KEY : z.string() {
    dev = "pk_public_value"
  }
}`;
		const f = join(dir, "grouped.vars");
		writeFileSync(f, content);
		await hideFile(f, key);
		const result = readFileSync(f, "utf8");
		expect(result).toContain("enc:v2:aes256gcm-det:"); // secret encrypted
		expect(result).toContain('"pk_public_value"'); // public unchanged
		expect(result).not.toContain("sk_secret_value"); // secret not in plaintext
	});

	it("show renames .vars to .unlocked.vars and decrypts", async () => {
		const content = `env(dev)

SECRET : z.string() {
  dev = "my-secret"
}`;
		const locked = join(dir, "config.vars");
		const unlocked = join(dir, "config.unlocked.vars");
		writeFileSync(locked, content);
		await hideFile(locked, key);
		await showFile(locked, key);

		expect(existsSync(locked)).toBe(false);
		expect(existsSync(unlocked)).toBe(true);
		const result = readFileSync(unlocked, "utf8");
		expect(result).toContain("my-secret");
	});

	it("show is idempotent — re-running on .unlocked.vars re-decrypts", async () => {
		const content = `env(dev)

SECRET : z.string() {
  dev = "my-secret"
}`;
		const locked = join(dir, "config.vars");
		const unlocked = join(dir, "config.unlocked.vars");
		writeFileSync(locked, content);
		await hideFile(locked, key);
		// Simulate crash: rename but don't decrypt
		renameSync(locked, unlocked);
		// Re-run show — should detect .unlocked.vars and re-decrypt
		await showFile(unlocked, key);
		const result = readFileSync(unlocked, "utf8");
		expect(result).toContain("my-secret");
	});

	it("hide renames .unlocked.vars back to .vars after encrypting", async () => {
		const content = `env(dev)

SECRET : z.string() {
  dev = "my-secret"
}`;
		const unlocked = join(dir, "config.unlocked.vars");
		const locked = join(dir, "config.vars");
		writeFileSync(unlocked, content);
		await hideFile(unlocked, key);

		expect(existsSync(unlocked)).toBe(false);
		expect(existsSync(locked)).toBe(true);
		const result = readFileSync(locked, "utf8");
		expect(result).toContain("enc:v2:aes256gcm-det:");
		expect(result).not.toContain("my-secret");
	});

	it("hide is idempotent — already-encrypted values are not double-encrypted", async () => {
		const content = `env(dev)

SECRET : z.string() {
  dev = "my-secret"
}`;
		const unlocked = join(dir, "config.unlocked.vars");
		writeFileSync(unlocked, content);
		await hideFile(unlocked, key);
		const locked = join(dir, "config.vars");
		const first = readFileSync(locked, "utf8");

		// Unlock again, then hide again
		await showFile(locked, key);
		await hideFile(join(dir, "config.unlocked.vars"), key);
		const second = readFileSync(locked, "utf8");
		expect(first).toBe(second);
	});

	it("handles flat (non-env-block) encrypted values in show", async () => {
		// First create a file with a flat encrypted value
		const content = `env(dev)

SECRET = "flat-secret"`;
		const f = join(dir, "flat.vars");
		writeFileSync(f, content);
		await hideFile(f, key);

		const encrypted = readFileSync(f, "utf8");
		expect(encrypted).toContain("enc:v2:"); // encrypted
		expect(encrypted).not.toContain("flat-secret");

		const unlockedFlat = await showFile(f, key);
		const decrypted = readFileSync(unlockedFlat, "utf8");
		expect(decrypted).toContain("flat-secret"); // restored
	});

	it("full cycle: hide → show → edit → hide produces correct output", async () => {
		const content = `env(dev, prod)

public APP_NAME = "my-app"
SECRET : z.string() {
  dev = "dev-secret"
  prod = "prod-secret"
}`;
		const locked = join(dir, "config.vars");
		writeFileSync(locked, content);

		// Hide: encrypts and stays at .vars (since input is .vars)
		await hideFile(locked, key);
		expect(existsSync(locked)).toBe(true);

		// Show: renames to .unlocked.vars and decrypts
		const unlocked = await showFile(locked, key);
		expect(unlocked).toBe(join(dir, "config.unlocked.vars"));
		expect(existsSync(locked)).toBe(false);
		expect(existsSync(unlocked)).toBe(true);
		expect(readFileSync(unlocked, "utf8")).toContain("dev-secret");

		// Simulate edit: change a value
		const edited = readFileSync(unlocked, "utf8").replace("dev-secret", "new-dev-secret");
		writeFileSync(unlocked, edited);

		// Hide: encrypts and renames back to .vars
		const finalLocked = await hideFile(unlocked, key);
		expect(finalLocked).toBe(locked);
		expect(existsSync(unlocked)).toBe(false);
		expect(existsSync(locked)).toBe(true);
		const final = readFileSync(locked, "utf8");
		expect(final).not.toContain("new-dev-secret");
		expect(final).toContain("enc:v2:aes256gcm-det:");

		// Verify the new value is recoverable
		const unlocked2 = await showFile(locked, key);
		expect(readFileSync(unlocked2, "utf8")).toContain("new-dev-secret");
	});

	it("hide overwrites stale .vars when .unlocked.vars is the source of truth", async () => {
		const content = `env(dev)

SECRET : z.string() {
  dev = "latest-secret"
}`;
		const unlocked = join(dir, "config.unlocked.vars");
		const locked = join(dir, "config.vars");
		// Simulate: both files exist (e.g., git restored .vars while .unlocked.vars on disk)
		writeFileSync(unlocked, content);
		writeFileSync(locked, "# stale content");
		await hideFile(unlocked, key);

		expect(existsSync(unlocked)).toBe(false);
		expect(existsSync(locked)).toBe(true);
		const result = readFileSync(locked, "utf8");
		expect(result).toContain("enc:v2:aes256gcm-det:");
		expect(result).not.toContain("stale content");
	});

	it("hide does not encrypt values inside check blocks", async () => {
		const content = `env(dev, prod)

SECRET : z.string() {
  dev = "dev-secret"
  prod = "prod-secret"
}

check "JWT secret is long enough in prod" {
  env == "prod" => length(SECRET) >= 64
}

check "Secret is defined" {
  defined(SECRET)
}`;
		const f = join(dir, "config.vars");
		writeFileSync(f, content);
		await hideFile(f, key);
		const result = readFileSync(f, "utf8");

		// Secret values should be encrypted
		expect(result).not.toContain("dev-secret");
		expect(result).not.toContain("prod-secret");
		expect(result).toContain("enc:v2:aes256gcm-det:");

		// Check block content must be preserved verbatim
		expect(result).toContain('env == "prod" => length(SECRET) >= 64');
		expect(result).toContain("defined(SECRET)");
		expect(result).toContain('check "JWT secret is long enough in prod"');
		expect(result).toContain('check "Secret is defined"');
	});

	it("hide preserves check blocks with various comparison operators", async () => {
		const content = `env(dev, prod)

SECRET = "my-secret"

check "comparisons" {
  env == "prod" => length(SECRET) >= 64
  env != "dev" => defined(SECRET)
  length(SECRET) <= 128
  length(SECRET) > 0
  length(SECRET) < 256
}`;
		const f = join(dir, "config.vars");
		writeFileSync(f, content);
		await hideFile(f, key);
		const result = readFileSync(f, "utf8");

		// All comparison operators inside check blocks must be preserved
		expect(result).toContain('env == "prod" => length(SECRET) >= 64');
		expect(result).toContain('env != "dev" => defined(SECRET)');
		expect(result).toContain("length(SECRET) <= 128");
		expect(result).toContain("length(SECRET) > 0");
		expect(result).toContain("length(SECRET) < 256");
	});

	it("hide→show round-trip preserves check blocks exactly", async () => {
		const content = `env(dev, prod)

SECRET : z.string() {
  dev = "dev-secret"
  prod = "prod-secret"
}

check "JWT secret is long enough in prod" {
  env == "prod" => length(SECRET) >= 64
}`;
		const f = join(dir, "config.vars");
		writeFileSync(f, content);
		await hideFile(f, key);
		const unlocked = await showFile(f, key);
		const result = readFileSync(unlocked, "utf8");

		expect(result).toContain('env == "prod" => length(SECRET) >= 64');
		expect(result).toContain("dev-secret");
		expect(result).toContain("prod-secret");
	});

	it("hide encrypts default values on schema-annotated lines", async () => {
		const content = `env(dev, prod)

JWT_SECRET : z.string().min(16) = "super-secret-default-key"
DATABASE_URL : z.string().url() = "postgres://user:pass@localhost/db"
public APP_NAME : z.string() = "my-app"
PORT : z.coerce.number() = 3000`;
		const f = join(dir, "config.unlocked.vars");
		writeFileSync(f, content);
		const locked = await hideFile(f, key);
		const result = readFileSync(locked, "utf8");

		// Private schema-default values must be encrypted
		expect(result).not.toContain("super-secret-default-key");
		expect(result).not.toContain("postgres://user:pass@localhost/db");
		expect(result).toContain("enc:v2:");
		// Public schema-default values stay plaintext
		expect(result).toContain('"my-app"');
		// Non-string defaults (numbers, booleans) stay as-is
		expect(result).toContain("= 3000");
	});

	it("hide encrypts schema defaults inside groups", async () => {
		const content = `env(dev, prod)

group db {
  HOST : z.string() = "localhost"
  PORT : z.coerce.number() = 5432
  PASSWORD : z.string() = "secret-pass"
  URL : z.string().url() = "postgres://admin:secret-pass@localhost:5432/mydb"
}`;
		const f = join(dir, "config.unlocked.vars");
		writeFileSync(f, content);
		const locked = await hideFile(f, key);
		const result = readFileSync(locked, "utf8");

		// Secret string defaults in groups must be encrypted
		expect(result).not.toContain('"localhost"');
		expect(result).not.toContain('"secret-pass"');
		expect(result).not.toContain("postgres://admin:secret-pass");
		// Number defaults stay as-is
		expect(result).toContain("= 5432");
	});

	it("show decrypts schema-default values back to plaintext", async () => {
		const content = `env(dev, prod)

JWT_SECRET : z.string().min(16) = "my-jwt-secret-value"
public APP_URL : z.string().url() = "https://example.com"`;
		const f = join(dir, "config.unlocked.vars");
		writeFileSync(f, content);

		// Hide then show round-trip
		const locked = await hideFile(f, key);
		const hiddenContent = readFileSync(locked, "utf8");
		expect(hiddenContent).not.toContain("my-jwt-secret-value");
		expect(hiddenContent).toContain("enc:v2:");

		const unlocked = await showFile(locked, key);
		const result = readFileSync(unlocked, "utf8");
		expect(result).toContain('"my-jwt-secret-value"');
		expect(result).toContain('"https://example.com"');
	});

	describe("owner-scoped show/hide", () => {
		let dir: string;
		let masterKey: Buffer;
		let backendKey: Buffer;

		beforeEach(async () => {
			dir = mkdtempSync(join(tmpdir(), "vars-test-"));
			masterKey = await createMasterKey();
			backendKey = await deriveOwnerKey(masterKey, "backend-team");
		});

		afterEach(() => rmSync(dir, { recursive: true }));

		it("hide with master scope encrypts owner fields with owner key", async () => {
			const content = `env(dev)\n\nAPI_KEY : z.string() {\n  dev = "master-secret"\n}\n\nBACKEND_SECRET : z.string() {\n  dev = "backend-secret"\n} (owner = "backend-team")`;
			const f = join(dir, "config.vars");
			writeFileSync(f, content);
			await hideFile(f, masterKey, "master");
			const result = readFileSync(f, "utf8");
			expect(result).not.toContain("master-secret");
			expect(result).not.toContain("backend-secret");
			expect(result).toContain("owner=backend-team:");
		});

		it("show with master scope decrypts all fields", async () => {
			const content = `env(dev)\n\nAPI_KEY : z.string() {\n  dev = "master-secret"\n}\n\nBACKEND_SECRET : z.string() {\n  dev = "backend-secret"\n} (owner = "backend-team")`;
			const f = join(dir, "config.vars");
			writeFileSync(f, content);
			await hideFile(f, masterKey, "master");
			const unlocked = await showFile(f, masterKey, "master");
			const result = readFileSync(unlocked, "utf8");
			expect(result).toContain("master-secret");
			expect(result).toContain("backend-secret");
		});

		it("show with owner scope leaves non-owner fields encrypted", async () => {
			const content = `env(dev)\n\nAPI_KEY : z.string() {\n  dev = "master-secret"\n}\n\nBACKEND_SECRET : z.string() {\n  dev = "backend-secret"\n} (owner = "backend-team")`;
			const f = join(dir, "config.vars");
			writeFileSync(f, content);
			await hideFile(f, masterKey, "master");
			const unlocked = await showFile(f, backendKey, { owner: "backend-team" });
			const result = readFileSync(unlocked, "utf8");
			expect(result).toContain("backend-secret");
			expect(result).not.toContain("master-secret");
			expect(result).toContain("enc:v2:aes256gcm-det:");
		});

		it("hide with owner scope only encrypts that owner's fields", async () => {
			const content = `env(dev)\n\nAPI_KEY : z.string() {\n  dev = "master-secret"\n}\n\nBACKEND_SECRET : z.string() {\n  dev = "backend-secret"\n} (owner = "backend-team")`;
			const f = join(dir, "config.vars");
			writeFileSync(f, content);
			await hideFile(f, masterKey, "master");
			const unlocked = await showFile(f, backendKey, { owner: "backend-team" });
			await hideFile(unlocked, backendKey, { owner: "backend-team" });
			const result = readFileSync(join(dir, "config.vars"), "utf8");
			expect(result).not.toContain("master-secret");
			expect(result).not.toContain("backend-secret");
			expect(result).toContain("owner=backend-team:");
		});

		it("owner scope cannot decrypt another owner's fields", async () => {
			const frontendKey = await deriveOwnerKey(masterKey, "frontend-team");
			const content = `env(dev)\n\nBACKEND_SECRET : z.string() {\n  dev = "backend-secret"\n} (owner = "backend-team")\n\nFRONTEND_SECRET : z.string() {\n  dev = "frontend-secret"\n} (owner = "frontend-team")`;
			const f = join(dir, "config.vars");
			writeFileSync(f, content);
			await hideFile(f, masterKey, "master");
			const unlocked = await showFile(f, backendKey, { owner: "backend-team" });
			const result = readFileSync(unlocked, "utf8");
			expect(result).toContain("backend-secret");
			expect(result).not.toContain("frontend-secret");
			expect(result).toContain("owner=frontend-team:");
		});
	});
});
