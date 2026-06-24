import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadDefaultEnv, loadProfile, parseCliOptions, resolveConfigPaths } from '../src/config.js';

describe('config loading', () => {
  it('loads canonical YAML config', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ensure-hosts-'));
    const configPath = join(dir, 'hosts.yaml');
    writeFileSync(
      configPath,
      [
        'profile: PROFILE_NAME',
        'hosts:',
        '  - domain: some.domain.test',
        '    address: 127.0.0.1',
        '    skipSelf: false',
        '    children:',
        '      - sitea',
      ].join('\n')
    );

    expect(loadProfile(configPath)).toEqual({
      profile: 'PROFILE_NAME',
      hosts: [
        {
          domain: 'some.domain.test',
          address: '127.0.0.1',
          skipSelf: false,
          children: [{ domain: 'sitea' }],
        },
      ],
    });
  });

  it('supports repeated --config options', () => {
    expect(parseCliOptions(['--config', 'a.yaml', '--config=b.yml']).configPaths).toEqual(['a.yaml', 'b.yml']);
  });

  it('uses ENSURE_HOSTS_CONFIG when --config is omitted', () => {
    expect(resolveConfigPaths(parseCliOptions([]), { ENSURE_HOSTS_CONFIG: 'a.yaml,b.yml' })).toEqual([
      join(process.cwd(), 'a.yaml'),
      join(process.cwd(), 'b.yml'),
    ]);
  });

  it('does not fail when dotenv file is missing', () => {
    expect(() => loadDefaultEnv(join(tmpdir(), 'missing-ensure-hosts.env'))).not.toThrow();
  });
});
