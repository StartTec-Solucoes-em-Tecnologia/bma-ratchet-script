const { PrismaClient } = require('@prisma/client');
const redis = require('redis');

/**
 * Gerenciador de Usuários
 * Responsável por operações de banco de dados, Redis e utilitários de usuários
 */

class UserManager {
    constructor() {
        this.prisma = new PrismaClient();
        this.redisClient = null;
    }

    /**
     * Inicializa conexão com Redis
     */
    async initRedis() {
        try {
            const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
            this.redisClient = redis.createClient({ url: redisUrl });

            this.redisClient.on('error', (err) => console.error('❌ Redis Error:', err));

            await this.redisClient.connect();
            console.log('✅ Conectado ao Redis\n');

            return this.redisClient;
        } catch (error) {
            console.warn('⚠️  Redis não disponível, continuando sem cache:', error.message);
            return null;
        }
    }

    /**
     * Busca invites com facial_image do banco de dados
     * Prioriza guests sobre participants para o mesmo inviteId
     */
    async fetchInvitesWithFacialImages() {
        try {
            const eventId = process.env.EVENT_ID;
            if (!eventId) {
                throw new Error('EVENT_ID não está definido nas variáveis de ambiente');
            }

            // Busca invites do evento com participants e guests
            const invites = await this.prisma.invite.findMany({
                where: {
                    event_id: eventId
                },
                include: {
                    participant: true,
                    guest: true
                }
            });

            console.log(`📊 Encontrados ${invites.length} invites do evento`);

            // Processa cada invite e extrai o melhor usuário (guest > participant)
            const users = [];
            let participantsCount = 0;
            let guestsCount = 0;
            let skippedCount = 0;

            for (const invite of invites) {
                let selectedUser = null;

                // Verifica se tem guest com facial_image
                if (invite.guest && invite.guest.facial_image) {
                    selectedUser = {
                        userId: invite.guest.id,
                        name: invite.guest.name,
                        email: invite.guest.email,
                        document: invite.guest.document,
                        cellphone: invite.guest.cellphone,
                        facialImageUrl: invite.guest.facial_image,
                        type: 'guest',
                        inviteId: invite.id,
                        priority: 2
                    };
                    guestsCount++;
                }
                // Se não tem guest, verifica participant com facial_image
                else if (invite.participant && invite.participant.facial_image) {
                    selectedUser = {
                        userId: invite.participant.id,
                        name: invite.participant.name,
                        email: invite.participant.email,
                        document: invite.participant.document,
                        cellphone: invite.participant.cellphone,
                        facialImageUrl: invite.participant.facial_image,
                        type: 'participant',
                        inviteId: invite.id,
                        priority: 1
                    };
                    participantsCount++;
                } else {
                    // Invite sem facial_image em nenhum dos dois
                    skippedCount++;
                    continue;
                }

                if (selectedUser) {
                    users.push(selectedUser);
                }
            }

            console.log(`   👥 Participantes selecionados: ${participantsCount}`);
            console.log(`   👤 Convidados selecionados: ${guestsCount}`);
            console.log(`   ⏭️  Invites sem facial: ${skippedCount}`);
            console.log(`   🎯 Total de usuários: ${users.length}`);
            console.log(`   📋 Prioridade: Guest > Participant\n`);

            return users;
        } catch (error) {
            console.error('❌ Erro ao buscar usuários:', error.message);
            throw error;
        }
    }

    /**
     * Separa nome completo em primeiro nome e último sobrenome
     */
    splitName(fullName) {
        if (!fullName || typeof fullName !== 'string') {
            return { firstName: 'Usuario', lastName: 'Sem Nome' };
        }

        const nameParts = fullName.trim().split(/\s+/);

        if (nameParts.length === 1) {
            return { firstName: nameParts[0], lastName: 'Sem Sobrenome' };
        }

        // Pega apenas o primeiro nome e último sobrenome
        const firstName = nameParts[0];
        const lastName = nameParts[nameParts.length - 1]; // Último elemento

        return { firstName, lastName };
    }

    /**
     * Formata nome para envio à catraca (apenas primeiro nome e último sobrenome)
     */
    formatNameForDevice(fullName) {
        const { firstName, lastName } = this.splitName(fullName);
        const formattedName = `${firstName} ${lastName}`.trim();

        // Limita a 50 caracteres conforme especificação da API
        return formattedName.length > 50
            ? formattedName.substring(0, 50)
            : formattedName;
    }

    /**
     * Salva usuário no Redis e cache JSON
     */
    async saveUser(deviceIp, userId, userData, cacheManager) {
        try {
            let redisSuccess = false;
            let jsonSuccess = false;

            // Salva no Redis (usando inviteId como chave se disponível)
            if (this.redisClient) {
                const key = `device:${deviceIp}:users`;
                const value = userData.inviteId ? `${userId}:${userData.inviteId}` : userId;
                await this.redisClient.sAdd(key, value);
                redisSuccess = true;
            }

            // Salva no cache JSON
            if (cacheManager) {
                jsonSuccess = await cacheManager.addUser(deviceIp, userId, userData);
            }

            return {
                success: redisSuccess || jsonSuccess,
                redis: redisSuccess,
                json: jsonSuccess
            };
        } catch (error) {
            console.error(`   ⚠️  Erro ao salvar usuário: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    /**
     * Remove usuário do Redis e cache JSON
     */
    async removeUser(deviceIp, userId, cacheManager) {
        try {
            let redisSuccess = false;
            let jsonSuccess = false;

            // Remove do Redis
            if (this.redisClient) {
                const key = `device:${deviceIp}:users`;
                await this.redisClient.sRem(key, userId);
                redisSuccess = true;
            }

            // Remove do cache JSON
            if (cacheManager) {
                jsonSuccess = await cacheManager.removeUser(deviceIp, userId);
            }

            return {
                success: redisSuccess || jsonSuccess,
                redis: redisSuccess,
                json: jsonSuccess
            };
        } catch (error) {
            console.error(`   ⚠️  Erro ao remover usuário: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    /**
     * Divide array em lotes de tamanho especificado
     */
    chunkArray(array, chunkSize) {
        const chunks = [];
        for (let i = 0; i < array.length; i += chunkSize) {
            chunks.push(array.slice(i, i + chunkSize));
        }
        return chunks;
    }

    /**
     * Fecha conexões
     */
    async close() {
        try {
            await this.prisma.$disconnect();
            if (this.redisClient) {
                await this.redisClient.quit();
                console.log('✅ Conexões fechadas');
            }
        } catch (error) {
            console.error('❌ Erro ao fechar conexões:', error.message);
        }
    }
}

module.exports = UserManager;
