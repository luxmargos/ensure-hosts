import type { ExpandedProfile, HostRecord } from './types.js';
export interface RewriteResult {
    content: string;
    appended: HostRecord[];
    removedDomains: string[];
}
export interface RemoveResult {
    content: string;
    removedDomains: string[];
}
export interface RewriteOptions {
    repeatProfileComments?: boolean;
}
export declare function rewriteHostsContent(content: string, profiles: ExpandedProfile[], options?: RewriteOptions): RewriteResult;
/**
 * Remove the domains managed by the given profiles from the hosts content,
 * without appending anything. This is the inverse of the default ensure
 * action: run the cleanup phase only.
 *
 * `force: false` (the `--remove` flag) strips only `cleanupDomains` — the
 * domains declared `rewrite: true`. Domains declared `rewrite: false` are
 * left untouched, matching their "do not alter existing entries" contract.
 *
 * `force: true` (the `--remove-force` flag) additionally strips every domain
 * the profiles would write (`record.domain`), including `rewrite: false`
 * entries.
 */
export declare function removeHostsContent(content: string, profiles: ExpandedProfile[], options: {
    force: boolean;
}): RemoveResult;
export declare function selectRecordsToAppend(lines: string[], profiles: ExpandedProfile[]): HostRecord[];
export declare function collectDomainsFromContent(content: string): Set<string>;
export declare function collectDomainsFromLines(lines: string[]): Set<string>;
