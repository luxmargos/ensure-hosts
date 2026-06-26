import { describe, expect, it } from 'vitest';
import { expandProfile } from '../src/domain-map.js';
import { removeHostsContent, rewriteHostsContent } from '../src/hosts.js';
import type { ProfileConfig } from '../src/types.js';

function rewrite(before: string, profile: ProfileConfig): string {
  return rewriteHostsContent(before, [expandProfile(profile)]).content;
}

function remove(before: string, profile: ProfileConfig, force = false): string {
  return removeHostsContent(before, [expandProfile(profile)], { force }).content;
}

const simpleProfile: ProfileConfig = {
  profile: 'PROFILE_NAME',
  hosts: [
    { domain: 'site1.domain.test', address: '192.168.1.111' },
    { domain: 'site2.domain.test', address: '127.0.0.1' },
    { domain: 'site3.domain.test' },
  ],
};

const subProfile: ProfileConfig = {
  profile: 'PROFILE_NAME',
  hosts: [
    {
      domain: 'some.domain.test',
      rewrite: true,
      address: '192.168.1.111',
      children: ['sitea', 'siteb'],
    },
  ],
};

const skipSelfProfile: ProfileConfig = {
  profile: 'PROFILE_NAME',
  hosts: [
    {
      domain: 'some.domain.test',
      rewrite: true,
      skipSelf: true,
      address: '192.168.1.111',
      children: ['sitea', 'siteb'],
    },
  ],
};

const inheritProfile: ProfileConfig = {
  profile: 'PROFILE_NAME',
  hosts: [
    {
      domain: 'some.domain.test',
      rewrite: true,
      children: [{ domain: 'sitea', address: '127.0.0.1' }, { domain: 'siteb' }],
    },
  ],
};

describe('hosts rewriting samples', () => {
  it('sample 0 expected 1', () => {
    expect(rewrite('127.0.0.1 localhost\n', simpleProfile)).toBe(
      '127.0.0.1 localhost\n\n' +
        '# PROFILE_NAME\n' +
        '192.168.1.111 site1.domain.test\n' +
        '# PROFILE_NAME\n' +
        '127.0.0.1 site2.domain.test\n'
    );
  });

  it('sample 0 expected 2', () => {
    const before =
      '127.0.0.1 localhost\n\n' +
      '192.168.1.111 site1.domain.test\n' +
      '192.168.1.111 site2.domain.test\n\n' +
      '127.0.0.1 another.domain.test\n\n' +
      '192.168.1.111 site3.domain.test\n';

    expect(rewrite(before, simpleProfile)).toBe(
      '127.0.0.1 localhost\n\n' +
        '127.0.0.1 another.domain.test\n\n' +
        '# PROFILE_NAME\n' +
        '192.168.1.111 site1.domain.test\n' +
        '# PROFILE_NAME\n' +
        '127.0.0.1 site2.domain.test\n'
    );
  });

  it('sample 1 expected 1', () => {
    expect(rewrite('127.0.0.1 localhost\n', subProfile)).toBe(
      '127.0.0.1 localhost\n\n' +
        '# PROFILE_NAME\n' +
        '192.168.1.111 some.domain.test\n' +
        '# PROFILE_NAME\n' +
        '192.168.1.111 sitea.some.domain.test\n' +
        '# PROFILE_NAME\n' +
        '192.168.1.111 siteb.some.domain.test\n'
    );
  });

  it('sample 1 expected 2', () => {
    const before =
      '127.0.0.1 localhost\n\n' +
      '192.168.1.111 some.domain.test\n' +
      '192.168.1.111 sitea.some.domain.test\n\n' +
      '127.0.0.1 another.domain\n\n' +
      '192.168.1.111 siteb.some.domain.test\n';

    expect(rewrite(before, subProfile)).toBe(
      '127.0.0.1 localhost\n\n' +
        '127.0.0.1 another.domain\n\n' +
        '# PROFILE_NAME\n' +
        '192.168.1.111 some.domain.test\n' +
        '# PROFILE_NAME\n' +
        '192.168.1.111 sitea.some.domain.test\n' +
        '# PROFILE_NAME\n' +
        '192.168.1.111 siteb.some.domain.test\n'
    );
  });

  it('sample 2 expected 1', () => {
    expect(rewrite('127.0.0.1 localhost\n', skipSelfProfile)).toBe(
      '127.0.0.1 localhost\n\n' +
        '# PROFILE_NAME\n' +
        '192.168.1.111 sitea.some.domain.test\n' +
        '# PROFILE_NAME\n' +
        '192.168.1.111 siteb.some.domain.test\n'
    );
  });

  it('sample 2 expected 2', () => {
    const before =
      '127.0.0.1 localhost\n\n' +
      '# PROFILE_NAME\n' +
      '192.168.1.111 some.domain.test\n' +
      '# PROFILE_NAME\n' +
      '192.168.1.111 sitea.some.domain.test\n\n' +
      '127.0.0.1 another.domain\n\n' +
      '# PROFILE_NAME\n' +
      '192.168.1.111 siteb.some.domain.test\n';

    expect(rewrite(before, skipSelfProfile)).toBe(
      '127.0.0.1 localhost\n\n' +
        '127.0.0.1 another.domain\n\n' +
        '# PROFILE_NAME\n' +
        '192.168.1.111 sitea.some.domain.test\n' +
        '# PROFILE_NAME\n' +
        '192.168.1.111 siteb.some.domain.test\n'
    );
  });

  it('sample 3 expected 1', () => {
    expect(rewrite('127.0.0.1 localhost\n', inheritProfile)).toBe(
      '127.0.0.1 localhost\n\n# PROFILE_NAME\n127.0.0.1 sitea.some.domain.test\n'
    );
  });

  it('sample 3 expected 2', () => {
    const before =
      '127.0.0.1 localhost\n\n' +
      '# PROFILE_NAME\n' +
      '192.168.1.111 some.domain.test\n' +
      '# PROFILE_NAME\n' +
      '192.168.1.111 sitea.some.domain.test\n\n' +
      '127.0.0.1 another.domain\n\n' +
      '# PROFILE_NAME\n' +
      '192.168.1.111 siteb.some.domain.test\n';

    expect(rewrite(before, inheritProfile)).toBe(
      '127.0.0.1 localhost\n\n' +
        '127.0.0.1 another.domain\n\n' +
        '# PROFILE_NAME\n' +
        '127.0.0.1 sitea.some.domain.test\n'
    );
  });
});

