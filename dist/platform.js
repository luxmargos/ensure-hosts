import { readFileSync, unlinkSync } from 'node:fs';
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
        return tryMacOsPrivilegePrompt(options);
    }
    if (platform() === 'win32') {
        return tryWindowsPrivilegePrompt(options);
    }
    return false;
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
function tryMacOsPrivilegePrompt(options) {
    console.log('[ensure-hosts] Requesting macOS administrator privileges.');
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
        return true;
    }
    if (result.status === 1) {
        throw new Error('macOS administrator privilege request was cancelled.');
    }
    throw new Error(`macOS administrator privilege request failed: osascript exit=${result.status}`);
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
        return true;
    }
    throw new Error(`Windows administrator privilege request failed or was cancelled: powershell exit=${result.status}`);
}
function withoutElevationArgs(args) {
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