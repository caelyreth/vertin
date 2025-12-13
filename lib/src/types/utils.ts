/**
 * Converts a union type into an intersection type.
 *
 * @template T The union type to convert.
 */
export type _UnionToIntersection<T>
  = (T extends any ? (t: T) => void : never) extends
  (i: infer I) => void ? I : never

/**
 * Extracts the "last" type from a union.
 *
 * @template T The union type.
 */
export type _LastOf<T>
  = _UnionToIntersection<
    T extends any ? () => T : never
  > extends () => infer RT ? RT : never

/**
 * A tuple utility type that appends a new element to the end.
 *
 * @template T The tuple type.
 * @template V The element to append.
 */
export type _Push<T extends any[], V> = [...T, V]

/**
 * Converts a union type into a tuple type.
 *
 * @template T The union type to convert.
 * @template K Internal helper (last element of the union).
 */
export type _UnionToTuple<T, K = _LastOf<T>>
  = [T] extends [never] ? []
    : _Push<_UnionToTuple<Exclude<T, K>>, K>

/**
 * Computes the number of keys in an object type.
 *
 * @example
 * interface Foo { a: string; b: number; c: boolean }
 * type Count = _KeyCount<Foo> // 3
 *
 * @template T The object type whose keys should be counted.
 */
export type _KeyCount<T extends object> = _UnionToTuple<keyof T>['length']
