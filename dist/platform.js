import { readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, win32 } from 'node:path';
import { platform } from 'node:os';
import { spawnSync } from 'node:child_process';
export function resolveDefaultHostsPath(currentPlatform = platform(), env = process.env) {
    if (currentPlatform === 'win32') {
        return win32.join(env.SystemRoot ?? 'C:\\Windows', 'System32', 'drivers', 'etc', 'hosts');
    }
    return '/etc/hosts';
}
export function tryElevate(options) {
    if (options.noElevate || options.elevated || options.dryRun || options.printRecords) {
        return false;
    }
    if (platform() === 'darwin') {
        // Try sudo (mkcert-style) first — works in terminal contexts and avoids
        // the noowners EPERM that osascript hits on external APFS volumes.
        const sudoResult = tryMacOsSudoWrite(options.filePath, options.content);
        if (sudoResult) {
            return sudoResult;
        }
        // Fall back to osascript GUI prompt for non-terminal contexts.
        return tryMacOsPrivilegePrompt(options);
    }
    if (platform() === 'win32') {
        return tryWindowsPrivilegePrompt(options);
    }
    return false;
}
/**
 * Returns true when an elevation attempt succeeded and the caller should
 * exit cleanly (no Permission denied error). Any truthy ElevationResult
 * (`'written'` from sudo tee / already-root, or `'spawned'` from the
 * osascript/Windows GUI re-spawn) counts as success. `false` means no
 * elevation happened and the caller should throw the sudo hint.
 */
