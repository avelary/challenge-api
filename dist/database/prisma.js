"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPrisma = exports.initializePrisma = void 0;
const client_1 = require("@prisma/client");
console.log('🔗 Configurando Prisma Client...');
console.log('🌍 DATABASE_URL:', process.env.DATABASE_URL ? 'Configurada' : 'Não configurada');
// Aguardar um pouco para o Railway configurar as variáveis de ambiente
const waitForDatabaseUrl = async () => {
    let attempts = 0;
    const maxAttempts = 10;
    while (!process.env.DATABASE_URL && attempts < maxAttempts) {
        console.log(`⏳ Aguardando DATABASE_URL... Tentativa ${attempts + 1}/${maxAttempts}`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
    }
    if (!process.env.DATABASE_URL) {
        throw new Error('DATABASE_URL não foi configurada após 10 tentativas');
    }
    console.log('✅ DATABASE_URL configurada com sucesso');
};
// Inicializar Prisma de forma assíncrona
let prisma = null;
const initializePrisma = async () => {
    if (prisma)
        return prisma;
    await waitForDatabaseUrl();
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
