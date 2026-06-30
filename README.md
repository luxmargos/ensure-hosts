# @luxmargos/ensure-hosts

Manage local hosts-file entries on macOS, Linux, and Windows from small YAML profiles.

`ensure-hosts` expands a YAML file into hosts-file records, removes stale records for the same domains when requested, and appends the current records. It is useful for local development domains such as `api.myapp.test`, `admin.myapp.test`, and other repeatable project setup.

## Why use it?

- Keep project hostnames in versioned YAML instead of editing `/etc/hosts` by hand.
- Re-run the same command safely when project IPs or domains change.
- Preview changes before writing with `--dry-run`.
- Remove a profile's entries when you no longer need them.
- Share one base config plus project-specific configs.

## Requirements

- Node.js 20 or newer
- Permission to write the system hosts file when not using `--dry-run`

Default hosts-file locations:

- Linux/macOS: `/etc/hosts`
- Windows: `%SystemRoot%\System32\drivers\etc\hosts`

## Install

```sh
npm install -g @luxmargos/ensure-hosts
```

Then check the CLI is available:

```sh
ensure-hosts --version
```

## Quick start

1. Create a config file, for example `hosts.local.yaml`:

   ```yaml
   profile: MYAPP_LOCAL
   hosts:
     - domain: myapp.test
       address: 127.0.0.1
       children:
         - api
         - admin
   ```

2. Preview what would be written:

   ```sh
   ensure-hosts --config ./hosts.local.yaml --dry-run
   ```

3. Apply the changes:

   ```sh
   ensure-hosts --config ./hosts.local.yaml
   ```

   On macOS and Windows, the CLI can prompt for administrator permission when needed. On Linux, run with `sudo` if your user cannot write `/etc/hosts`:

   ```sh
   sudo ensure-hosts --config ./hosts.local.yaml
   ```

The example above writes records like:

```txt
# MYAPP_LOCAL
127.0.0.1 myapp.test
# MYAPP_LOCAL
127.0.0.1 api.myapp.test
# MYAPP_LOCAL
127.0.0.1 admin.myapp.test
```

## Common commands

```sh
# Use one config
ensure-hosts --config ./hosts.local.yaml

# Layer multiple configs
ensure-hosts --config ./base.yaml --config ./project.yaml

# Preview the final hosts file without writing
ensure-hosts --config ./hosts.local.yaml --dry-run

# Print the expanded records only
ensure-hosts --config ./hosts.local.yaml --print-records

# Remove entries managed by rewrite:true records
ensure-hosts --config ./hosts.local.yaml --remove

# Remove every domain listed by the config, including rewrite:false records
ensure-hosts --config ./hosts.local.yaml --remove-force
```

## Configuration reference

A config file must be `.yaml` or `.yml` and contain:

```yaml
profile: PROFILE_NAME
hosts:
  - domain: some.domain.test
    address: 192.168.1.111
    rewrite: true
    skipSelf: false
    children:
      - sitea
      - domain: siteb
        address: ::1
```

Fields:

| Field | Required? | Description |
| --- | --- | --- |
| `profile` | Yes | Label written as a comment above generated entries, for example `# MYAPP_LOCAL`. |
| `hosts` | Yes | Array of host entries. |
| `domain` | Yes | Domain name. Inside `children`, this can be a relative subdomain such as `api`. |
| `address` | For records you want written | IPv4 or IPv6 address. Children inherit the parent address unless they set their own. |
| `rewrite` | No | Whether existing entries for the same domain may be cleaned before appending. Defaults to `true`. Children inherit the parent value. |
| `skipSelf` | No | Skip writing this node while still processing its children. Defaults to `false`. |
| `children` | No | Nested subdomains as strings or full objects. |

### Child domains

Child strings inherit the parent address and `rewrite` value:

```yaml
profile: LOCAL
hosts:
  - domain: example.test
    address: 127.0.0.1
    children:
      - api
      - admin
```

This writes:

- `example.test`
- `api.example.test`
- `admin.example.test`

If a child already contains the full parent domain, it is not duplicated. For example, `api.example.test` stays `api.example.test`.

### `skipSelf` example

