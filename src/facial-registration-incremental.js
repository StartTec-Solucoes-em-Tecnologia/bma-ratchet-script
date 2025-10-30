/**
 * Script de Cadastro Facial INCREMENTAL
 * 
 * Cadastra APENAS usuários novos ou sem face cadastrada
 * - Busca faces existentes na catraca
 * - Compara com os invites do evento
 * - Cadastra SOMENTE quem não tem face
 * 
 * Uso: npm run register-faces-incremental
 */

require('dotenv').config();
const ApiClient = require('./modules/api-client');
const UserManager = require('./modules/user-manager');
const ImageProcessor = require('./modules/image-processor');
const CacheManager = require('./modules/cache-manager');

class IncrementalFacialRegistration {
    constructor() {
        this.apiClient = new ApiClient();
        this.userManager = new UserManager();
        this.imageProcessor = new ImageProcessor();
        this.cacheManager = new CacheManager();
    }

    async init() {
        try {
            console.log('🔌 Conectando ao banco de dados...');
            await this.userManager.connect();
            
            console.log('💾 Inicializando cache...');
            await this.cacheManager.init();
            
            console.log('✅ Inicialização concluída!\n');
        } catch (error) {
            console.error('❌ Erro na inicialização:', error.message);
            throw error;
        }
    }

    async cleanup() {
        try {
            await this.userManager.disconnect();
            console.log('✅ Conexões fechadas');
        } catch (error) {
            console.error('❌ Erro ao fechar conexões:', error.message);
        }
    }

    /**
     * Busca usuários que precisam de cadastro (novos ou sem face)
     */
    async findUsersToRegister(deviceIp, allUsers) {
        console.log(`\n🔍 Verificando faces existentes em ${deviceIp}...`);
        
        // Busca faces já cadastradas
        const existingFaces = await this.apiClient.fetchExistingFaces(deviceIp);
        console.log(`📊 ${existingFaces.size} faces já cadastradas`);
        
        // Filtra apenas usuários que NÃO têm face
        const usersToRegister = allUsers.filter(user => {
            const userIdForDevice = String(user.inviteId || user.userId);
            return !existingFaces.has(userIdForDevice);
        });
        
        console.log(`📝 ${usersToRegister.length} novos usuários precisam de cadastro`);
        console.log(`⏭️  ${allUsers.length - usersToRegister.length} usuários já cadastrados (pulando)\n`);
        
        return usersToRegister;
    }

    /**
     * Processa cadastro incremental para um dispositivo
     */
    async processDevice(deviceIp, usersToRegister) {
        const stats = {
            usersRegistered: 0,
            facesRegistered: 0,
            errors: 0
        };

        if (usersToRegister.length === 0) {
            console.log(`✅ ${deviceIp} - Nada para cadastrar!\n`);
            return stats;
        }

        console.log(`🖥️  Processando ${deviceIp}...`);
        console.log(`   👥 ${usersToRegister.length} usuários para cadastrar\n`);

        const BATCH_SIZE = 10;
        
        // ========================================
        // FASE 1: CADASTRAR USUÁRIOS EM LOTES
        // ========================================
        const userBatches = Math.ceil(usersToRegister.length / BATCH_SIZE);
        
        console.log(`   ═══════════════════════════════════════════`);
        console.log(`   📋 FASE 1: CADASTRO DE USUÁRIOS`);
        console.log(`   📦 ${usersToRegister.length} usuários em ${userBatches} lote(s)`);
        console.log(`   ═══════════════════════════════════════════\n`);

        for (let i = 0; i < userBatches; i++) {
            const start = i * BATCH_SIZE;
            const end = Math.min(start + BATCH_SIZE, usersToRegister.length);
            const batch = usersToRegister.slice(start, end);
            
            console.log(`   📦 Lote ${i + 1}/${userBatches} (${batch.length} usuários)`);

            try {
                const result = await this.apiClient.registerUsers(deviceIp, batch);
                stats.usersRegistered += result.successCount || 0;
                console.log(`   ✅ ${result.successCount || 0} usuários cadastrados\n`);
            } catch (error) {
                console.error(`   ❌ Erro no lote: ${error.message}\n`);
                stats.errors++;
            }
        }
        
        console.log(`   ✅ FASE 1 CONCLUÍDA: ${stats.usersRegistered} usuários\n`);
        console.log(`   ⏸️  Aguardando 3s antes das faces...\n`);
        
        await new Promise(resolve => setTimeout(resolve, 3000));

        // ========================================
        // FASE 2: CADASTRAR FACES EM LOTES
        // ========================================
        const faceBatches = Math.ceil(usersToRegister.length / BATCH_SIZE);
        
        console.log(`   ═══════════════════════════════════════════`);
        console.log(`   📋 FASE 2: CADASTRO DE FACES`);
        console.log(`   🎭 ${usersToRegister.length} faces em ${faceBatches} lote(s)`);
        console.log(`   ═══════════════════════════════════════════\n`);

        for (let i = 0; i < faceBatches; i++) {
            const start = i * BATCH_SIZE;
            const end = Math.min(start + BATCH_SIZE, usersToRegister.length);
            const batch = usersToRegister.slice(start, end);
            
            console.log(`   🎭 Lote ${i + 1}/${faceBatches} (${batch.length} faces)`);

            try {
                const result = await this.apiClient.registerFaces(deviceIp, batch);
                stats.facesRegistered += result.successCount || 0;
                console.log(`   ✅ ${result.successCount || 0} faces cadastradas\n`);
            } catch (error) {
                console.error(`   ❌ Erro no lote: ${error.message}\n`);
                stats.errors++;
            }
        }
        
        console.log(`   ✅ FASE 2 CONCLUÍDA: ${stats.facesRegistered} faces\n`);

        // ========================================
        // SALVAR NO CACHE
        // ========================================
        console.log(`   💾 Salvando no cache...`);
        for (const user of usersToRegister) {
            try {
                await this.userManager.saveUser(
                    deviceIp, 
                    user.inviteId || user.userId, 
                    {
                        name: user.name,
                        email: user.email,
                        document: user.document,
                        cellphone: user.cellphone,
                        type: user.type,
                        inviteId: user.inviteId
                    }, 
                    this.cacheManager
                );
            } catch (error) {
                console.error(`   ⚠️  Erro ao salvar cache: ${error.message}`);
            }
        }
        console.log(`   ✅ Cache atualizado\n`);

        return stats;
    }

