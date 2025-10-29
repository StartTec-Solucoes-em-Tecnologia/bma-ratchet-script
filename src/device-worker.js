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

            // 3. Cadastrar usuários individualmente
            console.log(`   👤 Cadastrando ${users.length} usuários...`);
            const userRegResult = await this.apiClient.registerUsers(deviceIp, users);
            if (!userRegResult.success) {
                throw new Error(`Falha ao cadastrar usuários: ${userRegResult.error || 'Erro desconhecido'}`);
            }
            stats.usersRegistered += userRegResult.successCount || users.length;
            console.log(`   ✅ ${userRegResult.successCount || users.length} usuários cadastrados`);

            // 4. Aguardar estabilização e verificar usuários cadastrados
            console.log(`   ⏳ Aguardando estabilização (5s)...`);
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            console.log(`   🔍 Verificando se usuários foram realmente cadastrados...`);
            const verifyUsers = await this.apiClient.fetchExistingUsers(deviceIp);
            const verifyUserIds = new Set(verifyUsers.map(u => u.userId));
            const usersNotFound = users.filter(u => !verifyUserIds.has(u.userId));
            
            if (usersNotFound.length > 0) {
                console.warn(`   ⚠️  ${usersNotFound.length} usuários não encontrados após cadastro:`);
                usersNotFound.forEach(u => console.warn(`     - ${u.userId} (${u.formattedName || u.name})`));
            } else {
                console.log(`   ✅ Todos os ${users.length} usuários verificados no dispositivo`);
            }

            // 5. Cadastrar faces apenas para usuários verificados
            const usersToRegisterFace = users.filter(u => verifyUserIds.has(u.userId));
            
            if (usersToRegisterFace.length === 0) {
                console.warn(`   ⚠️  Nenhum usuário encontrado para cadastro de face`);
            } else {
                console.log(`   🎭 Cadastrando ${usersToRegisterFace.length} faces...`);
                const faceRegResult = await this.apiClient.registerFaces(deviceIp, usersToRegisterFace);
                if (!faceRegResult.success) {
                    console.warn(`   ⚠️  Algumas faces falharam no cadastro`);
                }
                stats.facesRegistered += faceRegResult.successCount || 0;
                console.log(`   ✅ ${faceRegResult.successCount || 0} faces cadastradas`);
            }

            // 6. Salvar no cache
            console.log(`   💾 Salvando no cache...`);
            for (const user of users) {
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
                message: 'Processamento falhou'
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
