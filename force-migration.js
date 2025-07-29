const { exec } = require('child_process')

console.log('🔧 Forçando aplicação de migração...')

// Tentar diferentes abordagens para aplicar a migração
async function forceMigration() {
  const commands = [
    'npx prisma migrate reset --force --skip-generate',
    'npx prisma migrate deploy --accept-data-loss',
    'npx prisma db push --force-reset --accept-data-loss',
    'npx prisma db push --skip-generate',
  ]

  for (const cmd of commands) {
    console.log(`\n🚀 Tentando: ${cmd}`)

    try {
      await new Promise((resolve, reject) => {
        exec(cmd, (error, stdout, stderr) => {
          if (error) {
            console.log(`❌ Falhou: ${error.message}`)
            resolve() // Continue para o próximo comando
          } else {
            console.log(`✅ Sucesso: ${stdout}`)
            resolve()
          }
        })
      })
    } catch (e) {
      console.log(`❌ Erro: ${e.message}`)
    }
  }

  console.log('\n✅ Script concluído')
}

forceMigration()
