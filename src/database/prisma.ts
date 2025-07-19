import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  log: process.env.NODE_ENV !== "production" ? ["query", "info", "warn", "error"] : ["error"]
})

export { prisma }