/** Parsed representation of a .vars file */
export interface VarsFile {
  variables: Variable[];
  refines: Refine[];
  extendsPath: string | null;
}

/** A single variable declaration with schema, values, and metadata */
export interface Variable {
  name: string;
  schema: string;
  values: EnvironmentValue[];
  metadata: Metadata;
  line: number;
}

/** An environment-specific value assignment */
export interface EnvironmentValue {
  env: string;
  value: string;
  line: number;
}

/** Variable metadata directives */
export interface Metadata {
  description?: string;
  expires?: string;
  deprecated?: string;
  owner?: string;
}

/** A cross-variable @refine constraint */
export interface Refine {
  expression: string;
  message: string;
  line: number;
}

/** Parsed encrypted value components */
export interface EncryptedValue {
  version: string;
  algorithm: string;
  iv: string;
  ciphertext: string;
  tag: string;
}

/** Options for loadEnvx() */
export interface LoadOptions {
  env?: string;
  key?: string | Buffer;
  envFile?: string;
}

/** Options for encrypt/decrypt operations */
export interface CryptoOptions {
  algorithm?: string;
  version?: string;
}
