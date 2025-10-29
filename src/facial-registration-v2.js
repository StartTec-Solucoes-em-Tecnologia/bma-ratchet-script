const CacheManager = require('./modules/cache-manager');
const ImageProcessor = require('./modules/image-processor');
const ImageCacheManager = require('./modules/image-cache-manager');
const ApiClient = require('./modules/api-client');
const UserManager = require('./modules/user-manager');
const DeviceProcessor = require('./device-processor');
require('dotenv').config();

/**
 * Script Principal de Registro Facial v2.0
 * Sistema de processamento paralelo por dispositivo
 */

class FacialRegistrationService {
    constructor() {
        this.cacheManager = new CacheManager();
        this.imageProcessor = new ImageProcessor();
        this.imageCacheManager = new ImageCacheManager();
        this.apiClient = new ApiClient();
        this.userManager = new UserManager();
        this.deviceProcessor = new DeviceProcessor();
    }

    /**
     * Inicializa o serviço
     */
    async init() {
        console.log('🚀 BMA Facial Registration Script v2.0.0');
        console.log('   Sistema Paralelo: Processo separado por dispositivo\n');

        // Inicializa componentes
        await this.userManager.initRedis();
        await this.cacheManager.init();
        await this.imageCacheManager.init();
        
        // Sincroniza cache JSON com Redis
        await this.cacheManager.syncWithRedis(this.userManager.redisClient);
    }

