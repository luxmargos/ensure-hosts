import type { ExpandedProfile, ProfileConfig } from './types.js';
export declare function expandProfiles(profiles: ProfileConfig[]): ExpandedProfile[];
export declare function expandProfile(profile: ProfileConfig): ExpandedProfile;
export declare function composeDomain(domain: string, parentDomain?: string): string;
