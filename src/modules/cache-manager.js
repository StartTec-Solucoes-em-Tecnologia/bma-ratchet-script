const fs = require('fs').promises;
const path = require('path');

/**
 * Gerenciador de Cache JSON para usuários registrados por IP de leitora facial
 * Responsável por salvar, carregar e gerenciar backups do cache
 */

// Configuração de cache JSON
const CACHE_DIR = path.join(__dirname, '..', '..', 'cache');
const BACKUP_DIR = path.join(CACHE_DIR, 'backups');

class CacheManager {
    constructor() {
        this.cache = {};
        this.deviceFiles = new Map(); // Mapeia IP -> arquivo de cache
    }

    /**
     * Inicializa diretórios de cache
     */
    async init() {
        try {
            await fs.mkdir(CACHE_DIR, { recursive: true });
            await fs.mkdir(BACKUP_DIR, { recursive: true });
            console.log('📁 Diretórios de cache inicializados');
            await this.loadAllDevices();
        } catch (error) {
            console.warn('⚠️  Erro ao criar diretórios de cache:', error.message);
        }
    }

    /**
     * Carrega todos os arquivos de cache de dispositivos
     */
    async loadAllDevices() {
        try {
            const files = await fs.readdir(CACHE_DIR);
            const deviceFiles = files.filter(file => file.startsWith('device-') && file.endsWith('.json'));
            
            for (const file of deviceFiles) {
                const deviceIp = file.replace('device-', '').replace('.json', '');
                const filePath = path.join(CACHE_DIR, file);
                
                try {
                    const data = await fs.readFile(filePath, 'utf8');
                    this.cache[deviceIp] = JSON.parse(data);
                    this.deviceFiles.set(deviceIp, filePath);
                } catch (error) {
                    console.warn(`⚠️  Erro ao carregar cache do dispositivo ${deviceIp}:`, error.message);
                    this.cache[deviceIp] = {};
                }
            }
            
            console.log(`📄 Cache carregado: ${Object.keys(this.cache).length} dispositivos`);
            return this.cache;
        } catch (error) {
            console.warn('⚠️  Erro ao carregar caches de dispositivos:', error.message);
            this.cache = {};
            return this.cache;
        }
    }

    /**
     * Carrega cache de um dispositivo específico
     */
    async loadDevice(deviceIp) {
        try {
            const filePath = this.getDeviceFilePath(deviceIp);
            const data = await fs.readFile(filePath, 'utf8');
            this.cache[deviceIp] = JSON.parse(data);
            return this.cache[deviceIp];
        } catch (error) {
            if (error.code === 'ENOENT') {
                console.log(`📄 Cache do dispositivo ${deviceIp} não encontrado, criando novo`);
                this.cache[deviceIp] = {};
                return this.cache[deviceIp];
            }
            console.warn(`⚠️  Erro ao carregar cache do dispositivo ${deviceIp}:`, error.message);
            this.cache[deviceIp] = {};
            return this.cache[deviceIp];
        }
    }

    /**
     * Salva cache de um dispositivo específico
     */
    async saveDevice(deviceIp) {
        try {
            if (!this.cache[deviceIp]) {
                console.warn(`⚠️  Nenhum cache encontrado para o dispositivo ${deviceIp}`);
                return;
            }

            const filePath = this.getDeviceFilePath(deviceIp);
            
            // Cria backup antes de salvar
            await this.createDeviceBackup(deviceIp, filePath);
            
            // Salva cache atual
            await fs.writeFile(filePath, JSON.stringify(this.cache[deviceIp], null, 2), 'utf8');
            this.deviceFiles.set(deviceIp, filePath);
            console.log(`💾 Cache do dispositivo ${deviceIp} salvo`);
        } catch (error) {
            console.error(`❌ Erro ao salvar cache do dispositivo ${deviceIp}:`, error.message);
        }
    }

    /**
     * Obtém caminho do arquivo de cache para um dispositivo
     */
    getDeviceFilePath(deviceIp) {
        return path.join(CACHE_DIR, `device-${deviceIp}.json`);
    }

