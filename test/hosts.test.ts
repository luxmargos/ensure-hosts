import { describe, expect, it } from 'vitest';
import { expandProfile } from '../src/domain-map.js';
import { rewriteHostsContent } from '../src/hosts.js';
import type { ProfileConfig } from '../src/types.js';

function rewrite(before: string, profile: ProfileConfig): string {
  return rewriteHostsContent(before, [expandProfile(profile)]).content;
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
