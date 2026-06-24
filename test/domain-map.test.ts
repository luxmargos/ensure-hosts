import { describe, expect, it } from 'vitest';
import { expandProfile } from '../src/domain-map.js';
import type { ProfileConfig } from '../src/types.js';

describe('domain expansion', () => {
  it('expands nested children with inherited address and rewrite', () => {
    const profile: ProfileConfig = {
      profile: 'PROFILE_NAME',
      hosts: [
        {
          domain: 'some.domain.test',
          address: '192.168.1.111',
          children: ['sitea', { domain: 'siteb', children: ['deep'] }],
        },
      ],
    };

    expect(expandProfile(profile)).toEqual({
      profile: 'PROFILE_NAME',
      cleanupDomains: [
        'some.domain.test',
        'sitea.some.domain.test',
        'siteb.some.domain.test',
        'deep.siteb.some.domain.test',
      ],
      records: [
        { profile: 'PROFILE_NAME', address: '192.168.1.111', domain: 'some.domain.test', rewrite: true },
        { profile: 'PROFILE_NAME', address: '192.168.1.111', domain: 'sitea.some.domain.test', rewrite: true },
        { profile: 'PROFILE_NAME', address: '192.168.1.111', domain: 'siteb.some.domain.test', rewrite: true },
        { profile: 'PROFILE_NAME', address: '192.168.1.111', domain: 'deep.siteb.some.domain.test', rewrite: true },
      ],
    });
  });

  it('supports skipSelf and explicit child IPv6 address', () => {
    const profile: ProfileConfig = {
      profile: 'IPV6',
      hosts: [
        {
          domain: 'example.test',
          address: '192.168.1.111',
          skipSelf: true,
          children: [{ domain: 'v6', address: '::1' }],
        },
      ],
    };

    expect(expandProfile(profile).records).toEqual([
      { profile: 'IPV6', address: '::1', domain: 'v6.example.test', rewrite: true },
    ]);
  });

  it('cleans entries without effective addresses but does not write them', () => {
    const profile: ProfileConfig = {
      profile: 'PROFILE_NAME',
      hosts: [
        {
          domain: 'some.domain.test',
          children: [{ domain: 'sitea', address: '127.0.0.1' }, 'siteb'],
        },
      ],
    };

    expect(expandProfile(profile)).toEqual({
      profile: 'PROFILE_NAME',
      cleanupDomains: ['some.domain.test', 'sitea.some.domain.test', 'siteb.some.domain.test'],
      records: [{ profile: 'PROFILE_NAME', address: '127.0.0.1', domain: 'sitea.some.domain.test', rewrite: true }],
    });
  });

  it('throws for invalid addresses', () => {
    expect(() =>
      expandProfile({
        profile: 'BAD',
        hosts: [{ domain: 'bad.test', address: 'not-an-ip' }],
      })
    ).toThrow(/Invalid IP address/);
  });
});
