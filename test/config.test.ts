import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildElevationArgs,
  loadDefaultEnv,
  loadProfile,
  packageVersion,
  parseCliOptions,
  resolveConfigPaths,
} from '../src/config.js';

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

  it('reads the CLI version from package metadata', () => {
    const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
      version: string;
    };

    expect(packageVersion()).toBe(packageJson.version);
  });
});

describe('remove flags', () => {
  it('parses --remove', () => {
    const options = parseCliOptions(['--config', 'a.yaml', '--remove']);
    expect(options.remove).toBe(true);
    expect(options.removeForce).toBe(false);
  });

  it('parses --remove-force', () => {
    const options = parseCliOptions(['--config', 'a.yaml', '--remove-force']);
    expect(options.removeForce).toBe(true);
    expect(options.remove).toBe(false);
  });

  it('defaults both remove flags to false', () => {
    const options = parseCliOptions(['--config', 'a.yaml']);
    expect(options.remove).toBe(false);
    expect(options.removeForce).toBe(false);
  });

  it('defaults repeat profile comments to false', () => {
    expect(parseCliOptions(['--config', 'a.yaml']).repeatProfileComments).toBe(false);
  });

  it('parses --repeat-profile-comments', () => {
    expect(parseCliOptions(['--config', 'a.yaml', '--repeat-profile-comments']).repeatProfileComments).toBe(true);
  });

  it('rejects --remove together with --remove-force', () => {
    expect(() => parseCliOptions(['--config', 'a.yaml', '--remove', '--remove-force'])).toThrow(
      /cannot be used together/
    );
  });

  it('rejects --remove with --print-records', () => {
    expect(() => parseCliOptions(['--config', 'a.yaml', '--remove', '--print-records'])).toThrow(
      /--print-records cannot be combined/
    );
  });

  it('rejects --remove-force with --print-records', () => {
    expect(() => parseCliOptions(['--config', 'a.yaml', '--remove-force', '--print-records'])).toThrow(
      /--print-records cannot be combined/
    );
  });
});

describe('buildElevationArgs', () => {
  it('resolves relative config paths against the parent cwd', () => {
    const options = parseCliOptions(['--config', 'fixtures/simple.yaml']);
    expect(buildElevationArgs(options, ['fixtures/simple.yaml'])).toEqual([
      '--config',
      resolve('fixtures/simple.yaml'),
    ]);
  });

  it('omits --env-file when the user did not set it explicitly', () => {
    const options = parseCliOptions(['--config', 'a.yaml']);
    expect(buildElevationArgs(options, ['a.yaml'])).not.toContain('--env-file');
  });

  it('includes resolved --env-file only when explicitly provided', () => {
    const options = parseCliOptions(['--config', 'a.yaml', '--env-file', 'secrets.env']);
    expect(buildElevationArgs(options, ['a.yaml'])).toContain('--env-file');
    expect(buildElevationArgs(options, ['a.yaml'])).toContain(resolve('secrets.env'));
  });

  it('includes resolved --hosts-file when provided', () => {
    const options = parseCliOptions(['--config', 'a.yaml', '--hosts-file', 'tmp/hosts']);
    expect(buildElevationArgs(options, ['a.yaml'])).toContain('--hosts-file');
    expect(buildElevationArgs(options, ['a.yaml'])).toContain(resolve('tmp/hosts'));
  });

  it('preserves --dry-run and --print-records flags', () => {
    const options = parseCliOptions(['--config', 'a.yaml', '--dry-run', '--print-records']);
    expect(buildElevationArgs(options, ['a.yaml'])).toEqual([
      '--config',
      resolve('a.yaml'),
      '--dry-run',
      '--print-records',
    ]);
  });

  it('forwards --repeat-profile-comments to the elevated child', () => {
    const options = parseCliOptions(['--config', 'a.yaml', '--repeat-profile-comments']);
    expect(buildElevationArgs(options, ['a.yaml'])).toEqual([
      '--config',
      resolve('a.yaml'),
      '--repeat-profile-comments',
    ]);
  });

  it('omits --no-elevate and --output-file', () => {
    const options = parseCliOptions([
      '--config',
      'a.yaml',
      '--no-elevate',
      '--output-file',
      '/tmp/log',
    ]);
    const args = buildElevationArgs(options, ['a.yaml']);
    expect(args).not.toContain('--no-elevate');
    expect(args).not.toContain('--output-file');
    expect(args).not.toContain('/tmp/log');
  });

  it('emits one --config pair per resolved path, in order', () => {
    const options = parseCliOptions(['--config', 'a.yaml', '--config', 'b.yml']);
    expect(buildElevationArgs(options, ['a.yaml', 'b.yml'])).toEqual([
      '--config',
      resolve('a.yaml'),
      '--config',
      resolve('b.yml'),
    ]);
  });

  it('forwards --remove to the elevated child', () => {
    const options = parseCliOptions(['--config', 'a.yaml', '--remove']);
    expect(buildElevationArgs(options, ['a.yaml'])).toEqual([
      '--config',
      resolve('a.yaml'),
      '--remove',
    ]);
  });

  it('forwards --remove-force to the elevated child', () => {
    const options = parseCliOptions(['--config', 'a.yaml', '--remove-force']);
    expect(buildElevationArgs(options, ['a.yaml'])).toEqual([
      '--config',
      resolve('a.yaml'),
      '--remove-force',
    ]);
  });

  it('omits remove flags when neither is set', () => {
    const options = parseCliOptions(['--config', 'a.yaml']);
    const args = buildElevationArgs(options, ['a.yaml']);
    expect(args).not.toContain('--remove');
    expect(args).not.toContain('--remove-force');
  });
});
