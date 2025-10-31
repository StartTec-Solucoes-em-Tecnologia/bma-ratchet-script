const fs = require('fs');
const path = require('path');

/**
 * Worker para processar um dispositivo específico
 * Executado em processo separado para cada catraca
 */

class DeviceWorker {
    constructor() {
        this.apiClient = null;
        this.userManager = null;
        this.cacheManager = null;
    }

    /**
     * Inicializa dependências
     */
    async init() {
        try {
            // Importa módulos necessários
            const ApiClient = require('./modules/api-client');
            const UserManager = require('./modules/user-manager');
            const CacheManager = require('./modules/cache-manager');

            this.apiClient = new ApiClient();
            this.userManager = new UserManager();
            this.cacheManager = new CacheManager();

            // Inicializa Redis e cache
            await this.userManager.initRedis();
            await this.cacheManager.init();

            console.log('✅ Worker inicializado com sucesso');
        } catch (error) {
            console.error('❌ Erro ao inicializar worker:', error.message);
            throw error;
        }
    }

    /**
     * Processa um lote de usuários para um dispositivo
     */
    async processBatch(deviceIp, users) {
        try {
            console.log(`🖥️  Processando dispositivo ${deviceIp}...`);
            console.log(`   👥 ${users.length} usuários para processar`);

            const stats = {
                usersVerified: 0,
                usersDeleted: 0,
                usersRegistered: 0,
                facesRegistered: 0,
                redisSaves: 0
            };

            // 1. Buscar usuários existentes
            console.log(`   🔍 Verificando usuários existentes...`);
            const existingUsers = await this.apiClient.fetchExistingUsers(deviceIp);
            const existingUserIds = new Set(existingUsers.map(u => u.userId));
            const existingUserMap = new Map(existingUsers.map(u => [u.userId, u]));

            stats.usersVerified += existingUsers.length;
            console.log(`   📊 ${existingUsers.length} usuários encontrados no dispositivo`);

            // 2. Deletar usuários que já existem
            const usersToDelete = users.filter(u => existingUserIds.has(u.userId));
            if (usersToDelete.length > 0) {
                console.log(`   🗑️  Deletando ${usersToDelete.length} usuários existentes...`);

                for (const user of usersToDelete) {
                    const existingUser = existingUserMap.get(user.userId);
                    if (existingUser && existingUser.recNo) {
                        const result = await this.apiClient.deleteUser(deviceIp, existingUser.recNo);
                        if (result.success) {
                            stats.usersDeleted++;
                        }
                        await new Promise(resolve => setTimeout(resolve, 200));
                    }
                }
                console.log(`   ✅ ${stats.usersDeleted} usuários deletados`);
            }

            // ========================================
            // FASE 1: CADASTRAR TODOS OS USUÁRIOS EM LOTES DE 10
            // ========================================
            const BATCH_SIZE = 10;
            const totalBatches = Math.ceil(users.length / BATCH_SIZE);

            // Array para armazenar UserIDs que foram REALMENTE cadastrados
            const successfulUserIds = [];

            console.log(`\n   ═══════════════════════════════════════════`);
            console.log(`   📋 FASE 1: CADASTRO DE TODOS OS USUÁRIOS`);
            console.log(`   📦 ${users.length} usuários em ${totalBatches} lote(s) de até ${BATCH_SIZE}`);
            console.log(`   ═══════════════════════════════════════════\n`);

            for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
                const start = batchIndex * BATCH_SIZE;
                const end = Math.min(start + BATCH_SIZE, users.length);
                const batch = users.slice(start, end);

                console.log(`   📦 Lote ${batchIndex + 1}/${totalBatches} (${batch.length} usuários)`);

                // Cadastrar usuários do lote
                const userRegResult = await this.apiClient.registerUsers(deviceIp, batch);
                if (!userRegResult.success) {
                    console.warn(`   ⚠️  Falha ao cadastrar alguns usuários do lote`);
                }
                stats.usersRegistered += userRegResult.successCount || 0;
                console.log(`   ✅ ${userRegResult.successCount || 0} usuários cadastrados\n`);

                // Se o cadastro foi bem-sucedido, adiciona os UserIDs ao array
                if (userRegResult.success) {
                    batch.forEach(user => successfulUserIds.push(user.userId));
                }
            }

            console.log(`   ✅ FASE 1 CONCLUÍDA: ${stats.usersRegistered} usuários cadastrados\n`);

            // Verifica se os usuários realmente foram cadastrados na catraca
            console.log(`   🔍 Verificando usuários realmente cadastrados na catraca...`);
            const existingUsersAfterRegistration = await this.apiClient.fetchExistingUsers(deviceIp);
            console.log(`   📊 Total de usuários na catraca agora: ${existingUsersAfterRegistration.length}`);

            // Cria Set de UserIDs dos usuários existentes após o cadastro
            const confirmedUserIdsSet = new Set(existingUsersAfterRegistration.map(u => String(u.userId)));

            // Filtra apenas usuários que REALMENTE foram cadastrados
            const confirmedUserIds = successfulUserIds.filter(userId =>
                confirmedUserIdsSet.has(String(userId))
            );

            console.log(`   ✅ ${confirmedUserIds.length}/${users.length} usuários confirmados na catraca`);

            if (confirmedUserIds.length < users.length) {
                const missing = users.length - confirmedUserIds.length;
                console.warn(`   ⚠️  ${missing} usuários NÃO foram cadastrados! Apenas estes terão faces registradas.`);
            }

            // IMPORTANTE: Filtra users para incluir APENAS os confirmados
            const usersWithConfirmedRegistration = users.filter(user =>
                confirmedUserIds.includes(user.userId)
            );

            console.log(`   🎯 ${usersWithConfirmedRegistration.length} usuários prontos para cadastro de faces\n`);
            console.log(`   ⏸️  Aguardando 3s antes de iniciar cadastro de faces...\n`);
            await new Promise(resolve => setTimeout(resolve, 3000));

            // ========================================
            // FASE 2: CADASTRAR TODAS AS FACES EM LOTES DE 10 (APENAS CONFIRMADOS)
            // ========================================
            const faceBatches = Math.ceil(usersWithConfirmedRegistration.length / BATCH_SIZE);

            console.log(`   ═══════════════════════════════════════════`);
            console.log(`   📋 FASE 2: CADASTRO DE TODAS AS FACES`);
            console.log(`   🎭 ${usersWithConfirmedRegistration.length} faces em ${faceBatches} lote(s) de até ${BATCH_SIZE}`);
            console.log(`   ═══════════════════════════════════════════\n`);

            for (let batchIndex = 0; batchIndex < faceBatches; batchIndex++) {
                const start = batchIndex * BATCH_SIZE;
                const end = Math.min(start + BATCH_SIZE, usersWithConfirmedRegistration.length);
                const batch = usersWithConfirmedRegistration.slice(start, end);

                console.log(`   🎭 Lote ${batchIndex + 1}/${faceBatches} (${batch.length} faces)`);

                // Cadastrar faces do lote
                const faceRegResult = await this.apiClient.registerFaces(deviceIp, batch);
                if (!faceRegResult.success) {
                    console.warn(`   ⚠️  Algumas faces falharam no cadastro`);
                }
                stats.facesRegistered += faceRegResult.successCount || 0;
                console.log(`   ✅ ${faceRegResult.successCount || 0} faces cadastradas\n`);
            }

            console.log(`   ✅ FASE 2 CONCLUÍDA: ${stats.facesRegistered} faces cadastradas\n`);

            // 6. Salvar no cache (APENAS CONFIRMADOS)
            console.log(`   💾 Salvando no cache...`);
            for (const user of usersWithConfirmedRegistration) {
                // user.userId já contém inviteId || participant.id || guest.id
                const saveResult = await this.userManager.saveUser(deviceIp, user.userId, {
                    name: user.name,
                    email: user.email,
                    document: user.document,
                    cellphone: user.cellphone,
                    type: user.type,
                    inviteId: user.inviteId
                }, this.cacheManager);

                if (saveResult.success) {
                    stats.redisSaves++;
                }
            }
            console.log(`   ✅ ${stats.redisSaves} usuários salvos no cache`);

            console.log(`   🎉 Processamento do dispositivo ${deviceIp} concluído com sucesso!`);

            return {
                success: true,
                deviceIp,
                stats,
                message: 'Processamento concluído com sucesso'
            };

        } catch (error) {
            console.error(`❌ Erro ao processar dispositivo ${deviceIp}:`, error.message);
            return {
                success: false,
                deviceIp,
                error: error.message,
                message: 'Processamento falhou',
                stats: {
                    usersVerified: 0,
                    usersDeleted: 0,
                    usersRegistered: 0,
                    facesRegistered: 0,
                    redisSaves: 0
                }
            };
        }
    }

    /**
     * Executa o worker
     */
    async run() {
        try {
            const tempFile = process.argv[2];
            if (!tempFile) {
                throw new Error('Arquivo temporário não fornecido');
            }

            // Carrega dados do lote
            const batchData = JSON.parse(fs.readFileSync(tempFile, 'utf8'));
            const { deviceIp, users } = batchData;

            console.log(`🚀 Worker iniciado para dispositivo ${deviceIp}`);
            console.log(`   📦 ${users.length} usuários para processar`);

            // Inicializa worker
            await this.init();

            // Processa lote
            const result = await this.processBatch(deviceIp, users);

            // Retorna resultado
            console.log(`📊 Resultado final:`, JSON.stringify(result, null, 2));

            process.exit(result.success ? 0 : 1);

        } catch (error) {
            console.error('❌ Erro fatal no worker:', error.message);
            process.exit(1);
        }
    }
}

// Executa worker se chamado diretamente
if (require.main === module) {
    const worker = new DeviceWorker();
    worker.run().catch(error => {
        console.error('❌ Erro fatal:', error.message);
        process.exit(1);
    });
}

module.exports = DeviceWorker;
