import { existsSync, readFileSync } from 'node:fs';
import { delimiter, resolve } from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { parse as parseYaml } from 'yaml';
const DEFAULT_ENV_FILE = '.env';
export function parseCliOptions(argv) {
    const options = {
        configPaths: [],
        envFiles: [],
        envFilesExplicit: false,
        envOverrideExplicit: false,
        envFileMissingExplicit: false,
        dryRun: false,
        printRecords: false,
        repeatProfileComments: false,
        remove: false,
        removeForce: false,
        noElevate: false,
        elevated: false,
    };
    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (arg === '--help' || arg === '-h') {
            printHelpAndExit(0);
        }
        if (arg === '--version' || arg === '-v') {
            printVersionAndExit();
        }
        if (arg === '--config') {
            options.configPaths.push(requireValue(argv, ++index, '--config'));
            continue;
        }
        if (arg.startsWith('--config=')) {
            options.configPaths.push(arg.slice('--config='.length));
            continue;
        }
        if (arg === '--env-file') {
            options.envFiles.push(requireValue(argv, ++index, '--env-file'));
            options.envFilesExplicit = true;
            continue;
        }
        if (arg.startsWith('--env-file=')) {
            options.envFiles.push(arg.slice('--env-file='.length));
            options.envFilesExplicit = true;
            continue;
        }
        if (arg === '--env-override') {
            options.envOverride = parseEnvOverrideMode(requireValue(argv, ++index, '--env-override'), '--env-override');
            options.envOverrideExplicit = true;
            continue;
        }
        if (arg.startsWith('--env-override=')) {
            options.envOverride = parseEnvOverrideMode(arg.slice('--env-override='.length), '--env-override');
            options.envOverrideExplicit = true;
            continue;
        }
        if (arg === '--env-file-missing') {
            options.envFileMissing = parseEnvFileMissingMode(requireValue(argv, ++index, '--env-file-missing'), '--env-file-missing');
            options.envFileMissingExplicit = true;
            continue;
        }
        if (arg.startsWith('--env-file-missing=')) {
            options.envFileMissing = parseEnvFileMissingMode(arg.slice('--env-file-missing='.length), '--env-file-missing');
            options.envFileMissingExplicit = true;
            continue;
        }
        if (arg === '--hosts-file') {
            options.hostsFile = requireValue(argv, ++index, '--hosts-file');
            continue;
        }
        if (arg.startsWith('--hosts-file=')) {
            options.hostsFile = arg.slice('--hosts-file='.length);
            continue;
        }
        if (arg === '--output-file') {
            options.outputFile = requireValue(argv, ++index, '--output-file');
            continue;
        }
        if (arg.startsWith('--output-file=')) {
            options.outputFile = arg.slice('--output-file='.length);
            continue;
        }
        if (arg === '--dry-run') {
            options.dryRun = true;
            continue;
        }
        if (arg === '--print-records') {
            options.printRecords = true;
            continue;
        }
        if (arg === '--repeat-profile-comments') {
            options.repeatProfileComments = true;
            continue;
        }
        if (arg === '--remove') {
            options.remove = true;
            continue;
        }
        if (arg === '--remove-force') {
            options.removeForce = true;
            continue;
        }
        if (arg === '--no-elevate') {
            options.noElevate = true;
            continue;
        }
        if (arg === '--elevated') {
            options.elevated = true;
            continue;
        }
        throw new Error(`Unknown option: ${arg}\n\n${usage()}`);
    }
    assertCompatibleModes(options);
    return options;
}
function assertCompatibleModes(options) {
    if (options.remove && options.removeForce) {
        throw new Error(`--remove and --remove-force cannot be used together.\n\n${usage()}`);
    }
    if ((options.remove || options.removeForce) && options.printRecords) {
        throw new Error(`--print-records cannot be combined with --remove or --remove-force.\n\n${usage()}`);
    }
}
export function resolveEnvOverride(options, env = process.env) {
    if (options.envOverride) {
        return options.envOverride;
    }
    const fromEnv = env.ENSURE_HOSTS_ENV_OVERRIDE?.trim();
    if (!fromEnv) {
        return 'overwrite';
    }
    return parseEnvOverrideMode(fromEnv, 'ENSURE_HOSTS_ENV_OVERRIDE');
}
export function resolveEnvFileMissing(options, env = process.env) {
    if (options.envFileMissing) {
        return options.envFileMissing;
    }
    const fromEnv = env.ENSURE_HOSTS_ENV_FILE_MISSING?.trim();
    if (!fromEnv) {
        return 'ignore';
    }
    return parseEnvFileMissingMode(fromEnv, 'ENSURE_HOSTS_ENV_FILE_MISSING');
}
export function loadDefaultEnv(optionsOrEnvFiles, overrideMode = 'overwrite', missingMode = 'ignore') {
    const envFiles = resolveEnvFilesToLoad(optionsOrEnvFiles);
    for (const envFile of envFiles) {
        const resolved = resolve(envFile);
        if (!existsSync(resolved)) {
            if (missingMode === 'error') {
                throw new Error(`Environment file not found: ${resolved}`);
            }
            continue;
        }
        loadDotenv({ path: resolved, override: overrideMode === 'overwrite' });
    }
}
function resolveEnvFilesToLoad(optionsOrEnvFiles) {
    if (typeof optionsOrEnvFiles === 'string') {
        return [optionsOrEnvFiles];
    }
    if (Array.isArray(optionsOrEnvFiles)) {
        return optionsOrEnvFiles;
    }
    return optionsOrEnvFiles.envFilesExplicit ? optionsOrEnvFiles.envFiles : [DEFAULT_ENV_FILE];
}
export function resolveConfigPaths(options, env = process.env) {
    if (options.configPaths.length > 0) {
        return options.configPaths.map(path => resolve(path));
    }
    const fromEnv = env.ENSURE_HOSTS_CONFIG?.trim();
    if (!fromEnv) {
        throw new Error(`No config file provided. Use --config <path> or set ENSURE_HOSTS_CONFIG.\n\n${usage()}`);
    }
    return splitPathList(fromEnv).map(path => resolve(path));
}
export function resolveHostsFileOverride(options, env = process.env) {
    return options.hostsFile ?? env.ENSURE_HOSTS_HOSTS_FILE;
}
export function resolveNoElevate(options, env = process.env) {
    return options.noElevate || parseBooleanEnv(env.ENSURE_HOSTS_NO_ELEVATE);
}
/**
 * Rebuild the CLI args for an elevated child process from already-resolved
 * (absolute) paths. The elevated re-spawn runs in a different working
 * directory than the parent (osascript's `do shell script` starts in `/`),
 * so any relative path the user passed would fail to resolve in the child.
 * Passing absolute paths fixes that without changing the public CLI surface.
 *
 * Elevation-only flags (`--no-elevate`, `--elevated`) and `--output-file`
 * (Windows elevated-output plumbing) are intentionally omitted: the child is
 * re-elevated/redirected by the elevation layer itself, not by these flags.
 */
