#!/usr/bin/env node

/**
 * 🧪 Script de Teste - Funcionalidade de OCR em Massa
 *
 * Este script demonstra como usar a nova funcionalidade de cadastro
 * de produtos em massa a partir de imagens de cardápio.
 */

const FormData = require('form-data')
const fs = require('fs')
const path = require('path')

// Configurações
const API_BASE_URL = 'http://localhost:3333'
const TEST_IMAGE_PATH = './test.png' // Substitua pelo caminho da sua imagem de teste

/**
 * Testa a funcionalidade de OCR em massa
 */
async function testBulkOCR() {
  console.log('🧪 INICIANDO TESTE DE OCR EM MASSA\n')

  try {
    // 1. Verificar se o arquivo de teste existe
    if (!fs.existsSync(TEST_IMAGE_PATH)) {
      console.error(`❌ Arquivo de teste não encontrado: ${TEST_IMAGE_PATH}`)
      console.log(
        '💡 Dica: Coloque uma imagem de cardápio como "test.png" na pasta da API'
      )
      return
    }

    // 2. Preparar dados do formulário
    console.log('📤 Preparando upload da imagem...')
    const form = new FormData()
    const imageStream = fs.createReadStream(TEST_IMAGE_PATH)
    form.append('images', imageStream)

    // 3. Fazer requisição
    console.log('🚀 Enviando requisição para OCR em massa...')
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

    // 5. Exibir resultados
    console.log('\n✅ TESTE CONCLUÍDO COM SUCESSO!\n')

    console.log('📊 RESUMO DOS RESULTADOS:')
    console.log('─'.repeat(50))
    console.log(`✨ Produtos encontrados: ${result.summary.totalProductsFound}`)
    console.log(`💾 Produtos salvos: ${result.summary.totalProductsSaved}`)
    console.log(`🔧 Método OCR: ${result.summary.ocrMethod}`)
    console.log(
      `💯 Confiança: ${(result.summary.ocrConfidence * 100).toFixed(1)}%`
    )
    console.log(`⏱️ Tempo total: ${totalTime}ms`)

    console.log('\n🎯 DETALHES DE PERFORMANCE:')
    console.log('─'.repeat(50))
    console.log(
      `🖼️ Otimização imagem: ${result.performance.imageOptimizationMs}ms`
    )
    console.log(`🔍 Processamento OCR: ${result.performance.ocrProcessingMs}ms`)
    console.log(`💾 Salvamento massa: ${result.performance.bulkSaveMs}ms`)

    console.log('\n📋 PRODUTOS CADASTRADOS:')
    console.log('─'.repeat(50))
    result.products.forEach((product, index) => {
      console.log(`${index + 1}. ${product.title}`)
      console.log(`   💰 Preço: R$ ${product.price.toFixed(2)}`)
      console.log(`   🏷️ Oferta: R$ ${product.offer.toFixed(2)}`)
      console.log(`   📝 Descrição: ${product.description}`)
      console.log(`   🆔 ID: ${product.idsku}`)
      console.log('')
    })

    if (result.summary.extractedText) {
      console.log('\n📝 TEXTO EXTRAÍDO (prévia):')
      console.log('─'.repeat(50))
      console.log(result.summary.extractedText.substring(0, 200) + '...')
    }

    console.log('\n🔍 INFORMAÇÕES DE DEBUG:')
    console.log('─'.repeat(50))
    console.log(`📊 Imagem original: ${result.debug.originalImageSizeMB} MB`)
    console.log(`🗜️ Imagem otimizada: ${result.debug.optimizedImageSizeKB} KB`)
    console.log(`💾 Imagem no banco: ${result.debug.dbImageSizeKB} KB`)
  } catch (error) {
    console.error('❌ ERRO NO TESTE:', error.message)

    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 DICAS DE SOLUÇÃO:')
      console.log('1. Verifique se a API está rodando em http://localhost:3333')
      console.log('2. Execute: npm run dev')
      console.log('3. Verifique se todas as dependências estão instaladas')
    }
  }
}

/**
 * Testa conectividade básica da API
 */
async function testAPIConnectivity() {
  console.log('🔌 Testando conectividade da API...')

  try {
    const response = await fetch(`${API_BASE_URL}/products/test-openai`)

    if (response.ok) {
      const result = await response.json()
      console.log('✅ API conectada e OpenAI funcionando')
      return true
    } else {
      console.log('⚠️ API conectada mas OpenAI com problemas')
      return false
    }
  } catch (error) {
    console.log('❌ API não está respondendo')
    console.log('💡 Execute: npm run dev')
    return false
  }
}

/**
 * Função principal
 */
async function main() {
  console.log('🚀 TESTE DE FUNCIONALIDADE - OCR EM MASSA')
  console.log('═'.repeat(60))
  console.log('')

  // 1. Testar conectividade
  const isConnected = await testAPIConnectivity()
  if (!isConnected) {
    console.log('\n❌ Não foi possível conectar com a API. Teste abortado.')
    return
  }

  console.log('')

  // 2. Executar teste principal
  await testBulkOCR()

  console.log('\n═'.repeat(60))
  console.log('🏁 TESTE FINALIZADO')
}

// Verificar se fetch está disponível (Node 18+)
if (typeof fetch === 'undefined') {
  console.error('❌ Este script requer Node.js 18+ (fetch nativo)')
  console.log('💡 Ou instale node-fetch: npm install node-fetch')
  process.exit(1)
}

// Executar se for chamado diretamente
if (require.main === module) {
  main().catch(console.error)
}

module.exports = { testBulkOCR, testAPIConnectivity }
