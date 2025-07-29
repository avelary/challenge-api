import { z } from 'zod'

export const createProductSchema = z.object({
  status: z.string().default('pending'),

  title: z
    .string()
    .trim()
    .min(6, 'Title must have at least 6 characters.')
    .max(100, 'Title must have at most 100 characters.'),

  productType: z
    .string()
    .trim()
    .min(4, 'Product type must have at least 6 characters.')
    .max(15, 'Product type must have at most 15 characters.'),

  idca: z.number().int(),
  idcl: z.number().int(),
  idPartner: z.number().int(),
  idPrinter: z.number().int().optional().nullable(),

  image: z.string().optional().nullable(),

  measure: z.string().trim().max(3, 'Measure must have at most 3 characters.'),

  quantity: z
    .number({ message: 'Quantity must be a number' })
    .nonnegative('Quantity must be non-negative')
    .optional()
    .nullable(),

  price: z
    .number()
    .min(0)
    .or(
      z.string().refine((val) => !isNaN(Number(val)), 'Price must be a number')
    )
    .transform((val) => Number(val)),

  offer: z
    .number()
    .min(0)
    .or(
      z.string().refine((val) => !isNaN(Number(val)), 'Offer must be a number')
    )
    .transform((val) => Number(val)),

  description: z.string().max(2000).optional().nullable(),
  remove: z.string().optional().nullable(),
  include: z.string().optional().nullable(),
  datasheet: z.string().optional().nullable(),
})

export const deleteProductParamsSchema = z.object({
  idsku: z.string().transform((val) => Number(val)),
})

export type CreateProductInput = z.infer<typeof createProductSchema>
export type DeleteProductParams = z.infer<typeof deleteProductParamsSchema>
