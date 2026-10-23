/**
 * @license MIT
 * @file Conservative typo suggestions. Suggestions never change input.
 * @author Yu <me@iki.moe>
 * @copyright Yu 2026
 */

function distance(left: string, right: string): number {
  let previous = Array.from(
    { length: right.length + 1 },
    (_, index) => index,
  )
  let before = previous
  for (let i = 1; i <= left.length; i += 1) {
    const current = [i]
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1
      current[j] = Math.min(
        current[j - 1]! + 1,
        previous[j]! + 1,
        previous[j - 1]! + cost,
      )
      if (
        i > 1 &&
        j > 1 &&
        left[i - 1] === right[j - 2] &&
        left[i - 2] === right[j - 1]
      ) {
        current[j] = Math.min(current[j]!, before[j - 2]! + 1)
      }
    }
    before = previous
    previous = current
  }
  return previous[right.length]!
}

/**
 * Suggests only the nearest plausible tokens, including adjacent swaps.
 */
export function suggest_hint(
  input: string,
  candidates: Iterable<string>,
): string | undefined {
  const { length } = input.replace(/^-+/, '')
  if (length < 3) return undefined
  const limit = length < 5 ? 1 : 2
  const ranked = [...new Set(candidates)]
    .filter(
      (name) =>
        name !== input && Math.abs(name.length - input.length) <= limit,
    )
    .map((name) => ({ name, score: distance(input, name) }))
    .filter(({ score }) => score <= limit)
    .sort((a, b) => a.score - b.score || a.name.localeCompare(b.name))
  const best = ranked[0]?.score
  const names = ranked
    .filter(({ score }) => score === best)
    .slice(0, 3)
    .map(({ name }) => `\`${name}\``)
  return names.length === 0
    ? undefined
    : `Did you mean ${names.join(' or ')}?`
}
