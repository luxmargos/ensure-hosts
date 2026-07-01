export function rewriteHostsContent(content, profiles, options = {}) {
    const eol = detectEol(content);
    const hadFinalEol = content.endsWith('\n') || content.endsWith('\r\n');
    const sourceLines = splitLines(content);
    const cleanupDomains = new Set(profiles.flatMap(profile => profile.cleanupDomains));
    const profileNames = new Set(profiles.map(profile => profile.profile));
    const domainProfiles = buildDomainProfileMap(profiles);
    const { lines: cleanedLines, removedDomains } = cleanupHostsLines(sourceLines, cleanupDomains, profileNames);
    const compactedLines = compactBlankRuns(cleanedLines);
    const appended = selectRecordsToAppend(compactedLines, profiles);
    const nextLines = [...trimTrailingBlankLines(compactedLines)];
    if (appended.length > 0) {
        if (nextLines.length > 0) {
            nextLines.push('');
        }
        for (const record of appended) {
            nextLines.push(`${record.address} ${record.domain}`);
        }
    }
    const formattedLines = formatManagedProfileComments(nextLines, domainProfiles, profileNames, {
        repeatProfileComments: options.repeatProfileComments === true,
    });
    const contentBody = formattedLines.join(eol);
    const nextContent = contentBody.length > 0 ? `${contentBody}${eol}` : hadFinalEol ? eol : '';
    return {
        content: nextContent,
        appended,
        removedDomains: [...removedDomains],
    };
}
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
export function removeHostsContent(content, profiles, options) {
    const eol = detectEol(content);
    const hadFinalEol = content.endsWith('\n') || content.endsWith('\r\n');
    const sourceLines = splitLines(content);
    const removeDomains = new Set(profiles.flatMap(profile => profile.cleanupDomains));
    if (options.force) {
        for (const profile of profiles) {
            for (const record of profile.records) {
                removeDomains.add(record.domain);
            }
        }
    }
    const profileNames = new Set(profiles.map(profile => profile.profile));
    const { lines: cleanedLines, removedDomains } = cleanupHostsLines(sourceLines, removeDomains, profileNames);
    const compactedLines = compactBlankRuns(cleanedLines);
    const nextLines = [...trimTrailingBlankLines(compactedLines)];
    const contentBody = nextLines.join(eol);
    const nextContent = contentBody.length > 0 ? `${contentBody}${eol}` : hadFinalEol ? eol : '';
    return {
        content: nextContent,
        removedDomains: [...removedDomains],
    };
}
/**
 * Run the shared line-cleanup pass used by both ensure (rewrite) and remove.
 * Strips tokens in `cleanupDomains` from each line via `cleanHostsLine`,
 * drops orphaned `# <profile>` managed comments that precede a removed line,
 * and returns the surviving lines plus the set of domains actually removed.
 * Does not compact blank runs or append anything — callers do that.
 */
