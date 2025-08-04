import { FastifyInstance } from 'fastify'
import { ProductsController } from '../controllers/products-controller'

const productsController = new ProductsController()

export async function productsRoutes(fastify: FastifyInstance) {
  // GET /products/test-openai - Testar conexão com OpenAI
  fastify.get(
    '/test-openai',
    productsController.testOpenAI.bind(productsController)
  )

  // POST /products - Criar produto
  fastify.post('/', productsController.create.bind(productsController))

  // POST /products/generate-ai - Gerar produto com IA (uma imagem)
  fastify.post(
    '/generate-ai',
    productsController.generateWithAI.bind(productsController)
  )

  // POST /products/generate-ai-multiple - Gerar produto com IA (múltiplas imagens)
  fastify.post(
    '/generate-ai-multiple',
    productsController.generateWithMultipleAI.bind(productsController)
  )

  // POST /products/bulk-menu-ocr - NOVA FUNCIONALIDADE: Processar cardápio em massa via OCR
  fastify.post(
    '/bulk-menu-ocr',
    productsController.processBulkMenuOCR.bind(productsController)
  )

  // GET /products - Listar produtos
  fastify.get('/', productsController.index.bind(productsController))

  // DELETE /products/:idsku - Deletar produto
  fastify.delete('/:idsku', productsController.delete.bind(productsController))
}
