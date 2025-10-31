const fs = require("fs").promises;
const sharp = require("sharp");

/**
 * Worker Thread para Processamento de Imagens
 * Função serializável para uso com piscina
 */

const maxSizeKB = 100;
const targetSize = { width: 500, height: 500 };

/**
 * Processa uma imagem: redimensiona, comprime e converte para base64
 * Esta função será executada em worker threads
 */
async function processUserImage(userData) {
  try {
    const { user, imagePath } = userData;

    // Carrega imagem do cache
    const imageBuffer = await fs.readFile(imagePath);

    // Redimensiona para 500x500px mantendo proporção
    let processedBuffer = await sharp(imageBuffer)
      .resize(targetSize.width, targetSize.height, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 90 })
      .toBuffer();

    // Se ainda estiver muito grande, reduz qualidade
    let quality = 90;
    while (processedBuffer.length > maxSizeKB * 1024 && quality > 10) {
      quality -= 10;
      processedBuffer = await sharp(imageBuffer)
        .resize(targetSize.width, targetSize.height, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality })
        .toBuffer();
    }

    // Converte para base64
    const photoBase64 = processedBuffer.toString("base64");

    return {
      ...user,
      photoBase64,
      imageSize: processedBuffer.length,
    };
  } catch (error) {
    return {
      error: true,
      user: userData.user,
      message: error.message,
    };
  }
}

// Exporta a função diretamente para uso com piscina
module.exports = processUserImage;

// Também exporta como named export para compatibilidade
module.exports.processUserImage = processUserImage;
