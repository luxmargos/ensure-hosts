# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project follows semantic versioning.

## [Unreleased]

- No unreleased changes yet.

## [0.1.3] - 2026-07-01

### Added

- `--repeat-profile-comments` to opt into writing the profile label before every generated hosts line.

### Changed

- Generated hosts entries now group profile comments once per contiguous managed block by default.

## [0.1.2] - 2026-07-01

### Fixed

- `--version` now reads from package metadata instead of a hard-coded value.

## [0.1.1] - 2026-07-01

### Added

- Documentation for the flat list config layout as an alternative to nested `children`.
- Quick start example showing both subdomains and flat list styles.

## [0.1.0] - 2026-06-30

### Added

- Initial `@luxmargos/ensure-hosts` CLI package.
- YAML profile support for managing local hosts-file entries.
- Support for macOS, Linux, and Windows hosts-file paths.
- Repeatable `--config` option for layering multiple YAML configs.
- `.env` loading, including `ENSURE_HOSTS_CONFIG`, `ENSURE_HOSTS_HOSTS_FILE`, and `ENSURE_HOSTS_NO_ELEVATE` support.
- `--dry-run` mode to preview rewritten hosts-file content without writing.
- `--print-records` mode to inspect expanded host records.
- Nested child domain expansion with inherited `address` and `rewrite` settings.
- `rewrite` behavior for cleaning stale same-domain entries before appending current records.
- `skipSelf` support for processing children without writing the parent domain.
- `--remove` and `--remove-force` modes for uninstalling profile entries.
- macOS elevation support with `sudo tee` and `osascript` fallback.
- Windows UAC elevation support.
- Linux root-write handling and permission guidance.
- Docker-based Linux test harness for unit tests, CLI scenarios, root writes, and permission-failure checks.
- User-friendly README with quick start, configuration reference, environment variables, and development instructions.

### Fixed

- Elevated re-spawn path handling so relative config paths continue to work after privilege elevation.
- Elevation result handling for `sudo tee` writes.
- Linux non-root permission error messaging with a `sudo ensure-hosts ...` hint.
