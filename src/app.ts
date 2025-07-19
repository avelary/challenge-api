import Fastify from 'fastify'
import { UPLOADS_DIR } from './config'

const app = Fastify({
  logger: true,
  trustProxy: true,
})

// Registrar plugins
const registerPlugins = async () => {
  // CORS
  await app.register(require('@fastify/cors'), {
    origin: ['http://localhost:3000'],
    credentials: true,
  })

  // Static files
  await app.register(require('@fastify/static'), {
    root: UPLOADS_DIR,
    prefix: '/uploads/',
  })

  // Multipart for file uploads
  await app.register(require('@fastify/multipart'))

  // Routes
  await app.register(require('./routes'))
}

// Error handler
app.setErrorHandler((error, request, reply) => {
  const statusCode = error.statusCode || 500

  app.log.error(error)

  reply.status(statusCode).send({
    error: true,
    message: error.message || 'Internal Server Error',
    statusCode,
  })
})

// Health check
app.get('/health', async (request, reply) => {
  return { status: 'ok', timestamp: new Date().toISOString() }
})

registerPlugins()

export { app }