function cleanupHostsLines(sourceLines, cleanupDomains, profileNames) {
    const cleanedLines = [];
    const removedDomains = new Set();
    let pendingManagedComments = [];
    for (const line of sourceLines) {
        if (isManagedProfileComment(line, profileNames)) {
            pendingManagedComments.push(line);
            continue;
        }
        const cleaned = cleanHostsLine(line, cleanupDomains);
        for (const domain of cleaned.removedDomains) {
            removedDomains.add(domain);
        }
        if (cleaned.changed) {
            pendingManagedComments = [];
        }
        else if (pendingManagedComments.length > 0) {
            cleanedLines.push(...pendingManagedComments);
            pendingManagedComments = [];
        }
        if (cleaned.line !== null) {
            cleanedLines.push(cleaned.line);
        }
    }
    if (pendingManagedComments.length > 0) {
        cleanedLines.push(...pendingManagedComments);
    }
    return { lines: cleanedLines, removedDomains };
}
export function selectRecordsToAppend(lines, profiles) {
    const existingDomains = collectDomainsFromLines(lines);
    const records = profiles.flatMap(profile => profile.records);
    const appended = [];
    for (const record of records) {
        if (!record.rewrite && existingDomains.has(record.domain)) {
            continue;
        }
        appended.push(record);
        existingDomains.add(record.domain);
    }
    return appended;
}
export function collectDomainsFromContent(content) {
    return collectDomainsFromLines(splitLines(content));
}
export function collectDomainsFromLines(lines) {
    const domains = new Set();
    for (const line of lines) {
        const body = stripInlineComment(line).trim();
        if (!body) {
            continue;
        }
        const [, ...hosts] = body.split(/\s+/);
        for (const host of hosts) {
            domains.add(host.toLowerCase());
        }
    }
    return domains;
}
function buildDomainProfileMap(profiles) {
    const domainProfiles = new Map();
    for (const profile of profiles) {
        for (const record of profile.records) {
            const domain = record.domain.toLowerCase();
            if (!domainProfiles.has(domain)) {
                domainProfiles.set(domain, record.profile);
            }
        }
    }
    return domainProfiles;
}
function formatManagedProfileComments(lines, domainProfiles, profileNames, options) {
    const output = [];
    let activeProfile = null;
    for (const line of lines) {
        const commentProfile = managedProfileComment(line, profileNames);
        if (commentProfile) {
            if (commentProfile !== activeProfile) {
                activeProfile = null;
            }
            continue;
        }
        const profile = profileForHostsLine(line, domainProfiles);
        if (!profile) {
            output.push(line);
            activeProfile = null;
            continue;
        }
        if (options.repeatProfileComments || activeProfile !== profile) {
            output.push(`# ${profile}`);
        }
        output.push(line);
        activeProfile = profile;
    }
    return output;
}
function profileForHostsLine(line, domainProfiles) {
    const body = stripInlineComment(line).trim();
    if (!body) {
        return null;
    }
    const [, ...hosts] = body.split(/\s+/);
    const profiles = new Set();
    for (const host of hosts) {
        const profile = domainProfiles.get(host.toLowerCase());
        if (profile) {
            profiles.add(profile);
        }
    }
    return profiles.size === 1 ? [...profiles][0] ?? null : null;
}
function cleanHostsLine(line, cleanupDomains) {
    if (cleanupDomains.size === 0) {
        return { line, changed: false, removedDomains: [] };
    }
    const { body, comment } = splitInlineComment(line);
    const leading = body.match(/^\s*/)?.[0] ?? '';
    const tokens = body.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) {
        return { line, changed: false, removedDomains: [] };
    }
    const [address, ...hosts] = tokens;
    if (hosts.length === 0) {
        return { line, changed: false, removedDomains: [] };
    }
    const removedDomains = [];
    const remainingHosts = hosts.filter(host => {
        const shouldRemove = cleanupDomains.has(host.toLowerCase());
        if (shouldRemove) {
            removedDomains.push(host.toLowerCase());
        }
        return !shouldRemove;
    });
    if (removedDomains.length === 0) {
        return { line, changed: false, removedDomains: [] };
    }
    if (remainingHosts.length === 0) {
        const keptComment = comment.trim();
        return {
            line: keptComment ? keptComment : null,
            changed: true,
            removedDomains,
        };
    }
    const nextBody = `${leading}${[address, ...remainingHosts].join('\t')}`;
    return {
        line: comment ? `${nextBody} ${comment}` : nextBody,
        changed: true,
        removedDomains,
    };
}
function isManagedProfileComment(line, profileNames) {
    return managedProfileComment(line, profileNames) !== null;
}
function managedProfileComment(line, profileNames) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('#')) {
        return null;
    }
    const label = trimmed.slice(1).trim();
    return profileNames.has(label) ? label : null;
}
function splitInlineComment(line) {
    const index = line.indexOf('#');
    if (index === -1) {
        return { body: line, comment: '' };
    }
    return {
        body: line.slice(0, index),
        comment: line.slice(index),
    };
}
function stripInlineComment(line) {
    return splitInlineComment(line).body;
}
function splitLines(content) {
    if (content.length === 0) {
        return [];
    }
    return content.replace(/\r?\n$/, '').split(/\r?\n/);
}
function trimTrailingBlankLines(lines) {
    const output = [...lines];
    while (output.length > 0 && output[output.length - 1]?.trim() === '') {
        output.pop();
    }
    return output;
}
function compactBlankRuns(lines) {
    const output = [];
    let previousBlank = false;
    for (const line of lines) {
        const blank = line.trim() === '';
        if (blank && previousBlank) {
            continue;
        }
        output.push(line);
        previousBlank = blank;
    }
    return output;
}
function detectEol(content) {
    return content.includes('\r\n') ? '\r\n' : '\n';
}
//# sourceMappingURL=hosts.js.map