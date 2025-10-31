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

            // Processa cada invite e extrai guest OU participant
            const usersMap = new Map(); // Usar Map para garantir unicidade por inviteId
            let participantsCount = 0;
            let guestsCount = 0;
            let skippedCount = 0;

            for (const invite of invites) {
                // Verifica se já processou este invite
                if (usersMap.has(invite.id)) {
                    console.warn(`   ⚠️  Invite duplicado ignorado: ${invite.id}`);
                    continue;
                }

                let selectedPerson = null;
                let personType = null;

                // Prioridade 1: Guest (se existir)
                if (invite.guest) {
                    selectedPerson = invite.guest;
                    personType = 'guest';
                    guestsCount++;
                }
                // Prioridade 2: Participant (se não tiver guest)
                else if (invite.participant) {
                    selectedPerson = invite.participant;
                    personType = 'participant';
                    participantsCount++;
                }

                // Se não tem nem guest nem participant, pula
                if (!selectedPerson) {
                    skippedCount++;
                    continue;
                }

                // Monta o objeto do usuário
                const user = {
                    inviteId: invite.id,                    // ID do invite (chave principal)
                    userId: selectedPerson.id,              // ID do guest ou participant
                    name: selectedPerson.name,
                    email: selectedPerson.email,
                    document: selectedPerson.document,
                    cellphone: selectedPerson.cellphone,
                    facialImageUrl: selectedPerson.facial_image,
                    type: personType,
                    priority: personType === 'guest' ? 2 : 1
                };

                // Só adiciona se tiver facial_image
                if (user.facialImageUrl) {
                    usersMap.set(invite.id, user);
                } else {
                    skippedCount++;
                }
            }

            // Converte Map para Array
            const users = Array.from(usersMap.values());

            console.log(`   👥 Participantes: ${participantsCount}`);
            console.log(`   👤 Convidados: ${guestsCount}`);
            console.log(`   ⏭️  Sem facial_image: ${skippedCount}`);
            console.log(`   🎯 Total de usuários com facial: ${users.length}`);
            console.log(`   📋 Regra: Guest > Participant (1 por invite)\n`);

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
