#!/usr/bin/env node

const { exec } = require('child_process')

console.log('🚀 Executando setup inicial do Railway...')

// Executar migrações do Prisma
exec('npx prisma migrate deploy', (error, stdout, stderr) => {
  if (error) {
    console.error('❌ Erro nas migrações:', error)
    return
  }

  console.log('✅ Migrações executadas com sucesso:')
  console.log(stdout)

  if (stderr) {
    console.log('Warnings:', stderr)
  }
})
