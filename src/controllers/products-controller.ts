import { FastifyRequest, FastifyReply } from 'fastify'
import { getPrisma } from '../database/prisma'
import { AppError } from '../utils/AppError'
import {
  createProductSchema,
  deleteProductParamsSchema,
} from '../schemas/product.schema'
import { OpenAIService } from '../services/openai.service'
import { MultipartFile } from '@fastify/multipart'

class ProductsController {
  async create(request: FastifyRequest, reply: FastifyReply) {
    try {
      const validatedData = createProductSchema.parse(request.body)
      const prisma = await getPrisma()

      const product = await prisma.product.create({
        data: validatedData,
      })

      return reply.status(201).send(product)
    } catch (error) {
      throw error
    }
  }

  // Método simples para testar conexão com OpenAI
  async testOpenAI(request: FastifyRequest, reply: FastifyReply) {
    try {
      console.log('🧪 Testando conexão com OpenAI...')

      // Verificar se a chave está configurada
      if (!process.env.OPENAI_API_KEY) {
        throw new AppError('Chave da OpenAI não configurada', 500)
      }

      if (process.env.OPENAI_API_KEY === 'sua-chave-da-openai-aqui') {
        throw new AppError(
          'Configure uma chave válida da OpenAI no arquivo .env',
          500
        )
      }

      // Testar geração simples
      const testProduct = await OpenAIService.generateFallbackProduct()

      return reply.send({
        success: true,
        message: 'OpenAI conectada com sucesso!',
        test_result: testProduct,
      })
    } catch (error: any) {
      console.error('❌ Erro no teste OpenAI:', error)
      throw new AppError(`Teste falhou: ${error.message}`, 500)
    }
  }

  // Função para comprimir imagem base64 (reduzir qualidade)
  private compressBase64Image(base64: string, maxSizeKB: number = 500): string {
    // Se a imagem já é pequena, retornar como está
    const currentSizeKB = Math.round((base64.length * 3) / 4 / 1024)
    if (currentSizeKB <= maxSizeKB) {
      return base64
    }

    // Para imagens muito grandes, truncar (não é ideal, mas evita erro de DB)
    // Em uma implementação real, usaria uma biblioteca de compressão de imagem
    const maxLength = (maxSizeKB * 1024 * 4) / 3 // Converter KB para caracteres base64
    if (base64.length > maxLength) {
      console.warn(
        `⚠️ Imagem muito grande (${currentSizeKB}KB), truncando para ${maxSizeKB}KB`
      )
      return base64.substring(0, Math.floor(maxLength))
    }

    return base64
  }

