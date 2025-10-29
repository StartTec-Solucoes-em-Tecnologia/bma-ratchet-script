const axios = require('axios');
const sharp = require('sharp');

/**
 * Processador de Imagens Faciais
 * Responsável por download, redimensionamento, compressão e conversão para base64
 */

class ImageProcessor {
    constructor() {
        this.maxSizeKB = 100;
        this.targetSize = { width: 500, height: 500 };
    }

    /**
     * Baixa imagem de uma URL
     */
    async downloadImage(imageUrl) {
        try {
            const response = await axios.get(imageUrl, {
                responseType: 'arraybuffer',
                timeout: 30000,
                headers: {
                    'User-Agent': 'BMA-Facial-Registration/2.0.0'
                }
            });
            
            return Buffer.from(response.data);
        } catch (error) {
            throw new Error(`Erro ao baixar imagem: ${error.message}`);
        }
    }

    /**
     * Processa imagem: redimensiona, comprime e converte para JPEG
     */
    async processImage(imageBuffer) {
        try {
            // Redimensiona para 500x500px mantendo proporção
            let processedBuffer = await sharp(imageBuffer)
                .resize(this.targetSize.width, this.targetSize.height, {
                    fit: 'inside',
                    withoutEnlargement: true
                })
                .jpeg({ quality: 90 })
                .toBuffer();

            // Se ainda estiver muito grande, reduz qualidade
            let quality = 90;
            while (processedBuffer.length > this.maxSizeKB * 1024 && quality > 10) {
                quality -= 10;
                processedBuffer = await sharp(imageBuffer)
                    .resize(this.targetSize.width, this.targetSize.height, {
                        fit: 'inside',
                        withoutEnlargement: true
                    })
                    .jpeg({ quality })
                    .toBuffer();
            }

            return processedBuffer;
        } catch (error) {
            throw new Error(`Erro ao processar imagem: ${error.message}`);
        }
    }

    /**
     * Converte buffer de imagem para base64
     */
    imageToBase64(imageBuffer) {
        return imageBuffer.toString('base64');
    }

    /**
     * Processa imagem completa: download + processamento + base64
     */
    async processUserImage(user) {
        try {
            // Download da imagem
            const imageBuffer = await this.downloadImage(user.facialImageUrl);
            
            // Processa imagem (redimensiona e comprime)
            const processedImage = await this.processImage(imageBuffer);
            
            // Converte para base64
            const photoBase64 = this.imageToBase64(processedImage);
            
            return {
                ...user,
                photoBase64,
                imageSize: processedImage.length
            };
        } catch (error) {
            console.error(`❌ Erro ao processar imagem de ${user.name}:`, error.message);
            return null;
        }
    }

    /**
     * Processa lote de usuários
     */
    async processBatch(users) {
        const processedUsers = [];
        let processedCount = 0;
        let errorCount = 0;

        for (const user of users) {
            try {
                const processedUser = await this.processUserImage(user);
                if (processedUser) {
                    processedUsers.push(processedUser);
                    processedCount++;
                } else {
                    errorCount++;
                }
            } catch (error) {
                console.error(`❌ Erro ao processar ${user.name}:`, error.message);
                errorCount++;
            }
        }

        return {
            processedUsers,
            processedCount,
            errorCount
        };
    }

    /**
     * Valida especificações da imagem
     */
    validateImageSpecs(imageBuffer) {
        const specs = {
            minWidth: 150,
            maxWidth: 600,
            minHeight: 300,
            maxHeight: 1200,
            maxSizeKB: this.maxSizeKB
        };

        // Verifica tamanho do arquivo
        const sizeKB = imageBuffer.length / 1024;
        if (sizeKB > specs.maxSizeKB) {
            return {
                valid: false,
                error: `Imagem muito grande: ${sizeKB.toFixed(2)}KB (máx: ${specs.maxSizeKB}KB)`
            };
        }

        return { valid: true };
    }
}

module.exports = ImageProcessor;
