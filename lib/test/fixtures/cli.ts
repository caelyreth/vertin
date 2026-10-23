import { app, args, cmd, flags } from '../../src/index'

await app({
  ver: '1.2.3',
  desc: 'Fixture CLI',
  main: cmd(
    {
      args: args({
        name: {},
      }),
      flags: flags({
        count: { resolver: Number, fallback: 1 },
        fail: { resolver: Boolean, fallback: false },
      }),
    },
    (ctx) => {
      if (ctx.flags.fail) throw new Error('fixture failed')
      console.log(
        JSON.stringify({
          name: ctx.args.name,
          count: ctx.flags.count,
        }),
      )
    },
  ),
}).run()
