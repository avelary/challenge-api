"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UploadController = void 0;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const config_1 = require("../config");
const promises_1 = require("stream/promises");
class UploadController {
    // Handler para upload de arquivo usando Fastify multipart
    async handleUpload(request, reply) {
        try {
            // Verificar se é multipart/form-data
            const data = await request.file();
            if (!data) {
                return reply.status(400).send({ error: 'No file uploaded' });
            }
            // Criar pasta uploads se não existir
            if (!fs_1.default.existsSync(config_1.UPLOADS_DIR)) {
                fs_1.default.mkdirSync(config_1.UPLOADS_DIR, { recursive: true });
            }
            // Gerar nome único para o arquivo
            const ext = path_1.default.extname(data.filename);
            const filename = `${Date.now()}${ext}`;
            const filepath = path_1.default.join(config_1.UPLOADS_DIR, filename);
            // Salvar arquivo
            await (0, promises_1.pipeline)(data.file, fs_1.default.createWriteStream(filepath));
            // URL pública para acesso à imagem
            const imageUrl = `/uploads/${filename}`;
            return reply.status(201).send({ imageUrl });
        }
        catch (error) {
            request.log.error(error);
            return reply.status(500).send({ error: 'Failed to upload file' });
        }
    }
}
exports.UploadController = UploadController;
