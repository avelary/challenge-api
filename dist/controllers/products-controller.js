"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductsController = void 0;
const prisma_1 = require("../database/prisma");
const AppError_1 = require("../utils/AppError");
const product_schema_1 = require("../schemas/product.schema");
const openai_service_1 = require("../services/openai.service");
const image_utils_1 = require("../utils/image-utils");
class ProductsController {
    async create(request, reply) {
        try {
            const validatedData = product_schema_1.createProductSchema.parse(request.body);
            const prisma = await (0, prisma_1.getPrisma)();
            const product = await prisma.product.create({
                data: validatedData,
            });
            return reply.status(201).send(product);
        }
        catch (error) {
            throw error;
        }
    }
    // Método simples para testar conexão com OpenAI
    async testOpenAI(request, reply) {
        try {
            console.log('🧪 Testando conexão com OpenAI...');
            // Verificar se a chave está configurada
            if (!process.env.OPENAI_API_KEY) {
                throw new AppError_1.AppError('Chave da OpenAI não configurada', 500);
            }
            if (process.env.OPENAI_API_KEY === 'sua-chave-da-openai-aqui') {
                throw new AppError_1.AppError('Configure uma chave válida da OpenAI no arquivo .env', 500);
            }
            // Testar geração simples
            const testProduct = await openai_service_1.OpenAIService.generateFallbackProduct();
            return reply.send({
                success: true,
                message: 'OpenAI conectada com sucesso!',
                test_result: testProduct,
            });
        }
        catch (error) {
            console.error('❌ Erro no teste OpenAI:', error);
            throw new AppError_1.AppError(`Teste falhou: ${error.message}`, 500);
        }
    }
    // Função para comprimir imagem usando Sharp (substituindo a versão antiga)
    async compressImageBuffer(buffer, mimeType, maxSizeKB = 500) {
        console.log('🗜️ [PERFORMANCE] Iniciando compressão inteligente da imagem...');
        const startTime = Date.now();
        try {
            const result = await image_utils_1.ImageUtils.bufferToCompressedBase64(buffer, mimeType, maxSizeKB);
            const compressionTime = Date.now() - startTime;
            console.log(`⏱️ [PERFORMANCE] Compressão concluída em ${compressionTime}ms`);
            return result;
        }
        catch (error) {
            console.error('❌ Erro na compressão, usando fallback:', error);
            // Fallback: usar método antigo se Sharp falhar
            const base64 = buffer.toString('base64');
            return {
                base64: this.legacyCompressBase64(base64, maxSizeKB),
                mimeType,
                sizeKB: Math.round((base64.length * 3) / 4 / 1024),
            };
        }
    }
    // Fallback para compressão simples (método antigo)
    legacyCompressBase64(base64, maxSizeKB = 500) {
        const currentSizeKB = Math.round((base64.length * 3) / 4 / 1024);
        if (currentSizeKB <= maxSizeKB) {
            return base64;
        }
        const maxLength = (maxSizeKB * 1024 * 4) / 3;
        if (base64.length > maxLength) {
            console.warn(`⚠️ Fallback: truncando de ${currentSizeKB}KB para ${maxSizeKB}KB`);
            return base64.substring(0, Math.floor(maxLength));
        }
        return base64;
    }
    async generateWithAI(request, reply) {
        console.log('🚀 Iniciando processamento de imagem com IA...');
        try {
            // Verificar se há arquivo de imagem no upload
            const data = await request.file();
            if (!data) {
                console.error('❌ Nenhum arquivo enviado');
                throw new AppError_1.AppError('Imagem é obrigatória para análise da IA', 400);
            }
            console.log(`📁 Arquivo recebido: ${data.filename} (${data.mimetype})`);
            // Verificar se é uma imagem
            if (!data.mimetype.startsWith('image/')) {
                console.error(`❌ Arquivo não é imagem: ${data.mimetype}`);
                throw new AppError_1.AppError('Arquivo deve ser uma imagem', 400);
            }
            // Verificar tamanho do arquivo
            const buffer = await data.toBuffer();
            const fileSizeMB = buffer.length / 1024 / 1024;
            if (fileSizeMB > 10) {
                throw new AppError_1.AppError('Imagem muito grande. Máximo 10MB permitido.', 400);
            }
            console.log(`📊 Tamanho do arquivo: ${fileSizeMB.toFixed(2)} MB`);
            // Comprimir e converter imagem para base64 (OTIMIZAÇÃO DE PERFORMANCE)
            console.log('🔄 [PERFORMANCE] Iniciando compressão e conversão para base64...');
            const compressionStartTime = Date.now();
            const compressedResult = await this.compressImageBuffer(buffer, data.mimetype, 800);
            const imageBase64 = compressedResult.base64;
            const compressionTime = Date.now() - compressionStartTime;
            console.log(`⏱️ [PERFORMANCE] Conversão completa em ${compressionTime}ms`);
            console.log(`📊 Tamanho final: ${compressedResult.sizeKB}KB`);
            let generatedProduct;
            let analysisMethod = 'ai-vision';
            try {
                // Tentar análise com IA primeiro
                console.log('🔍 Tentando análise com OpenAI Vision...');
                generatedProduct = await openai_service_1.OpenAIService.analyzeProductImage(imageBase64, data.mimetype);
                console.log('✅ Análise com IA Vision bem sucedida');
            }
            catch (aiError) {
                console.error('❌ Falha na análise com IA Vision:', aiError.message);
                console.error('🔍 DEBUG - Erro completo da OpenAI:', {
                    status: aiError.status,
                    message: aiError.message,
                    type: aiError.type,
                    code: aiError.code,
                });
                // Se é rate limit, usar fallback inteligente
                if (aiError.message === 'RATE_LIMIT') {
                    console.log('⚠️ Rate limit detectado, usando fallback inteligente baseado no nome do arquivo...');
                    try {
                        generatedProduct = await openai_service_1.OpenAIService.generateSmartFallbackProduct(data.filename);
                        analysisMethod = 'smart-fallback';
                        console.log('✅ Fallback inteligente bem sucedido');
                    }
                    catch (smartFallbackError) {
                        console.error('❌ Falha no fallback inteligente:', smartFallbackError.message);
                        // Se fallback inteligente falhar, usar fallback simples
                        try {
                            generatedProduct = await openai_service_1.OpenAIService.generateFallbackProduct();
                            analysisMethod = 'simple-fallback';
                            console.log('✅ Fallback simples bem sucedido');
                        }
                        catch (simpleFallbackError) {
                            console.error('❌ Falha no fallback simples:', simpleFallbackError.message);
                            throw new AppError_1.AppError('Limite de requisições excedido. Tente novamente em alguns minutos.', 429);
                        }
                    }
                }
                else {
                    // Para outros erros, tentar fallback uma vez
                    console.log('🔄 Tentando método fallback...');
                    try {
                        generatedProduct = await openai_service_1.OpenAIService.generateSmartFallbackProduct(data.filename);
                        analysisMethod = 'smart-fallback';
                        console.log('✅ Método fallback bem sucedido');
                    }
                    catch (fallbackError) {
                        console.error('❌ Falha no método fallback:', fallbackError.message);
                        throw new AppError_1.AppError(`Falha na análise: ${aiError.message}`, 500);
                    }
                }
            }
            console.log('📝 Produto gerado:', generatedProduct);
            // Mapear classificação e categoria para IDs únicos
            const idcl = Math.abs(generatedProduct.classification
                .split('')
                .reduce((a, b) => a + b.charCodeAt(0), 0) % 1000);
            const idca = Math.abs(generatedProduct.category
                .split('')
                .reduce((a, b) => a + b.charCodeAt(0), 0) % 1000);
            console.log(`🔢 IDs gerados - idcl: ${idcl}, idca: ${idca}`);
            // Comprimir imagem adicional para salvar no banco (máximo 500KB para DB)
            console.log('🗜️ [PERFORMANCE] Comprimindo para banco de dados...');
            const dbCompressionStartTime = Date.now();
            const dbCompressedResult = await this.compressImageBuffer(buffer, data.mimetype, 500);
            const compressedBase64 = dbCompressedResult.base64;
            const finalMimeType = dbCompressedResult.mimeType;
            const dbCompressionTime = Date.now() - dbCompressionStartTime;
            console.log(`⏱️ [PERFORMANCE] Compressão DB em ${dbCompressionTime}ms`);
            console.log(`📊 Tamanho final DB: ${dbCompressedResult.sizeKB}KB`);
            // Criar payload para o banco de dados
            const productData = {
                title: generatedProduct.title,
                productType: generatedProduct.productType,
                idcl,
                idca,
                idPartner: 1, // Parceiro padrão
                idPrinter: null,
                measure: 'un', // Unidade padrão
                quantity: null,
                price: generatedProduct.price,
                offer: generatedProduct.offer,
                description: generatedProduct.description,
                remove: null,
                include: null,
                datasheet: null,
                status: 'pending',
                image: `data:${finalMimeType};base64,${compressedBase64}`, // Salvar imagem comprimida
            };
            console.log('🔍 Validando dados do produto...');
            // Validar dados
            const validatedData = product_schema_1.createProductSchema.parse(productData);
            console.log('💾 Salvando produto no banco de dados...');
            // Criar produto no banco
            const prisma = await (0, prisma_1.getPrisma)();
            const product = await prisma.product.create({
                data: validatedData,
            });
            console.log(`✅ Produto criado com sucesso - ID: ${product.idsku}`);
            // Retornar produto criado com informações adicionais
            const response = {
                ...product,
                aiGenerated: true,
                aiAnalyzed: analysisMethod === 'ai-vision',
                analysisMethod,
                originalClassification: generatedProduct.classification,
                originalCategory: generatedProduct.category,
                rateLimitHit: analysisMethod !== 'ai-vision', // Indicar se houve rate limit
                imageSizeKB: dbCompressedResult.sizeKB, // Para debug
            };
            return reply.status(201).send(response);
        }
        catch (error) {
            console.error('❌ Erro no processamento:', error);
            throw error;
        }
    }
    // Novo método para processar múltiplas imagens
    async generateWithMultipleAI(request, reply) {
        console.log('🚀 STEP 1: Iniciando processamento de múltiplas imagens com IA...');
        const startTime = Date.now();
        try {
            console.log('🚀 STEP 2: Coletando arquivos do upload...');
            const collectStartTime = Date.now();
            // Coletar todas as imagens do upload
            const files = [];
            // Processar múltiplos arquivos
            console.log('🔄 STEP 2.1: Iniciando loop de arquivos...');
            let fileCount = 0;
            // Estratégia simplificada: timeout menor e limite de partes
            let partCount = 0;
            let maxParts = 5; // Máximo de partes para processar
            const partsPromise = (async () => {
                const partsIterator = request.parts();
                for await (const part of partsIterator) {
                    partCount++;
                    console.log(`🔄 STEP 2.1.${partCount}: Part ${partCount}/${maxParts} - type: ${part.type}, fieldname: ${part.fieldname || 'undefined'}`);
                    if (part.type === 'file' && part.fieldname === 'images') {
                        fileCount++;
                        console.log(`📁 STEP 2.1.${partCount}: Arquivo ${fileCount} - ${part.filename} (${part.mimetype})`);
                        files.push(part);
                        console.log(`✅ STEP 2.1.${partCount}: Arquivo ${part.filename} coletado`);
                    }
                    else if (part.type === 'field') {
                        console.log(`📝 STEP 2.1.${partCount}: Campo - ${part.fieldname}: ${part.value}`);
                    }
                    else {
                        console.log(`⏭️ STEP 2.1.${partCount}: Part ignorada`);
                    }
                    // Parar se atingiu o limite ou coletou arquivos suficientes
                    if (partCount >= maxParts || fileCount >= 3) {
                        console.log(`🔚 STEP 2.1: Limite atingido (${partCount} parts, ${fileCount} arquivos), finalizando`);
                        break;
                    }
                }
                console.log(`✅ STEP 2.1: Processamento completo - ${partCount} parts, ${fileCount} arquivos`);
            })();
            // Timeout reduzido para 5 segundos
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => {
                    console.log(`⚠️ TIMEOUT: 5s atingido (${partCount} parts, ${fileCount} arquivos)`);
                    console.log(`🔄 Continuando com ${fileCount} arquivo(s) coletado(s)`);
                    // Não rejeitar, apenas continuar com o que temos
                }, 5000);
            });
            // Usar Promise.allSettled para não falhar no timeout
            await Promise.race([partsPromise, timeoutPromise]).catch(() => {
                console.log(`⚠️ Erro no loop, mas continuando com ${fileCount} arquivo(s)`);
            });
            console.log(`✅ STEP 2.1 FINAL: ${fileCount} arquivos coletados de ${partCount} parts totais`);
            console.log(`⏱️ STEP 2 COMPLETO: Coleta levou ${Date.now() - collectStartTime}ms`);
            // Verificar se conseguimos coletar pelo menos 1 arquivo
            if (files.length === 0) {
                console.error(`❌ Nenhum arquivo coletado após ${partCount} parts processadas`);
                throw new AppError_1.AppError('Erro no upload: nenhuma imagem foi recebida. Tente novamente.', 400);
            }
            else {
                console.log(`🎯 Prosseguindo com ${files.length} arquivo(s) válido(s)`);
            }
            if (files.length > 3) {
                throw new AppError_1.AppError('Máximo de 3 imagens permitidas', 400);
            }
            console.log(`🚀 STEP 3: ${files.length} arquivos recebidos, processando para base64...`);
            const processStartTime = Date.now();
            // Verificar se todos são imagens e processar
            const imagesBase64 = [];
            const mimeTypes = [];
            const buffers = [];
            let totalSizeMB = 0;
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                console.log(`📁 Arquivo ${i + 1}: ${file.filename} (${file.mimetype})`);
                // Verificar se é uma imagem
                if (!file.mimetype.startsWith('image/')) {
                    console.error(`❌ Arquivo ${i + 1} não é imagem: ${file.mimetype}`);
                    throw new AppError_1.AppError(`Arquivo ${i + 1} deve ser uma imagem`, 400);
                }
                // Verificar tamanho do arquivo com timeout
                console.log(`🔄 STEP 3.${i + 1}.1: Convertendo ${file.filename} para buffer (toBuffer)...`);
                const bufferStartTime = Date.now();
                const bufferPromise = file.toBuffer();
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error(`TIMEOUT: ${file.filename} demorou mais de 15s`)), 15000);
                });
                const buffer = (await Promise.race([
                    bufferPromise,
                    timeoutPromise,
                ]));
                console.log(`✅ STEP 3.${i + 1}.1: Buffer criado em ${Date.now() - bufferStartTime}ms`);
                const fileSizeMB = buffer.length / 1024 / 1024;
                totalSizeMB += fileSizeMB;
                if (fileSizeMB > 10) {
                    throw new AppError_1.AppError(`Imagem ${i + 1} muito grande. Máximo 10MB permitido por imagem.`, 400);
                }
                if (totalSizeMB > 25) {
                    throw new AppError_1.AppError('Tamanho total das imagens muito grande. Máximo 25MB no total.', 400);
                }
                console.log(`📊 Arquivo ${i + 1} - Tamanho: ${fileSizeMB.toFixed(2)} MB`);
                // Converter imagem para base64
                console.log(`🔄 STEP 3.${i + 1}: Convertendo ${file.filename} para base64...`);
                const convertStartTime = Date.now();
                const imageBase64 = buffer.toString('base64');
                imagesBase64.push(imageBase64);
                mimeTypes.push(file.mimetype);
                buffers.push(buffer);
                console.log(`✅ STEP 3.${i + 1} COMPLETO: ${file.filename} - ${Math.round((imageBase64.length * 3) / 4 / 1024)} KB em ${Date.now() - convertStartTime}ms`);
            }
            console.log(`⏱️ STEP 3 COMPLETO: Processamento base64 levou ${Date.now() - processStartTime}ms`);
            console.log(`📊 Tamanho total: ${totalSizeMB.toFixed(2)} MB`);
            let generatedProduct;
            let analysisMethod = 'ai-vision-multiple';
            try {
                // Tentar análise com múltiplas imagens
                console.log('🚀 STEP 4: Enviando para OpenAI Vision (múltiplas imagens)...');
                const openaiStartTime = Date.now();
                generatedProduct = await openai_service_1.OpenAIService.analyzeMultipleProductImages(imagesBase64, mimeTypes);
                console.log(`✅ STEP 4 COMPLETO: OpenAI respondeu em ${Date.now() - openaiStartTime}ms`);
                console.log('🎯 Análise com IA Vision (múltiplas imagens) bem sucedida');
            }
            catch (aiError) {
                console.error('❌ Falha na análise com IA Vision:', aiError.message);
                console.error('🔍 DEBUG - Erro completo da OpenAI (múltiplas imagens):', {
                    status: aiError.status,
                    message: aiError.message,
                    type: aiError.type,
                    code: aiError.code,
                });
                // Se é rate limit ou múltiplas imagens falham, tentar com apenas a primeira imagem
                if (aiError.message === 'RATE_LIMIT' ||
                    aiError.message.includes('muito grandes')) {
                    console.log('⚠️ Fallback: tentando análise apenas com a primeira imagem...');
                    try {
                        generatedProduct = await openai_service_1.OpenAIService.analyzeProductImage(imagesBase64[0], mimeTypes[0]);
                        analysisMethod = 'ai-vision-single-fallback';
                        console.log('✅ Análise com primeira imagem bem sucedida');
                    }
                    catch (singleImageError) {
                        console.error('❌ Falha na análise com primeira imagem:', singleImageError.message);
                        // Usar fallback inteligente baseado no nome do primeiro arquivo
                        try {
                            generatedProduct =
                                await openai_service_1.OpenAIService.generateSmartFallbackProduct(files[0].filename);
                            analysisMethod = 'smart-fallback';
                            console.log('✅ Fallback inteligente bem sucedido');
                        }
                        catch (fallbackError) {
                            console.error('❌ Falha no fallback:', fallbackError.message);
                            throw new AppError_1.AppError('Limite de requisições excedido. Tente novamente em alguns minutos.', 429);
                        }
                    }
                }
                else {
                    // Para outros erros, tentar com primeira imagem
                    console.log('🔄 Tentando análise com primeira imagem...');
                    try {
                        generatedProduct = await openai_service_1.OpenAIService.analyzeProductImage(imagesBase64[0], mimeTypes[0]);
                        analysisMethod = 'ai-vision-single-fallback';
                        console.log('✅ Análise com primeira imagem bem sucedida');
                    }
                    catch (fallbackError) {
                        console.error('❌ Falha na análise:', fallbackError.message);
                        throw new AppError_1.AppError(`Falha na análise: ${aiError.message}`, 500);
                    }
                }
            }
            console.log('📝 Produto gerado:', generatedProduct);
            // Mapear classificação e categoria para IDs únicos
            const idcl = Math.abs(generatedProduct.classification
                .split('')
                .reduce((a, b) => a + b.charCodeAt(0), 0) % 1000);
            const idca = Math.abs(generatedProduct.category
                .split('')
                .reduce((a, b) => a + b.charCodeAt(0), 0) % 1000);
            console.log(`🔢 IDs gerados - idcl: ${idcl}, idca: ${idca}`);
            // Usar a primeira imagem comprimida para salvar no banco
            console.log('🗜️ Comprimindo primeira imagem para salvar no banco...');
            const dbCompressedResult = await this.compressImageBuffer(buffers[0], files[0].mimetype, 500);
            const compressedBase64 = dbCompressedResult.base64;
            const compressedSizeKB = dbCompressedResult.sizeKB;
            console.log(`📊 Tamanho comprimido: ${compressedSizeKB} KB`);
            // Criar payload para o banco de dados
            const productData = {
                title: generatedProduct.title,
                productType: generatedProduct.productType,
                idcl,
                idca,
                idPartner: 1, // Parceiro padrão
                idPrinter: null,
                measure: 'un', // Unidade padrão
                quantity: null,
                price: generatedProduct.price,
                offer: generatedProduct.offer,
                description: generatedProduct.description,
                remove: null,
                include: null,
                datasheet: null,
                status: 'pending',
                image: `data:${files[0].mimetype};base64,${compressedBase64}`, // Salvar primeira imagem comprimida
            };
            console.log('🚀 STEP 5: Validando dados do produto...');
            const validateStartTime = Date.now();
            // Validar dados
            const validatedData = product_schema_1.createProductSchema.parse(productData);
            console.log(`⏱️ STEP 5 COMPLETO: Validação levou ${Date.now() - validateStartTime}ms`);
            console.log('🚀 STEP 6: Salvando produto no banco de dados...');
            const saveStartTime = Date.now();
            // Criar produto no banco
            const prisma = await (0, prisma_1.getPrisma)();
            const product = await prisma.product.create({
                data: validatedData,
            });
            console.log(`⏱️ STEP 6 COMPLETO: Salvamento levou ${Date.now() - saveStartTime}ms`);
            console.log(`✅ Produto criado com sucesso - ID: ${product.idsku}`);
            console.log(`🏁 PROCESSO TOTAL: ${Date.now() - startTime}ms`);
            // Retornar produto criado com informações adicionais
            const response = {
                ...product,
                aiGenerated: true,
                aiAnalyzed: analysisMethod.includes('ai-vision'),
                analysisMethod,
                originalClassification: generatedProduct.classification,
                originalCategory: generatedProduct.category,
                rateLimitHit: !analysisMethod.includes('ai-vision'),
                imageSizeKB: compressedSizeKB,
                totalImagesProcessed: files.length,
                imagesUsedForAnalysis: analysisMethod === 'ai-vision-multiple' ? files.length : 1,
            };
            return reply.status(201).send(response);
        }
        catch (error) {
            console.error('❌ Erro no processamento de múltiplas imagens:', error);
            throw error;
        }
    }
    /**
     * NOVA FUNCIONALIDADE: Processar cardápio em massa via OCR
     * Extrai múltiplos produtos de uma imagem de cardápio e cadastra todos automaticamente
     */
    async processBulkMenuOCR(request, reply) {
        console.log('🍽️ [BULK OCR] Iniciando processamento de cardápio em massa...');
        const totalStartTime = Date.now();
        try {
            // STEP 1: Receber e validar arquivo
            console.log('📤 [STEP 1] Recebendo arquivo de cardápio...');
            const stepStartTime = Date.now();
            const data = await request.file();
            if (!data) {
                throw new AppError_1.AppError('Imagem de cardápio é obrigatória', 400);
            }
            console.log(`📁 Arquivo: ${data.filename} (${data.mimetype})`);
            if (!data.mimetype.startsWith('image/')) {
                throw new AppError_1.AppError('Arquivo deve ser uma imagem', 400);
            }
            const buffer = await data.toBuffer();
            const fileSizeMB = buffer.length / 1024 / 1024;
            if (fileSizeMB > 15) {
                throw new AppError_1.AppError('Imagem muito grande. Máximo 15MB para cardápios.', 400);
            }
            console.log(`⏱️ [STEP 1] Completo em ${Date.now() - stepStartTime}ms`);
            console.log(`📊 Tamanho: ${fileSizeMB.toFixed(2)}MB`);
            // STEP 2: Otimizar imagem para OCR (alta qualidade mas tamanho controlado)
            console.log('🔄 [STEP 2] Otimizando imagem para OCR...');
            const ocrOptimizationStartTime = Date.now();
            const ocrOptimizedResult = await this.compressImageBuffer(buffer, data.mimetype, 2000); // 2MB para OCR
            const imageBase64 = ocrOptimizedResult.base64;
            console.log(`⏱️ [STEP 2] Otimização OCR em ${Date.now() - ocrOptimizationStartTime}ms`);
            console.log(`📊 Imagem otimizada: ${ocrOptimizedResult.sizeKB}KB`);
            // STEP 3: Processar OCR do cardápio
            console.log('🔍 [STEP 3] Processando OCR do cardápio...');
            const ocrStartTime = Date.now();
            const ocrResult = await openai_service_1.OpenAIService.processMenuOCR(imageBase64, ocrOptimizedResult.mimeType);
            console.log(`⏱️ [STEP 3] OCR completo em ${Date.now() - ocrStartTime}ms`);
            console.log(`🎯 Produtos encontrados: ${ocrResult.products.length}`);
            console.log(`📝 Método usado: ${ocrResult.method}`);
            console.log(`💯 Confiança: ${(ocrResult.confidence || 0) * 100}%`);
            if (ocrResult.products.length === 0) {
                throw new AppError_1.AppError('Nenhum produto foi identificado no cardápio. Tente uma imagem mais clara.', 400);
            }
            // STEP 4: Cadastrar produtos em massa no banco
            console.log('💾 [STEP 4] Salvando produtos no banco de dados...');
            const bulkSaveStartTime = Date.now();
            const prisma = await (0, prisma_1.getPrisma)();
            const createdProducts = [];
            // Comprimir imagem uma vez para usar em todos os produtos
            const dbCompressedResult = await this.compressImageBuffer(buffer, data.mimetype, 300); // Menor para DB
            for (let i = 0; i < ocrResult.products.length; i++) {
                const product = ocrResult.products[i];
                console.log(`💾 Salvando produto ${i + 1}/${ocrResult.products.length}: ${product.title}`);
                // Mapear classificação e categoria para IDs únicos
                const idcl = Math.abs(product.classification
                    .split('')
                    .reduce((a, b) => a + b.charCodeAt(0), 0) % 1000);
                const idca = Math.abs(product.category.split('').reduce((a, b) => a + b.charCodeAt(0), 0) %
                    1000);
                const productData = {
                    title: product.title,
                    productType: product.productType,
                    idcl,
                    idca,
                    idPartner: 1,
                    idPrinter: null,
                    measure: 'un',
                    quantity: null,
                    price: product.price,
                    offer: product.offer,
                    description: product.description,
                    remove: null,
                    include: null,
                    datasheet: null,
                    status: 'pending',
                    image: `data:${dbCompressedResult.mimeType};base64,${dbCompressedResult.base64}`,
                };
                try {
                    const validatedData = product_schema_1.createProductSchema.parse(productData);
                    const createdProduct = await prisma.product.create({
                        data: validatedData,
                    });
                    createdProducts.push(createdProduct);
                    console.log(`✅ Produto ${i + 1} salvo - ID: ${createdProduct.idsku}`);
                }
                catch (productError) {
                    console.error(`❌ Erro ao salvar produto ${i + 1}:`, productError.message);
                    // Continuar com próximo produto em caso de erro
                }
            }
            const bulkSaveTime = Date.now() - bulkSaveStartTime;
            const totalTime = Date.now() - totalStartTime;
            console.log(`⏱️ [STEP 4] Salvamento em massa em ${bulkSaveTime}ms`);
            console.log(`🏁 [BULK OCR] PROCESSO COMPLETO em ${totalTime}ms`);
            console.log(`📊 RESUMO: ${createdProducts.length}/${ocrResult.products.length} produtos salvos`);
            // STEP 5: Retornar resultado
            const response = {
                success: true,
                message: `${createdProducts.length} produtos cadastrados com sucesso`,
                summary: {
                    totalProductsFound: ocrResult.products.length,
                    totalProductsSaved: createdProducts.length,
                    ocrMethod: ocrResult.method,
                    ocrConfidence: ocrResult.confidence,
                    processingTimeMs: totalTime,
                    extractedText: ocrResult.extractedText?.substring(0, 500) || null,
                },
                products: createdProducts.map((product) => ({
                    idsku: product.idsku,
                    title: product.title,
                    price: product.price,
                    offer: product.offer,
                    description: product.description,
                })),
                performance: {
                    imageOptimizationMs: ocrOptimizationStartTime,
                    ocrProcessingMs: ocrResult.processingTimeMs,
                    bulkSaveMs: bulkSaveTime,
                    totalMs: totalTime,
                },
                debug: {
                    originalImageSizeMB: fileSizeMB,
                    optimizedImageSizeKB: ocrOptimizedResult.sizeKB,
                    dbImageSizeKB: dbCompressedResult.sizeKB,
                },
            };
            return reply.status(201).send(response);
        }
        catch (error) {
            const totalTime = Date.now() - totalStartTime;
            console.error(`❌ [BULK OCR] Erro após ${totalTime}ms:`, error.message);
            throw error;
        }
    }
    async index(request, reply) {
        try {
            console.log('📋 Buscando produtos no banco de dados...');
            console.log('🔗 DATABASE_URL:', process.env.DATABASE_URL ? 'Configurada' : 'Não configurada');
            const prisma = await (0, prisma_1.getPrisma)();
            const products = await prisma.product.findMany({
                orderBy: {
                    createdAt: 'desc',
                },
            });
            console.log(`✅ ${products.length} produtos encontrados`);
            return reply.send(products);
        }
        catch (error) {
            console.error('❌ Erro ao buscar produtos:', error);
            throw error;
        }
    }
    async delete(request, reply) {
        try {
            const { idsku } = product_schema_1.deleteProductParamsSchema.parse(request.params);
            const prisma = await (0, prisma_1.getPrisma)();
            const product = await prisma.product.findUnique({
                where: { idsku },
            });
            if (!product) {
                throw new AppError_1.AppError('Este produto não existe.', 404);
            }
            await prisma.product.delete({
                where: { idsku },
            });
            return reply.status(204).send();
        }
        catch (error) {
            throw error;
        }
    }
}
exports.ProductsController = ProductsController;
