"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = routes;
const products_routes_1 = require("./products-routes");
const upload_routes_1 = require("./upload-routes");
async function routes(fastify) {
    // Registrar todas as rotas
    await fastify.register(products_routes_1.productsRoutes, { prefix: '/products' });
    await fastify.register(upload_routes_1.uploadRoutes, { prefix: '/upload' });
}
