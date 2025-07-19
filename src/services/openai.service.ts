import OpenAI from 'openai'

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

export class OpenAIService {
  static async analyzeProductImage(
    imageBase64: string
  ): Promise<GeneratedProduct> {
    console.log('🤖 Iniciando análise da imagem com OpenAI Vision...')

    // Verificar se a chave da API está configurada
    if (!process.env.OPENAI_API_KEY) {
      console.error('❌ OPENAI_API_KEY não configurada')
      throw new Error(
        'Chave da OpenAI não configurada. Verifique as variáveis de ambiente'
      )
    }

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

    const prompt = `
Analise esta imagem de produto e extraia as seguintes informações EXATAMENTE conforme as regras:

TIPOS PERMITIDOS:
- souvenir (para souvenirs, lembranças, artesanato)
- menu (para comidas, bebidas, pratos)
- vestuario (para roupas, acessórios vestíveis)

CLASSIFICAÇÕES POR TIPO:
- souvenir: artesanato, colecionavel, local
- menu: entrada, prato_principal, bebida
- vestuario: camiseta, bone, moletom

CATEGORIAS POR CLASSIFICAÇÃO:
- artesanato: madeira, ceramica, tecido
- colecionavel: moeda, selo, miniatura
- local: lembranca, cartao_postal, imas
- entrada: salada, sopa, petisco
- prato_principal: carne, peixe, vegetariano
- bebida: suco, refrigerante, alcoolica
- camiseta: manga_curta, manga_longa, regata
- bone: aba_reta, aba_curva, trucker
- moletom: com_capuz, sem_capuz, ziper

INSTRUÇÕES:
1. Identifique o que você vê na imagem
2. Classifique o produto no tipo mais adequado (souvenir, menu ou vestuario)
3. Escolha a classificação e categoria corretas
4. Crie um título descritivo baseado no que você vê
5. Escreva uma descrição detalhada do produto visível
6. Estime um preço justo entre R$ 10 e R$ 300
7. Defina uma oferta menor que o preço

RETORNE APENAS UM JSON válido no formato:
{
  "title": "Nome descritivo baseado na imagem",
  "productType": "tipo_identificado",
  "classification": "classificacao_adequada", 
  "category": "categoria_adequada",
  "description": "Descrição detalhada do que vê na imagem",
  "price": numero_preco_estimado,
  "offer": numero_oferta_menor
}
`

    try {
      console.log('📤 Enviando requisição para OpenAI...')

      const completion = await openai!.chat.completions.create({
        model: 'gpt-4o-mini', // Usar modelo mais barato e com limites maiores
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt,
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${imageBase64}`,
                  detail: 'low', // Usar resolução baixa para economizar tokens e evitar rate limit
                },
              },
            ],
          },
        ],
        max_tokens: 300, // Reduzir tokens para evitar rate limit
        temperature: 0.3,
      })

      console.log('📥 Resposta recebida da OpenAI')
      console.log('🔍 Usage:', completion.usage)

      const content = completion.choices[0]?.message?.content
      if (!content) {
        console.error('❌ Nenhum conteúdo retornado da OpenAI')
        throw new Error('Nenhum conteúdo retornado da OpenAI')
      }

      console.log('📝 Conteúdo da resposta:', content)

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

      console.log('✅ Produto analisado com sucesso:', productData)
      return productData
    } catch (error: any) {
      console.error('❌ Erro detalhado na análise:', error)

      // Tratamento específico de erros da OpenAI
      if (error.status) {
        console.error(`❌ Erro HTTP ${error.status}:`, error.message)
        switch (error.status) {
          case 401:
            throw new Error(
              'Chave da OpenAI inválida. Verifique sua configuração.'
            )
          case 404:
            throw new Error(
              'Modelo não encontrado. Verifique se sua conta tem acesso.'
            )
          case 429:
            console.warn(
              '⚠️ Rate limit atingido, será usado fallback automaticamente'
            )
            throw new Error('RATE_LIMIT') // Erro especial para trigger do fallback
          case 500:
            throw new Error('Erro interno da OpenAI. Tente novamente.')
          default:
            throw new Error(
              `Erro da OpenAI (${error.status}): ${error.message}`
            )
        }
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
}
