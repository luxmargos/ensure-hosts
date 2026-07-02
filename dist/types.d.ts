export interface HostNodeConfig {
    domain: string;
    address?: string;
    rewrite?: boolean;
    skipSelf?: boolean;
    children?: Array<string | HostNodeConfig>;
}
export interface ProfileConfig {
    profile: string;
    hosts: HostNodeConfig[];
}
export interface HostRecord {
    profile: string;
    domain: string;
    address: string;
    rewrite: boolean;
}
export interface ExpandedProfile {
    profile: string;
    records: HostRecord[];
    cleanupDomains: string[];
}
export type EnvOverrideMode = 'overwrite' | 'respect';
export type EnvFileMissingMode = 'ignore' | 'error';
export interface CliOptions {
    configPaths: string[];
    envFiles: string[];
    envFilesExplicit: boolean;
    envOverride?: EnvOverrideMode;
    envOverrideExplicit: boolean;
    envFileMissing?: EnvFileMissingMode;
    envFileMissingExplicit: boolean;
    hostsFile?: string;
    dryRun: boolean;
    printRecords: boolean;
    repeatProfileComments: boolean;
    remove: boolean;
    removeForce: boolean;
    noElevate: boolean;
    elevated: boolean;
    outputFile?: string;
}
