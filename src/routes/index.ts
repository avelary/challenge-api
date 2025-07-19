import { FastifyInstance } from 'fastify'
import { productsRoutes } from './products-routes'
import { uploadRoutes } from './upload-routes'

export default async function routes(fastify: FastifyInstance) {
  // Registrar todas as rotas
  await fastify.register(productsRoutes, { prefix: '/products' })
  await fastify.register(uploadRoutes, { prefix: '/upload' })
}
