import { app, check, cmd, snippet } from 'vertin'

// A read-only asset catalog: inspect local files, then describe a collection.
// It never uploads assets, writes files, or contacts the asset server.

interface _Asset {
  readonly path: string
  readonly bytes: number
  readonly sha256?: string
}

function parse_collection(raw: string): string {
  const name = raw.trim().toLowerCase()
  if (!/^[a-z][a-z0-9-]*$/.test(name)) {
    throw new Error('Use a collection name like docs or brand-assets')
  }
  return name
}

async function missing_files(paths: readonly string[]): Promise<string[]> {
  const exists = await Promise.all(
    paths.map((path) => Bun.file(path).exists()),
  )
  return paths.filter((_, index) => !exists[index])
}

async function describe_file(
  path: string,
  checksum: boolean,
): Promise<_Asset> {
  const bytes = await Bun.file(path).bytes()
  return {
    path,
    bytes: bytes.byteLength,
    sha256: checksum
      ? new Bun.CryptoHasher('sha256').update(bytes).digest('hex')
      : undefined,
  }
}

function output(
  format: 'text' | 'json',
  data: unknown,
  lines: readonly string[],
): void {
  console.log(
    format === 'json' ? JSON.stringify(data, null, 2) : lines.join('\n'),
  )
}

// Mount once globally; reuse the same snippet for typed handler access.
const common = snippet({
  flags: {
    verbose: {
      alias: 'v',
      resolver: Boolean,
      fallback: false,
      desc: 'Log progress to stderr',
    },
    format: {
      alias: 'f',
      choices: ['text', 'json'],
      fallback: 'text',
      desc: 'Output format',
    },
  },
})

const content = snippet({
  flags: {
    checksum: {
      alias: 'c',
      resolver: Boolean,
      fallback: true,
      desc: 'Calculate SHA-256 checksums',
    },
  },
})

// These flags belong to the catalog group and are inherited by create.
const catalog_options = snippet({
  flags: {
    visibility: {
      choices: ['internal', 'public'],
      fallback: 'internal',
      desc: 'Intended collection visibility (metadata only)',
    },
    origin: {
      resolver: (raw) => new URL(raw),
      fallback: new URL('https://assets.example.com'),
      desc: 'Asset server origin (recorded only; no requests are made)',
      check: check<URL>(
        ({ value }) =>
          value.protocol === 'https:' || 'Asset origin must use HTTPS',
      ),
    },
  },
})

const create = cmd(
  {
    alias: 'new',
    desc: 'Describe a named collection of existing local files',
    use: [common, content, catalog_options],
    args: {
      collection: {
        resolver: parse_collection,
        desc: 'Collection name, e.g. docs or brand-assets',
      },
      files: {
        resolver: [String],
        desc: 'One or more local asset paths',
        check: check<string[]>(async ({ value }) => {
          const missing = await missing_files(value)
          return (
            missing.length === 0 || `Files not found: ${missing.join(', ')}`
          )
        }),
      },
    },
    flags: {
      owner: {
        alias: 'o',
        required: true,
        desc: 'Team responsible for the collection',
        check: check<string>(
          ({ value }) => value.trim().length > 0 || 'Owner cannot be empty',
        ),
      },
      tag: {
        alias: 't',
        resolver: [String],
        fallback: [],
        desc: 'Collection tags; repeat or separate with commas',
      },
      priority: {
        resolver: Number,
        fallback: 0,
        desc: 'Collection display priority, from -10 to 10',
        check: check<number>(
          ({ value }) =>
            (Number.isInteger(value) && value >= -10 && value <= 10) ||
            'Priority must be an integer from -10 to 10',
        ),
      },
    },
  },
  async (ctx) => {
    if (ctx.flags.verbose) {
      console.error(
        `Inspecting ${ctx.args.files.length} asset(s) for ${ctx.args.collection}`,
      )
    }
    const assets = await Promise.all(
      ctx.args.files.map((path) => describe_file(path, ctx.flags.checksum)),
    )
    const result = {
      collection: ctx.args.collection,
      visibility: ctx.flags.visibility,
      origin: ctx.flags.origin.origin,
      owner: ctx.flags.owner,
      priority: ctx.flags.priority,
      tags: ctx.flags.tag,
      assets,
    }
    output(ctx.flags.format, result, [
      `Collection ${result.collection} (${result.visibility})`,
      `Asset origin: ${result.origin}`,
      `Owner: ${result.owner}; priority: ${result.priority}`,
      `Tags: ${result.tags.join(', ') || '(none)'}`,
      ...assets.map(
        (file) =>
          `  ${file.path} (${file.bytes} bytes)${file.sha256 ? ` ${file.sha256}` : ''}`,
      ),
    ])
  },
)

const inspect = cmd(
  {
    alias: 'i',
    desc: 'Inspect a local asset before adding it to a collection',
    use: [common, content],
    args: {
      file: {
        desc: 'Local file path',
        check: check<string>(
          async ({ value }) =>
            (await Bun.file(value).exists()) || `File not found: ${value}`,
        ),
      },
      label: { required: false, desc: 'Optional display label' },
    },
  },
  async (ctx) => {
    if (ctx.flags.verbose) console.error(`Reading ${ctx.args.file}`)
    const asset = await describe_file(ctx.args.file, ctx.flags.checksum)
    output(ctx.flags.format, { label: ctx.args.label, ...asset }, [
      `${ctx.args.label ?? asset.path}: ${asset.bytes} bytes`,
      `SHA-256: ${asset.sha256 ?? '(disabled)'}`,
    ])
  },
)

await app({
  desc: 'Inspect local assets and generate collection catalogs',
  ver: '1.0.0',
  flags: common.flags,
  sub: {
    inspect,
    catalog: cmd({
      alias: 'cat',
      desc: 'Organize files into named asset collections',
      use: [catalog_options],
      sub: { create },
    }),
  },
}).run()
