const CacheManager = require('./modules/cache-manager');
const ImageProcessor = require('./modules/image-processor');
const ImageCacheManager = require('./modules/image-cache-manager');
const ApiClient = require('./modules/api-client');
const UserManager = require('./modules/user-manager');
require('dotenv').config();

/**
 * Script de Registro Facial Individual
 * Cadastra TODOS os usuários primeiro, depois TODAS as faces
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
        console.log('🚀 BMA Facial Registration - Modo Individual em 2 Fases');
        console.log('   Fase 1: Cadastro de TODOS os usuários');
        console.log('   Fase 2: Cadastro de TODAS as faces\n');

        // Inicializa componentes
        await this.userManager.initRedis();
        await this.cacheManager.init();
        await this.imageCacheManager.init();
        
        // Sincroniza cache JSON com Redis
        await this.cacheManager.syncWithRedis(this.userManager.redisClient);
    }

    /**
     * Processo principal de registro facial em 2 fases
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

            // Armazena usuários cadastrados por dispositivo
            const registeredUsersByDevice = new Map();

            // ========================================
            // FASE 1: CADASTRAR TODOS OS USUÁRIOS
            // ========================================
            console.log('\n' + '═'.repeat(60));
            console.log('📋 FASE 1: CADASTRO DE USUÁRIOS');
            console.log('═'.repeat(60));

            for (const deviceIp of ipArray) {
                console.log(`\n🖥️  Dispositivo: ${deviceIp}`);
                console.log('─'.repeat(60));
                
                const deviceRegisteredUsers = [];

                for (let userIndex = 0; userIndex < usersWithFormattedNames.length; userIndex++) {
                    const user = usersWithFormattedNames[userIndex];
                    console.log(`   [${userIndex + 1}/${usersWithFormattedNames.length}] Cadastrando ${user.formattedName}...`);
                    
                    try {
                        // Verificar se usuário já existe
                        const existingUsers = await this.apiClient.fetchExistingUsers(deviceIp);
                        const existingUser = existingUsers.find(u => u.userId === user.userId);
                        
                        if (existingUser) {
                            globalStats.usersVerified++;
                            console.log(`       🗑️  Deletando usuário existente (RecNo: ${existingUser.recNo})...`);
                            const deleteResult = await this.apiClient.deleteUser(deviceIp, existingUser.recNo);
                            if (deleteResult.success) {
                                globalStats.usersDeleted++;
                            }
                            await new Promise(resolve => setTimeout(resolve, 200));
                        }

                        // Cadastrar usuário
                        const userRegResult = await this.apiClient.registerSingleUser(deviceIp, user);
                        
                        if (userRegResult.success) {
                            globalStats.usersRegistered++;
                            deviceRegisteredUsers.push(user);
                            console.log(`       ✅ Cadastrado`);
                        } else {
                            console.log(`       ❌ Falha: ${userRegResult.error}`);
                            globalStats.failedUsers++;
                        }
                        
                        // Pequena pausa entre usuários
                        await new Promise(resolve => setTimeout(resolve, 300));
                        
                    } catch (error) {
                        console.error(`       ❌ Erro: ${error.message}`);
                        globalStats.failedUsers++;
                    }
                }

                registeredUsersByDevice.set(deviceIp, deviceRegisteredUsers);
                
                console.log(`\n   ✅ ${deviceRegisteredUsers.length} usuários cadastrados em ${deviceIp}`);
            }

            console.log('\n✅ FASE 1 CONCLUÍDA: Todos os usuários cadastrados\n');
            console.log(`   📊 Total de usuários cadastrados: ${globalStats.usersRegistered}`);
            console.log(`   📊 Total de falhas: ${globalStats.failedUsers}`);

            // Aguardar estabilização geral
            console.log(`\n⏳ Aguardando estabilização geral dos dispositivos (10s)...\n`);
            await new Promise(resolve => setTimeout(resolve, 10000));

            // ========================================
            // FASE 2: CADASTRAR TODAS AS FACES
            // ========================================
            console.log('═'.repeat(60));
            console.log('📋 FASE 2: CADASTRO DE FACES');
            console.log('═'.repeat(60));

            for (const deviceIp of ipArray) {
                console.log(`\n🖥️  Dispositivo: ${deviceIp}`);
                console.log('─'.repeat(60));
                
                const usersToRegisterFace = registeredUsersByDevice.get(deviceIp) || [];
                
                if (usersToRegisterFace.length === 0) {
                    console.warn(`   ⚠️  Nenhum usuário para cadastrar face`);
                    continue;
                }

                // Verificar quais usuários estão realmente no dispositivo
                console.log(`   🔍 Verificando ${usersToRegisterFace.length} usuários no dispositivo...`);
                const verifyUsers = await this.apiClient.fetchExistingUsers(deviceIp);
                const verifyUserIds = new Set(verifyUsers.map(u => u.userId));
                
                const confirmedUsers = usersToRegisterFace.filter(u => verifyUserIds.has(u.userId));
                const missingUsers = usersToRegisterFace.filter(u => !verifyUserIds.has(u.userId));
                
                if (missingUsers.length > 0) {
                    console.warn(`   ⚠️  ${missingUsers.length} usuários não encontrados:`);
                    missingUsers.forEach(u => console.warn(`       - ${u.formattedName}`));
                }
                
                console.log(`   ✅ ${confirmedUsers.length} usuários confirmados no dispositivo\n`);

                // Cadastrar faces
                for (let userIndex = 0; userIndex < confirmedUsers.length; userIndex++) {
                    const user = confirmedUsers[userIndex];
                    console.log(`   [${userIndex + 1}/${confirmedUsers.length}] Cadastrando face de ${user.formattedName}...`);
                    
                    try {
                        const faceRegResult = await this.apiClient.registerSingleFace(deviceIp, user);
                        
                        if (faceRegResult.success) {
                            globalStats.facesRegistered++;
                            console.log(`       ✅ Cadastrada`);
                        } else {
                            console.log(`       ❌ Falha: ${faceRegResult.error}`);
                        }
                        
                        // Pequena pausa entre faces
                        await new Promise(resolve => setTimeout(resolve, 500));
                        
                    } catch (error) {
                        console.error(`       ❌ Erro: ${error.message}`);
                    }
                }
                
                console.log(`\n   ✅ ${globalStats.facesRegistered} faces cadastradas em ${deviceIp}`);
                
                // Salvar no cache
                console.log(`   💾 Salvando ${confirmedUsers.length} usuários no cache...`);
                for (const user of confirmedUsers) {
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
                    }
                }
                console.log(`   ✅ ${globalStats.redisSaves} usuários salvos no cache`);
            }

            console.log('\n✅ FASE 2 CONCLUÍDA: Todas as faces cadastradas\n');

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
        console.log('📊 RELATÓRIO FINAL - REGISTRO EM 2 FASES');
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
        console.log(`   ✅ Usuários processados com sucesso: ${globalStats.usersRegistered}`);
        console.log(`   ❌ Usuários com falha: ${globalStats.failedUsers}`);
        console.log(`   📊 Taxa de sucesso: ${globalStats.usersRegistered + globalStats.failedUsers > 0 ? 
            ((globalStats.usersRegistered / (globalStats.usersRegistered + globalStats.failedUsers)) * 100).toFixed(2) : 0}%`);
        console.log('═'.repeat(60));

        console.log('\n🎉 Processamento em 2 fases concluído!');
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