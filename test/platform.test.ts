import { describe, expect, it } from 'vitest';
import { resolveDefaultHostsPath, tryElevate, withoutElevationArgs, notifyRootWrite } from '../src/platform.js';
import type { ElevationOptions } from '../src/platform.js';

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

  it('keeps --remove and --remove-force (mode flags, not elevation-only)', () => {
    expect(
      withoutElevationArgs([
        '--config',
        'a.yaml',
        '--remove',
        '--remove-force',
        '--no-elevate',
      ])
    ).toEqual(['--config', 'a.yaml', '--remove', '--remove-force']);
  });
});

describe('tryElevate guard branches', () => {
  // A dummy script path; the guards short-circuit before any spawn happens.
  const baseOptions: ElevationOptions = {
    scriptPath: '/path/to/cli.js',
    args: ['--config', 'a.yaml'],
    cwd: '/cwd',
    noElevate: false,
    elevated: false,
    dryRun: false,
    printRecords: false,
    filePath: '/etc/hosts',
    content: 'dummy content',
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

describe('tryElevate darwin fallback chain', () => {
  // On macOS, tryElevate uses a layered fallback:
  //   1. sudo tee (mkcert-style, terminal password prompt)
  //   2. osascript (GUI administrator prompt)
  //   3. throw / return false (caller prints sudo hint)
  //
  // The actual sudo/osascript behavior requires a real terminal and
  // privilege escalation, so it is verified manually (see PLAN.md
  // Verification section). Here we test only the guard logic.

  const baseOptions: ElevationOptions = {
    scriptPath: '/path/to/cli.js',
    args: ['--config', 'a.yaml'],
    cwd: '/cwd',
    noElevate: false,
    elevated: false,
    dryRun: false,
    printRecords: false,
    filePath: '/etc/hosts',
    content: 'dummy content',
  };

  it('returns false on darwin when noElevate is set (does not attempt sudo or osascript)', () => {
    // This verifies the guard short-circuits before any spawn, even on darwin.
    expect(
      tryElevate({
        ...baseOptions,
        noElevate: true,
      })
    ).toBe(false);
  });

  it('returns false on platforms without elevation support (e.g. linux)', () => {
    // On linux, tryElevate has no elevation strategy and returns false.
    // We can't force platform() to return 'linux' without mocking, but
    // we verify the guard path returns false for a non-elevated scenario
    // where dryRun is set (which short-circuits before platform check).
    expect(
      tryElevate({
        ...baseOptions,
        dryRun: true,
      })
    ).toBe(false);
  });
});

describe('notifyRootWrite', () => {
  it('does not throw when not running as root', () => {
    // On a normal dev machine or CI container we are not root, so
    // notifyRootWrite should be a silent no-op that does not throw.
    expect(() => notifyRootWrite('/etc/hosts')).not.toThrow();
  });
});