    /**
     * Execução principal
     */
    async run() {
        const startTime = Date.now();
        
        try {
            console.log('╔════════════════════════════════════════════════════╗');
            console.log('║   CADASTRO FACIAL INCREMENTAL (APENAS NOVOS)      ║');
            console.log('╚════════════════════════════════════════════════════╝\n');

            await this.init();

            // Configuração
            const eventId = process.env.EVENT_ID;
            const deviceIps = process.env.FACE_READER_IPS?.split(',').map(ip => ip.trim()) || [];

            if (!eventId) {
                throw new Error('EVENT_ID não configurado no .env');
            }

            if (deviceIps.length === 0) {
                throw new Error('FACE_READER_IPS não configurado no .env');
            }

            console.log(`📅 Evento: ${eventId}`);
            console.log(`🖥️  Dispositivos: ${deviceIps.join(', ')}\n`);

            // 1. Buscar todos os usuários do evento
            console.log('🔍 Buscando usuários com facial do evento...');
            const allUsers = await this.userManager.fetchInvitesWithFacialImages(eventId);
            console.log(`✅ ${allUsers.length} usuários encontrados\n`);

            if (allUsers.length === 0) {
                console.log('⚠️  Nenhum usuário com facial encontrado!');
                return;
            }

            // 2. Processar imagens
            console.log('🖼️  Processando imagens...');
            const usersWithImages = [];
            
            for (const user of allUsers) {
                try {
                    const photoBase64 = await this.imageProcessor.processUserImage(user);
                    if (photoBase64) {
                        usersWithImages.push({
                            ...user,
                            photoBase64
                        });
                    }
                } catch (error) {
                    console.error(`⚠️  Erro ao processar ${user.name}: ${error.message}`);
                }
            }
            
            console.log(`✅ ${usersWithImages.length} imagens processadas\n`);

            // 3. Processar cada dispositivo
            const globalStats = {
                totalUsersRegistered: 0,
                totalFacesRegistered: 0,
                totalErrors: 0
            };

            for (const deviceIp of deviceIps) {
                try {
                    // Filtra apenas novos usuários
                    const usersToRegister = await this.findUsersToRegister(deviceIp, usersWithImages);
                    
                    // Processa o dispositivo
                    const stats = await this.processDevice(deviceIp, usersToRegister);
                    
                    globalStats.totalUsersRegistered += stats.usersRegistered;
                    globalStats.totalFacesRegistered += stats.facesRegistered;
                    globalStats.totalErrors += stats.errors;
                    
                } catch (error) {
                    console.error(`❌ Erro ao processar ${deviceIp}:`, error.message);
                    globalStats.totalErrors++;
                }
            }

            // 4. Relatório final
            const duration = ((Date.now() - startTime) / 1000).toFixed(2);
            
            console.log('\n╔════════════════════════════════════════════════════╗');
            console.log('║                  RELATÓRIO FINAL                   ║');
            console.log('╚════════════════════════════════════════════════════╝');
            console.log(`⏱️  Tempo total: ${duration}s`);
            console.log(`👥 Usuários cadastrados: ${globalStats.totalUsersRegistered}`);
            console.log(`🎭 Faces cadastradas: ${globalStats.totalFacesRegistered}`);
            console.log(`❌ Erros: ${globalStats.totalErrors}`);
            console.log('');

            if (globalStats.totalErrors === 0 && globalStats.totalFacesRegistered > 0) {
                console.log('🎉 Cadastro incremental concluído com sucesso!');
            } else if (globalStats.totalFacesRegistered === 0) {
                console.log('✅ Nenhum novo cadastro necessário!');
            } else {
                console.log('⚠️  Cadastro concluído com alguns erros');
            }

        } catch (error) {
            console.error('\n❌ Erro fatal:', error.message);
            console.error(error.stack);
            process.exit(1);
        } finally {
            await this.cleanup();
        }
    }
}

// Execução
if (require.main === module) {
    const registration = new IncrementalFacialRegistration();
    registration.run().catch(error => {
        console.error('💥 Erro não tratado:', error);
        process.exit(1);
    });
}

module.exports = IncrementalFacialRegistration;

