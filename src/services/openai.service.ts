import OpenAI from 'openai'
import tesseract from 'node-tesseract-ocr'

// Inicializar OpenAI apenas se a chave estiver configurada
let openai: OpenAI | null = null

if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })
}

export interface GeneratedProduct {
  title: string
  productType: 'souvenir' | 'menu' | 'vestuario'
  classification: string
  category: string
  description: string
  price: number
  offer: number
}

export interface MenuOCRResult {
  success: boolean
  extractedText?: string
  products: GeneratedProduct[]
  processingTimeMs: number
  method: 'openai-vision' | 'tesseract-ocr' | 'hybrid'
  confidence?: number
}

export class OpenAIService {
  static async analyzeProductImage(
    imageBase64: string,
    mimeType: string = 'image/jpeg'
  ): Promise<GeneratedProduct> {
    console.log('🤖 Iniciando análise da imagem com OpenAI Vision...')

    // Verificar se a chave da API está configurada
    if (!process.env.OPENAI_API_KEY) {
      console.error('❌ OPENAI_API_KEY não configurada')
      throw new Error(
        'Chave da OpenAI não configurada. Verifique as variáveis de ambiente'
      )
    }

    // Log da chave (primeiros e últimos caracteres para debug)
    const keyPreview =
      process.env.OPENAI_API_KEY.substring(0, 10) +
      '...' +
      process.env.OPENAI_API_KEY.substring(
        process.env.OPENAI_API_KEY.length - 4
      )
    console.log(`🔑 Chave OpenAI configurada: ${keyPreview}`)

    if (!openai) {
      console.error('❌ Cliente OpenAI não inicializado')
      throw new Error('Cliente OpenAI não disponível')
    }

    if (process.env.OPENAI_API_KEY === 'sua-chave-da-openai-aqui') {
      console.error('❌ OPENAI_API_KEY ainda está com valor padrão')
      throw new Error('Configure uma chave válida da OpenAI no arquivo .env')
    }

    // Log do tamanho da imagem
    const imageSizeKB = Math.round((imageBase64.length * 3) / 4 / 1024)
    console.log(`📷 Tamanho da imagem: ${imageSizeKB} KB`)

    if (imageSizeKB > 5000) {
      console.warn('⚠️ Imagem muito grande, pode causar problemas')
    }

    const prompt = `ANALISE esta imagem e EXTRAIA as informações REAIS do produto visível.

IMPORTANTE: Use os dados EXATOS que você vê na imagem, NÃO use exemplos genéricos!

Retorne APENAS um JSON com esta estrutura:
{
  "title": "Camiseta Preta Básica",
  "productType": "vestuario", 
  "classification": "camiseta",
  "category": "manga_curta",
  "description": "Camiseta preta de algodão, confortável e versátil",
  "price": 45.90,
  "offer": 39.90
}

INSTRUÇÕES OBRIGATÓRIAS:
1. EXTRAIA o nome REAL do produto da imagem - NÃO invente
2. Use título descritivo e específico (mínimo 2 caracteres)
3. Tipos válidos: souvenir, menu, vestuario
4. Se não conseguir ler claramente, descreva o que vê
5. Preços devem ser números realistas baseados no tipo de produto

EXEMPLO DO QUE NÃO FAZER:
❌ "title": "Nome do produto"
❌ "title": "Nome do Produto"

EXEMPLO DO QUE FAZER:
✅ "title": "Camiseta Azul Marinho"
✅ "title": "Boné Preto Aba Curva"
✅ "title": "Coca-Cola 350ml"`

    try {
      console.log('📤 Enviando requisição para OpenAI...')

      // Timeout de 8 segundos para imagem única
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(
          () => reject(new Error('TIMEOUT - OpenAI demorou mais que 8s')),
          8000
        )
      })