    /**
     * Processo principal de registro facial
     */
    async registerAllFacesInAllDevices() {
        try {
            // Busca usuários com facial_image
            console.log('🔍 Buscando usuários com imagens faciais...');
            const users = await this.userManager.fetchInvitesWithFacialImages();
            
            if (users.length === 0) {
                console.log('ℹ️  Nenhum usuário encontrado com imagem facial');
                return {
                    success: true,
                    message: 'Nenhum usuário para processar'
                };
            }

            console.log(`\n📥 Baixando ${users.length} imagens faciais...\n`);

            // 1. Baixa todas as imagens (verifica cache primeiro)
            const downloadResults = await this.imageCacheManager.downloadAllImages(users);

            if (downloadResults.users.length === 0) {
                throw new Error('Nenhuma imagem foi baixada com sucesso');
            }

            console.log(`\n📸 Processando ${downloadResults.users.length} imagens para base64...\n`);

            // 2. Processa imagens baixadas (converte para base64)
            const { processedUsers, processedCount, errorCount } = await this.imageProcessor.processBatch(downloadResults.users);

            console.log(`\n📊 Processamento de imagens concluído:`);
            console.log(`   ✅ Sucesso: ${processedCount}`);
            console.log(`   ❌ Erros: ${errorCount}\n`);

            if (processedUsers.length === 0) {
                throw new Error('Nenhuma imagem foi processada com sucesso');
            }

            // 3. Formata nomes para os dispositivos (primeiro nome + último sobrenome)
            console.log(`📝 Formatando nomes para dispositivos...`);
            const usersWithFormattedNames = processedUsers.map(user => ({
                ...user,
                formattedName: this.userManager.formatNameForDevice(user.name)
            }));
            console.log(`   ✅ ${usersWithFormattedNames.length} nomes formatados\n`);

            // Converte string de IPs em array
            const deviceIps = process.env.FACE_READER_IPS || process.env.DEVICE_IPS;
            if (!deviceIps) {
                throw new Error('FACE_READER_IPS ou DEVICE_IPS não está definido nas variáveis de ambiente');
            }

            const ipArray = deviceIps.split(',').map(ip => ip.trim());
            
            console.log(`📡 Registrando em ${ipArray.length} leitora(s) facial(is)...`);
            console.log(`   IPs: ${ipArray.join(', ')}\n`);

            // Divide usuários em lotes de 10 (limite da API)
            const batches = this.userManager.chunkArray(usersWithFormattedNames, 10);
            console.log(`📦 Total de lotes: ${batches.length} (máx 10 usuários por lote)\n`);

            // Estatísticas globais
            const globalStats = {
                usersVerified: 0,
                usersDeleted: 0,
                usersRegistered: 0,
                facesRegistered: 0,
                redisSaves: 0,
                successfulBatches: 0,
                failedBatches: 0
            };

            const results = [];

            // Processa cada lote em paralelo em todas as leitoras
            for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
                const batch = batches[batchIndex];
                console.log(`\n═══════════════════════════════════════════`);
                console.log(`📦 Lote ${batchIndex + 1}/${batches.length} (${batch.length} usuários)`);
                console.log(`═══════════════════════════════════════════`);
                
                // Processa todas as leitoras em paralelo para este lote
                const batchResult = await this.deviceProcessor.processMultipleDevices(ipArray, batch, batchIndex);
                
                // Atualiza estatísticas globais
                globalStats.successfulBatches += batchResult.successful;
                globalStats.failedBatches += batchResult.failed;
                
                // Processa resultados individuais
                for (const result of batchResult.results) {
                    if (result.success && result.data) {
                        const stats = result.data.stats;
                        globalStats.usersVerified += stats.usersVerified;
                        globalStats.usersDeleted += stats.usersDeleted;
                        globalStats.usersRegistered += stats.usersRegistered;
                        globalStats.facesRegistered += stats.facesRegistered;
                        globalStats.redisSaves += stats.redisSaves;
                    }

                    results.push({
                        deviceIp: result.deviceIp,
                        batchIndex: batchIndex + 1,
                        success: result.success,
                        error: result.error,
                        stats: result.data?.stats || {}
                    });

                    console.log(`\n📊 Resultado da leitora ${result.deviceIp}:`);
                    console.log(`   ✅ Sucesso: ${result.success ? 'Sim' : 'Não'}`);
                    if (!result.success) {
                        console.log(`   ❌ Erro: ${result.error}`);
                    }
                    if (result.data?.stats) {
                        const stats = result.data.stats;
                        console.log(`   👀 Usuários verificados: ${stats.usersVerified}`);
                        console.log(`   🗑️  Usuários deletados: ${stats.usersDeleted}`);
                        console.log(`   👤 Usuários cadastrados: ${stats.usersRegistered}`);
                        console.log(`   🎭 Faces cadastradas: ${stats.facesRegistered}`);
                        console.log(`   💾 Saves no Redis: ${stats.redisSaves}`);
                    }
                }
            }

            // Relatório final
            this.showFinalReport(globalStats, results, ipArray);

            return {
                success: true,
                stats: globalStats,
                results: results
            };

        } catch (error) {
            console.error('❌ Erro fatal:', error.message);
            throw error;
        }
    }

    /**
     * Mostra relatório final
     */
    showFinalReport(globalStats, results, ipArray) {
        console.log('\n' + '═'.repeat(60));
        console.log('📊 RELATÓRIO FINAL - REGISTRO PARALELO');
        console.log('═'.repeat(60));
        
        console.log(`\n🔍 Operações Realizadas:`);
        console.log(`   👀 Usuários verificados: ${globalStats.usersVerified}`);
        console.log(`   🗑️  Usuários deletados: ${globalStats.usersDeleted}`);
        console.log(`   👤 Usuários cadastrados: ${globalStats.usersRegistered}`);
        console.log(`   🎭 Faces cadastradas: ${globalStats.facesRegistered}`);
        console.log(`   💾 Saves no Redis: ${globalStats.redisSaves}`);
        console.log(`   📄 Cache JSON: Ativo`);
        
        // Estatísticas do cache de imagens
        const imageCacheStats = this.imageCacheManager.getCacheStats();
        console.log(`\n📷 Cache de Imagens:`);
        console.log(`   📁 Total de imagens: ${imageCacheStats.totalImages}`);
        console.log(`   💾 Tamanho total: ${imageCacheStats.totalSizeMB}MB`);
        
        console.log(`\n📈 Resultados:`);
        console.log(`   ✅ Lotes bem-sucedidos: ${globalStats.successfulBatches}`);
        console.log(`   ❌ Lotes com erro: ${globalStats.failedBatches}`);
        console.log('═'.repeat(60));

        // Detalhes por leitora
        console.log('\n📋 DETALHES POR LEITORA:');
        ipArray.forEach(ip => {
            const deviceResults = results.filter(r => r.deviceIp === ip);
            const successful = deviceResults.filter(r => r.success).length;
            const failed = deviceResults.filter(r => !r.success).length;
            
            console.log(`\n🖥️  ${ip}:`);
            console.log(`   ✅ Sucessos: ${successful}`);
            console.log(`   ❌ Falhas: ${failed}`);
            
            if (failed > 0) {
                console.log(`   📋 Erros:`);
                deviceResults
                    .filter(r => !r.success)
                    .forEach(r => {
                        console.log(`     - Lote ${r.batchIndex}: ${r.error}`);
                    });
            }
        });

        console.log('\n🎉 Processamento paralelo concluído!');
        console.log('═'.repeat(60) + '\n');
    }
}

// Execução principal
async function main() {
    try {
        const registration = new FacialRegistrationService();
        await registration.init();
        await registration.registerAllFacesInAllDevices();
    } catch (error) {
        console.error('❌ Erro fatal:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = FacialRegistrationService;