export function buildElevationArgs(options, configPaths) {
    const args = [];
    for (const configPath of configPaths) {
        args.push('--config', resolve(configPath));
    }
    // Only forward --env-file when the user explicitly set it. Node 20.6+ treats
    // --env-file as its own flag (even after the script path) and exits with an
    // error if the file is missing, so emitting it unconditionally would crash
    // the elevated child whenever the default .env is absent.
    if (options.envFilesExplicit) {
        for (const envFile of options.envFiles) {
            args.push('--env-file', resolve(envFile));
        }
    }
    if (options.envOverrideExplicit && options.envOverride) {
        args.push('--env-override', options.envOverride);
    }
    if (options.envFileMissingExplicit && options.envFileMissing) {
        args.push('--env-file-missing', options.envFileMissing);
    }
    if (options.hostsFile) {
        args.push('--hosts-file', resolve(options.hostsFile));
    }
    if (options.dryRun) {
        args.push('--dry-run');
    }
    if (options.printRecords) {
        args.push('--print-records');
    }
    if (options.repeatProfileComments) {
        args.push('--repeat-profile-comments');
    }
    if (options.remove) {
        args.push('--remove');
    }
    if (options.removeForce) {
        args.push('--remove-force');
    }
    return args;
}
export function loadProfiles(configPaths) {
    return configPaths.map(configPath => loadProfile(configPath));
}
export function loadProfile(configPath, env = process.env) {
    if (!/\.ya?ml$/i.test(configPath)) {
        throw new Error(`Config file must be .yaml or .yml: ${configPath}`);
    }
    const content = readFileSync(configPath, 'utf8');
    const interpolated = interpolateEnv(content, env);
    const parsed = parseYaml(interpolated);
    return normalizeProfile(parsed, configPath);
}
export function interpolateEnv(content, env = process.env, warn = message => console.warn(message)) {
    const warned = new Set();
    return content.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)(?:(:-|-)([^}]*))?\}/g, (_match, name, operator, defaultValue) => {
        const value = env[name];
        const isSet = value !== undefined;
        const isEmpty = value === '';
        if (operator === ':-') {
            return isSet && !isEmpty ? value : defaultValue;
        }
        if (operator === '-') {
            return isSet ? value : defaultValue;
        }
        if (isSet) {
            return value;
        }
        if (!warned.has(name)) {
            warned.add(name);
            warn(`[ensure-hosts] Environment variable ${name} is not set; substituting an empty string.`);
        }
        return '';
    });
}
function normalizeProfile(value, configPath) {
    if (!isRecord(value)) {
        throw new Error(`Config must be a YAML object: ${configPath}`);
    }
    const profile = requireString(value.profile, 'profile', configPath);
    const hostsValue = value.hosts;
    if (!Array.isArray(hostsValue)) {
        throw new Error(`Config field "hosts" must be an array: ${configPath}`);
    }
    return {
        profile,
        hosts: hostsValue.map((host, index) => normalizeHostNode(host, `${configPath}:hosts[${index}]`)),
    };
}
function normalizeHostNode(value, location) {
    if (typeof value === 'string') {
        return { domain: value };
    }
    if (!isRecord(value)) {
        throw new Error(`Host entry must be an object or string: ${location}`);
    }
    const domain = requireString(value.domain, 'domain', location);
    const node = { domain };
    if (value.address !== undefined) {
        node.address = requireString(value.address, 'address', location);
    }
    if (value.rewrite !== undefined) {
        node.rewrite = requireBoolean(value.rewrite, 'rewrite', location);
    }
    if (value.skipSelf !== undefined) {
        node.skipSelf = requireBoolean(value.skipSelf, 'skipSelf', location);
    }
    if (value.children !== undefined) {
        if (!Array.isArray(value.children)) {
            throw new Error(`Field "children" must be an array: ${location}`);
        }
        node.children = value.children.map((child, index) => normalizeHostNode(child, `${location}.children[${index}]`));
    }
    return node;
}
function splitPathList(value) {
    return value
        .split(/[,\n]/g)
        .flatMap(part => part.split(delimiter))
        .map(part => part.trim())
        .filter(Boolean);
}
function requireValue(argv, index, option) {
    const value = argv[index];
    if (!value || value.startsWith('--')) {
        throw new Error(`${option} requires a value.`);
    }
    return value;
}
function requireString(value, field, location) {
    if (typeof value !== 'string' || value.trim() === '') {
        throw new Error(`Field "${field}" must be a non-empty string: ${location}`);
    }
    return value.trim();
}
function requireBoolean(value, field, location) {
    if (typeof value !== 'boolean') {
        throw new Error(`Field "${field}" must be a boolean: ${location}`);
    }
    return value;
}
function parseBooleanEnv(value) {
    if (!value) {
        return false;
    }
    return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}
