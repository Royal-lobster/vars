// @dotvars/node — Node.js filesystem and key management layer
export { readVarsFile } from "./file-reader.js";
export { resolveUseChain } from "./use-resolver.js";
export type { UseResolveOptions } from "./use-resolver.js";
export { encryptDeterministic, decrypt, deriveOwnerKey } from "./crypto.js";
export {
	createMasterKey,
	encryptMasterKey,
	decryptMasterKey,
	getKeyFromEnv,
	parseKeyFile,
} from "./key-manager.js";
export type { KeyEntry } from "./key-manager.js";
export { showFile, hideFile } from "./show-hide.js";
export { storeKey, retrieveKey, clearKey } from "./keychain.js";
export {
	toUnlockedPath,
	toLockedPath,
	isUnlockedPath,
	toCanonicalPath,
	toLocalPath,
	isLocalPath,
} from "./unlocked-path.js";
