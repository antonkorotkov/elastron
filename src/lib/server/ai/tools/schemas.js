import { z } from 'zod'

/**
 * An object with any keys, each value matching `values`.
 *
 * Use this instead of `z.record(z.string(), …)`: a record's JSON Schema
 * carries `propertyNames`, which OpenAI doesn't support, so the SDK strips it
 * and logs a compatibility warning on every request. A catchall object
 * produces the same schema without it and validates the same way.
 */
export const openObject = (values = z.unknown()) => z.object({}).catchall(values)
