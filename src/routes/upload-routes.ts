import { FastifyInstance } from 'fastify'
import { UploadController } from '../controllers/upload-controller'

const uploadController = new UploadController()

export async function uploadRoutes(fastify: FastifyInstance) {
  // POST /upload - Upload de arquivo
  fastify.post('/', uploadController.handleUpload.bind(uploadController))
}
