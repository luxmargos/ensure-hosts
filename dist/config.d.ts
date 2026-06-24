import type { CliOptions, ProfileConfig } from './types.js';
export declare function parseCliOptions(argv: string[]): CliOptions;
export declare function loadDefaultEnv(envFile: string): void;
export declare function resolveConfigPaths(options: CliOptions, env?: NodeJS.ProcessEnv): string[];
export declare function resolveHostsFileOverride(options: CliOptions, env?: NodeJS.ProcessEnv): string | undefined;
export declare function resolveNoElevate(options: CliOptions, env?: NodeJS.ProcessEnv): boolean;
export declare function loadProfiles(configPaths: string[]): ProfileConfig[];
export declare function loadProfile(configPath: string): ProfileConfig;
export declare function usage(): string;
