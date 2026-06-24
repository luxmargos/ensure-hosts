import { isIP } from 'node:net';
export function expandProfiles(profiles) {
    return profiles.map(expandProfile);
}
export function expandProfile(profile) {
    const output = {
        profile: profile.profile,
        records: [],
        cleanupDomains: new Set(),
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
function expandNode(node, context, output) {
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
        expandNode(childNode, {
            profile: context.profile,
            parentDomain: domain,
            parentAddress: address,
            parentRewrite: rewrite,
        }, output);
    }
}
export function composeDomain(domain, parentDomain) {
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
function normalizeOptionalString(value) {
    const normalized = value?.trim();
    return normalized ? normalized : undefined;
}
function assertIpAddress(address, domain) {
    if (isIP(address) === 0) {
        throw new Error(`Invalid IP address for ${domain}: ${address}`);
    }
}
//# sourceMappingURL=domain-map.js.map