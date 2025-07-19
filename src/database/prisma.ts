import { PrismaClient } from '@prisma/client'

console.log('🔗 Configurando Prisma Client...')
console.log(
  '🌍 DATABASE_URL:',
  process.env.DATABASE_URL ? 'Configurada' : 'Não configurada'
)

const prisma = new PrismaClient({
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

export { prisma }