function parseEnvOverrideMode(value, source) {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'overwrite' || normalized === 'respect') {
        return normalized;
    }
    throw new Error(`${source} must be one of: overwrite, respect.`);
}
function parseEnvFileMissingMode(value, source) {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'ignore' || normalized === 'error') {
        return normalized;
    }
    throw new Error(`${source} must be one of: ignore, error.`);
}
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function printHelpAndExit(code) {
    console.log(usage());
    process.exit(code);
}
function printVersionAndExit() {
    console.log(packageVersion());
    process.exit(0);
}
export function packageVersion() {
    const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    if (typeof packageJson.version !== 'string' || packageJson.version.trim() === '') {
        throw new Error('package.json must define a non-empty version.');
    }
    return packageJson.version;
}
export function usage() {
    return [
        'Usage: ensure-hosts --config <path> [--config <path> ...] [options]',
        '',
        'Options:',
        '  --config <path>      YAML/YML config file path (repeatable)',
        '  --env-file <path>    dotenv file path (default: .env, repeatable)',
        '  --env-override <mode>  dotenv collision mode: overwrite|respect (default: overwrite)',
        '  --env-file-missing <mode>  missing dotenv mode: ignore|error (default: ignore)',
        '  --hosts-file <path>  override hosts file path',
        '  --dry-run            print rewritten hosts content without writing',
        '  --print-records      print expanded records and exit',
        '  --repeat-profile-comments  repeat profile comment before every generated host line',
        '  --remove             remove rewrite:true domains (respects rewrite:false)',
        '  --remove-force       remove all listed domains, including rewrite:false',
        '  --no-elevate         disable macOS/Windows privilege prompt',
        '  --help               show help',
        '  --version            show version',
        '',
        '--remove and --remove-force are mutually exclusive and cannot be combined',
        'with --print-records.',
    ].join('\n');
}
//# sourceMappingURL=config.js.map