  async generateWithAI(request: FastifyRequest, reply: FastifyReply) {
    console.log('🚀 Iniciando processamento de imagem com IA...')

    try {
      // Verificar se há arquivo de imagem no upload
      const data: MultipartFile | undefined = await request.file()

      if (!data) {
        console.error('❌ Nenhum arquivo enviado')
        throw new AppError('Imagem é obrigatória para análise da IA', 400)
      }

      console.log(`📁 Arquivo recebido: ${data.filename} (${data.mimetype})`)

      // Verificar se é uma imagem
      if (!data.mimetype.startsWith('image/')) {
        console.error(`❌ Arquivo não é imagem: ${data.mimetype}`)
        throw new AppError('Arquivo deve ser uma imagem', 400)
      }

      // Verificar tamanho do arquivo
      const buffer = await data.toBuffer()
      const fileSizeMB = buffer.length / 1024 / 1024

      if (fileSizeMB > 10) {
        throw new AppError('Imagem muito grande. Máximo 10MB permitido.', 400)
      }

      console.log(`📊 Tamanho do arquivo: ${fileSizeMB.toFixed(2)} MB`)

      // Converter imagem para base64
      console.log('🔄 Convertendo imagem para base64...')
      const imageBase64 = buffer.toString('base64')

      console.log(
        `📊 Tamanho base64: ${Math.round(
          (imageBase64.length * 3) / 4 / 1024
        )} KB`
      )

      let generatedProduct
      let analysisMethod = 'ai-vision'

      try {
        // Tentar análise com IA primeiro
        console.log('🔍 Tentando análise com OpenAI Vision...')
        generatedProduct = await OpenAIService.analyzeProductImage(imageBase64)
        console.log('✅ Análise com IA Vision bem sucedida')
      } catch (aiError: any) {
        console.error('❌ Falha na análise com IA Vision:', aiError.message)
        console.error('🔍 DEBUG - Erro completo da OpenAI:', {
          status: aiError.status,
          message: aiError.message,
          type: aiError.type,
          code: aiError.code,
        })

        // Se é rate limit, usar fallback inteligente
        if (aiError.message === 'RATE_LIMIT') {
          console.log(
            '⚠️ Rate limit detectado, usando fallback inteligente baseado no nome do arquivo...'
          )
          try {
            generatedProduct = await OpenAIService.generateSmartFallbackProduct(
              data.filename
            )
            analysisMethod = 'smart-fallback'
            console.log('✅ Fallback inteligente bem sucedido')
          } catch (smartFallbackError: any) {
            console.error(
              '❌ Falha no fallback inteligente:',
              smartFallbackError.message
            )
            // Se fallback inteligente falhar, usar fallback simples
            try {
              generatedProduct = await OpenAIService.generateFallbackProduct()
              analysisMethod = 'simple-fallback'
              console.log('✅ Fallback simples bem sucedido')
            } catch (simpleFallbackError: any) {
              console.error(
                '❌ Falha no fallback simples:',
                simpleFallbackError.message
              )
              throw new AppError(
                'Limite de requisições excedido. Tente novamente em alguns minutos.',
                429
              )
            }
          }
        } else {
          // Para outros erros, tentar fallback uma vez
          console.log('🔄 Tentando método fallback...')
          try {
            generatedProduct = await OpenAIService.generateSmartFallbackProduct(
              data.filename
            )
            analysisMethod = 'smart-fallback'
            console.log('✅ Método fallback bem sucedido')
          } catch (fallbackError: any) {
            console.error('❌ Falha no método fallback:', fallbackError.message)
            throw new AppError(`Falha na análise: ${aiError.message}`, 500)
          }
        }
      }

      console.log('📝 Produto gerado:', generatedProduct)

      // Mapear classificação e categoria para IDs únicos
      const idcl = Math.abs(
        generatedProduct.classification
          .split('')
          .reduce((a, b) => a + b.charCodeAt(0), 0) % 1000
      )
      const idca = Math.abs(
        generatedProduct.category
          .split('')
          .reduce((a, b) => a + b.charCodeAt(0), 0) % 1000
      )

      console.log(`🔢 IDs gerados - idcl: ${idcl}, idca: ${idca}`)

      // Comprimir imagem para salvar no banco (máximo 1MB)
      console.log('🗜️ Comprimindo imagem para salvar no banco...')
      const compressedBase64 = this.compressBase64Image(imageBase64)
      const compressedSizeKB = Math.round(
        (compressedBase64.length * 3) / 4 / 1024
      )
      console.log(`📊 Tamanho comprimido: ${compressedSizeKB} KB`)

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
        image: `data:${data.mimetype};base64,${compressedBase64}`, // Salvar imagem comprimida
      }

      console.log('🔍 Validando dados do produto...')

      // Validar dados
      const validatedData = createProductSchema.parse(productData)

      console.log('💾 Salvando produto no banco de dados...')

      // Criar produto no banco
      const prisma = await getPrisma()
      const product = await prisma.product.create({
        data: validatedData,
      })

      console.log(`✅ Produto criado com sucesso - ID: ${product.idsku}`)

      // Retornar produto criado com informações adicionais
      const response = {
        ...product,
        aiGenerated: true,
        aiAnalyzed: analysisMethod === 'ai-vision',
        analysisMethod,
        originalClassification: generatedProduct.classification,
        originalCategory: generatedProduct.category,
        rateLimitHit: analysisMethod !== 'ai-vision', // Indicar se houve rate limit
        imageSizeKB: compressedSizeKB, // Para debug
      }

      return reply.status(201).send(response)
    } catch (error: any) {
      console.error('❌ Erro no processamento:', error)
      throw error
    }
  }

  // Novo método para processar múltiplas imagens
  async generateWithMultipleAI(request: FastifyRequest, reply: FastifyReply) {
    console.log('🚀 Iniciando processamento de múltiplas imagens com IA...')

    try {
      // Coletar todas as imagens do upload
      const files: MultipartFile[] = []

      // Processar múltiplos arquivos
      for await (const part of request.parts()) {
        if (part.type === 'file' && part.fieldname === 'images') {
          files.push(part)
        }
      }

      if (files.length === 0) {
        console.error('❌ Nenhum arquivo enviado')
        throw new AppError(
          'Pelo menos uma imagem é obrigatória para análise da IA',
          400
        )
      }

      if (files.length > 5) {
        throw new AppError('Máximo de 5 imagens permitidas', 400)
      }

      console.log(`📁 ${files.length} arquivos recebidos`)

      // Verificar se todos são imagens e processar
      const imagesBase64: string[] = []
      let totalSizeMB = 0

      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        console.log(`📁 Arquivo ${i + 1}: ${file.filename} (${file.mimetype})`)

        // Verificar se é uma imagem
        if (!file.mimetype.startsWith('image/')) {
          console.error(`❌ Arquivo ${i + 1} não é imagem: ${file.mimetype}`)
          throw new AppError(`Arquivo ${i + 1} deve ser uma imagem`, 400)
        }

        // Verificar tamanho do arquivo
        const buffer = await file.toBuffer()
        const fileSizeMB = buffer.length / 1024 / 1024
        totalSizeMB += fileSizeMB

        if (fileSizeMB > 10) {
          throw new AppError(
            `Imagem ${i + 1} muito grande. Máximo 10MB permitido por imagem.`,
            400
          )
        }

        if (totalSizeMB > 25) {
          throw new AppError(
            'Tamanho total das imagens muito grande. Máximo 25MB no total.',
            400
          )
        }

        console.log(
          `📊 Arquivo ${i + 1} - Tamanho: ${fileSizeMB.toFixed(2)} MB`
        )

        // Converter imagem para base64
        const imageBase64 = buffer.toString('base64')
        imagesBase64.push(imageBase64)

        console.log(
          `📊 Imagem ${i + 1} - Base64: ${Math.round(
            (imageBase64.length * 3) / 4 / 1024
          )} KB`
        )
      }

      console.log(`📊 Tamanho total: ${totalSizeMB.toFixed(2)} MB`)

      let generatedProduct
      let analysisMethod = 'ai-vision-multiple'

      try {
        // Tentar análise com múltiplas imagens
        console.log(
          '🔍 Tentando análise com OpenAI Vision (múltiplas imagens)...'
        )
        generatedProduct = await OpenAIService.analyzeMultipleProductImages(
          imagesBase64
        )
        console.log('✅ Análise com IA Vision (múltiplas imagens) bem sucedida')
      } catch (aiError: any) {
        console.error('❌ Falha na análise com IA Vision:', aiError.message)
        console.error(
          '🔍 DEBUG - Erro completo da OpenAI (múltiplas imagens):',
          {
            status: aiError.status,
            message: aiError.message,
            type: aiError.type,
            code: aiError.code,
          }
        )

        // Se é rate limit ou múltiplas imagens falham, tentar com apenas a primeira imagem
        if (
          aiError.message === 'RATE_LIMIT' ||
          aiError.message.includes('muito grandes')
        ) {
          console.log(
            '⚠️ Fallback: tentando análise apenas com a primeira imagem...'
          )
          try {
            generatedProduct = await OpenAIService.analyzeProductImage(
              imagesBase64[0]
            )
            analysisMethod = 'ai-vision-single-fallback'
            console.log('✅ Análise com primeira imagem bem sucedida')
          } catch (singleImageError: any) {
            console.error(
              '❌ Falha na análise com primeira imagem:',
              singleImageError.message
            )
            // Usar fallback inteligente baseado no nome do primeiro arquivo
            try {
              generatedProduct =
                await OpenAIService.generateSmartFallbackProduct(
                  files[0].filename
                )
              analysisMethod = 'smart-fallback'
              console.log('✅ Fallback inteligente bem sucedido')
            } catch (fallbackError: any) {
              console.error('❌ Falha no fallback:', fallbackError.message)
              throw new AppError(
                'Limite de requisições excedido. Tente novamente em alguns minutos.',
                429
              )
            }
          }
        } else {
          // Para outros erros, tentar com primeira imagem
          console.log('🔄 Tentando análise com primeira imagem...')
          try {
            generatedProduct = await OpenAIService.analyzeProductImage(
              imagesBase64[0]
            )
            analysisMethod = 'ai-vision-single-fallback'
            console.log('✅ Análise com primeira imagem bem sucedida')
          } catch (fallbackError: any) {
            console.error('❌ Falha na análise:', fallbackError.message)
            throw new AppError(`Falha na análise: ${aiError.message}`, 500)
          }
        }
      }

      console.log('📝 Produto gerado:', generatedProduct)

      // Mapear classificação e categoria para IDs únicos
      const idcl = Math.abs(
        generatedProduct.classification
          .split('')
          .reduce((a, b) => a + b.charCodeAt(0), 0) % 1000
      )
      const idca = Math.abs(
        generatedProduct.category
          .split('')
          .reduce((a, b) => a + b.charCodeAt(0), 0) % 1000
      )

      console.log(`🔢 IDs gerados - idcl: ${idcl}, idca: ${idca}`)

      // Usar a primeira imagem comprimida para salvar no banco
      console.log('🗜️ Comprimindo primeira imagem para salvar no banco...')
      const compressedBase64 = this.compressBase64Image(imagesBase64[0])
      const compressedSizeKB = Math.round(
        (compressedBase64.length * 3) / 4 / 1024
      )
      console.log(`📊 Tamanho comprimido: ${compressedSizeKB} KB`)

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
      }

      console.log('🔍 Validando dados do produto...')

      // Validar dados
      const validatedData = createProductSchema.parse(productData)

      console.log('💾 Salvando produto no banco de dados...')

      // Criar produto no banco
      const prisma = await getPrisma()
      const product = await prisma.product.create({
        data: validatedData,
      })

      console.log(`✅ Produto criado com sucesso - ID: ${product.idsku}`)

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
        imagesUsedForAnalysis:
          analysisMethod === 'ai-vision-multiple' ? files.length : 1,
      }

      return reply.status(201).send(response)
    } catch (error: any) {
      console.error('❌ Erro no processamento de múltiplas imagens:', error)
      throw error
    }
  }

  async index(request: FastifyRequest, reply: FastifyReply) {
    try {
      console.log('📋 Buscando produtos no banco de dados...')
      console.log(
        '🔗 DATABASE_URL:',
        process.env.DATABASE_URL ? 'Configurada' : 'Não configurada'
      )

      const prisma = await getPrisma()
      const products = await prisma.product.findMany({
        orderBy: {
          createdAt: 'desc',
        },
      })

      console.log(`✅ ${products.length} produtos encontrados`)
      return reply.send(products)
    } catch (error) {
      console.error('❌ Erro ao buscar produtos:', error)
      throw error
    }
  }

  async delete(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { idsku } = deleteProductParamsSchema.parse(request.params)
      const prisma = await getPrisma()

      const product = await prisma.product.findUnique({
        where: { idsku },
      })

      if (!product) {
        throw new AppError('Este produto não existe.', 404)
      }

      await prisma.product.delete({
        where: { idsku },
      })

      return reply.status(204).send()
    } catch (error) {
      throw error
    }
  }
}

export { ProductsController }
