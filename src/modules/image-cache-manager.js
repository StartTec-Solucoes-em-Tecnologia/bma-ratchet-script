const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

/**
 * Gerenciador de Cache de Imagens
 * Responsável por baixar, armazenar e verificar imagens localmente
 */

class ImageCacheManager {
    constructor() {
        this.cacheDir = path.join(__dirname, '..', '..', 'cache', 'images');
        this.metadataFile = path.join(this.cacheDir, 'metadata.json');
        this.metadata = {};
    }

    /**
     * Inicializa o diretório de cache de imagens
     */
    async init() {
        try {
            await fs.mkdir(this.cacheDir, { recursive: true });
            await this.loadMetadata();
            console.log('📁 Cache de imagens inicializado');
        } catch (error) {
            console.warn('⚠️  Erro ao inicializar cache de imagens:', error.message);
        }
    }

    /**
     * Carrega metadados do cache
     */
    async loadMetadata() {
        try {
            const data = await fs.readFile(this.metadataFile, 'utf8');
            this.metadata = JSON.parse(data);
        } catch (error) {
            if (error.code === 'ENOENT') {
                this.metadata = {};
            } else {
                console.warn('⚠️  Erro ao carregar metadados do cache:', error.message);
            }
        }
    }

    /**
     * Salva metadados do cache
     */
    async saveMetadata() {
        try {
            await fs.writeFile(this.metadataFile, JSON.stringify(this.metadata, null, 2), 'utf8');
        } catch (error) {
            console.warn('⚠️  Erro ao salvar metadados do cache:', error.message);
        }
    }

    /**
     * Gera hash da URL da imagem para usar como nome do arquivo
     */
    generateImageHash(imageUrl) {
        return crypto.createHash('md5').update(imageUrl).digest('hex');
    }

    /**
     * Verifica se a imagem já foi baixada
     */
    async isImageCached(imageUrl) {
        const hash = this.generateImageHash(imageUrl);
        const imagePath = path.join(this.cacheDir, `${hash}.jpg`);
        
        try {
            await fs.access(imagePath);
            return {
                cached: true,
                path: imagePath,
                hash: hash
            };
        } catch (error) {
            return {
                cached: false,
                path: imagePath,
                hash: hash
            };
        }
    }

    /**
     * Baixa e salva imagem no cache
     */
    async downloadAndCacheImage(imageUrl, userId, forceDownload = false) {
        // Valida URL
        if (!imageUrl || typeof imageUrl !== 'string') {
            console.error(`❌ URL inválida para ${userId}: ${imageUrl}`);
            return {
                success: false,
                error: 'URL inválida ou não fornecida'
            };
        }

        const cacheInfo = await this.isImageCached(imageUrl);
        
        // Se está em cache E não é forceDownload, retorna do cache
        if (cacheInfo.cached && !forceDownload) {
            // console.log(`📷 Imagem já em cache: ${userId}`);
            return {
                success: true,
                path: cacheInfo.path,
                hash: cacheInfo.hash,
                cached: true
            };
        }

        try {
            const axios = require('axios');
            const response = await axios.get(imageUrl, {
                responseType: 'arraybuffer',
                timeout: 30000,
                headers: {
                    'User-Agent': 'BMA-Facial-Registration/2.0.0'
                },
                validateStatus: (status) => status === 200
            });

            const imageBuffer = Buffer.from(response.data);
            
            // Valida se realmente é uma imagem
            if (imageBuffer.length < 100) {
                throw new Error('Arquivo muito pequeno (possivelmente inválido)');
            }

            await fs.writeFile(cacheInfo.path, imageBuffer);
            
            // Salva metadados
            this.metadata[cacheInfo.hash] = {
                url: imageUrl,
                userId: userId,
                downloadedAt: new Date().toISOString(),
                size: imageBuffer.length
            };
            await this.saveMetadata();

            console.log(`⬇️  Imagem baixada: ${userId} (${(imageBuffer.length / 1024).toFixed(2)}KB)`);
            
            return {
                success: true,
                path: cacheInfo.path,
                hash: cacheInfo.hash,
                cached: false
            };

        } catch (error) {
            const errorMsg = error.response 
                ? `HTTP ${error.response.status}: ${error.response.statusText}`
                : error.message;
            console.error(`❌ Erro ao baixar imagem de ${userId}: ${errorMsg}`);
            console.error(`   URL: ${imageUrl}`);
            return {
                success: false,
                error: errorMsg
            };
        }
    }

    /**
     * Baixa todas as imagens necessárias
     */
    async downloadAllImages(users, forceDownload = false) {
        console.log(`\n📥 Baixando ${users.length} imagens...`);
        if (forceDownload) {
            console.log(`   🔄 Modo: FORÇAR DOWNLOAD (ignora cache)`);
        }
        
        const results = {
            total: users.length,
            downloaded: 0,
            cached: 0,
            errors: 0,
            users: []
        };

        for (let i = 0; i < users.length; i++) {
            const user = users[i];
            console.log(`   ${i + 1}/${users.length} - ${user.name}...`);
            
            const result = await this.downloadAndCacheImage(user.facialImageUrl, user.userId, forceDownload);
            
            if (result.success) {
                results.users.push({
                    ...user,
                    imagePath: result.path,
                    imageHash: result.hash,
                    wasCached: result.cached
                });
                
                if (result.cached) {
                    results.cached++;
                } else {
                    results.downloaded++;
                }
            } else {
                results.errors++;
                console.log(`   ⚠️  ${user.name} - falha no download`);
            }
        }

        console.log(`\n📊 Download concluído:`);
        console.log(`   ⬇️  Baixadas: ${results.downloaded}`);
        console.log(`   📷 Em cache: ${results.cached}`);
        console.log(`   ❌ Erros: ${results.errors}`);
        console.log(`   ✅ Total processadas: ${results.users.length}\n`);

        return results;
    }

    /**
     * Limpa cache antigo (opcional)
     */
    async cleanupOldImages(daysOld = 30) {
        try {
            const files = await fs.readdir(this.cacheDir);
            const imageFiles = files.filter(file => file.endsWith('.jpg'));
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysOld);

            let cleanedCount = 0;
            for (const file of imageFiles) {
                const filePath = path.join(this.cacheDir, file);
                const stats = await fs.stat(filePath);
                
                if (stats.mtime < cutoffDate) {
                    await fs.unlink(filePath);
                    cleanedCount++;
                }
            }

            if (cleanedCount > 0) {
                console.log(`🧹 ${cleanedCount} imagens antigas removidas do cache`);
            }

        } catch (error) {
            console.warn('⚠️  Erro ao limpar cache antigo:', error.message);
        }
    }

    /**
     * Obtém estatísticas do cache
     */
    getCacheStats() {
        const totalImages = Object.keys(this.metadata).length;
        const totalSize = Object.values(this.metadata).reduce((sum, meta) => sum + (meta.size || 0), 0);
        
        return {
            totalImages,
            totalSizeKB: Math.round(totalSize / 1024),
            totalSizeMB: Math.round(totalSize / (1024 * 1024) * 100) / 100
        };
    }
}

module.exports = ImageCacheManager;
