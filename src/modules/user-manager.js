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

            // Busca participantes com facial_image
            const participants = await this.prisma.participant.findMany({
                where: {
                    invite: {
                        eventId: eventId
                    },
                    facialImage: {
                        not: null
                    }
                },
                include: {
                    invite: true
                }
            });

            // Busca convidados com facial_image
            const guests = await this.prisma.guest.findMany({
                where: {
                    invite: {
                        eventId: eventId
                    },
                    facialImage: {
                        not: null
                    }
                },
                include: {
                    invite: true
                }
            });

            // Converte para formato unificado
            const allUsers = [
                ...participants.map(p => ({
                    userId: p.id,
                    name: p.name,
                    email: p.email,
                    document: p.document,
                    cellphone: p.cellphone,
                    facialImageUrl: p.facialImage,
                    type: 'participant',
                    inviteId: p.inviteId,
                    priority: 1 // Prioridade menor para participants
                })),
                ...guests.map(g => ({
                    userId: g.id,
                    name: g.name,
                    email: g.email,
                    document: g.document,
                    cellphone: g.cellphone,
                    facialImageUrl: g.facialImage,
                    type: 'guest',
                    inviteId: g.inviteId,
                    priority: 2 // Prioridade maior para guests
                }))
            ];

            // Agrupa por inviteId e seleciona o de maior prioridade (guest)
            const usersByInvite = new Map();
            
            allUsers.forEach(user => {
                const existingUser = usersByInvite.get(user.inviteId);
                
                if (!existingUser || user.priority > existingUser.priority) {
                    usersByInvite.set(user.inviteId, user);
                }
            });

            // Converte de volta para array
            const users = Array.from(usersByInvite.values());

            console.log(`📊 Encontrados ${users.length} usuários únicos por inviteId`);
            console.log(`   👥 Participantes: ${participants.length}`);
            console.log(`   👤 Convidados: ${guests.length}`);
            console.log(`   🎯 Únicos selecionados: ${users.length}`);
            console.log(`   📋 Prioridade: Guest > Participant\n`);

            return users;
        } catch (error) {
            console.error('❌ Erro ao buscar usuários:', error.message);
            throw error;
        }
    }

    /**
     * Separa nome completo em nome e sobrenome
     */
    splitName(fullName) {
        if (!fullName || typeof fullName !== 'string') {
            return { firstName: 'Usuario', lastName: 'Sem Nome' };
        }
        
        const nameParts = fullName.trim().split(/\s+/);
        
        if (nameParts.length === 1) {
            return { firstName: nameParts[0], lastName: 'Sem Sobrenome' };
        }
        
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(' ');
        
        return { firstName, lastName };
    }

    /**
     * Formata nome para envio à catraca (nome completo limpo)
     */
    formatNameForDevice(fullName) {
        const { firstName, lastName } = this.splitName(fullName);
        return `${firstName} ${lastName}`.trim();
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
