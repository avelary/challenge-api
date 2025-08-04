#!/usr/bin/env node

/**
 * 🔍 DEBUG - Teste da Rota Cardápio
 *
 * Vamos ver exatamente o que está acontecendo com a rota /bulk-menu-ocr
 */

const fetch = require('node-fetch')
const FormData = require('form-data')
const fs = require('fs')

const API_URL = 'http://localhost:3333'

async function testCardapioRoute() {
  console.log('🔍 TESTE DEBUG - ROTA CARDÁPIO\n')

  try {
    // 1. Testar se a API está rodando
    console.log('1️⃣ Testando se API está online...')
    const healthResponse = await fetch(`${API_URL}/products/test-openai`)

    if (!healthResponse.ok) {
      console.error('❌ API não está respondendo. Execute: npm run dev')
      return
    }

    console.log('✅ API está online')

    // 2. Testar a rota correta para cardápio
    console.log('\n2️⃣ Testando rota BULK MENU OCR...')

    // Criar um arquivo de teste simples (se não existir)
    const testImagePath = './test.png'
    if (!fs.existsSync(testImagePath)) {
      console.log('⚠️ Arquivo test.png não encontrado')
      console.log('💡 Copie uma imagem de cardápio como "test.png" nesta pasta')
      return
    }

    const form = new FormData()
    form.append('images', fs.createReadStream(testImagePath))

    console.log('📤 Enviando para: /products/bulk-menu-ocr')
    console.log('📤 Método: POST')
    console.log('📤 Tipo: FormData com imagem')

    const startTime = Date.now()

    const response = await fetch(`${API_URL}/products/bulk-menu-ocr`, {
      method: 'POST',
      body: form,
      headers: form.getHeaders(),
    })

    const totalTime = Date.now() - startTime

    console.log(`\n📊 RESPOSTA RECEBIDA em ${totalTime}ms:`)
    console.log(`📊 Status: ${response.status}`)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ ERRO:', errorText)
      return
    }

    const result = await response.json()

    console.log('\n🎯 RESULTADO:')
    console.log('─'.repeat(50))
    console.log(
      `✨ Produtos encontrados: ${result.summary?.totalProductsFound || 'N/A'}`
    )
    console.log(
      `💾 Produtos salvos: ${result.summary?.totalProductsSaved || 'N/A'}`
    )
    console.log(`🔧 Método OCR: ${result.summary?.ocrMethod || 'N/A'}`)

    if (result.products && result.products.length > 0) {
      console.log('\n📋 PRODUTOS CADASTRADOS:')
      result.products.forEach((product, index) => {
        console.log(`${index + 1}. ${product.title} (SKU: ${product.idsku})`)
      })

      // VERIFICAR SE CADASTROU APENAS 1 PRODUTO
      if (result.products.length === 1) {
        console.log('\n🚨 PROBLEMA DETECTADO:')
        console.log('❌ Apenas 1 produto foi cadastrado de um cardápio!')
        console.log('🔍 Produto:', result.products[0])
        console.log('\n💡 CAUSA PROVÁVEL:')
        console.log('- OpenAI Vision não conseguiu ler múltiplos produtos')
        console.log('- Tesseract fallback também falhou')
        console.log('- Imagem pode estar muito embaçada')
        console.log('\n🔧 SOLUÇÕES:')
        console.log(
          '1. Verificar logs da API para ver exatamente o que aconteceu'
        )
        console.log('2. Testar com imagem mais clara')
        console.log('3. Verificar se está usando a rota correta')
      } else {
        console.log('\n✅ SUCESSO: Múltiplos produtos cadastrados!')
      }
    }
  } catch (error) {
    console.error('❌ ERRO NO TESTE:', error.message)

    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 SOLUÇÃO:')
      console.log('1. Abra outro terminal')
      console.log('2. Execute: npm run dev')
      console.log('3. Aguarde a mensagem "Server listening on port 3333"')
      console.log('4. Execute este teste novamente')
    }
  }
}

async function testWrongRoute() {
  console.log('\n3️⃣ Testando rota ERRADA (para comparação)...')

  try {
    const testImagePath = './test.png'
    if (!fs.existsSync(testImagePath)) return

    const form = new FormData()
    form.append('images', fs.createReadStream(testImagePath))

    console.log('📤 Enviando para: /products/generate-ai (ROTA ERRADA)')

    const response = await fetch(`${API_URL}/products/generate-ai`, {
      method: 'POST',
      body: form,
      headers: form.getHeaders(),
    })

    if (response.ok) {
      const result = await response.json()
      console.log('⚠️ ROTA ERRADA FUNCIONOU - Retornou produto único:')
      console.log(`   Título: ${result.product?.title || 'N/A'}`)
      console.log('')
      console.log('🎯 COMPARAÇÃO:')
      console.log('❌ /generate-ai → 1 produto (ERRADO para cardápio)')
      console.log('✅ /bulk-menu-ocr → N produtos (CORRETO para cardápio)')
    }
  } catch (error) {
    console.log('✅ Rota errada falhou (isso é bom)')
  }
}

async function main() {
  console.log('🧪 TESTE DEBUG - VERIFICAR ROTA CARDÁPIO')
  console.log('═'.repeat(60))

  await testCardapioRoute()
  await testWrongRoute()

  console.log('\n═'.repeat(60))
  console.log('🔍 DIAGNÓSTICO COMPLETO')

  console.log('\n💡 PRÓXIMOS PASSOS:')
  console.log(
    '1. Verificar logs da API (terminal onde está rodando npm run dev)'
  )
  console.log('2. Verificar se a interface está usando a rota correta')
  console.log('3. Se ainda falhar, problema está no prompt OpenAI')
}

// Executar se chamado diretamente
if (require.main === module) {
  main().catch(console.error)
}
