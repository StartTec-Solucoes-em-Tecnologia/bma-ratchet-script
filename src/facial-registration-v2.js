const CacheManager = require('./modules/cache-manager');
const ImageProcessor = require('./modules/image-processor');
const ImageCacheManager = require('./modules/image-cache-manager');
const ApiClient = require('./modules/api-client');
const UserManager = require('./modules/user-manager');
require('dotenv').config();

/**
 * Script Principal de Registro Facial v2.0
 * Arquivo simplificado que orquestra todos os módulos
 */

class FacialRegistrationService {
    constructor() {
        this.cacheManager = new CacheManager();
        this.imageProcessor = new ImageProcessor();
        this.imageCacheManager = new ImageCacheManager();
        this.apiClient = new ApiClient();
        this.userManager = new UserManager();
    }

    /**
     * Inicializa o serviço
     */
    async init() {
        console.log('🚀 BMA Facial Registration Script v2.0.0');
        console.log('   Sistema Modular: Cache JSON + Redis + Processamento Assíncrono\n');

        // Inicializa componentes
        await this.userManager.initRedis();
        await this.cacheManager.init();
        await this.cacheManager.load();
        await this.imageCacheManager.init();
        
        // Sincroniza cache JSON com Redis
        await this.cacheManager.syncWithRedis(this.userManager.redisClient);
    }

    /**
     * Processo principal de registro facial
     */
    async registerAllFaces() {
        try {
            // Verifica variáveis de ambiente
            const deviceIps = process.env.FACE_READER_IPS;
            if (!deviceIps) {
                throw new Error('Variável de ambiente FACE_READER_IPS não está definida');
            }

            // Busca usuários com facial_image
            const users = await this.userManager.fetchInvitesWithFacialImages();
            if (users.length === 0) {
                console.log('⚠️  Nenhum usuário com facial_image encontrado');
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

            // Converte string de IPs em array
            const ipArray = deviceIps.split(',').map(ip => ip.trim());
            
            console.log(`📡 Registrando em ${ipArray.length} leitora(s) facial(is)...`);
            console.log(`   IPs: ${ipArray.join(', ')}\n`);

            // Divide usuários em lotes de 10 (limite da API)
            const batches = this.userManager.chunkArray(processedUsers, 10);
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

            // Processa cada lote em cada leitora
            for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
                const batch = batches[batchIndex];
                console.log(`\n═══════════════════════════════════════════`);
                console.log(`📦 Lote ${batchIndex + 1}/${batches.length} (${batch.length} usuários)`);
                console.log(`═══════════════════════════════════════════`);
                
                for (const deviceIp of ipArray) {
                    const batchStats = {
                        usersVerified: 0,
                        usersDeleted: 0,
                        usersRegistered: 0,
                        facesRegistered: 0,
                        redisSaves: 0
                    };

                    // Processa lote na leitora
                    const result = await this.apiClient.processBatch(deviceIp, batch, batchStats);
                    
                    // Salva usuários no cache JSON e Redis
                    for (const user of batch) {
                        const saveResult = await this.userManager.saveUser(deviceIp, user.userId, {
                            name: user.name,
                            email: user.email,
                            document: user.document,
                            cellphone: user.cellphone,
                            type: user.type,
                            inviteId: user.inviteId
                        }, this.cacheManager);
                        
                        if (saveResult.success) {
                            batchStats.redisSaves++;
                        }
                    }
                    
                    // Atualiza estatísticas globais
                    globalStats.usersVerified += batchStats.usersVerified;
                    globalStats.usersDeleted += batchStats.usersDeleted;
                    globalStats.usersRegistered += batchStats.usersRegistered;
                    globalStats.facesRegistered += batchStats.facesRegistered;
                    globalStats.redisSaves += batchStats.redisSaves;
                    
                    if (result.success) {
                        globalStats.successfulBatches++;
                    } else {
                        globalStats.failedBatches++;
                    }

                    results.push({
                        deviceIp,
                        batch: batchIndex + 1,
                        success: result.success,
                        stats: batchStats
                    });

                    // Pausa entre dispositivos
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }

            // Relatório final
            this.printFinalReport(users, processedCount, errorCount, ipArray, batches, globalStats, results);

            return {
                success: globalStats.failedBatches === 0,
                totalUsers: users.length,
                processedImages: processedCount,
                processingErrors: errorCount,
                devices: ipArray.length,
                batches: batches.length,
                stats: globalStats,
                results
            };

        } catch (error) {
            console.error('❌ Erro no processo principal:', error.message);
            throw error;
        } finally {
            // Fecha conexões
            await this.userManager.close();
        }
    }

    /**
     * Imprime relatório final
     */
    printFinalReport(users, processedCount, errorCount, ipArray, batches, globalStats, results) {
        console.log('\n\n═══════════════════════════════════════════');
        console.log('📊 RELATÓRIO FINAL COMPLETO - v2.0');
        console.log('═══════════════════════════════════════════');
        console.log(`👥 Total de usuários: ${users.length}`);
        console.log(`✅ Imagens processadas: ${processedCount}`);
        console.log(`❌ Erros no processamento: ${errorCount}`);
        console.log(`📡 Leitoras faciais: ${ipArray.length}`);
        console.log(`📦 Lotes processados: ${batches.length}`);
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
        console.log('═══════════════════════════════════════════\n');

        // Detalhes por leitora
        console.log('📋 DETALHES POR LEITORA:');
        ipArray.forEach(ip => {
            const deviceResults = results.filter(r => r.deviceIp === ip);
            const deviceSuccess = deviceResults.filter(r => r.success).length;
            const deviceFailure = deviceResults.filter(r => !r.success).length;
            const status = deviceFailure === 0 ? '✅' : '⚠️';
            
            console.log(`${status} ${ip}: ${deviceSuccess}/${deviceResults.length} lotes OK`);
        });

        // Estatísticas do cache
        const cacheStats = this.cacheManager.getStats();
        console.log(`\n📄 ESTATÍSTICAS DO CACHE JSON:`);
        console.log(`   📱 Dispositivos: ${cacheStats.totalDevices}`);
        console.log(`   👥 Total de usuários: ${cacheStats.totalUsers}`);
        Object.entries(cacheStats.usersByDevice).forEach(([device, count]) => {
            console.log(`   📍 ${device}: ${count} usuários`);
        });
    }

    /**
     * Executa o serviço completo
     */
    async run() {
        try {
            await this.init();
            return await this.registerAllFaces();
        } catch (error) {
            console.error('❌ Erro fatal:', error.message);
            process.exit(1);
        }
    }
}

// Execução se chamado diretamente
if (require.main === module) {
    const service = new FacialRegistrationService();
    service.run();
}

module.exports = FacialRegistrationService;
