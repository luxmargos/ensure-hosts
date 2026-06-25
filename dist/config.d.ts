import type { CliOptions, ProfileConfig } from './types.js';
export declare function parseCliOptions(argv: string[]): CliOptions;
export declare function loadDefaultEnv(envFile: string): void;
export declare function resolveConfigPaths(options: CliOptions, env?: NodeJS.ProcessEnv): string[];
export declare function resolveHostsFileOverride(options: CliOptions, env?: NodeJS.ProcessEnv): string | undefined;
export declare function resolveNoElevate(options: CliOptions, env?: NodeJS.ProcessEnv): boolean;
/**
 * Rebuild the CLI args for an elevated child process from already-resolved
 * (absolute) paths. The elevated re-spawn runs in a different working
 * directory than the parent (osascript's `do shell script` starts in `/`),
 * so any relative path the user passed would fail to resolve in the child.
 * Passing absolute paths fixes that without changing the public CLI surface.
 *
 * Elevation-only flags (`--no-elevate`, `--elevated`) and `--output-file`
 * (Windows elevated-output plumbing) are intentionally omitted: the child is
 * re-elevated/redirected by the elevation layer itself, not by these flags.
 */
export declare function buildElevationArgs(options: CliOptions, configPaths: string[]): string[];
export declare function loadProfiles(configPaths: string[]): ProfileConfig[];
export declare function loadProfile(configPath: string): ProfileConfig;
export declare function usage(): string;
