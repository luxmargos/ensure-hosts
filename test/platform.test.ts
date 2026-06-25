import { describe, expect, it } from 'vitest';
import { resolveDefaultHostsPath, tryElevate, withoutElevationArgs } from '../src/platform.js';

describe('resolveDefaultHostsPath', () => {
  it('returns /etc/hosts on posix', () => {
    expect(resolveDefaultHostsPath('linux')).toBe('/etc/hosts');
    expect(resolveDefaultHostsPath('darwin')).toBe('/etc/hosts');
  });

  it('returns the Windows hosts path under SystemRoot', () => {
    expect(resolveDefaultHostsPath('win32', { SystemRoot: 'C:\\Windows' })).toBe(
      'C:\\Windows\\System32\\drivers\\etc\\hosts'
    );
  });

  it('falls back to a default SystemRoot when the env var is absent', () => {
    expect(resolveDefaultHostsPath('win32', {})).toBe(
      'C:\\Windows\\System32\\drivers\\etc\\hosts'
    );
  });
});

describe('withoutElevationArgs', () => {
  it('strips elevation and output-file flags but keeps the rest', () => {
    expect(
      withoutElevationArgs([
        '--config',
        'a.yaml',
        '--no-elevate',
        '--elevated',
        '--output-file',
        '/tmp/log',
        '--dry-run',
      ])
    ).toEqual(['--config', 'a.yaml', '--dry-run']);
  });

  it('strips --output-file=value form', () => {
    expect(
      withoutElevationArgs(['--config', 'a.yaml', '--output-file=/tmp/log'])
    ).toEqual(['--config', 'a.yaml']);
  });
});

describe('tryElevate guard branches', () => {
  // A dummy script path; the guards short-circuit before any spawn happens.
  const baseOptions = {
    scriptPath: '/path/to/cli.js',
    args: ['--config', 'a.yaml'],
    cwd: '/cwd',
  };

  it('does not elevate when noElevate is set', () => {
    expect(
      tryElevate({
        ...baseOptions,
        noElevate: true,
        elevated: false,
        dryRun: false,
        printRecords: false,
      })
    ).toBe(false);
  });

  it('does not elevate when already elevated', () => {
    expect(
      tryElevate({
        ...baseOptions,
        noElevate: false,
        elevated: true,
        dryRun: false,
        printRecords: false,
      })
    ).toBe(false);
  });

  it('does not elevate for --dry-run', () => {
    expect(
      tryElevate({
        ...baseOptions,
        noElevate: false,
        elevated: false,
        dryRun: true,
        printRecords: false,
      })
    ).toBe(false);
  });

  it('does not elevate for --print-records', () => {
    expect(
      tryElevate({
        ...baseOptions,
        noElevate: false,
        elevated: false,
        dryRun: false,
        printRecords: true,
      })
    ).toBe(false);
  });
});
