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

            console.log(`🔍 Buscando no evento: ${eventId}\n`);

            // Busca participants através da tabela de relacionamento participant_to_event
            const participantToEvents = await this.prisma.participant_to_event.findMany({
                where: {
                    event_id: eventId
                },
                include: {
                    participant: {
                        include: {
                            invite: {
                                where: {
                                    event_id: eventId,
                                    type: 'PARTICIPANT'
                                }
                            }
                        }
                    }
                }
            });

            // Filtra apenas participants com facial_image
            const participants = participantToEvents
                .filter(pte => pte.participant?.facial_image)
                .map(pte => ({
                    ...pte.participant,
                    invite: pte.participant.invite
                }));

            // Busca guests diretamente pelo event_id
            const guests = await this.prisma.guest.findMany({
                where: {
                    event_id: eventId,
                    facial_image: {
                        not: null
                    }
                },
                include: {
                    invite: {
                        where: {
                            event_id: eventId,
                            type: 'GUEST'
                        }
                    }
                }
            });

            console.log(`📊 Busca no banco de dados:`);
            console.log(`   👥 ${participants.length} participants com facial_image NO EVENTO`);
            console.log(`   👤 ${guests.length} guests com facial_image NO EVENTO`);
            console.log(`   🎯 Total: ${participants.length + guests.length} registros`);

            // Debug: Busca totais SEM filtro de evento
            const allParticipantToEvents = await this.prisma.participant_to_event.findMany({
                include: {
                    participant: true
                }
            });

            const allParticipantsWithFacial = allParticipantToEvents.filter(
                pte => pte.participant?.facial_image
            ).length;

            const allGuestsWithFacial = await this.prisma.guest.count({
                where: {
                    facial_image: {
                        not: null
                    }
                }
            });

            console.log(`\n   🌐 Total NO BANCO (todos os eventos):`);
            console.log(`   👥 ${allParticipantsWithFacial} participants com facial_image`);
            console.log(`   👤 ${allGuestsWithFacial} guests com facial_image`);
            console.log(`   🎯 Total geral: ${allParticipantsWithFacial + allGuestsWithFacial}`);

            if (participants.length + guests.length < allParticipantsWithFacial + allGuestsWithFacial) {
                const diff = (allParticipantsWithFacial + allGuestsWithFacial) - (participants.length + guests.length);
                console.log(`\n   ⚠️  ${diff} pessoas com facial estão em OUTROS EVENTOS`);;
            }

            // Processa participants e guests separadamente (SEM deduplica)
            const users = [];

            // 1. Processa TODOS os participants
            for (const participant of participants) {
                const inviteId = participant.invite[0]?.id;

                // UserID = inviteId (prioridade) OU participant.id (fallback)
                const userIdForDevice = inviteId || participant.id;

                const user = {
                    inviteId: inviteId || null,             // ID do invite (pode ser null)
                    userId: userIdForDevice,                // IMPORTANTE: inviteId OU participant.id para a catraca
                    participantId: participant.id,          // ID real do participant no banco
                    name: participant.name,
                    email: participant.email,
                    document: participant.document,
                    cellphone: participant.cellphone,
                    facialImageUrl: participant.facial_image,
                    type: 'participant',
                    priority: 1
                };

                users.push(user);
            }

            // 2. Processa TODOS os guests
            for (const guest of guests) {
                const inviteId = guest.invite[0]?.id;

                // UserID = inviteId (prioridade) OU guest.id (fallback)
                const userIdForDevice = inviteId || guest.id;

                const user = {
                    inviteId: inviteId || null,             // ID do invite (pode ser null)
                    userId: userIdForDevice,                // IMPORTANTE: inviteId OU guest.id para a catraca
                    guestId: guest.id,                      // ID real do guest no banco
                    name: guest.name,
                    email: guest.email,
                    document: guest.document,
                    cellphone: guest.cellphone,
                    facialImageUrl: guest.facial_image,
                    type: 'guest',
                    priority: 2
                };

                users.push(user);
            }

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
