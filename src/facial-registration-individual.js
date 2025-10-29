const CacheManager = require('./modules/cache-manager');
const ImageProcessor = require('./modules/image-processor');
const ImageCacheManager = require('./modules/image-cache-manager');
const ApiClient = require('./modules/api-client');
const UserManager = require('./modules/user-manager');
require('dotenv').config();

/**
 * Script de Registro Facial Individual
 * Cadastra usuários um por vez usando API V1
 */

class IndividualFacialRegistration {
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
        console.log('🚀 BMA Facial Registration - Modo Individual');
        console.log('   API V1: Cadastro individual por usuário\n');

        // Inicializa componentes
        await this.userManager.initRedis();
        await this.cacheManager.init();
        await this.imageCacheManager.init();
        
        // Sincroniza cache JSON com Redis
        await this.cacheManager.syncWithRedis(this.userManager.redisClient);
    }

    /**
     * Processo principal de registro facial individual
     */
    async registerAllFacesIndividually() {
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

            // Estatísticas globais
            const globalStats = {
                usersVerified: 0,
                usersDeleted: 0,
                usersRegistered: 0,
                facesRegistered: 0,
                redisSaves: 0,
                successfulUsers: 0,
                failedUsers: 0
            };

            // Processa cada usuário individualmente em cada dispositivo
            for (let userIndex = 0; userIndex < usersWithFormattedNames.length; userIndex++) {
                const user = usersWithFormattedNames[userIndex];
                
                console.log(`\n═══════════════════════════════════════════`);
                console.log(`👤 Usuário ${userIndex + 1}/${usersWithFormattedNames.length}: ${user.formattedName}`);
                console.log(`═══════════════════════════════════════════`);
                
                // Processa em todos os dispositivos
                for (const deviceIp of ipArray) {
                    console.log(`\n🖥️  Processando dispositivo ${deviceIp}...`);
                    
                    try {
                        // 1. Verificar se usuário já existe
                        const existingUsers = await this.apiClient.fetchExistingUsers(deviceIp);
                        const existingUser = existingUsers.find(u => u.userId === user.userId);
                        
                        if (existingUser) {
                            console.log(`   🔍 Usuário ${user.userId} já existe (RecNo: ${existingUser.recNo})`);
                            globalStats.usersVerified++;
                            
                            // Deletar usuário existente
                            console.log(`   🗑️  Deletando usuário existente...`);
                            const deleteResult = await this.apiClient.deleteUser(deviceIp, existingUser.recNo);
                            if (deleteResult.success) {
                                globalStats.usersDeleted++;
                                console.log(`   ✅ Usuário deletado`);
                            }
                        }

                        // 2. Cadastrar usuário individualmente
                        console.log(`   👤 Cadastrando usuário...`);
                        const userRegResult = await this.apiClient.registerSingleUser(deviceIp, user);
                        
                        if (userRegResult.success) {
                            globalStats.usersRegistered++;
                            console.log(`   ✅ Usuário cadastrado - ${userRegResult.response}`);
                            
                            // 3. Aguardar estabilização
                            console.log(`   ⏳ Aguardando estabilização (2s)...`);
                            await new Promise(resolve => setTimeout(resolve, 2000));
                            
                            // 4. Cadastrar face individualmente
                            console.log(`   🎭 Cadastrando face...`);
                            const faceRegResult = await this.apiClient.registerSingleFace(deviceIp, user);
                            
                            if (faceRegResult.success) {
                                globalStats.facesRegistered++;
                                console.log(`   ✅ Face cadastrada`);
                            } else {
                                console.log(`   ❌ Falha ao cadastrar face: ${faceRegResult.error}`);
                            }
                            
                            // 5. Salvar no cache
                            const saveResult = await this.userManager.saveUser(deviceIp, user.userId, {
                                name: user.name,
                                email: user.email,
                                document: user.document,
                                cellphone: user.cellphone,
                                type: user.type,
                                inviteId: user.inviteId
                            }, this.cacheManager);
                            
                            if (saveResult.success) {
                                globalStats.redisSaves++;
                                console.log(`   💾 Salvo no cache`);
                            }
                            
                            globalStats.successfulUsers++;
                            console.log(`   🎉 Usuário ${user.formattedName} processado com sucesso em ${deviceIp}`);
                            
                        } else {
                            console.log(`   ❌ Falha ao cadastrar usuário: ${userRegResult.error}`);
                            globalStats.failedUsers++;
                        }
                        
                    } catch (error) {
                        console.error(`   ❌ Erro ao processar usuário em ${deviceIp}:`, error.message);
                        globalStats.failedUsers++;
                    }
                    
                    // Pausa entre dispositivos
                    if (deviceIp !== ipArray[ipArray.length - 1]) {
                        console.log(`   ⏳ Pausa entre dispositivos (1s)...`);
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                }
                
                // Pausa entre usuários
                if (userIndex < usersWithFormattedNames.length - 1) {
                    console.log(`\n⏳ Pausa entre usuários (3s)...`);
                    await new Promise(resolve => setTimeout(resolve, 3000));
                }
            }

            // Relatório final
            this.showFinalReport(globalStats, ipArray);

            return {
                success: true,
                stats: globalStats
            };

        } catch (error) {
            console.error('❌ Erro fatal:', error.message);
            throw error;
        }
    }

    /**
     * Mostra relatório final
     */
    showFinalReport(globalStats, ipArray) {
        console.log('\n' + '═'.repeat(60));
        console.log('📊 RELATÓRIO FINAL - REGISTRO INDIVIDUAL');
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
        console.log(`   ✅ Usuários processados com sucesso: ${globalStats.successfulUsers}`);
        console.log(`   ❌ Usuários com falha: ${globalStats.failedUsers}`);
        console.log(`   📊 Taxa de sucesso: ${globalStats.successfulUsers + globalStats.failedUsers > 0 ? 
            ((globalStats.successfulUsers / (globalStats.successfulUsers + globalStats.failedUsers)) * 100).toFixed(2) : 0}%`);
        console.log('═'.repeat(60));

        console.log('\n🎉 Processamento individual concluído!');
        console.log('═'.repeat(60) + '\n');
    }
}

// Execução principal
async function main() {
    try {
        const registration = new IndividualFacialRegistration();
        await registration.init();
        await registration.registerAllFacesIndividually();
    } catch (error) {
        console.error('❌ Erro fatal:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = IndividualFacialRegistration;