Use `skipSelf: true` when you only want child records:

```yaml
profile: LOCAL
hosts:
  - domain: example.test
    address: 127.0.0.1
    skipSelf: true
    children:
      - api
      - admin
```

This writes `api.example.test` and `admin.example.test`, but not `example.test`.

## How rewriting works

By default, `rewrite` is `true`.

With `rewrite: true`, `ensure-hosts`:

1. Removes existing hosts entries for the same domain.
2. Removes stale adjacent `# PROFILE_NAME` comments left by previous runs.
3. Appends the current generated entry when an address is available.

With `rewrite: false`, `ensure-hosts`:

1. Leaves existing entries for the same domain untouched.
2. Appends the generated entry only if that domain is not already present.

Entries without an effective `address` are not written. If their effective `rewrite` value is `true`, matching existing entries can still be cleaned.

## Remove mode

Use remove mode when you want to uninstall entries from a profile instead of ensuring them.

```sh
ensure-hosts --config ./hosts.local.yaml --remove
ensure-hosts --config ./hosts.local.yaml --remove-force
ensure-hosts --config ./hosts.local.yaml --remove --dry-run
```

- `--remove` removes domains whose effective `rewrite` value is `true`. Domains marked `rewrite: false` are left untouched.
- `--remove-force` removes every domain listed by the config, including `rewrite: false` domains.

`--remove` and `--remove-force` cannot be used together, and neither can be combined with `--print-records`.

## Environment variables

The CLI automatically loads `.env` from the current working directory. Missing `.env` files and missing environment variables are ignored.

You can provide config paths with `ENSURE_HOSTS_CONFIG` instead of `--config`:

```dotenv
ENSURE_HOSTS_CONFIG=./hosts.local.yaml,./another.yaml
```

You can also override the hosts file path, which is useful for tests or custom workflows:

```dotenv
ENSURE_HOSTS_HOSTS_FILE=./tmp-hosts
```

To disable macOS/Windows elevation prompts:

```dotenv
ENSURE_HOSTS_NO_ELEVATE=true
```

Use `--env-file <path>` if your dotenv file is not named `.env`.

## CLI options

```txt
--config <path>      YAML/YML config file path (repeatable)
--env-file <path>    dotenv file path (default: .env)
--hosts-file <path>  override hosts file path
--dry-run            print rewritten hosts content without writing
--print-records      print expanded records and exit
--remove             remove rewrite:true domains (respects rewrite:false)
--remove-force       remove all listed domains, including rewrite:false
--no-elevate         disable macOS/Windows privilege prompt
--help               show help
--version            show version
```

Notes:

- On Linux, `--no-elevate` is effectively a no-op because Linux does not use an in-process elevation prompt. Run the command with `sudo` when needed.
- Use `--hosts-file` or `ENSURE_HOSTS_HOSTS_FILE` to test against a temporary file instead of the real hosts file.

## Development

Install dependencies:

```sh
npm install
```

Run checks:

```sh
npm test
npm run typecheck
npm run build
```

The repository also includes a Docker-based Linux test harness (`Dockerfile.linux-test` and `compose.linux-test.yaml`). These files are for testing only, not production.

```sh
# Run the unit test suite in a Linux container
docker compose -f compose.linux-test.yaml run --rm test

# Typecheck and build
docker compose -f compose.linux-test.yaml run --rm typecheck
docker compose -f compose.linux-test.yaml run --rm build

# Exercise CLI scenarios
docker compose -f compose.linux-test.yaml run --rm dry-run
docker compose -f compose.linux-test.yaml run --rm print-records
docker compose -f compose.linux-test.yaml run --rm root-write
docker compose -f compose.linux-test.yaml run --rm etc-hosts-write
docker compose -f compose.linux-test.yaml run --rm non-root-fail
docker compose -f compose.linux-test.yaml run --rm remove
```

The `root-write`, `non-root-fail`, and `remove` services use `--hosts-file /tmp/test-hosts`, so the real `/etc/hosts` is not modified. The `etc-hosts-write` service writes to the container's ephemeral `/etc/hosts`, not your host machine.

## License

MIT
