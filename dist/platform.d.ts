export declare function resolveDefaultHostsPath(currentPlatform?: NodeJS.Platform, env?: NodeJS.ProcessEnv): string;
export type ElevationResult = false | 'written' | 'spawned';
export interface ElevationOptions {
    scriptPath: string;
    args: string[];
    cwd: string;
    noElevate: boolean;
    elevated: boolean;
    dryRun: boolean;
    printRecords: boolean;
    filePath: string;
    content: string;
}
export declare function tryElevate(options: ElevationOptions): ElevationResult;
/**
 * Returns true when an elevation attempt succeeded and the caller should
 * exit cleanly (no Permission denied error). Any truthy ElevationResult
 * (`'written'` from sudo tee / already-root, or `'spawned'` from the
 * osascript/Windows GUI re-spawn) counts as success. `false` means no
 * elevation happened and the caller should throw the sudo hint.
 */
export declare function elevationHandled(elevated: ElevationResult): boolean;
/**
 * Prints a notification when the process is running as root (uid 0),
 * so the user knows the hosts file will be written directly without
 * any elevation prompt. Called before the direct writeFileSync in cli.ts.
 */
export declare function notifyRootWrite(filePath: string): void;
export declare function elevatedCommandHint(command?: string): string;
export declare function withoutElevationArgs(args: string[]): string[];
