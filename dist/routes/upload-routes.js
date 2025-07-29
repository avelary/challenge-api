"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadRoutes = uploadRoutes;
const upload_controller_1 = require("../controllers/upload-controller");
const uploadController = new upload_controller_1.UploadController();
async function uploadRoutes(fastify) {
    // POST /upload - Upload de arquivo
    fastify.post('/', uploadController.handleUpload.bind(uploadController));
}
