"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.productsRoutes = productsRoutes;
const products_controller_1 = require("../controllers/products-controller");
const productsController = new products_controller_1.ProductsController();
async function productsRoutes(fastify) {
    // GET /products/test-openai - Testar conexão com OpenAI
    fastify.get('/test-openai', productsController.testOpenAI.bind(productsController));
    // POST /products - Criar produto
    fastify.post('/', productsController.create.bind(productsController));
    // POST /products/generate-ai - Gerar produto com IA (uma imagem)
    fastify.post('/generate-ai', productsController.generateWithAI.bind(productsController));
    // POST /products/generate-ai-multiple - Gerar produto com IA (múltiplas imagens)
    fastify.post('/generate-ai-multiple', productsController.generateWithMultipleAI.bind(productsController));
    // GET /products - Listar produtos
    fastify.get('/', productsController.index.bind(productsController));
    // DELETE /products/:idsku - Deletar produto
    fastify.delete('/:idsku', productsController.delete.bind(productsController));
}
