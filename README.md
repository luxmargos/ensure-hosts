# @luxmargos/ensure-hosts

TypeScript CLI for managing local hosts-file entries from YAML profiles.

## Install

```sh
npm install -g @luxmargos/ensure-hosts
```

## Usage

```sh
ensure-hosts --config ./hosts.local.yaml
ensure-hosts --config ./base.yaml --config ./project.yaml
ensure-hosts --config ./hosts.local.yaml --dry-run
ensure-hosts --config ./hosts.local.yaml --print-records
ensure-hosts --config ./hosts.local.yaml --remove
ensure-hosts --config ./hosts.local.yaml --remove-force
```

The CLI loads `.env` from the current working directory by default. Missing `.env` files and missing environment variables are ignored.

Config paths must be provided with `--config`, or by `ENSURE_HOSTS_CONFIG` in `.env`/environment:

```dotenv
ENSURE_HOSTS_CONFIG=./hosts.local.yaml,./another.yaml
```

## YAML config

Canonical field names use camelCase for compound names.

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

Generated entries are appended like this:

```txt
# PROFILE_NAME
192.168.1.111 some.domain.test
# PROFILE_NAME
192.168.1.111 sitea.some.domain.test
# PROFILE_NAME
::1 siteb.some.domain.test
```

## Fields

- `profile`: comment label used above generated entries.
- `hosts`: top-level host mapping array.
- `domain`: root domain, or relative subdomain when nested under `children`.
- `address`: IPv4 or IPv6 address.
- `rewrite`: remove existing same-domain entries before appending. Default: `true`.
- `skipSelf`: skip writing the current node while still processing children. Default: `false`.
- `children`: nested subdomains as strings or objects.

A child string inherits its parent address and rewrite setting:

```yaml
profile: LOCAL
hosts:
  - domain: example.test
    address: 127.0.0.1
    children:
      - api
      - admin
```

This writes `example.test`, `api.example.test`, and `admin.example.test`.

Entries without an effective `address` are not written. If `rewrite` is `true`, they are still cleaned from existing hosts content.

## Rewrite behavior

`rewrite: true` (default):

- Removes existing hosts tokens/lines for the same domain.
- Removes stale adjacent `# PROFILE_NAME` comments.
- Appends the generated entry when an address is available.

`rewrite: false`:

- Does not remove, comment, or alter existing same-domain lines.
- Appends a generated entry only when the domain is absent and an address is available.

## Remove mode

The default action ensures the listed domains are present. Two flags do the
inverse — remove the listed domains without appending anything:

```sh
ensure-hosts --config ./hosts.local.yaml --remove
ensure-hosts --config ./hosts.local.yaml --remove-force
ensure-hosts --config ./hosts.local.yaml --remove --dry-run
```

- `--remove` strips the domains declared `rewrite: true` (the same set ensure
  cleans up), along with their stale `# PROFILE_NAME` comments. Domains
  declared `rewrite: false` are left untouched, consistent with their
  "do not alter existing entries" contract.
- `--remove-force` strips **every** domain the config lists, including
  `rewrite: false` entries. Use this to fully uninstall a profile's entries.

Both flags also attempt privilege elevation when writing the real hosts file.
On macOS, the CLI first tries `sudo tee` (a terminal password prompt,
like `mkcert`), then falls back to an `osascript` GUI administrator prompt.
On Windows, a UAC elevation prompt is shown. `--remove` and `--remove-force`
are mutually exclusive and cannot be combined with `--print-records`.

## Options

```txt
--config <path>      YAML/YML config file path (repeatable)
--env-file <path>    dotenv file path (default: .env)
--hosts-file <path>  override hosts file path
--dry-run            print rewritten hosts content without writing
--print-records      print expanded records and exit
--remove             remove rewrite:true domains (respects rewrite:false)
--remove-force       remove all listed domains, including rewrite:false
--no-elevate         disable sudo/osascript (macOS) or UAC (Windows) privilege prompt
--help               show help
--version            show version
```

## Hosts file paths

By default, the CLI writes to:

- Linux/macOS: `/etc/hosts`
- Windows: `%SystemRoot%\\System32\\drivers\\etc\\hosts`

Use `--hosts-file` or `ENSURE_HOSTS_HOSTS_FILE` to override the path for tests/custom workflows.
