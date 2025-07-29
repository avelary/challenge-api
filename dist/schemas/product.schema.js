"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteProductParamsSchema = exports.createProductSchema = void 0;
const zod_1 = require("zod");
exports.createProductSchema = zod_1.z.object({
    status: zod_1.z.string().default('pending'),
    title: zod_1.z
        .string()
        .trim()
        .min(6, 'Title must have at least 6 characters.')
        .max(100, 'Title must have at most 100 characters.'),
    productType: zod_1.z
        .string()
        .trim()
        .min(4, 'Product type must have at least 6 characters.')
        .max(15, 'Product type must have at most 15 characters.'),
    idca: zod_1.z.number().int(),
    idcl: zod_1.z.number().int(),
    idPartner: zod_1.z.number().int(),
    idPrinter: zod_1.z.number().int().optional().nullable(),
    image: zod_1.z.string().optional().nullable(),
    measure: zod_1.z.string().trim().max(3, 'Measure must have at most 3 characters.'),
    quantity: zod_1.z
        .number({ message: 'Quantity must be a number' })
        .nonnegative('Quantity must be non-negative')
        .optional()
        .nullable(),
    price: zod_1.z
        .number()
        .min(0)
        .or(zod_1.z.string().refine((val) => !isNaN(Number(val)), 'Price must be a number'))
        .transform((val) => Number(val)),
    offer: zod_1.z
        .number()
        .min(0)
        .or(zod_1.z.string().refine((val) => !isNaN(Number(val)), 'Offer must be a number'))
        .transform((val) => Number(val)),
    description: zod_1.z.string().max(2000).optional().nullable(),
    remove: zod_1.z.string().optional().nullable(),
    include: zod_1.z.string().optional().nullable(),
    datasheet: zod_1.z.string().optional().nullable(),
});
exports.deleteProductParamsSchema = zod_1.z.object({
    idsku: zod_1.z.string().transform((val) => Number(val)),
});