    /**
     * Cria backup do cache de um dispositivo
     */
    async createDeviceBackup(deviceIp, filePath) {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupFile = path.join(BACKUP_DIR, `device-${deviceIp}-${timestamp}.json`);
            
            try {
                await fs.copyFile(filePath, backupFile);
                console.log(`📦 Backup criado: ${path.basename(backupFile)}`);
            } catch (error) {
                if (error.code !== 'ENOENT') {
                    throw error;
                }
            }
            
            await this.cleanupOldDeviceBackups(deviceIp);
        } catch (error) {
            console.warn(`⚠️  Erro ao criar backup do dispositivo ${deviceIp}:`, error.message);
        }
    }

    /**
     * Limpa backups antigos de um dispositivo
     */
    async cleanupOldDeviceBackups(deviceIp) {
        try {
            const files = await fs.readdir(BACKUP_DIR);
            const deviceBackups = files
                .filter(file => file.startsWith(`device-${deviceIp}-`) && file.endsWith('.json'))
                .map(file => ({
                    name: file,
                    path: path.join(BACKUP_DIR, file),
                    stats: null
                }));
            
            for (const file of deviceBackups) {
                try {
                    file.stats = await fs.stat(file.path);
                } catch (error) {
                    continue;
                }
            }
            
            deviceBackups.sort((a, b) => b.stats.mtime - a.stats.mtime);
            
            const filesToRemove = deviceBackups.slice(10); // Mantém apenas os 10 mais recentes
            for (const file of filesToRemove) {
                try {
                    await fs.unlink(file.path);
                    console.log(`🗑️  Backup antigo removido: ${file.name}`);
                } catch (error) {
                    console.warn(`⚠️  Erro ao remover backup ${file.name}:`, error.message);
                }
            }
        } catch (error) {
            console.warn(`⚠️  Erro ao limpar backups antigos do dispositivo ${deviceIp}:`, error.message);
        }
    }

    /**
     * Adiciona usuário ao cache de um dispositivo
     */
    async addUser(deviceIp, userId, userData) {
        try {
            if (!this.cache[deviceIp]) {
                this.cache[deviceIp] = {};
            }
            
            const inviteId = userData.inviteId;
            
            const userRecord = {
                userId,
                inviteId: inviteId,
                name: userData.name,
                email: userData.email,
                document: userData.document,
                cellphone: userData.cellPhone,
                type: userData.type,
                registeredAt: new Date().toISOString(),
                lastUpdated: new Date().toISOString()
            };
            
            const existingUser = this.cache[deviceIp][inviteId];
            
            if (existingUser) {
                this.cache[deviceIp][inviteId] = userRecord;
                console.log(`🔄 Usuário sobrescrito - inviteId: ${inviteId} (userId: ${existingUser.userId} → ${userId})`);
            } else {
                this.cache[deviceIp][inviteId] = userRecord;
                console.log(`➕ Usuário adicionado - inviteId: ${inviteId} (userId: ${userId})`);
            }
            
            await this.saveDevice(deviceIp);
            return true;
            
        } catch (error) {
            console.error(`❌ Erro ao adicionar usuário ao cache do dispositivo ${deviceIp}:`, error.message);
            return false;
        }
    }

    /**
     * Remove usuário do cache de um dispositivo
     */
    async removeUser(deviceIp, userId, inviteId = null) {
        try {
            if (this.cache[deviceIp] && inviteId) {
                const hadUser = this.cache[deviceIp].hasOwnProperty(inviteId);
                
                if (hadUser) {
                    delete this.cache[deviceIp][inviteId];
                    await this.saveDevice(deviceIp);
                    console.log(`➖ Usuário removido - inviteId: ${inviteId} (userId: ${userId})`);
                    return true;
                }
            }
            
            return false;
            
        } catch (error) {
            console.error(`❌ Erro ao remover usuário do cache do dispositivo ${deviceIp}:`, error.message);
            return false;
        }
    }

    /**
     * Obtém usuários de um dispositivo
     */
    getUsers(deviceIp) {
        const deviceUsers = this.cache[deviceIp] || {};
        return Object.values(deviceUsers);
    }

    /**
     * Obtém usuário por inviteId em um dispositivo
     */
    getUserByInviteId(deviceIp, inviteId) {
        const deviceUsers = this.cache[deviceIp] || {};
        return deviceUsers[inviteId] || null;
    }

    /**
     * Obtém usuário por inviteId em qualquer dispositivo
     */
    getUserByInviteIdGlobal(inviteId) {
        for (const [deviceIp, deviceUsers] of Object.entries(this.cache)) {
            if (deviceUsers[inviteId]) {
                return { ...deviceUsers[inviteId], deviceIp };
            }
        }
        return null;
    }

    /**
     * Obtém todos os usuários de todos os dispositivos
     */
    getAllUsers() {
        const allUsers = [];
        for (const [deviceIp, deviceUsers] of Object.entries(this.cache)) {
            for (const [inviteId, user] of Object.entries(deviceUsers)) {
                allUsers.push({ ...user, deviceIp });
            }
        }
        return allUsers;
    }

    /**
     * Obtém estatísticas do cache
     */
    getStats() {
        const stats = {
            totalDevices: Object.keys(this.cache).length,
            totalUsers: 0,
            usersByDevice: {}
        };

        for (const [deviceIp, deviceUsers] of Object.entries(this.cache)) {
            const userCount = Object.keys(deviceUsers).length;
            stats.usersByDevice[deviceIp] = userCount;
            stats.totalUsers += userCount;
        }

        return stats;
    }

    /**
     * Sincroniza cache com Redis
     */
    async syncWithRedis(redisClient) {
        try {
            if (!redisClient) {
                console.log('⚠️  Redis não disponível, pulando sincronização');
                return;
            }
            
            let syncedDevices = 0;
            let syncedUsers = 0;
            
            for (const [deviceIp, deviceUsers] of Object.entries(this.cache)) {
                const userIds = Object.values(deviceUsers).map(u => u.userId);
                const redisKey = `device:${deviceIp}:users`;
                
                await redisClient.del(redisKey);
                
                if (userIds.length > 0) {
                    await redisClient.sAdd(redisKey, userIds);
                    syncedDevices++;
                    syncedUsers += userIds.length;
                }
            }
            
            console.log(`🔄 Cache sincronizado com Redis: ${syncedDevices} dispositivos, ${syncedUsers} usuários`);
            
        } catch (error) {
            console.error('❌ Erro ao sincronizar cache com Redis:', error.message);
        }
    }

    /**
     * Limpa cache de um dispositivo específico
     */
    async clearDevice(deviceIp) {
        try {
            if (this.cache[deviceIp]) {
                this.cache[deviceIp] = {};
                await this.saveDevice(deviceIp);
                console.log(`🗑️  Cache do dispositivo ${deviceIp} limpo`);
                return true;
            }
            return false;
        } catch (error) {
            console.error(`❌ Erro ao limpar cache do dispositivo ${deviceIp}:`, error.message);
            return false;
        }
    }

    /**
     * Limpa cache de todos os dispositivos
     */
    async clearAll() {
        try {
            for (const deviceIp of Object.keys(this.cache)) {
                await this.clearDevice(deviceIp);
            }
            console.log('🗑️  Cache de todos os dispositivos limpo');
        } catch (error) {
            console.error('❌ Erro ao limpar cache de todos os dispositivos:', error.message);
        }
    }
}

module.exports = CacheManager;