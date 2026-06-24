import { isIP } from 'node:net';
import type { ExpandedProfile, HostNodeConfig, HostRecord, ProfileConfig } from './types.js';

interface ExpandContext {
  profile: string;
  parentDomain?: string;
  parentAddress?: string;
  parentRewrite?: boolean;
}

interface MutableExpandedProfile {
  profile: string;
  records: HostRecord[];
  cleanupDomains: Set<string>;
}

export function expandProfiles(profiles: ProfileConfig[]): ExpandedProfile[] {
  return profiles.map(expandProfile);
}

export function expandProfile(profile: ProfileConfig): ExpandedProfile {
  const output: MutableExpandedProfile = {
    profile: profile.profile,
    records: [],
    cleanupDomains: new Set<string>(),
  };

  for (const host of profile.hosts) {
    expandNode(host, {
      profile: profile.profile,
      parentRewrite: true,
    }, output);
  }

  return {
    profile: output.profile,
    records: output.records,
    cleanupDomains: [...output.cleanupDomains],
  };
}

function expandNode(
  node: HostNodeConfig,
  context: ExpandContext,
  output: MutableExpandedProfile
): void {
  const domain = composeDomain(node.domain, context.parentDomain);
  const address = normalizeOptionalString(node.address) ?? context.parentAddress;
  const rewrite = node.rewrite ?? context.parentRewrite ?? true;
  const skipSelf = node.skipSelf ?? false;

  if (rewrite) {
    output.cleanupDomains.add(domain);
  }

  if (!skipSelf && address) {
    assertIpAddress(address, domain);
    output.records.push({
      profile: context.profile,
      domain,
      address,
      rewrite,
    });
  }

  for (const child of node.children ?? []) {
    const childNode = typeof child === 'string' ? { domain: child } : child;
    expandNode(
      childNode,
      {
        profile: context.profile,
        parentDomain: domain,
        parentAddress: address,
        parentRewrite: rewrite,
      },
      output
    );
  }
}

export function composeDomain(domain: string, parentDomain?: string): string {
  const normalized = domain.trim().replace(/^\.+|\.+$/g, '').toLowerCase();
  if (!normalized) {
    throw new Error('Domain must not be empty.');
  }
  if (!parentDomain) {
    return normalized;
  }
  const normalizedParent = parentDomain.trim().replace(/^\.+|\.+$/g, '').toLowerCase();
  if (normalized === normalizedParent || normalized.endsWith(`.${normalizedParent}`)) {
    return normalized;
  }
  return `${normalized}.${normalizedParent}`;
}

function normalizeOptionalString(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function assertIpAddress(address: string, domain: string): void {
  if (isIP(address) === 0) {
    throw new Error(`Invalid IP address for ${domain}: ${address}`);
  }
}
