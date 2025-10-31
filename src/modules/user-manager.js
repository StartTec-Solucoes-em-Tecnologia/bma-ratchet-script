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

            // Busca TODOS os participants com facial_image do evento
            const participants = await this.prisma.participant.findMany({
                where: {
                    invite: {
                        some: {
                            event_id: eventId
                        }
                    },
                    facial_image: {
                        not: null
                    }
                },
                include: {
                    invite: {
                        where: {
                            event_id: eventId
                        }
                    }
                }
            });

            // Busca TODOS os guests com facial_image do evento
            const guests = await this.prisma.guest.findMany({
                where: {
                    invite: {
                        some: {
                            event_id: eventId
                        }
                    },
                    facial_image: {
                        not: null
                    }
                },
                include: {
                    invite: {
                        where: {
                            event_id: eventId
                        }
                    }
                }
            });

            console.log(`📊 Busca no banco de dados:`);
            console.log(`   👥 ${participants.length} participants com facial_image`);
            console.log(`   👤 ${guests.length} guests com facial_image`);
            console.log(`   🎯 Total: ${participants.length + guests.length} registros`);

            // Processa participants e guests em um único Map
            const usersByPersonId = new Map();    // Deduplica por userId (pessoa física)
            let imageUpdates = 0;
            let duplicatedPeople = 0;

            // 1. Processa TODOS os participants
            for (const participant of participants) {
                const personId = `participant_${participant.id}`;
                const inviteId = participant.invite[0]?.id || 'no-invite';

                const user = {
                    inviteId: inviteId,
                    userId: participant.id,
                    personKey: personId,  // Chave única para deduplica
                    name: participant.name,
                    email: participant.email,
                    document: participant.document,
                    cellphone: participant.cellphone,
                    facialImageUrl: participant.facial_image,
                    type: 'participant',
                    priority: 1
                };

                usersByPersonId.set(personId, user);
            }

            // 2. Processa TODOS os guests
            for (const guest of guests) {
                const personId = `guest_${guest.id}`;
                const inviteId = guest.invite[0]?.id || 'no-invite';

                const user = {
                    inviteId: inviteId,
                    userId: guest.id,
                    personKey: personId,  // Chave única para deduplica
                    name: guest.name,
                    email: guest.email,
                    document: guest.document,
                    cellphone: guest.cellphone,
                    facialImageUrl: guest.facial_image,
                    type: 'guest',
                    priority: 2
                };

                usersByPersonId.set(personId, user);
            }

            // Converte Map para Array
            const users = Array.from(usersByPersonId.values());

            console.log(`\n   📊 Resumo do Processamento:`);
            console.log(`   👥 ${participants.length} participants adicionados`);
            console.log(`   👤 ${guests.length} guests adicionados`);
            console.log(`   🎯 Total de PESSOAS ÚNICAS: ${users.length}`);
            console.log(`   📋 Regra: TODOS participants + TODOS guests com facial_image\n`);

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
