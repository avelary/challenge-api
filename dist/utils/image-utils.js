"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImageUtils = void 0;
const sharp_1 = __importDefault(require("sharp"));
class ImageUtils {
    /**
     * Compress and resize image buffer
     * @param buffer Original image buffer
     * @param maxWidth Maximum width in pixels (default: 1024)
     * @param maxHeight Maximum height in pixels (default: 1024)
     * @param quality JPEG quality 1-100 (default: 80)
     * @returns Compressed image buffer
     */
    static async compressImage(buffer, maxWidth = 1024, maxHeight = 1024, quality = 80) {
        console.log(`🗜️ Comprimindo imagem (${buffer.length} bytes → qualidade ${quality})...`);
        const startTime = Date.now();
        try {
            const compressed = await (0, sharp_1.default)(buffer)
                .resize(maxWidth, maxHeight, {
                fit: 'inside',
                withoutEnlargement: true,
            })
                .jpeg({ quality, progressive: true })
                .toBuffer();
            const originalKB = Math.round(buffer.length / 1024);
            const compressedKB = Math.round(compressed.length / 1024);
            const savings = Math.round(((buffer.length - compressed.length) / buffer.length) * 100);
            const processingTime = Date.now() - startTime;
            console.log(`✅ Compressão concluída em ${processingTime}ms: ${originalKB}KB → ${compressedKB}KB (${savings}% menor)`);
            return compressed;
        }
        catch (error) {
            console.error('❌ Erro na compressão da imagem:', error);
            throw new Error('Falha ao comprimir imagem');
        }
    }
    /**
     * Get image metadata
     * @param buffer Image buffer
     * @returns Image metadata
     */
    static async getImageMetadata(buffer) {
        try {
            const metadata = await (0, sharp_1.default)(buffer).metadata();
            return {
                width: metadata.width,
                height: metadata.height,
                format: metadata.format,
                size: buffer.length,
                channels: metadata.channels,
                density: metadata.density,
            };
        }
        catch (error) {
            console.error('❌ Erro ao obter metadados da imagem:', error);
            throw new Error('Falha ao analisar imagem');
        }
    }
    /**
     * Convert buffer to base64 with compression
     * @param buffer Original image buffer
     * @param mimeType Original mime type
     * @param maxSizeKB Maximum size in KB (default: 500)
     * @returns Compressed base64 string and final mime type
     */
    static async bufferToCompressedBase64(buffer, mimeType, maxSizeKB = 500) {
        const originalSizeKB = Math.round(buffer.length / 1024);
        console.log(`📸 Processando imagem: ${originalSizeKB}KB (limite: ${maxSizeKB}KB)`);
        let processedBuffer = buffer;
        let resultMimeType = mimeType;
        // Se a imagem é maior que o limite, comprimir
        if (originalSizeKB > maxSizeKB) {
            // Calcular qualidade baseada no tamanho
            const compressionRatio = maxSizeKB / originalSizeKB;
            const quality = Math.max(20, Math.min(80, Math.round(compressionRatio * 100)));
            console.log(`🎯 Aplicando compressão com qualidade ${quality}%`);
            processedBuffer = await this.compressImage(buffer, 1024, 1024, quality);
            resultMimeType = 'image/jpeg'; // Sharp sempre retorna JPEG
            // Se ainda está grande, tentar redimensionamento mais agressivo
            const newSizeKB = Math.round(processedBuffer.length / 1024);
            if (newSizeKB > maxSizeKB) {
                console.log(`⚠️ Ainda grande (${newSizeKB}KB), aplicando redimensionamento agressivo`);
                const aggressiveWidth = Math.round(512 * compressionRatio);
                processedBuffer = await this.compressImage(buffer, aggressiveWidth, aggressiveWidth, Math.max(30, quality));
            }
        }
        const base64 = processedBuffer.toString('base64');
        const finalSizeKB = Math.round(processedBuffer.length / 1024);
        return {
            base64,
            mimeType: resultMimeType,
            sizeKB: finalSizeKB,
        };
    }
}
exports.ImageUtils = ImageUtils;
