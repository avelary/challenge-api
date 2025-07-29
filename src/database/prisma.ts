import { PrismaClient } from '@prisma/client'

console.log('🔗 Configurando Prisma Client...')
console.log(
  '🌍 DATABASE_URL:',
  process.env.DATABASE_URL ? 'Configurada' : 'Não configurada'
)

// Inicializar Prisma de forma assíncrona
let prisma: PrismaClient | null = null

const initializePrisma = async () => {
  if (prisma) return prisma

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL não está configurada')
  }

  console.log('✅ Inicializando Prisma Client')

  prisma = new PrismaClient({
    log:
      process.env.NODE_ENV !== 'production'
        ? ['query', 'info', 'warn', 'error']
        : ['error'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  })

  return prisma
}

export { initializePrisma }

// Para compatibilidade com código existente
const getPrisma = async () => {
  return await initializePrisma()
}

export { getPrisma }
