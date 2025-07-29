"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const fastify_1 = __importDefault(require("fastify"));
const config_1 = require("./config");
const fs_1 = __importDefault(require("fs"));
// Criar diretório uploads se não existir
const ensureUploadsDir = () => {
    try {
        if (!fs_1.default.existsSync(config_1.UPLOADS_DIR)) {
            console.log(`📁 Criando diretório: ${config_1.UPLOADS_DIR}`);
            fs_1.default.mkdirSync(config_1.UPLOADS_DIR, { recursive: true });
            console.log('✅ Diretório uploads criado com sucesso');
        }
        else {
            console.log(`📁 Diretório já existe: ${config_1.UPLOADS_DIR}`);
        }
    }
    catch (error) {
        console.error('❌ Erro ao criar diretório uploads:', error);
        // Não falhar se não conseguir criar o diretório
    }
};
// Criar diretório na inicialização
ensureUploadsDir();
const app = (0, fastify_1.default)({
    logger: true,
    trustProxy: true,
});
exports.app = app;
// Health check
app.get('/health', async (request, reply) => {
    console.log('🏥 Health check requested');
    return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        port: process.env.PORT || '10000',
    };
});
// Root endpoint
app.get('/', async (request, reply) => {
    return {
        message: 'Business API is running!',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
    };
});
// Database test endpoint
app.get('/db-test', async (request, reply) => {
    try {
        console.log('🔍 Testando conexão com banco de dados...');
        const { getPrisma } = require('./database/prisma');
        // Testar conexão
        const prisma = await getPrisma();
        await prisma.$connect();
        console.log('✅ Conexão com banco estabelecida');
        // Testar query simples
        const count = await prisma.product.count();
        console.log(`📊 Total de produtos: ${count}`);
        return {
            status: 'ok',
            database: 'connected',
            products_count: count,
            timestamp: new Date().toISOString(),
        };
    }
    catch (error) {
        console.error('❌ Erro na conexão com banco:', error);
        return reply.status(500).send({
            status: 'error',
            database: 'disconnected',
            error: error.message,
            timestamp: new Date().toISOString(),
        });
    }
});
// Uploads directory test endpoint
app.get('/uploads-test', async (request, reply) => {
    try {
        console.log('🔍 Testando diretório uploads...');
        const uploadsExists = fs_1.default.existsSync(config_1.UPLOADS_DIR);
        const uploadsPath = config_1.UPLOADS_DIR;
        if (uploadsExists) {
            const files = fs_1.default.readdirSync(config_1.UPLOADS_DIR);
            console.log(`📁 Diretório uploads existe: ${uploadsPath}`);
            console.log(`📄 Arquivos no diretório: ${files.length}`);
            return {
                status: 'ok',
                uploads_directory: 'exists',
                path: uploadsPath,
                files_count: files.length,
                files: files.slice(0, 10), // Mostrar apenas os primeiros 10 arquivos
                timestamp: new Date().toISOString(),
            };
        }
        else {
            console.log(`❌ Diretório uploads não existe: ${uploadsPath}`);
            return reply.status(500).send({
                status: 'error',
                uploads_directory: 'not_exists',
                path: uploadsPath,
                timestamp: new Date().toISOString(),
            });
        }
    }
    catch (error) {
        console.error('❌ Erro ao verificar diretório uploads:', error);
        return reply.status(500).send({
            status: 'error',
            uploads_directory: 'error',
            error: error.message,
            timestamp: new Date().toISOString(),
        });
    }
});
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
    });
    // Static files
    await app.register(require('@fastify/static'), {
        root: config_1.UPLOADS_DIR,
        prefix: '/uploads/',
        decorateReply: false,
        schemaHide: true,
    });
    // Multipart for file uploads
    await app.register(require('@fastify/multipart'));
    // Routes
    await app.register(require('./routes'));
};
// Error handler
app.setErrorHandler((error, request, reply) => {
    const statusCode = error.statusCode || 500;
    app.log.error(error);
    reply.status(statusCode).send({
        error: true,
        message: error.message || 'Internal Server Error',
        statusCode,
    });
});
// Inicializar plugins
registerPlugins();
