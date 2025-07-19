import { FastifyRequest, FastifyReply } from 'fastify'
import path from 'path'
import fs from 'fs'
import { UPLOADS_DIR } from '../config'
import { pipeline } from 'stream/promises'

class UploadController {
  // Handler para upload de arquivo usando Fastify multipart
  async handleUpload(request: FastifyRequest, reply: FastifyReply) {
    try {
      // Verificar se é multipart/form-data
      const data = await request.file()

      if (!data) {
        return reply.status(400).send({ error: 'No file uploaded' })
      }

      // Criar pasta uploads se não existir
      if (!fs.existsSync(UPLOADS_DIR)) {
        fs.mkdirSync(UPLOADS_DIR, { recursive: true })
      }

      // Gerar nome único para o arquivo
      const ext = path.extname(data.filename)
      const filename = `${Date.now()}${ext}`
      const filepath = path.join(UPLOADS_DIR, filename)

      // Salvar arquivo
      await pipeline(data.file, fs.createWriteStream(filepath))

      // URL pública para acesso à imagem
      const imageUrl = `/uploads/${filename}`

      return reply.status(201).send({ imageUrl })
    } catch (error) {
      request.log.error(error)
      return reply.status(500).send({ error: 'Failed to upload file' })
    }
  }
}

export { UploadController }