describe('rewrite false and preservation behavior', () => {
  it('does not touch existing same-domain lines for rewrite false', () => {
    const profile: ProfileConfig = {
      profile: 'PROFILE_NAME',
      hosts: [
        { domain: 'site1.domain.test', address: '192.168.1.111', rewrite: false },
        { domain: 'site2.domain.test', address: '127.0.0.1', rewrite: false },
        { domain: 'site3.domain.test', rewrite: false },
      ],
    };
    const before =
      '127.0.0.1 localhost\n\n' +
      '# PROFILE_NAME\n' +
      '192.168.1.111 site1.domain.test\n\n' +
      '127.0.0.1 another.domain\n\n' +
      '127.0.0.1 site2.domain.test\n' +
      '127.0.0.1 site3.domain.test\n';

    expect(rewrite(before, profile)).toBe(before);
  });

  it('appends a rewrite false record only when absent', () => {
    const profile: ProfileConfig = {
      profile: 'PROFILE_NAME',
      hosts: [{ domain: 'site2.domain.test', address: '127.0.0.1', rewrite: false }],
    };

    expect(rewrite('127.0.0.1 localhost\n', profile)).toBe(
      '127.0.0.1 localhost\n\n# PROFILE_NAME\n127.0.0.1 site2.domain.test\n'
    );
  });

  it('preserves CRLF line endings', () => {
    const before = '127.0.0.1 localhost\r\n';
    expect(rewrite(before, simpleProfile)).toBe(
      '127.0.0.1 localhost\r\n\r\n' +
        '# PROFILE_NAME\r\n' +
        '192.168.1.111 site1.domain.test\r\n' +
        '# PROFILE_NAME\r\n' +
        '127.0.0.1 site2.domain.test\r\n'
    );
  });

  it('preserves unrelated comments and inline comments where possible', () => {
    const before =
      '# keep me\n' +
      '127.0.0.1 localhost site1.domain.test # local aliases\n' +
      '# another comment\n';

    expect(rewrite(before, simpleProfile)).toBe(
      '# keep me\n' +
        '127.0.0.1\tlocalhost # local aliases\n' +
        '# another comment\n\n' +
        '# PROFILE_NAME\n' +
        '192.168.1.111 site1.domain.test\n' +
        '# PROFILE_NAME\n' +
        '127.0.0.1 site2.domain.test\n'
    );
  });
});

