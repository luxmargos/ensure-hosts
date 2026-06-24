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

export interface CliOptions {
  configPaths: string[];
  envFile: string;
  hostsFile?: string;
  dryRun: boolean;
  printRecords: boolean;
  noElevate: boolean;
  elevated: boolean;
  outputFile?: string;
}
