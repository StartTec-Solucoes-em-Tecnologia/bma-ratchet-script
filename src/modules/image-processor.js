const fs = require("fs").promises;
const sharp = require("sharp");
const Piscina = require("piscina");
const path = require("path");
const os = require("os");

/**
 * Processador de Imagens Faciais
 * Responsável por processamento de imagens em cache, redimensionamento, compressão e conversão para base64
 */

class ImageProcessor {
  constructor() {
    this.maxSizeKB = 100;
    this.targetSize = { width: 500, height: 500 };
    this.pool = null;
    this.maxThreads = Math.max(2, Math.floor(os.cpus().length / 2));
  }

  /**
   * Carrega imagem do cache local
   */
  async loadImageFromCache(imagePath) {
    try {
      const imageBuffer = await fs.readFile(imagePath);
      return imageBuffer;
    } catch (error) {
      throw new Error(`Erro ao carregar imagem do cache: ${error.message}`);
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
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality: 90 })
        .toBuffer();

      // Se ainda estiver muito grande, reduz qualidade
      let quality = 90;
      while (processedBuffer.length > this.maxSizeKB * 1024 && quality > 10) {
        quality -= 10;
        processedBuffer = await sharp(imageBuffer)
          .resize(this.targetSize.width, this.targetSize.height, {
            fit: "inside",
            withoutEnlargement: true,
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
    return imageBuffer.toString("base64");
  }

  /**
   * Processa imagem completa: carregamento do cache + processamento + base64
   */
  async processUserImage(user) {
    try {
      // Carrega imagem do cache
      const imageBuffer = await this.loadImageFromCache(user.imagePath);

      // Processa imagem (redimensiona e comprime)
      const processedImage = await this.processImage(imageBuffer);

      // Converte para base64
      const photoBase64 = this.imageToBase64(processedImage);

      return {
        ...user,
        photoBase64,
        imageSize: processedImage.length,
      };
    } catch (error) {
      console.error(
        `❌ Erro ao processar imagem de ${user.name}:`,
        error.message
      );
      return null;
    }
  }

  /**
   * Inicializa thread pool para processamento paralelo
   */
  _initPool() {
    if (!this.pool) {
      const workerPath = path.join(
        __dirname,
        "..",
        "workers",
        "image-processor-worker.js"
      );
      this.pool = new Piscina({
        filename: workerPath,
        maxThreads: this.maxThreads,
        minThreads: 2,
      });
    }
    return this.pool;
  }

  /**
   * Finaliza thread pool
   */
  async destroy() {
    if (this.pool) {
      await this.pool.destroy();
      this.pool = null;
    }
  }

  /**
   * Processa lote de usuários em paralelo usando thread pool
   */
  async processBatchParallel(users) {
    if (users.length === 0) {
      return {
        processedUsers: [],
        processedCount: 0,
        errorCount: 0,
      };
    }

    const pool = this._initPool();
    const processedUsers = [];
    let processedCount = 0;
    let errorCount = 0;

    try {
      // Prepara dados para os workers
      const tasks = users.map((user) => ({
        user,
        imagePath: user.imagePath,
      }));

      // Processa todas as imagens em paralelo
      const results = await Promise.allSettled(
        tasks.map((task) => pool.run(task))
      );

      // Processa resultados
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const user = users[i];

        if (result.status === "fulfilled") {
          const processedUser = result.value;
          if (processedUser && !processedUser.error) {
            processedUsers.push(processedUser);
            processedCount++;
          } else {
            console.error(
              `❌ Erro ao processar imagem de ${user.name}:`,
              processedUser?.message || "Erro desconhecido"
            );
            errorCount++;
          }
        } else {
          console.error(
            `❌ Erro ao processar ${user.name}:`,
            result.reason?.message || result.reason
          );
          errorCount++;
        }
      }
    } catch (error) {
      console.error("❌ Erro no processamento paralelo:", error.message);
      throw error;
    }

    return {
      processedUsers,
      processedCount,
      errorCount,
    };
  }

  /**
   * Processa lote de usuários (método sequencial - mantido para compatibilidade)
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
      errorCount,
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
      maxSizeKB: this.maxSizeKB,
    };

    // Verifica tamanho do arquivo
    const sizeKB = imageBuffer.length / 1024;
    if (sizeKB > specs.maxSizeKB) {
      return {
        valid: false,
        error: `Imagem muito grande: ${sizeKB.toFixed(2)}KB (máx: ${
          specs.maxSizeKB
        }KB)`,
      };
    }

    return { valid: true };
  }
}

module.exports = ImageProcessor;
