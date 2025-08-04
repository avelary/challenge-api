#!/usr/bin/env node

/**
 * 🧪 Teste Específico - OCR de Cardápio em Massa
 *
 * Testa a funcionalidade de extrair múltiplos produtos de uma imagem de cardápio
 */

const FormData = require('form-data')
const fs = require('fs')

// Configurações
const API_BASE_URL = 'http://localhost:3333'
const TEST_IMAGE_PATH = './cardapio.jpg' // Substitua pelo caminho da sua imagem de cardápio

/**
 * Testa OCR de cardápio em massa
 */
async function testBulkMenuOCR() {
  console.log('🍽️ TESTE OCR CARDÁPIO EM MASSA\n')

  try {
    // 1. Verificar se o arquivo existe
    if (!fs.existsSync(TEST_IMAGE_PATH)) {
      console.error(`❌ Arquivo não encontrado: ${TEST_IMAGE_PATH}`)
      console.log('💡 Dica: Coloque uma imagem de cardápio como "cardapio.jpg"')
      return
    }

    // 2. Preparar requisição
    console.log('📤 Preparando upload da imagem de cardápio...')
    const form = new FormData()
    const imageStream = fs.createReadStream(TEST_IMAGE_PATH)
    form.append('images', imageStream)

    // 3. Fazer requisição para OCR em massa
    console.log('🚀 Enviando para OCR em massa...')
    console.log(`📡 URL: ${API_BASE_URL}/products/bulk-menu-ocr`)

    const startTime = Date.now()

    const response = await fetch(`${API_BASE_URL}/products/bulk-menu-ocr`, {
      method: 'POST',
      body: form,
      headers: form.getHeaders(),
    })

    const totalTime = Date.now() - startTime

    // 4. Processar resposta
    if (!response.ok) {
      const errorText = await response.text()
      console.error(`❌ Erro HTTP ${response.status}:`, errorText)
      return
    }

    const result = await response.json()

    // 5. Analisar resultado
    console.log('\n✅ TESTE CONCLUÍDO!\n')

    // Verificar se extraiu múltiplos produtos
    const productCount = result.summary.totalProductsSaved

    if (productCount === 1) {
      console.log('⚠️  ATENÇÃO: Apenas 1 produto cadastrado!')
      console.log('🔍 Verifique se:')
      console.log('   - A imagem contém múltiplos produtos visíveis')
      console.log('   - A imagem não está muito embaçada')
      console.log('   - Os produtos têm nomes claros no cardápio')
    } else if (productCount > 1) {
      console.log(`🎉 SUCESSO: ${productCount} produtos extraídos do cardápio!`)
    }

    console.log('\n📊 RESUMO:')
    console.log('─'.repeat(50))
    console.log(`✨ Produtos encontrados: ${result.summary.totalProductsFound}`)
    console.log(`💾 Produtos salvos: ${result.summary.totalProductsSaved}`)
    console.log(`🔧 Método OCR: ${result.summary.ocrMethod}`)
    console.log(
      `💯 Confiança: ${(result.summary.ocrConfidence * 100).toFixed(1)}%`
    )
    console.log(`⏱️ Tempo total: ${totalTime}ms`)

    console.log('\n🎯 PERFORMANCE:')
    console.log('─'.repeat(50))
    console.log(`🖼️ Otimização: ${result.performance.imageOptimizationMs}ms`)
    console.log(`🔍 OCR: ${result.performance.ocrProcessingMs}ms`)
    console.log(`💾 Salvamento: ${result.performance.bulkSaveMs}ms`)

    if (result.products && result.products.length > 0) {
      console.log('\n📋 PRODUTOS CADASTRADOS:')
      console.log('─'.repeat(50))
      result.products.forEach((product, index) => {
        console.log(`${index + 1}. ${product.title}`)
        console.log(
          `   💰 R$ ${product.price.toFixed(2)} → R$ ${product.offer.toFixed(
            2
          )}`
        )
        console.log(`   🆔 SKU: ${product.idsku}`)
        console.log('')
      })
    }

    // Mostrar texto extraído se disponível
    if (result.summary.extractedText) {
      console.log('\n📝 TEXTO EXTRAÍDO (prévia):')
      console.log('─'.repeat(50))
      console.log(result.summary.extractedText.substring(0, 300) + '...')
    }
  } catch (error) {
    console.error('❌ ERRO NO TESTE:', error.message)

    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 SOLUÇÕES:')
      console.log('1. Inicie a API: npm run dev')
      console.log('2. Verifique se está rodando na porta 3333')
    }
  }
}

/**
 * Função principal
 */
async function main() {
  console.log('🧪 TESTE ESPECÍFICO - OCR CARDÁPIO EM MASSA')
  console.log('═'.repeat(60))
  console.log('')

  await testBulkMenuOCR()

  console.log('\n═'.repeat(60))
  console.log('🏁 TESTE FINALIZADO')

  console.log('\n💡 DICAS:')
  console.log('- Para múltiplos produtos, use: /bulk-menu-ocr')
  console.log('- Para produto único, use: /generate-ai')
  console.log('- Verifique os logs da API para debug detalhado')
}

// Verificar se fetch está disponível
if (typeof fetch === 'undefined') {
  console.error('❌ Este script requer Node.js 18+ (fetch nativo)')
  process.exit(1)
}

// Executar se chamado diretamente
if (require.main === module) {
  main().catch(console.error)
}

module.exports = { testBulkMenuOCR }
