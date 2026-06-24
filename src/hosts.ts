import type { ExpandedProfile, HostRecord } from './types.js';

export interface RewriteResult {
  content: string;
  appended: HostRecord[];
  removedDomains: string[];
}

interface CleanLineResult {
  line: string | null;
  changed: boolean;
  removedDomains: string[];
}

export function rewriteHostsContent(content: string, profiles: ExpandedProfile[]): RewriteResult {
  const eol = detectEol(content);
  const hadFinalEol = content.endsWith('\n') || content.endsWith('\r\n');
  const sourceLines = splitLines(content);
  const cleanupDomains = new Set(profiles.flatMap(profile => profile.cleanupDomains));
  const profileNames = new Set(profiles.map(profile => profile.profile));
  const cleanedLines: string[] = [];
  const removedDomains = new Set<string>();
  let pendingManagedComments: string[] = [];

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
    } else if (pendingManagedComments.length > 0) {
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

  const compactedLines = compactBlankRuns(cleanedLines);
  const appended = selectRecordsToAppend(compactedLines, profiles);
  const nextLines = [...trimTrailingBlankLines(compactedLines)];

  if (appended.length > 0) {
    if (nextLines.length > 0) {
      nextLines.push('');
    }
    for (const record of appended) {
      nextLines.push(`# ${record.profile}`);
      nextLines.push(`${record.address} ${record.domain}`);
    }
  }

  const contentBody = nextLines.join(eol);
  const nextContent = contentBody.length > 0 ? `${contentBody}${eol}` : hadFinalEol ? eol : '';

  return {
    content: nextContent,
    appended,
    removedDomains: [...removedDomains],
  };
}

export function selectRecordsToAppend(lines: string[], profiles: ExpandedProfile[]): HostRecord[] {
  const existingDomains = collectDomainsFromLines(lines);
  const records = profiles.flatMap(profile => profile.records);
  const appended: HostRecord[] = [];

  for (const record of records) {
    if (!record.rewrite && existingDomains.has(record.domain)) {
      continue;
    }
    appended.push(record);
    existingDomains.add(record.domain);
  }

  return appended;
}

export function collectDomainsFromContent(content: string): Set<string> {
  return collectDomainsFromLines(splitLines(content));
}

export function collectDomainsFromLines(lines: string[]): Set<string> {
  const domains = new Set<string>();
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

function cleanHostsLine(line: string, cleanupDomains: Set<string>): CleanLineResult {
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

  const removedDomains: string[] = [];
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

function isManagedProfileComment(line: string, profileNames: Set<string>): boolean {
  const trimmed = line.trim();
  if (!trimmed.startsWith('#')) {
    return false;
  }
  const label = trimmed.slice(1).trim();
  return profileNames.has(label);
}

function splitInlineComment(line: string): { body: string; comment: string } {
  const index = line.indexOf('#');
  if (index === -1) {
    return { body: line, comment: '' };
  }
  return {
    body: line.slice(0, index),
    comment: line.slice(index),
  };
}

function stripInlineComment(line: string): string {
  return splitInlineComment(line).body;
}

function splitLines(content: string): string[] {
  if (content.length === 0) {
    return [];
  }
  return content.replace(/\r?\n$/, '').split(/\r?\n/);
}

function trimTrailingBlankLines(lines: string[]): string[] {
  const output = [...lines];
  while (output.length > 0 && output[output.length - 1]?.trim() === '') {
    output.pop();
  }
  return output;
}

function compactBlankRuns(lines: string[]): string[] {
  const output: string[] = [];
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

function detectEol(content: string): string {
  return content.includes('\r\n') ? '\r\n' : '\n';
}
