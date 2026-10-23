# Asset catalog

A read-only CLI that inspects local files and describes named asset
collections, including ownership, tags, visibility, sizes, and checksums.
It never uploads assets, writes files, or contacts the asset server.
Visibility and origin are catalog metadata, not access controls or uploads.
File paths are relative to the directory from which you run the CLI.

From the repository root:

```sh
bun examples/asset-catalog/src/index.ts --help
bun examples/asset-catalog/src/index.ts --version

# Inspect an asset with an optional display label.
bun examples/asset-catalog/src/index.ts inspect README.md documentation

# Create a collection with a normalized name, required owner, and files.
bun examples/asset-catalog/src/index.ts catalog create Docs README.md LICENSE --owner platform

# Aliases, a boolean cluster, inherited options, arrays, and a negative value.
bun examples/asset-catalog/src/index.ts -vc cat --visibility public new docs README.md LICENSE --owner platform --tag reference,public --tag reviewed --priority -2 --format json

# Disable checksums using boolean negation.
bun examples/asset-catalog/src/index.ts inspect README.md --no-checksum

# Root and nested groups display help without dummy handlers.
bun examples/asset-catalog/src/index.ts
bun examples/asset-catalog/src/index.ts catalog
bun examples/asset-catalog/src/index.ts help catalog create

# A filename starting with '-' can follow the end-of-options marker.
# bun examples/asset-catalog/src/index.ts inspect -- -logo.svg
```

For a shorter command while exploring, define a shell function:

```sh
assets() { bun examples/asset-catalog/src/index.ts "$@"; }
assets inspect README.md --format json
```

## Validation examples

These fail before running the action:

```sh
# Typo suggestion for 'create'.
assets catalog craete

# Allowed-choice and numeric-check errors.
assets catalog create docs README.md --owner platform --visibility secret --priority 99

# Custom resolver error, missing required owner, and asynchronous file check.
assets catalog create 'bad/name' missing.svg

# Option suggestion for '--format'.
assets inspect README.md --formta json
```

The example demonstrates inline parameter definitions, inferred handler
types, reusable snippets, global and inherited flags, command aliases,
handlerless groups, generated help, version handling, choices, fallbacks,
required/optional/rest arguments, custom resolvers, asynchronous validation
and handlers, repeatable arrays, negative numbers, boolean negation,
short-option clusters, diagnostics, and typo suggestions.

The package depends on `vertin` through `workspace:*`. Its local TypeScript
configuration points that import at the library source so you can explore
it without rebuilding the library.