describe('removeHostsContent', () => {
  const mixedProfile: ProfileConfig = {
    profile: 'PROFILE_NAME',
    hosts: [
      { domain: 'site1.domain.test', address: '192.168.1.111', rewrite: true },
      { domain: 'site2.domain.test', address: '127.0.0.1', rewrite: false },
    ],
  };

  // Content as it would look after running ensure (the default action) on a
  // bare localhost file. Used as the starting point for removal below.
  const ensured =
    '127.0.0.1 localhost\n\n' +
    '# PROFILE_NAME\n' +
    '192.168.1.111 site1.domain.test\n' +
    '# PROFILE_NAME\n' +
    '127.0.0.1 site2.domain.test\n';

  it('--remove strips rewrite:true domains and their comments', () => {
    expect(remove(ensured, mixedProfile, false)).toBe(
      '127.0.0.1 localhost\n\n# PROFILE_NAME\n127.0.0.1 site2.domain.test\n'
    );
  });

  it('--remove leaves rewrite:false domains untouched', () => {
    const result = remove(ensured, mixedProfile, false);
    expect(result).toContain('127.0.0.1 site2.domain.test');
    expect(result).not.toContain('site1.domain.test');
  });

  it('--remove-force strips rewrite:false domains as well', () => {
    expect(remove(ensured, mixedProfile, true)).toBe('127.0.0.1 localhost\n');
  });

  it('strips every domain for an all-rewrite:true profile with --remove', () => {
    const ensuredSimple =
      '127.0.0.1 localhost\n\n' +
      '# PROFILE_NAME\n' +
      '192.168.1.111 site1.domain.test\n' +
      '# PROFILE_NAME\n' +
      '127.0.0.1 site2.domain.test\n';
    expect(remove(ensuredSimple, simpleProfile, false)).toBe('127.0.0.1 localhost\n');
  });

  it('removes only the listed token when a line mixes listed and unlisted hosts', () => {
    const before = '127.0.0.1 localhost site1.domain.test\n';
    // --remove strips site1.domain.test (rewrite:true), keeps localhost.
    expect(remove(before, simpleProfile, false)).toBe('127.0.0.1\tlocalhost\n');
  });

  it('is idempotent: removing from already-clean content is a no-op', () => {
    const clean = '127.0.0.1 localhost\n';
    expect(remove(clean, mixedProfile, false)).toBe(clean);
    expect(remove(clean, mixedProfile, true)).toBe(clean);
  });

  it('reports the domains actually removed', () => {
    const result = removeHostsContent(ensured, [expandProfile(mixedProfile)], { force: false });
    expect(result.removedDomains).toEqual(['site1.domain.test']);
  });

  it('reports all removed domains under --remove-force', () => {
    const result = removeHostsContent(ensured, [expandProfile(mixedProfile)], { force: true });
    expect(result.removedDomains.sort()).toEqual(['site1.domain.test', 'site2.domain.test']);
  });

  it('preserves CRLF line endings', () => {
    const before =
      '127.0.0.1 localhost\r\n\r\n' +
      '# PROFILE_NAME\r\n' +
      '192.168.1.111 site1.domain.test\r\n' +
      '# PROFILE_NAME\r\n' +
      '127.0.0.1 site2.domain.test\r\n';
    expect(remove(before, mixedProfile, true)).toBe('127.0.0.1 localhost\r\n');
  });

  it('preserves unrelated lines and comments', () => {
    const before =
      '# keep me\n' +
      '127.0.0.1 localhost\n\n' +
      '# PROFILE_NAME\n' +
      '192.168.1.111 site1.domain.test\n' +
      '10.0.0.5 another.domain\n';
    expect(remove(before, mixedProfile, false)).toBe(
      '# keep me\n127.0.0.1 localhost\n\n10.0.0.5 another.domain\n'
    );
  });
});