export function elevationHandled(elevated) {
    return elevated !== false;
}
export function elevatedCommandHint(command = 'ensure-hosts') {
    if (platform() === 'win32') {
        return `Windows: if the privilege prompt does not appear, run \`${command}\` in an elevated PowerShell.`;
    }
    if (platform() === 'darwin') {
        return `macOS: if the privilege prompt does not appear, run \`sudo ${command}\`.`;
    }
    return `Linux: run \`sudo ${command}\`.`;
}
function tryMacOsSudoWrite(filePath, content) {
    // Already root → write directly, no sudo needed.
    if (typeof process.getuid === 'function' && process.getuid() === 0) {
        console.log(`[ensure-hosts] Already running as root; writing ${filePath} directly.`);
        writeFileSync(filePath, content, 'utf8');
        console.log(`[ensure-hosts] Updated ${filePath} as root.`);
        return 'written';
    }
    // Check if sudo is available before attempting to prompt.
    const which = spawnSync('which', ['sudo'], { stdio: 'ignore' });
    if (which.status !== 0) {
        return false;
    }
    // Run: sudo -- tee <filePath> with content piped via stdin.
    // sudo reads the password from /dev/tty (the controlling terminal),
    // so the user sees a terminal password prompt. Only tee runs as root;
    // node stays as the normal user, avoiding noowners EPERM on external volumes.
    console.log(`[ensure-hosts] sudo password required to update ${filePath}.`);
    console.log('[ensure-hosts] Only `tee` runs as root; this process stays as the current user.');
    const result = spawnSync('sudo', ['--', 'tee', filePath], {
        input: content,
        encoding: 'utf8',
        stdio: ['pipe', 'ignore', 'inherit'],
    });
    if (result.status === 0) {
        console.log(`[ensure-hosts] sudo tee updated ${filePath}.`);
        return 'written';
    }
    console.log('[ensure-hosts] sudo elevation failed or was cancelled; falling back to GUI prompt...');
    return false;
}
function tryMacOsPrivilegePrompt(options) {
    console.log('[ensure-hosts] Requesting macOS administrator privileges via osascript.');
    console.log('[ensure-hosts] A GUI administrator password dialog will appear; re-running ensure-hosts as root.');
    const rerunArgs = [...withoutElevationArgs(options.args), '--elevated'];
    const command = [shellQuote(process.execPath), shellQuote(options.scriptPath), ...rerunArgs.map(shellQuote)].join(' ');
    const script = `do shell script ${appleScriptString(command)} with administrator privileges`;
    const result = spawnSync('osascript', ['-e', script], {
        cwd: options.cwd,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (result.stdout) {
        process.stdout.write(result.stdout);
    }
    if (result.stderr) {
        process.stderr.write(result.stderr);
    }
    if (result.status === 0) {
        console.log('[ensure-hosts] macOS administrator privileges granted; elevated child completed.');
        return 'spawned';
    }
    const childError = result.stderr?.trim() ?? '';
    // osascript returns exit status 1 both when the user cancels the prompt and
    // when the elevated child exits non-zero. A cancelled prompt produces no
    // child stderr; a failed child leaves our own `[ensure-hosts]` error line.
    // Distinguish them so a real failure isn't misreported as "cancelled".
    const childFailed = /\[ensure-hosts\]|Error/i.test(childError);
    if (result.status === 1 && !childFailed) {
        throw new Error('macOS administrator privilege request was cancelled.');
    }
    const detail = childError ? `\n${childError}` : '';
    throw new Error(`macOS administrator privilege request failed: osascript exit=${result.status}.${detail}`);
}
function tryWindowsPrivilegePrompt(options) {
    console.log('[ensure-hosts] Requesting Windows administrator privileges.');
    const outputPath = join(process.env.TEMP ?? process.env.TMP ?? 'C:\\Windows\\Temp', `ensure-hosts-${process.pid}.log`);
    const rerunArgs = [...withoutElevationArgs(options.args), '--elevated', '--output-file', outputPath];
    const command = [
        'try {',
        `$proc = Start-Process -FilePath ${powerShellString(process.execPath)} -ArgumentList @(${[
            options.scriptPath,
            ...rerunArgs,
        ]
            .map(powerShellString)
            .join(', ')}) -WorkingDirectory ${powerShellString(options.cwd)} -Verb RunAs -Wait -PassThru`,
        'if (Test-Path $env:OUT) { Get-Content $env:OUT -Raw | Write-Output }',
        'exit $proc.ExitCode',
        '} catch {',
        'Write-Error $_',
        'exit 1',
        '}',
    ].join(' ; ');
    const result = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', `$env:OUT = ${powerShellString(outputPath)} ; ${command}`], {
        cwd: options.cwd,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    let capturedOutput = '';
    try {
        capturedOutput = readFileSync(outputPath, 'utf8');
    }
    catch {
        // ignore missing elevated output file
    }
    try {
        unlinkSync(outputPath);
    }
    catch {
        // ignore cleanup errors
    }
    if (capturedOutput) {
        process.stdout.write(capturedOutput);
    }
    if (result.stdout) {
        process.stdout.write(result.stdout);
    }
    if (result.stderr) {
        process.stderr.write(result.stderr);
    }
    if (result.status === 0) {
        console.log('[ensure-hosts] Windows elevated hosts update completed.');
        return 'spawned';
    }
    const detail = [capturedOutput.trim(), result.stderr?.trim() ?? ''].filter(Boolean).join('\n');
    const suffix = detail ? `\n${detail}` : '';
    throw new Error(`Windows administrator privilege request failed or was cancelled: powershell exit=${result.status}.${suffix}`);
}
export function withoutElevationArgs(args) {
    const output = [];
    for (let index = 0; index < args.length; index += 1) {
        const arg = args[index];
        if (arg === '--elevated' || arg === '--no-elevate') {
            continue;
        }
        if (arg === '--output-file') {
            index += 1;
            continue;
        }
        if (arg.startsWith('--output-file=')) {
            continue;
        }
        output.push(arg);
    }
    return output;
}
function shellQuote(value) {
    return `'${value.replaceAll("'", "'\\''")}'`;
}
function appleScriptString(value) {
    return `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
}
function powerShellString(value) {
    return `'${value.replaceAll("'", "''")}'`;
}
//# sourceMappingURL=platform.js.map