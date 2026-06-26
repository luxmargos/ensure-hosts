#!/usr/bin/env node
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildElevationArgs, loadDefaultEnv, loadProfiles, parseCliOptions, resolveConfigPaths, resolveHostsFileOverride, resolveNoElevate, } from './config.js';
import { expandProfiles } from './domain-map.js';
import { removeHostsContent, rewriteHostsContent } from './hosts.js';
import { elevatedCommandHint, resolveDefaultHostsPath, tryElevate } from './platform.js';
async function main() {
    const options = parseCliOptions(process.argv.slice(2));
    if (options.outputFile) {
        redirectConsoleToFile(options.outputFile);
    }
    loadDefaultEnv(options.envFile);
    const configPaths = resolveConfigPaths(options);
    const profiles = loadProfiles(configPaths);
    const expandedProfiles = expandProfiles(profiles);
    if (options.printRecords) {
        printRecords(expandedProfiles);
        return;
    }
    if (options.remove || options.removeForce) {
        return runRemove(options, configPaths, expandedProfiles);
    }
    const hostsFile = resolveHostsFileOverride(options) ?? resolveDefaultHostsPath();
    const hostsContent = readFileSync(hostsFile, 'utf8');
    const result = rewriteHostsContent(hostsContent, expandedProfiles);
    if (options.dryRun) {
        process.stdout.write(result.content);
        return;
    }
    if (result.content === hostsContent) {
        console.log('[ensure-hosts] hosts file is already up to date.');
        return;
    }
    try {
        writeFileSync(hostsFile, result.content, 'utf8');
    }
    catch (error) {
        if (isPermissionError(error)) {
            const elevated = tryElevate({
                scriptPath: fileURLToPath(import.meta.url),
                args: buildElevationArgs(options, configPaths),
                cwd: process.cwd(),
                noElevate: resolveNoElevate(options),
                elevated: options.elevated,
                dryRun: options.dryRun,
                printRecords: options.printRecords,
            });
            if (elevated) {
                return;
            }
            throw new Error([
                `Permission denied while writing hosts file: ${hostsFile}`,
                'Run again with administrator/root privileges.',
                elevatedCommandHint(`ensure-hosts --config ${configPaths.join(' --config ')}`),
            ].join('\n'));
        }
        throw error;
    }
    console.log(`[ensure-hosts] updated ${hostsFile}: appended ${result.appended.length}, cleaned ${result.removedDomains.length}.`);
}
function runRemove(options, configPaths, expandedProfiles) {
    const force = options.removeForce;
    const hostsFile = resolveHostsFileOverride(options) ?? resolveDefaultHostsPath();
    const hostsContent = readFileSync(hostsFile, 'utf8');
    const result = removeHostsContent(hostsContent, expandedProfiles, { force });
    if (options.dryRun) {
        process.stdout.write(result.content);
        return;
    }
    if (result.content === hostsContent) {
        console.log('[ensure-hosts] hosts file has no matching entries to remove.');
        return;
    }
    try {
        writeFileSync(hostsFile, result.content, 'utf8');
    }
    catch (error) {
        if (isPermissionError(error)) {
            const elevated = tryElevate({
                scriptPath: fileURLToPath(import.meta.url),
                args: buildElevationArgs(options, configPaths),
                cwd: process.cwd(),
                noElevate: resolveNoElevate(options),
                elevated: options.elevated,
                dryRun: options.dryRun,
                printRecords: options.printRecords,
            });
            if (elevated) {
                return;
            }
            const modeFlag = force ? '--remove-force' : '--remove';
            throw new Error([
                `Permission denied while writing hosts file: ${hostsFile}`,
                'Run again with administrator/root privileges.',
                elevatedCommandHint(`ensure-hosts --config ${configPaths.join(' --config ')} ${modeFlag}`),
            ].join('\n'));
        }
        throw error;
    }
    const modeLabel = force ? ' (force)' : '';
    console.log(`[ensure-hosts] removed ${result.removedDomains.length} domain(s) from ${hostsFile}${modeLabel}.`);
}
function printRecords(expandedProfiles) {
    for (const profile of expandedProfiles) {
        for (const record of profile.records) {
            console.log(`${record.address}\t${record.domain}\t# ${record.profile}\trewrite=${record.rewrite}`);
        }
    }
}
function redirectConsoleToFile(filePath) {
    const write = (text) => appendFileSync(filePath, text);
    const line = (args) => `${args.map(arg => (typeof arg === 'string' ? arg : String(arg))).join(' ')}\n`;
    console.log = (...args) => write(line(args));
    console.info = console.log;
    console.warn = (...args) => write(line(args));
    console.error = (...args) => write(line(args));
    process.stdout.write = ((chunk) => {
        write(typeof chunk === 'string' ? chunk : chunk.toString());
        return true;
    });
    process.stderr.write = ((chunk) => {
        write(typeof chunk === 'string' ? chunk : chunk.toString());
        return true;
    });
}
function isPermissionError(error) {
    return (typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error.code === 'EACCES' || error.code === 'EPERM'));
}
main().catch(error => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[ensure-hosts] ${message}`);
    process.exit(1);
});
//# sourceMappingURL=cli.js.map