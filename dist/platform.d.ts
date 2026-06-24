export declare function resolveDefaultHostsPath(currentPlatform?: NodeJS.Platform, env?: NodeJS.ProcessEnv): string;
export interface ElevationOptions {
    scriptPath: string;
    args: string[];
    cwd: string;
    noElevate: boolean;
    elevated: boolean;
    dryRun: boolean;
    printRecords: boolean;
}
export declare function tryElevate(options: ElevationOptions): boolean;
export declare function elevatedCommandHint(command?: string): string;