      const completion = (await Promise.race([
        openai!.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${mimeType};base64,${imageBase64}`,
                    detail: 'low',
                  },
                },
              ],
            },
          ],
          max_tokens: 80, // Reduzir ainda mais
          temperature: 0.1,
          frequency_penalty: 0,
          presence_penalty: 0,
        }),
        timeoutPromise,
      ])) as any

      console.log('📥 Resposta recebida da OpenAI')
      console.log('🔍 Usage:', completion.usage)

      const content = completion.choices[0]?.message?.content
      if (!content) {
        console.error('❌ Nenhum conteúdo retornado da OpenAI')
        throw new Error('Nenhum conteúdo retornado da OpenAI')
      }

      console.log('📝 Conteúdo da resposta:', content)

      // 🔍 DEBUG: Verificar se a resposta contém nomes genéricos
      if (
        content.includes('Nome do produto') ||
        content.includes('Nome do Produto')
      ) {
        console.error('🚨 PROBLEMA DETECTADO: OpenAI retornou nome genérico!')
        console.error('🔍 Prompt enviado:', prompt.substring(0, 200) + '...')
        console.error('🔍 Resposta recebida:', content)
      }

      // Tentar extrair JSON da resposta
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        console.error('❌ Não foi possível extrair JSON da resposta:', content)
        throw new Error('Resposta da OpenAI não contém JSON válido')
      }

      console.log('🔍 JSON extraído:', jsonMatch[0])

      let productData: GeneratedProduct
      try {
        productData = JSON.parse(jsonMatch[0]) as GeneratedProduct
      } catch (parseError) {
        console.error('❌ Erro ao fazer parse do JSON:', parseError)
        console.error('JSON problemático:', jsonMatch[0])
        throw new Error('JSON retornado pela OpenAI é inválido')
      }

      // Validar se os campos obrigatórios estão presentes
      const missingFields = []
      if (!productData.title) missingFields.push('title')
      if (!productData.productType) missingFields.push('productType')
      if (!productData.classification) missingFields.push('classification')
      if (!productData.category) missingFields.push('category')
      if (!productData.description) missingFields.push('description')
      if (!productData.price) missingFields.push('price')
      if (!productData.offer) missingFields.push('offer')

      if (missingFields.length > 0) {
        console.error('❌ Campos obrigatórios ausentes:', missingFields)
        console.error('Dados recebidos:', productData)
        throw new Error(
          `Dados incompletos da OpenAI. Campos ausentes: ${missingFields.join(
            ', '
          )}`
        )
      }

      return productData
    } catch (error: any) {
      console.error('❌ Erro na análise com OpenAI:', error)

      // Log detalhado do erro para debug
      console.error('🔍 Detalhes do erro OpenAI:', {
        status: error.status,
        message: error.message,
        type: error.type,
        code: error.code,
      })

      // Tratar erros específicos da OpenAI
      if (error.status === 429) {
        console.error('⚠️ Rate limit atingido - Status 429')
        throw new Error('RATE_LIMIT')
      }

      if (error.status === 400) {
        console.error('❌ Erro 400 - Bad Request:', error.message)
        throw new Error('Imagem inválida ou muito grande para a OpenAI')
      }

      if (error.status === 401) {
        console.error('❌ Erro 401 - Unauthorized:', error.message)
        throw new Error('Chave da OpenAI inválida ou sem permissões')
      }

      if (error.status === 402) {
        console.error('❌ Erro 402 - Payment Required:', error.message)
        throw new Error('Quota da OpenAI esgotada - verifique billing')
      }

      if (error.status === 403) {
        console.error('❌ Erro 403 - Forbidden:', error.message)
        throw new Error('Acesso negado pela OpenAI - verifique permissões')
      }

      if (error.status === 500) {
        console.error('❌ Erro 500 - Internal Server Error:', error.message)
        throw new Error('Erro interno da OpenAI - tente novamente')
      }

      // Verificar se é erro de rede
      if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        throw new Error('Erro de conexão com a OpenAI. Verifique sua internet.')
      }

      // Se não tem status, é um erro interno
      if (error.message.includes('JSON')) {
        throw new Error(
          'Falha ao processar resposta da IA. Tente com uma imagem diferente.'
        )
      }

      // Re-throw com mensagem mais amigável
      throw new Error(`Falha na análise: ${error.message}`)
    }
  }

  // Novo método para analisar múltiplas imagens
  static async analyzeMultipleProductImages(
    imagesBase64: string[],
    mimeTypes: string[] = []
  ): Promise<GeneratedProduct> {
    console.log(
      `🤖 Iniciando análise de ${imagesBase64.length} imagens com OpenAI Vision...`
    )

    // Verificar se a chave da API está configurada
    if (!process.env.OPENAI_API_KEY) {
      console.error('❌ OPENAI_API_KEY não configurada')
      throw new Error(
        'Chave da OpenAI não configurada. Verifique as variáveis de ambiente'
      )
    }

    // Log da chave (primeiros e últimos caracteres para debug)
    const keyPreview =
      process.env.OPENAI_API_KEY.substring(0, 10) +
      '...' +
      process.env.OPENAI_API_KEY.substring(
        process.env.OPENAI_API_KEY.length - 4
      )
    console.log(`🔑 Chave OpenAI configurada: ${keyPreview}`)

    if (!openai) {
      console.error('❌ Cliente OpenAI não inicializado')
      throw new Error('Cliente OpenAI não disponível')
    }

    if (process.env.OPENAI_API_KEY === 'sua-chave-da-openai-aqui') {
      console.error('❌ OPENAI_API_KEY ainda está com valor padrão')
      throw new Error('Configure uma chave válida da OpenAI no arquivo .env')
    }

    // Verificar limite de imagens
    if (imagesBase64.length > 3) {
      throw new Error('Máximo de 3 imagens permitidas')
    }

    if (imagesBase64.length === 0) {
      throw new Error('Pelo menos uma imagem é necessária')
    }

    // Log do tamanho das imagens
    const totalSizeKB = imagesBase64.reduce((total, base64) => {
      return total + Math.round((base64.length * 3) / 4 / 1024)
    }, 0)
    console.log(`📷 Tamanho total das imagens: ${totalSizeKB} KB`)

    if (totalSizeKB > 15000) {
      console.warn('⚠️ Imagens muito grandes, pode causar problemas')
    }

    const prompt = `ANALISE estas imagens e EXTRAIA os nomes REAIS dos produtos visíveis.

IMPORTANTE: Use os NOMES EXATOS das imagens, NÃO exemplos genéricos!

Retorne APENAS um JSON:
{"title":"Pizza Margherita","productType":"menu","classification":"prato_principal","category":"pizza","description":"Pizza tradicional italiana","price":28.90,"offer":25.90}

INSTRUÇÕES:
- EXTRAIA o nome REAL do produto das imagens
- Use título específico e descritivo  
- Classifications: bebida, prato_principal, sobremesa, entrada, petisco
- Preços realistas baseados no tipo de produto`

    try {
      console.log('📤 Enviando requisição para OpenAI com múltiplas imagens...')

      // Construir conteúdo da mensagem com texto e imagens
      const content: any[] = [
        {
          type: 'text',
          text: prompt,
        },
      ]

      // Adicionar cada imagem ao conteúdo
      imagesBase64.forEach((base64, index) => {
        const mimeType = mimeTypes[index] || 'image/jpeg'
        content.push({
          type: 'image_url',
          image_url: {
            url: `data:${mimeType};base64,${base64}`,
            detail: 'low', // Usar resolução baixa para economizar tokens
          },
        })
        console.log(`📷 Imagem ${index + 1} (${mimeType}) adicionada ao prompt`)
      })

      // Timeout de 30 segundos para múltiplas imagens
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(
          () => reject(new Error('TIMEOUT - OpenAI demorou mais que 30s')),
          30000
        )
      })

      const completion = (await Promise.race([
        openai!.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content }],
          max_tokens: 500, // Aumentado para permitir resposta completa
          temperature: 0.1,
          frequency_penalty: 0,
          presence_penalty: 0,
        }),
        timeoutPromise,
      ])) as any

      console.log('📥 Resposta recebida da OpenAI')
      console.log('🔍 Usage:', completion.usage)

      const responseContent = completion.choices[0]?.message?.content
      if (!responseContent) {
        console.error('❌ Nenhum conteúdo retornado da OpenAI')
        throw new Error('Nenhum conteúdo retornado da OpenAI')
      }

      console.log('📝 Conteúdo da resposta:', responseContent)

      // 🔍 DEBUG MELHORADO: Analisar resposta da OpenAI
      console.log(
        '\n🔍 [DEBUG MÚLTIPLAS IMAGENS] Análise detalhada da resposta:'
      )
      console.log(
        '📏 Tamanho da resposta:',
        responseContent.length,
        'caracteres'
      )
      console.log(
        '🎯 Primeiros 200 caracteres:',
        responseContent.substring(0, 200)
      )
      console.log(
        '🎯 Últimos 200 caracteres:',
        responseContent.substring(responseContent.length - 200)
      )

      // Verificar se a resposta foi cortada
      if (responseContent.length >= 490) {
        console.warn(
          '⚠️ [DEBUG] Resposta pode ter sido cortada pelo limite de tokens!'
        )
      }

      // Tentar extrair JSON da resposta
      const jsonMatch = responseContent.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        console.error(
          '\n❌ [DEBUG] ERRO: Não foi possível extrair JSON da resposta!'
        )
        console.error('🔍 Resposta completa recebida:', responseContent)
        console.error('🔍 Esperado: JSON com campos obrigatórios')
        throw new Error(
          'RESPOSTA_SEM_JSON - OpenAI não retornou formato JSON válido'
        )
      }

      console.log('🔍 JSON extraído:', jsonMatch[0])

      let productData: GeneratedProduct
      try {
        productData = JSON.parse(jsonMatch[0]) as GeneratedProduct
        console.log('✅ [DEBUG] JSON parsing bem sucedido')
        console.log('🔍 [DEBUG] Campos encontrados:', Object.keys(productData))
      } catch (parseError) {
        console.error('\n❌ [DEBUG] ERRO DE JSON PARSING!')
        console.error('🔍 Erro detalhado:', parseError)
        console.error('🔍 JSON problemático:', jsonMatch[0])
        console.error('🔍 Tamanho do JSON:', jsonMatch[0].length, 'caracteres')
        throw new Error(
          'JSON_PARSE_ERROR - JSON retornado pela OpenAI é inválido'
        )
      }

      // Validar se os campos obrigatórios estão presentes
      console.log('\n🔍 [DEBUG] Validando campos obrigatórios...')
      const missingFields = []
      const fieldCheck = {
        title: productData.title,
        productType: productData.productType,
        classification: productData.classification,
        category: productData.category,
        description: productData.description,
        price: productData.price,
        offer: productData.offer,
      }

      console.log('🔍 [DEBUG] Valores dos campos:')
      Object.entries(fieldCheck).forEach(([key, value]) => {
        console.log(`  ${key}: ${value} (${typeof value})`)
        if (!value) missingFields.push(key)
      })

      if (missingFields.length > 0) {
        console.error('\n❌ [DEBUG] CAMPOS OBRIGATÓRIOS AUSENTES!')
        console.error('🔍 Campos ausentes:', missingFields)
        console.error(
          '🔍 Dados completos recebidos:',
          JSON.stringify(productData, null, 2)
        )
        throw new Error(
          `CAMPOS_OBRIGATORIOS_AUSENTES - Campos ausentes: ${missingFields.join(
            ', '
          )}`
        )
      }

      console.log('✅ [DEBUG] Todos os campos obrigatórios estão presentes')

      return productData
    } catch (error: any) {
      console.error('❌ Erro na análise com OpenAI:', error)

      // Log detalhado do erro para debug
      console.error('🔍 Detalhes do erro OpenAI (múltiplas imagens):', {
        status: error.status,
        message: error.message,
        type: error.type,
        code: error.code,
      })

      // Tratar erros específicos da OpenAI
      if (error.status === 429) {
        console.error('⚠️ Rate limit atingido - Status 429')
        throw new Error('RATE_LIMIT')
      }

      if (error.status === 400) {
        console.error('❌ Erro 400 - Bad Request:', error.message)
        throw new Error('Imagens inválidas ou muito grandes para a OpenAI')
      }

      if (error.status === 401) {
        console.error('❌ Erro 401 - Unauthorized:', error.message)
        throw new Error('Chave da OpenAI inválida ou sem permissões')
      }

      if (error.status === 402) {
        console.error('❌ Erro 402 - Payment Required:', error.message)
        throw new Error('Quota da OpenAI esgotada - verifique billing')
      }

      if (error.status === 403) {
        console.error('❌ Erro 403 - Forbidden:', error.message)
        throw new Error('Acesso negado pela OpenAI - verifique permissões')
      }

      if (error.status === 500) {
        console.error('❌ Erro 500 - Internal Server Error:', error.message)
        throw new Error('Erro interno da OpenAI - tente novamente')
      }

      // Verificar se é erro de rede
      if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        throw new Error('Erro de conexão com a OpenAI. Verifique sua internet.')
      }

      // Se não tem status, é um erro interno
      if (error.message.includes('JSON')) {
        throw new Error(
          'Falha ao processar resposta da IA. Tente com imagens diferentes.'
        )
      }

      // Re-throw com mensagem mais amigável
      throw new Error(`Falha na análise: ${error.message}`)
    }
  }

  // Método de fallback inteligente baseado na imagem
  static async generateSmartFallbackProduct(
    filename?: string
  ): Promise<GeneratedProduct> {
    console.log('🔄 Usando método fallback inteligente...')

    // Tentar detectar tipo de produto pelo nome do arquivo
    let productType = 'vestuario'
    let classification = 'camiseta'
    let category = 'manga_curta'
    let title = 'Camiseta Preta Básica'
    let description =
      'Camiseta preta básica de algodão, confortável e versátil para uso casual'

    if (filename) {
      const lowerFilename = filename.toLowerCase()

      // Detectar vestuário
      if (
        lowerFilename.includes('camiseta') ||
        lowerFilename.includes('shirt')
      ) {
        productType = 'vestuario'
        classification = 'camiseta'
        category = 'manga_curta'
        title = 'Camiseta Estilosa'
        description =
          'Camiseta moderna e confortável, perfeita para o dia a dia'
      } else if (
        lowerFilename.includes('bone') ||
        lowerFilename.includes('cap')
      ) {
        productType = 'vestuario'
        classification = 'bone'
        category = 'aba_curva'
        title = 'Boné Moderno'
        description = 'Boné elegante com aba curva, ideal para proteção solar'
      } else if (
        lowerFilename.includes('moletom') ||
        lowerFilename.includes('hoodie')
      ) {
        productType = 'vestuario'
        classification = 'moletom'
        category = 'com_capuz'
        title = 'Moletom Confortável'
        description = 'Moletom quentinho com capuz, perfeito para dias frios'
      }

      // Detectar comida/bebida
      else if (
        lowerFilename.includes('prato') ||
        lowerFilename.includes('comida')
      ) {
        productType = 'menu'
        classification = 'prato_principal'
        category = 'carne'
        title = 'Prato Especial'
        description =
          'Delicioso prato principal preparado com ingredientes frescos'
      } else if (
        lowerFilename.includes('bebida') ||
        lowerFilename.includes('drink')
      ) {
        productType = 'menu'
        classification = 'bebida'
        category = 'suco'
        title = 'Bebida Refrescante'
        description =
          'Bebida natural e refrescante, ideal para qualquer momento'
      }

      // Detectar souvenirs
      else if (
        lowerFilename.includes('artesanato') ||
        lowerFilename.includes('craft')
      ) {
        productType = 'souvenir'
        classification = 'artesanato'
        category = 'madeira'
        title = 'Peça Artesanal'
        description = 'Produto artesanal único, feito com técnicas tradicionais'
      }
    }

    const product: GeneratedProduct = {
      title,
      productType: productType as 'souvenir' | 'menu' | 'vestuario',
      classification,
      category,
      description,
      price: Math.round((Math.random() * 200 + 30) * 100) / 100, // R$ 30-230
      offer: 0,
    }

    // Calcular oferta (10-30% de desconto)
    const discountPercent = Math.random() * 0.2 + 0.1 // 10-30%
    product.offer =
      Math.round(product.price * (1 - discountPercent) * 100) / 100

    console.log('✅ Produto fallback gerado:', product)
    return product
  }

  // Método de fallback usando GPT-3.5 (sem análise de imagem)
  static async generateFallbackProduct(): Promise<GeneratedProduct> {
    console.log('🔄 Usando método fallback simples...')

    if (!openai) {
      console.error('❌ Cliente OpenAI não inicializado para fallback')
      throw new Error('Cliente OpenAI não disponível para fallback')
    }

    const prompt = `
Gere um produto de vestuário (camiseta preta) seguindo EXATAMENTE as regras:

TIPOS PERMITIDOS: vestuario
CLASSIFICAÇÕES: camiseta
CATEGORIAS: manga_curta

RETORNE APENAS UM JSON válido:
{
  "title": "Camiseta Preta Básica",
  "productType": "vestuario",
  "classification": "camiseta", 
  "category": "manga_curta",
  "description": "Camiseta preta básica de algodão, confortável e versátil para uso casual",
  "price": 45.99,
  "offer": 35.99
}
`

    try {
      const completion = await openai!.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 200,
        temperature: 0.3,
      })

      const content = completion.choices[0]?.message?.content
      if (!content) {
        throw new Error('Nenhum conteúdo retornado')
      }

      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('JSON não encontrado na resposta')
      }

      return JSON.parse(jsonMatch[0]) as GeneratedProduct
    } catch (error) {
      console.error('❌ Erro no fallback GPT-3.5:', error)

      // Se também falhar, usar fallback offline
      console.log('🔄 Usando fallback offline...')
      return this.generateSmartFallbackProduct()
    }
  }

  /**
   * Processar cardápio/menu em massa usando OCR
   * @param imageBase64 Imagem do cardápio em base64
   * @param mimeType Tipo da imagem
   * @returns Lista de produtos extraídos
   */
  static async processMenuOCR(
    imageBase64: string,
    mimeType: string = 'image/jpeg'
  ): Promise<MenuOCRResult> {
    console.log('🍽️ Iniciando processamento de cardápio/menu em massa...')
    const startTime = Date.now()

    const imageSizeKB = Math.round((imageBase64.length * 3) / 4 / 1024)
    console.log(`📷 Tamanho da imagem do cardápio: ${imageSizeKB} KB`)

    try {
      // Primeira tentativa: OpenAI Vision com prompt otimizado para cardápio
      console.log('🔍 Tentativa 1: OpenAI Vision para análise de cardápio...')
      const visionStartTime = Date.now()

      const menuPrompt = `🍽️ VOCÊ É UM ESPECIALISTA EM EXTRAIR CARDÁPIOS!

Esta imagem contém um CARDÁPIO com MÚLTIPLOS PRODUTOS listados. 
Sua tarefa é extrair CADA PRODUTO INDIVIDUAL listado no cardápio.

📋 EXEMPLO PRÁTICO:
Se vir um cardápio assim:
"PORÇÕES:
- Batata Frita R$15
- Isca de Frango R$20
BEBIDAS:  
- Coca-Cola R$8
- Suco de Laranja R$10"

Você DEVE retornar 4 produtos:
{
  "products": [
    {"title": "Batata Frita", "price": 15.00, "productType": "menu", "classification": "prato_principal", "category": "porcao", "description": "Porção de batata frita", "offer": 13.00},
    {"title": "Isca de Frango", "price": 20.00, "productType": "menu", "classification": "prato_principal", "category": "porcao", "description": "Porção de isca de frango", "offer": 18.00},
    {"title": "Coca-Cola", "price": 8.00, "productType": "menu", "classification": "bebida", "category": "refrigerante", "description": "Refrigerante Coca-Cola", "offer": 7.00},
    {"title": "Suco de Laranja", "price": 10.00, "productType": "menu", "classification": "bebida", "category": "suco", "description": "Suco natural de laranja", "offer": 9.00}
  ]
}

🚨 REGRAS OBRIGATÓRIAS:
1. CONTE quantos produtos existem na imagem ANTES de começar
2. Se vir 8 produtos → retorne 8 produtos no JSON
3. Se vir 12 produtos → retorne 12 produtos no JSON  
4. NUNCA retorne apenas 1 produto se há vários na imagem
5. Extraia o nome COMPLETO de cada produto (ex: "Picanha na Manteiga" não é "Manteiga")
6. Cada linha/item do cardápio = 1 produto separado
7. Ignore títulos de seções (como "PORÇÕES", "BEBIDAS")

🔥 PROCESSO PASSO A PASSO:
1. Examine TODA a imagem
2. Identifique CADA produto listado
3. Conte quantos produtos encontrou  
4. Extraia TODOS eles no JSON
5. Verifique se o número no JSON corresponde ao que contou

❌ EXEMPLOS DE ERRO:
- Ver 10 produtos → retornar 1 
- "Picanha na Manteiga" → extrair só "Manteiga"
- Parar de ler no meio do cardápio

✅ EXEMPLOS CORRETOS:
- Ver 10 produtos → retornar 10 no JSON
- "Picanha na Manteiga" → extrair "Picanha na Manteiga"  
- Ler TODO o cardápio até o final

AGORA ANALISE ESTA IMAGEM e extraia TODOS OS PRODUTOS:`

      try {
        const completion = await openai!.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: menuPrompt },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${mimeType};base64,${imageBase64}`,
                    detail: 'high', // Usar alta resolução para cardápios
                  },
                },
              ],
            },
          ],
          max_tokens: 4000, // 🔥 AUMENTADO para múltiplos produtos
          temperature: 0.2, // 🔥 AUMENTADO para maior criatividade na leitura
        })

        const visionTime = Date.now() - visionStartTime
        console.log(`⏱️ OpenAI Vision respondeu em ${visionTime}ms`)

        const content = completion.choices[0]?.message?.content
        if (!content) {
          throw new Error('Nenhum conteúdo retornado da OpenAI Vision')
        }

        console.log('📝 Resposta da Vision API:', content)

        // 🔍 DEBUG: Analisar resposta do cardápio
        console.log('🔍 [DEBUG CARDÁPIO] Analisando resposta da OpenAI...')

        // Extrair JSON da resposta
        const jsonMatch = content.match(/\{[\s\S]*\}/)
        if (!jsonMatch) {
          console.error(
            '❌ [DEBUG] JSON não encontrado na resposta:',
            content.substring(0, 300)
          )
          throw new Error('JSON não encontrado na resposta da Vision API')
        }

        console.log('🔍 [DEBUG CARDÁPIO] JSON extraído:', jsonMatch[0])

        const parsedResult = JSON.parse(jsonMatch[0])

        console.log(
          '🔍 [DEBUG CARDÁPIO] Estrutura parseada:',
          JSON.stringify(parsedResult, null, 2)
        )

        if (!parsedResult.products || !Array.isArray(parsedResult.products)) {
          console.error(
            '❌ [DEBUG CARDÁPIO] Estrutura inválida - esperado array "products":',
            parsedResult
          )
          throw new Error(
            'Formato de resposta inválido - products não encontrado'
          )
        }

        console.log(
          `🔍 [DEBUG CARDÁPIO] Produtos no JSON: ${parsedResult.products.length}`
        )

        // 🚨 ALERTA: Verificar se retornou apenas 1 produto de um cardápio
        if (parsedResult.products.length === 1) {
          console.error(
            '🚨 [PROBLEMA] Apenas 1 produto extraído de um cardápio!'
          )
          console.error(
            '🔍 [ANÁLISE] Produto extraído:',
            parsedResult.products[0]
          )
          console.error(
            '🔍 [DICA] Verifique se a imagem realmente contém vários produtos'
          )
          console.error(
            '🔍 [DICA] Se houver vários produtos, o prompt precisa ser melhorado'
          )
          console.error('🔍 [FORÇANDO FALLBACK] Tentando com Tesseract OCR...')

          // 🔥 FORÇAR fallback para Tesseract quando detectar apenas 1 produto
          throw new Error(
            'OpenAI Vision retornou apenas 1 produto - forçando fallback para Tesseract'
          )
        } else if (parsedResult.products.length > 1) {
          console.log(
            `✅ [SUCESSO] ${parsedResult.products.length} produtos extraídos corretamente!`
          )
          console.log(
            '🔍 [PRODUTOS] Lista de títulos:',
            parsedResult.products.map((p) => p.title).join(', ')
          )
        }

        // Validar e limpar produtos
        const validProducts: GeneratedProduct[] = []
        for (const product of parsedResult.products) {
          if (product.title && product.price) {
            // Sanitizar e validar título
            let title = product.title.trim()
            if (title.length < 2) {
              console.warn(`⚠️ Título muito curto: "${title}", expandindo...`)
              title = `Produto ${title}` // Expandir títulos muito curtos
            }
            if (title.length > 100) {
              title = title.substring(0, 97) + '...' // Truncar títulos muito longos
            }

            // Validar preço
            const price = parseFloat(product.price)
            if (isNaN(price) || price <= 0) {
              console.warn(
                `⚠️ Preço inválido: ${product.price}, usando preço padrão`
              )
              continue // Pular produtos com preço inválido
            }

            // Garantir campos obrigatórios
            const validProduct: GeneratedProduct = {
              title: title,
              productType: 'menu',
              classification: product.classification || 'prato_principal',
              category: product.category || 'geral',
              description:
                product.description || `Delicioso ${title.toLowerCase()}`,
              price: price,
              offer:
                product.offer && !isNaN(parseFloat(product.offer))
                  ? parseFloat(product.offer)
                  : Math.round(price * 0.9 * 100) / 100, // 10% desconto arredondado
            }

            console.log(
              `✅ Produto validado: "${validProduct.title}" - R$ ${validProduct.price}`
            )
            validProducts.push(validProduct)
          } else {
            console.warn(`⚠️ Produto inválido ignorado:`, {
              title: product.title,
              price: product.price,
            })
          }
        }

        const totalTime = Date.now() - startTime
        console.log(
          `✅ OpenAI Vision: ${validProducts.length} produtos extraídos em ${totalTime}ms`
        )

        return {
          success: true,
          products: validProducts,
          processingTimeMs: totalTime,
          method: 'openai-vision',
          extractedText: content,
          confidence: 0.9,
        }
      } catch (visionError: any) {
        console.error('❌ Falha na OpenAI Vision:', visionError.message)

        // Se é rate limit, tentar Tesseract
        if (
          visionError.status === 429 ||
          visionError.message === 'RATE_LIMIT'
        ) {
          console.log('⚠️ Rate limit - tentando Tesseract OCR...')
          return await this.processMenuWithTesseract(imageBase64, startTime)
        }

        throw visionError
      }
    } catch (error: any) {
      console.error('❌ Erro no processamento do cardápio:', error)

      // Fallback: Tesseract OCR
      console.log('🔄 Fallback: tentando Tesseract OCR...')
      try {
        return await this.processMenuWithTesseract(imageBase64, startTime)
      } catch (tesseractError: any) {
        console.error('❌ Tesseract também falhou:', tesseractError.message)

        // Último fallback: produto genérico
        const totalTime = Date.now() - startTime
        return {
          success: false,
          products: [await this.generateSmartFallbackProduct()],
          processingTimeMs: totalTime,
          method: 'hybrid',
          confidence: 0.1,
        }
      }
    }
  }

  /**
   * Processar cardápio usando Tesseract OCR
   */
  private static async processMenuWithTesseract(
    imageBase64: string,
    originalStartTime: number
  ): Promise<MenuOCRResult> {
    console.log('🔍 Iniciando OCR com Tesseract...')
    const tesseractStartTime = Date.now()

    try {
      // Converter base64 para buffer para o Tesseract
      const imageBuffer = Buffer.from(imageBase64, 'base64')

      // Extrair texto da imagem
      const extractedText = await tesseract.recognize(imageBuffer, {
        lang: 'por+eng', // Português e inglês
        oem: 1,
        psm: 6, // Uniform block of text
      })

      const ocrTime = Date.now() - tesseractStartTime
      console.log(`⏱️ Tesseract OCR concluído em ${ocrTime}ms`)
      console.log('📝 Texto extraído:', extractedText.substring(0, 500) + '...')

      // Processar texto extraído para identificar produtos
      const products = await this.parseMenuText(extractedText)

      const totalTime = Date.now() - originalStartTime
      console.log(
        `✅ Tesseract: ${products.length} produtos extraídos em ${totalTime}ms`
      )

      return {
        success: true,
        extractedText,
        products,
        processingTimeMs: totalTime,
        method: 'tesseract-ocr',
        confidence: 0.7,
      }
    } catch (error: any) {
      console.error('❌ Erro no Tesseract OCR:', error)
      throw new Error(`Tesseract falhou: ${error.message}`)
    }
  }

  /**
   * Analisar texto extraído para identificar produtos do menu
   */
  private static async parseMenuText(
    text: string
  ): Promise<GeneratedProduct[]> {
    console.log('🔍 Analisando texto extraído para identificar produtos...')

    if (!openai) {
      throw new Error('OpenAI não disponível para análise de texto')
    }

    const textAnalysisPrompt = `🔍 FALLBACK TESSERACT - EXTRAIR MÚLTIPLOS PRODUTOS DO CARDÁPIO

TEXTO EXTRAÍDO DO CARDÁPIO:
${text}

🎯 MISSÃO: Encontrar TODOS os produtos listados neste texto.
📋 O texto acima foi extraído de uma imagem de cardápio que contém MÚLTIPLOS produtos.

🚨 REGRA CRÍTICA: NUNCA retorne apenas 1 produto se há vários no texto!

EXEMPLO PRÁTICO:
Se o texto contém:
"PORÇÕES
Batata Canoa 20
Isca de Frango 20
BEBIDAS  
Coca Cola 8
Suco Natural 10"

Você DEVE retornar 4 produtos:
{
  "products": [
    {"title": "Batata Canoa", "price": 20.00, "productType": "menu", "classification": "prato_principal", "category": "porcao", "description": "Porção de batata canoa", "offer": 18.00},
    {"title": "Isca de Frango", "price": 20.00, "productType": "menu", "classification": "prato_principal", "category": "porcao", "description": "Porção de isca de frango", "offer": 18.00},
    {"title": "Coca Cola", "price": 8.00, "productType": "menu", "classification": "bebida", "category": "refrigerante", "description": "Refrigerante Coca Cola", "offer": 7.00},
    {"title": "Suco Natural", "price": 10.00, "productType": "menu", "classification": "bebida", "category": "suco", "description": "Suco natural", "offer": 9.00}
  ]
}

🔥 PROCESSO OBRIGATÓRIO:
1. Leia TODO o texto linha por linha
2. Identifique CADA produto individual  
3. Conte quantos produtos encontrou
4. Extraia TODOS no JSON final
5. Se encontrou 8 produtos → retorne 8 no JSON
6. Se encontrou 12 produtos → retorne 12 no JSON

❌ ERRO CRÍTICO:
- Encontrar 10 produtos no texto → retornar apenas 1 no JSON

✅ SUCESSO:
- Encontrar 10 produtos no texto → retornar 10 no JSON
- Usar nomes COMPLETOS (ex: "Picanha na Manteiga" não apenas "Manteiga")

AGORA ANALISE O TEXTO E EXTRAIA TODOS OS PRODUTOS:`

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: textAnalysisPrompt }],
        max_tokens: 1500,
        temperature: 0.2,
      })

      const content = completion.choices[0]?.message?.content
      if (!content) {
        throw new Error('Nenhuma resposta da análise de texto')
      }

      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('JSON não encontrado na análise de texto')
      }

      const parsedResult = JSON.parse(jsonMatch[0])

      if (!parsedResult.products || !Array.isArray(parsedResult.products)) {
        return []
      }

      // Validar produtos extraídos
      const validProducts: GeneratedProduct[] = []
      for (const product of parsedResult.products) {
        if (product.title && product.price) {
          // Sanitizar e validar título
          let title = product.title.trim()
          if (title.length < 2) {
            console.warn(`⚠️ Título muito curto: "${title}", expandindo...`)
            title = `Produto ${title}`
          }
          if (title.length > 100) {
            title = title.substring(0, 97) + '...'
          }

          // Validar preço
          const price = parseFloat(product.price)
          if (isNaN(price) || price <= 0) {
            console.warn(
              `⚠️ Preço inválido: ${product.price}, ignorando produto`
            )
            continue
          }

          validProducts.push({
            title: title,
            productType: 'menu',
            classification: product.classification || 'prato_principal',
            category: product.category || 'geral',
            description: product.description || `${title}`,
            price: price,
            offer:
              product.offer && !isNaN(parseFloat(product.offer))
                ? parseFloat(product.offer)
                : Math.round(price * 0.9 * 100) / 100,
          })

          console.log(`✅ Produto OCR validado: "${title}" - R$ ${price}`)
        }
      }

      console.log(
        `✅ ${validProducts.length} produtos identificados na análise de texto`
      )
      return validProducts
    } catch (error: any) {
      console.error('❌ Erro na análise de texto:', error)
      return []
    }
  }
}
