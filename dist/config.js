import { existsSync, readFileSync } from 'node:fs';
import { delimiter, resolve } from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { parse as parseYaml } from 'yaml';
const DEFAULT_ENV_FILE = '.env';
export function parseCliOptions(argv) {
    const options = {
        configPaths: [],
        envFile: DEFAULT_ENV_FILE,
        dryRun: false,
        printRecords: false,
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
            options.envFile = requireValue(argv, ++index, '--env-file');
            continue;
        }
        if (arg.startsWith('--env-file=')) {
            options.envFile = arg.slice('--env-file='.length);
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
    return options;
}
export function loadDefaultEnv(envFile) {
    const resolved = resolve(envFile);
    if (!existsSync(resolved)) {
        return;
    }
    loadDotenv({ path: resolved, override: false });
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
export function loadProfiles(configPaths) {
    return configPaths.map(loadProfile);
}
export function loadProfile(configPath) {
    if (!/\.ya?ml$/i.test(configPath)) {
        throw new Error(`Config file must be .yaml or .yml: ${configPath}`);
    }
    const content = readFileSync(configPath, 'utf8');
    const parsed = parseYaml(content);
    return normalizeProfile(parsed, configPath);
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
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function printHelpAndExit(code) {
    console.log(usage());
    process.exit(code);
}
function printVersionAndExit() {
    console.log('0.1.0');
    process.exit(0);
}
export function usage() {
    return [
        'Usage: ensure-hosts --config <path> [--config <path> ...] [options]',
        '',
        'Options:',
        '  --config <path>      YAML/YML config file path (repeatable)',
        '  --env-file <path>    dotenv file path (default: .env)',
        '  --hosts-file <path>  override hosts file path',
        '  --dry-run            print rewritten hosts content without writing',
        '  --print-records      print expanded records and exit',
        '  --no-elevate         disable macOS/Windows privilege prompt',
        '  --help               show help',
        '  --version            show version',
    ].join('\n');
}
//# sourceMappingURL=config.js.map