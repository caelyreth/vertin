/**
 * Constraint checking context.
 */
export interface ConstraintContext<T> {
  /**
   * Raw value of current field.
   */
  value: T
}

/**
 * Constraint function to check if a value is valid.
 */
export type Constraint<T> = (ctx: ConstraintContext<T>) => void
