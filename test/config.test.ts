import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildElevationArgs,
  interpolateEnv,
  loadDefaultEnv,
  loadProfile,
  packageVersion,
  parseCliOptions,
  resolveConfigPaths,
  resolveEnvFileMissing,
  resolveEnvOverride,
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

  it('supports repeated --env-file options', () => {
    const options = parseCliOptions(['--env-file', 'base.env', '--env-file=local.env']);
    expect(options.envFiles).toEqual(['base.env', 'local.env']);
    expect(options.envFilesExplicit).toBe(true);
  });

  it('parses env behavior options', () => {
    const options = parseCliOptions([
      '--env-override',
      'respect',
      '--env-file-missing=error',
    ]);
    expect(options.envOverride).toBe('respect');
    expect(options.envOverrideExplicit).toBe(true);
    expect(options.envFileMissing).toBe('error');
    expect(options.envFileMissingExplicit).toBe(true);
  });

  it('rejects invalid env behavior options', () => {
    expect(() => parseCliOptions(['--env-override', 'replace'])).toThrow(/overwrite, respect/);
    expect(() => parseCliOptions(['--env-file-missing', 'skip'])).toThrow(/ignore, error/);
  });

  it('uses ENSURE_HOSTS_CONFIG when --config is omitted', () => {
    expect(resolveConfigPaths(parseCliOptions([]), { ENSURE_HOSTS_CONFIG: 'a.yaml,b.yml' })).toEqual([
      join(process.cwd(), 'a.yaml'),
      join(process.cwd(), 'b.yml'),
    ]);
  });

  it('resolves env override with CLI, env var, and default precedence', () => {
    expect(resolveEnvOverride(parseCliOptions(['--env-override', 'respect']), { ENSURE_HOSTS_ENV_OVERRIDE: 'overwrite' })).toBe(
      'respect'
    );
    expect(resolveEnvOverride(parseCliOptions([]), { ENSURE_HOSTS_ENV_OVERRIDE: 'respect' })).toBe('respect');
    expect(resolveEnvOverride(parseCliOptions([]), {})).toBe('overwrite');
  });

  it('resolves missing env-file mode with CLI, env var, and default precedence', () => {
    expect(
      resolveEnvFileMissing(parseCliOptions(['--env-file-missing', 'error']), {
        ENSURE_HOSTS_ENV_FILE_MISSING: 'ignore',
      })
    ).toBe('error');
    expect(resolveEnvFileMissing(parseCliOptions([]), { ENSURE_HOSTS_ENV_FILE_MISSING: 'error' })).toBe('error');
    expect(resolveEnvFileMissing(parseCliOptions([]), {})).toBe('ignore');
  });

  it('does not fail when dotenv file is missing in ignore mode', () => {
    expect(() => loadDefaultEnv(join(tmpdir(), 'missing-ensure-hosts.env'))).not.toThrow();
  });

  it('fails when dotenv file is missing in error mode', () => {
    expect(() => loadDefaultEnv(join(tmpdir(), 'missing-ensure-hosts.env'), 'overwrite', 'error')).toThrow(
      /Environment file not found/
    );
  });

  it('loads multiple dotenv files in order with overwrite mode', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ensure-hosts-'));
    const base = join(dir, 'base.env');
    const local = join(dir, 'local.env');
    const key = 'ENSURE_HOSTS_TEST_OVERWRITE';
    writeFileSync(base, `${key}=base\n`);
    writeFileSync(local, `${key}=local\n`);

    const previous = process.env[key];
    process.env[key] = 'shell';
    try {
      loadDefaultEnv([base, local], 'overwrite', 'error');
      expect(process.env[key]).toBe('local');
    } finally {
      restoreEnv(key, previous);
    }
  });

  it('loads multiple dotenv files in order with respect mode', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ensure-hosts-'));
    const base = join(dir, 'base.env');
    const local = join(dir, 'local.env');
    const shellKey = 'ENSURE_HOSTS_TEST_RESPECT_SHELL';
    const fileKey = 'ENSURE_HOSTS_TEST_RESPECT_FILE';
    writeFileSync(base, [`${shellKey}=base`, `${fileKey}=base`].join('\n'));
    writeFileSync(local, [`${shellKey}=local`, `${fileKey}=local`].join('\n'));

    const previousShell = process.env[shellKey];
    const previousFile = process.env[fileKey];
    process.env[shellKey] = 'shell';
    delete process.env[fileKey];
    try {
      loadDefaultEnv([base, local], 'respect', 'error');
      expect(process.env[shellKey]).toBe('shell');
      expect(process.env[fileKey]).toBe('base');
    } finally {
      restoreEnv(shellKey, previousShell);
      restoreEnv(fileKey, previousFile);
    }
  });

  it('interpolates environment variables before YAML parsing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ensure-hosts-'));
    const configPath = join(dir, 'hosts.yaml');
    writeFileSync(
      configPath,
      [
        'profile: "${PROFILE_NAME}"',
        'hosts:',
        '  - domain: "${HOST_DOMAIN}"',
        '    address: "${HOST_ADDRESS:-127.0.0.1}"',
        '    children:',
        '      - "${CHILD_DOMAIN-default-child}"',
      ].join('\n')
    );

    expect(
      loadProfile(configPath, {
        PROFILE_NAME: 'FROM_ENV',
        HOST_DOMAIN: 'example.test',
      })
    ).toEqual({
      profile: 'FROM_ENV',
      hosts: [
        {
          domain: 'example.test',
          address: '127.0.0.1',
          children: [{ domain: 'default-child' }],
        },
      ],
    });
  });

  it('supports Docker Compose-like interpolation defaults', () => {
    expect(
      interpolateEnv('${SET:-fallback}|${EMPTY:-fallback}|${EMPTY-fallback}|${UNSET-fallback}', {
        SET: 'value',
        EMPTY: '',
      })
    ).toBe('value|fallback||fallback');
  });

  it('expands plain missing variables to empty strings and warns', () => {
    const warnings: string[] = [];
    expect(interpolateEnv('a${MISSING_ENSURE_HOSTS_TEST}b', {}, message => warnings.push(message))).toBe('ab');
    expect(warnings).toEqual([
      '[ensure-hosts] Environment variable MISSING_ENSURE_HOSTS_TEST is not set; substituting an empty string.',
    ]);
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

  it('includes repeated env files and explicit env modes', () => {
    const options = parseCliOptions([
      '--config',
      'a.yaml',
      '--env-file',
      'base.env',
      '--env-file=local.env',
      '--env-override',
      'respect',
      '--env-file-missing=error',
    ]);
    expect(buildElevationArgs(options, ['a.yaml'])).toEqual([
      '--config',
      resolve('a.yaml'),
      '--env-file',
      resolve('base.env'),
      '--env-file',
      resolve('local.env'),
      '--env-override',
      'respect',
      '--env-file-missing',
      'error',
    ]);
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

function restoreEnv(key: string, previous: string | undefined): void {
  if (previous === undefined) {
    delete process.env[key];
    return;
  }
  process.env[key] = previous;
}
