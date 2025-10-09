const Redis = require('ioredis');

/**
 * Módulo de cache Redis para evitar duplicatas no registro de usuários em catracas
 * Armazena pares de deviceIp:participantId para rastrear usuários já registrados
 */

class RedisCache {
    constructor() {
        this.redis = null;
        this.isEnabled = false;
    }

    /**
     * Verifica se o Redis está conectado e habilitado
     */
    isConnected() {
        return this.isEnabled && this.redis !== null;
    }

    /**
     * Inicializa a conexão com o Redis
     */
    async connect() {
        try {
            const redisHost = process.env.REDIS_HOST || 'localhost';
            const redisPort = process.env.REDIS_PORT || 6379;
            const redisPassword = process.env.REDIS_PASSWORD || '';
            const redisDb = process.env.REDIS_DB || 0;

            this.redis = new Redis({
                host: redisHost,
                port: redisPort,
                password: redisPassword || undefined,
                db: redisDb,
                retryStrategy: (times) => {
                    const delay = Math.min(times * 50, 2000);
                    return delay;
                },
                maxRetriesPerRequest: 3
            });

            this.redis.on('connect', () => {
                console.log('✅ Redis conectado com sucesso!');
                this.isEnabled = true;
            });

            this.redis.on('error', (err) => {
                console.warn('⚠️  Redis não disponível:', err.message);
                console.warn('⚠️  Continuando sem cache (permitindo duplicatas)');
                this.isEnabled = false;
            });

            // Testa a conexão
            await this.redis.ping();
            this.isEnabled = true;

        } catch (error) {
            console.warn('⚠️  Não foi possível conectar ao Redis:', error.message);
            console.warn('⚠️  Continuando sem cache (permitindo duplicatas)');
            this.isEnabled = false;
        }
    }

    /**
     * Gera uma chave única para o cache baseada no IP da catraca e ID do participante
     */
    generateKey(deviceIp, participantId) {
        return `ratchet:${deviceIp}:user:${participantId}`;
    }

    /**
     * Verifica se um usuário já foi registrado em uma catraca específica
     */
    async isUserRegistered(deviceIp, participant) {
        if (!this.isEnabled || !this.redis) {
            return false;
        }

        try {
            const key = this.generateKey(deviceIp, participant.id);
            const exists = await this.redis.exists(key);
            return exists === 1;
        } catch (error) {
            console.warn(`⚠️  Erro ao verificar cache: ${error.message}`);
            return false; // Em caso de erro, permite o registro
        }
    }

    /**
     * Marca um usuário como registrado em uma catraca específica
     */
    async markUserAsRegistered(deviceIp, participant, ttl = null) {
        if (!this.isEnabled || !this.redis) {
            return false;
        }

        try {
            const key = this.generateKey(deviceIp, participant.id);
            const value = JSON.stringify({
                participantId: participant.id,
                participantName: participant.nome,
                inviteCode: participant.codigo_de_convite,
                deviceIp: deviceIp,
                registeredAt: new Date().toISOString()
            });

            if (ttl) {
                // Define TTL em segundos se especificado
                await this.redis.setex(key, ttl, value);
            } else {
                // Sem TTL, armazena permanentemente
                await this.redis.set(key, value);
            }

            return true;
        } catch (error) {
            console.warn(`⚠️  Erro ao salvar no cache: ${error.message}`);
            return false;
        }
    }

    /**
     * Obtém informações sobre um usuário registrado
     */
    async getUserInfo(deviceIp, participantId) {
        if (!this.isEnabled || !this.redis) {
            return null;
        }

        try {
            const key = this.generateKey(deviceIp, participantId);
            const value = await this.redis.get(key);
            return value ? JSON.parse(value) : null;
        } catch (error) {
            console.warn(`⚠️  Erro ao obter informações do cache: ${error.message}`);
            return null;
        }
    }

    /**
     * Remove um usuário do cache (útil para forçar re-registro)
     */
    async removeUser(deviceIp, participantId) {
        if (!this.isEnabled || !this.redis) {
            return false;
        }

        try {
            const key = this.generateKey(deviceIp, participantId);
            await this.redis.del(key);
            return true;
        } catch (error) {
            console.warn(`⚠️  Erro ao remover do cache: ${error.message}`);
            return false;
        }
    }

    /**
     * Limpa todo o cache de registros
     */
    async clearAll() {
        if (!this.isEnabled || !this.redis) {
            return false;
        }

        try {
            const keys = await this.redis.keys('ratchet:*:user:*');
            if (keys.length > 0) {
                await this.redis.del(...keys);
                console.log(`🗑️  ${keys.length} registros removidos do cache`);
            } else {
                console.log('ℹ️  Nenhum registro encontrado no cache');
            }
            return true;
        } catch (error) {
            console.warn(`⚠️  Erro ao limpar cache: ${error.message}`);
            return false;
        }
    }

    /**
     * Obtém estatísticas do cache
     */
    async getStats() {
        if (!this.isEnabled || !this.redis) {
            return {
                enabled: false,
                totalRecords: 0
            };
        }

        try {
            const keys = await this.redis.keys('ratchet:*:user:*');
            return {
                enabled: true,
                totalRecords: keys.length,
                keys: keys
            };
        } catch (error) {
            console.warn(`⚠️  Erro ao obter estatísticas: ${error.message}`);
            return {
                enabled: this.isEnabled,
                totalRecords: 0,
                error: error.message
            };
        }
    }

    /**
     * Fecha a conexão com o Redis
     */
    async disconnect() {
        if (this.redis) {
            await this.redis.quit();
            console.log('👋 Redis desconectado');
        }
    }
}

// Exporta uma instância singleton
const cacheInstance = new RedisCache();

module.exports = cacheInstance;

