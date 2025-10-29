const ImageCacheManager = require('./modules/image-cache-manager');
const path = require('path');

/**
 * Visualizador de Cache de Imagens
 * Permite visualizar, limpar e gerenciar o cache de imagens
 */

class ImageCacheViewer {
    constructor() {
        this.imageCacheManager = new ImageCacheManager();
    }

    /**
     * Inicializa o visualizador
     */
    async init() {
        await this.imageCacheManager.init();
    }

    /**
     * Lista todas as imagens em cache
     */
    async listImages() {
        const stats = this.imageCacheManager.getCacheStats();
        
        console.log('\n📷 IMAGENS EM CACHE:');
        console.log('═'.repeat(60));
        
        if (stats.totalImages === 0) {
            console.log('   Nenhuma imagem encontrada no cache');
            return;
        }

        console.log(`📊 Total: ${stats.totalImages} imagens`);
        console.log(`💾 Tamanho: ${stats.totalSizeMB}MB`);
        console.log(`📁 Diretório: ${this.imageCacheManager.cacheDir}`);
        console.log('═'.repeat(60));

        // Lista arquivos de imagem
        const fs = require('fs').promises;
        try {
            const files = await fs.readdir(this.imageCacheManager.cacheDir);
            const imageFiles = files.filter(file => file.endsWith('.jpg'));
            
            imageFiles.forEach((file, index) => {
                const hash = file.replace('.jpg', '');
                const metadata = this.imageCacheManager.metadata[hash];
                
                if (metadata) {
                    console.log(`${index + 1}. ${file}`);
                    console.log(`   👤 Usuário: ${metadata.userId}`);
                    console.log(`   🌐 URL: ${metadata.url}`);
                    console.log(`   📅 Baixado: ${new Date(metadata.downloadedAt).toLocaleString()}`);
                    console.log(`   📏 Tamanho: ${(metadata.size / 1024).toFixed(2)}KB`);
                } else {
                    console.log(`${index + 1}. ${file} (sem metadados)`);
                }
                console.log('─'.repeat(60));
            });
        } catch (error) {
            console.error('❌ Erro ao listar arquivos:', error.message);
        }
    }

    /**
     * Mostra estatísticas do cache
     */
    showStats() {
        const stats = this.imageCacheManager.getCacheStats();
        
        console.log('\n📊 ESTATÍSTICAS DO CACHE DE IMAGENS:');
        console.log('═'.repeat(50));
        console.log(`📁 Total de imagens: ${stats.totalImages}`);
        console.log(`💾 Tamanho total: ${stats.totalSizeKB}KB (${stats.totalSizeMB}MB)`);
        console.log(`📂 Diretório: ${this.imageCacheManager.cacheDir}`);
        console.log(`📄 Metadados: ${path.join(this.imageCacheManager.cacheDir, 'metadata.json')}`);
    }

    /**
     * Limpa cache antigo
     */
    async cleanupOldImages(days = 30) {
        console.log(`\n🧹 Limpando imagens com mais de ${days} dias...`);
        
        try {
            await this.imageCacheManager.cleanupOldImages(days);
            console.log('✅ Limpeza concluída');
        } catch (error) {
            console.error('❌ Erro na limpeza:', error.message);
        }
    }

    /**
     * Limpa todo o cache
     */
    async clearAllCache() {
        console.log('\n🗑️  Limpando todo o cache de imagens...');
        
        try {
            const fs = require('fs').promises;
            const files = await fs.readdir(this.imageCacheManager.cacheDir);
            const imageFiles = files.filter(file => file.endsWith('.jpg'));
            
            let removedCount = 0;
            for (const file of imageFiles) {
                try {
                    await fs.unlink(path.join(this.imageCacheManager.cacheDir, file));
                    removedCount++;
                } catch (error) {
                    console.warn(`⚠️  Erro ao remover ${file}:`, error.message);
                }
            }
            
            // Limpa metadados
            this.imageCacheManager.metadata = {};
            await this.imageCacheManager.saveMetadata();
            
            console.log(`✅ ${removedCount} imagens removidas do cache`);
        } catch (error) {
            console.error('❌ Erro ao limpar cache:', error.message);
        }
    }

    /**
     * Verifica integridade do cache
     */
    async checkIntegrity() {
        console.log('\n🔍 Verificando integridade do cache...');
        
        try {
            const fs = require('fs').promises;
            const files = await fs.readdir(this.imageCacheManager.cacheDir);
            const imageFiles = files.filter(file => file.endsWith('.jpg'));
            
            let validFiles = 0;
            let invalidFiles = 0;
            let orphanedMetadata = 0;
            
            // Verifica arquivos de imagem
            for (const file of imageFiles) {
                const filePath = path.join(this.imageCacheManager.cacheDir, file);
                try {
                    await fs.access(filePath);
                    validFiles++;
                } catch (error) {
                    invalidFiles++;
                    console.log(`❌ Arquivo inválido: ${file}`);
                }
            }
            
            // Verifica metadados órfãos
            for (const [hash, metadata] of Object.entries(this.imageCacheManager.metadata)) {
                const filePath = path.join(this.imageCacheManager.cacheDir, `${hash}.jpg`);
                try {
                    await fs.access(filePath);
                } catch (error) {
                    orphanedMetadata++;
                    console.log(`❌ Metadados órfãos: ${hash}`);
                }
            }
            
            console.log(`\n📊 Resultado da verificação:`);
            console.log(`   ✅ Arquivos válidos: ${validFiles}`);
            console.log(`   ❌ Arquivos inválidos: ${invalidFiles}`);
            console.log(`   🗑️  Metadados órfãos: ${orphanedMetadata}`);
            
        } catch (error) {
            console.error('❌ Erro na verificação:', error.message);
        }
    }

    /**
     * Mostra ajuda
     */
    showHelp() {
        console.log('\n📖 COMANDOS DISPONÍVEIS:');
        console.log('═'.repeat(50));
        console.log('node src/image-cache-viewer.js list                    - Lista todas as imagens');
        console.log('node src/image-cache-viewer.js stats                  - Mostra estatísticas');
        console.log('node src/image-cache-viewer.js cleanup [dias]         - Limpa imagens antigas');
        console.log('node src/image-cache-viewer.js clear                  - Limpa todo o cache');
        console.log('node src/image-cache-viewer.js check                  - Verifica integridade');
        console.log('node src/image-cache-viewer.js help                   - Mostra esta ajuda');
    }
}

// Execução via linha de comando
async function main() {
    const viewer = new ImageCacheViewer();
    await viewer.init();

    const command = process.argv[2];
    const arg = process.argv[3];

    switch (command) {
        case 'list':
            await viewer.listImages();
            break;
        case 'stats':
            viewer.showStats();
            break;
        case 'cleanup':
            const days = parseInt(arg) || 30;
            await viewer.cleanupOldImages(days);
            break;
        case 'clear':
            await viewer.clearAllCache();
            break;
        case 'check':
            await viewer.checkIntegrity();
            break;
        case 'help':
        default:
            viewer.showHelp();
            break;
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = ImageCacheViewer;
