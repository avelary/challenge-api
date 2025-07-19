import Fastify from 'fastify'
import { UPLOADS_DIR } from './config'

const app = Fastify({
  logger: true,
  trustProxy: true,
})

// Health check
app.get('/health', async (request, reply) => {
  console.log('🏥 Health check requested')
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    port: process.env.PORT || '10000',
  }
})

// Root endpoint
app.get('/', async (request, reply) => {
  return {
    message: 'Business API is running!',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  }
})

// Database test endpoint
app.get('/db-test', async (request, reply) => {
  try {
    console.log('🔍 Testando conexão com banco de dados...')
    const { getPrisma } = require('./database/prisma')

    // Testar conexão
    const prisma = await getPrisma()
    await prisma.$connect()
    console.log('✅ Conexão com banco estabelecida')

    // Testar query simples
    const count = await prisma.product.count()
    console.log(`📊 Total de produtos: ${count}`)

    return {
      status: 'ok',
      database: 'connected',
      products_count: count,
      timestamp: new Date().toISOString(),
    }
  } catch (error) {
    console.error('❌ Erro na conexão com banco:', error)
    return reply.status(500).send({
      status: 'error',
      database: 'disconnected',
      error: error.message,
      timestamp: new Date().toISOString(),
    })
  }
})

// Registrar plugins
const registerPlugins = async () => {
  // CORS
  await app.register(require('@fastify/cors'), {
    origin: [
      'http://localhost:3000',
      'https://challenge-three-inky.vercel.app',
      'https://challenge-git-main-yagoavelars-projects.vercel.app',
      'https://challenge-3hxolw6m2-yagoavelars-projects.vercel.app',
      /^https:\/\/challenge.*\.vercel\.app$/,
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
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

// Inicializar plugins
registerPlugins()

export { app }
