import { describe, expect, it } from 'vitest'

import {
  err,
  is_err,
  is_ok,
  map_err,
  map_ok,
  ok,
  unwrap_or,
} from '../src/utils'

describe('result utilities', () => {
  it('creates, narrows, maps, and unwraps result values', () => {
    const good = ok(2)
    const bad = err(['missing'])

    expect(is_ok(good)).toBe(true)
    expect(is_err(bad)).toBe(true)
    expect(map_ok(good, (value) => value * 3)).toEqual(ok(6))
    expect(map_ok(bad, (value: number) => value * 3)).toBe(bad)
    expect(map_err(bad, (errors) => errors.join(', '))).toEqual(
      err('missing'),
    )
    expect(map_err(good, (errors: string[]) => errors.join(', '))).toBe(
      good,
    )
    expect(unwrap_or(good, 0)).toBe(2)
    expect(unwrap_or(bad, 0)).toBe(0)
  })
})
