import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnvx } from "@vars/core";

export interface VarsOptions {
  envFile?: string;
  env?: string;
  key?: string;
}

export interface DynamicModule {
  module: typeof EnvxModule;
  global: boolean;
  providers: Array<{ provide: symbol; useValue: Record<string, unknown> }>;
  exports: symbol[];
}

/**
 * Injection token for the resolved vars object.
 * Use with `@Inject(VARS)` in NestJS services.
 *
 * @example
 * ```ts
 * @Injectable()
 * export class AppService {
 *   constructor(@Inject(VARS) private env: Env) {}
 * }
 * ```
 */
export const VARS: unique symbol = Symbol("VARS");

/**
 * NestJS module for vars integration.
 * Loads, decrypts, and validates .vars at module initialization,
 * then provides the resolved env object via DI.
 *
 * @example
 * ```ts
 * // app.module.ts
 * import { EnvxModule, VARS } from '@vars/nestjs'
 *
 * @Module({
 *   imports: [EnvxModule.forRoot({ env: 'production' })],
 * })
 * export class AppModule {}
 * ```
 */
export class EnvxModule {
  static forRoot(options: VarsOptions = {}): DynamicModule {
    const envFile = options.envFile ?? ".vars";
    const env = options.env ?? process.env.VARS_ENV ?? "development";
    const key = options.key ?? process.env.VARS_KEY ?? readKeyFile(envFile);

    const envFilePath = resolve(process.cwd(), envFile);

    const loadOptions: Record<string, unknown> = { env };
    if (key) loadOptions.key = key;

    const resolved = loadEnvx(envFilePath, loadOptions as { env?: string; key?: string });

    return {
      module: EnvxModule,
      global: true,
      providers: [
        {
          provide: VARS,
          useValue: resolved,
        },
      ],
      exports: [VARS],
    };
  }
}

function readKeyFile(envFile: string): string | undefined {
  const keyPath = resolve(process.cwd(), `${envFile}.key`);
  if (existsSync(keyPath)) {
    return readFileSync(keyPath, "utf8").trim();
  }
  return undefined;
}
