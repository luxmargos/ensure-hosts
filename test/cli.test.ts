import { describe, expect, it } from 'vitest';
import { elevationHandled } from '../src/platform.js';

// Regression guard for the elevation exit-decision bug.
//
// tryElevate() returns: false | 'written' | 'spawned'
//   - 'written'  : sudo tee wrote the hosts file (or process is already root)
//   - 'spawned'  : osascript / Windows GUI re-spawned an elevated child
//   - false      : elevation did not happen / unavailable
//
// Previously cli.ts only treated 'spawned' as success, so the primary macOS
// terminal flow (`sudo tee` -> 'written') threw a misleading "Permission
// denied" error after the file was already updated. Any truthy result must be
// treated as success.
describe('elevationHandled', () => {
  it('treats "written" (sudo tee / already root) as success', () => {
    // This is the case that regressed: the hosts file was updated by sudo tee,
    // but the CLI reported Permission denied and exited non-zero.
    expect(elevationHandled('written')).toBe(true);
  });

  it('treats "spawned" (osascript / Windows re-spawn) as success', () => {
    expect(elevationHandled('spawned')).toBe(true);
  });

  it('treats false (no elevation) as not handled -> caller throws sudo hint', () => {
    expect(elevationHandled(false)).toBe(false);
  });
});