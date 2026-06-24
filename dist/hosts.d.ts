import type { ExpandedProfile, HostRecord } from './types.js';
export interface RewriteResult {
    content: string;
    appended: HostRecord[];
    removedDomains: string[];
}
export declare function rewriteHostsContent(content: string, profiles: ExpandedProfile[]): RewriteResult;
export declare function selectRecordsToAppend(lines: string[], profiles: ExpandedProfile[]): HostRecord[];
export declare function collectDomainsFromContent(content: string): Set<string>;
export declare function collectDomainsFromLines(lines: string[]): Set<string>;
