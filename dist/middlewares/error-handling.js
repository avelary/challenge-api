"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandling = errorHandling;
const AppError_1 = require("../utils/AppError");
const zod_1 = require("zod");
function errorHandling(error, request, reply) {
    if (error instanceof AppError_1.AppError) {
        return reply.status(error.statusCode).send({ message: error.message });
    }
    if (error instanceof zod_1.ZodError) {
        return reply.status(400).send({
            message: 'validation error',
            issues: error.format(),
        });
    }
    reply.status(500).send({ message: error.message });
}
