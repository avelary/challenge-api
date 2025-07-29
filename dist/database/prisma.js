"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPrisma = exports.initializePrisma = void 0;
const client_1 = require("@prisma/client");
console.log('🔗 Configurando Prisma Client...');
console.log('🌍 DATABASE_URL:', process.env.DATABASE_URL ? 'Configurada' : 'Não configurada');
// Inicializar Prisma de forma assíncrona
let prisma = null;
const initializePrisma = async () => {
    if (prisma)
        return prisma;
    if (!process.env.DATABASE_URL) {
        throw new Error('DATABASE_URL não está configurada');
    }
    console.log('✅ Inicializando Prisma Client');
    prisma = new client_1.PrismaClient({
        log: process.env.NODE_ENV !== 'production'
            ? ['query', 'info', 'warn', 'error']
            : ['error'],
        datasources: {
            db: {
                url: process.env.DATABASE_URL,
            },
        },
    });
    return prisma;
};
exports.initializePrisma = initializePrisma;
// Para compatibilidade com código existente
const getPrisma = async () => {
    return await initializePrisma();
};
exports.getPrisma = getPrisma;
