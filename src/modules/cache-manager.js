const fs = require('fs').promises;
const path = require('path');

/**
 * Gerenciador de Cache JSON para usuários registrados
 * Responsável por salvar, carregar e gerenciar backups do cache
 */

// Configuração de cache JSON
const CACHE_DIR = path.join(__dirname, '..', '..', 'cache');
const CACHE_FILE = path.join(CACHE_DIR, 'registered-users.json');
const BACKUP_DIR = path.join(CACHE_DIR, 'backups');

class CacheManager {
    constructor() {
        this.cache = {};
    }

    /**
     * Inicializa diretórios de cache
     */
    async init() {
        try {
            await fs.mkdir(CACHE_DIR, { recursive: true });
            await fs.mkdir(BACKUP_DIR, { recursive: true });
            console.log('📁 Diretórios de cache inicializados');
        } catch (error) {
            console.warn('⚠️  Erro ao criar diretórios de cache:', error.message);
        }
    }

    /**
     * Carrega cache de usuários registrados do JSON
     */
    async load() {
        try {
            const data = await fs.readFile(CACHE_FILE, 'utf8');
            this.cache = JSON.parse(data);
            console.log(`📄 Cache carregado: ${Object.keys(this.cache).length} dispositivos`);
            return this.cache;
        } catch (error) {
            if (error.code === 'ENOENT') {
                console.log('📄 Cache não encontrado, criando novo');
                this.cache = {};
                return this.cache;
            }
            console.warn('⚠️  Erro ao carregar cache:', error.message);
            this.cache = {};
            return this.cache;
        }
    }

    /**
     * Salva cache de usuários registrados no JSON
     */
    async save() {
        try {
            // Cria backup antes de salvar
            await this.createBackup();
            
            // Salva cache atual
            await fs.writeFile(CACHE_FILE, JSON.stringify(this.cache, null, 2), 'utf8');
            console.log('💾 Cache salvo em JSON');
        } catch (error) {
            console.error('❌ Erro ao salvar cache:', error.message);
        }
    }

    /**
     * Cria backup do cache com timestamp
     */
    async createBackup() {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupFile = path.join(BACKUP_DIR, `registered-users-${timestamp}.json`);
            
            // Copia arquivo atual para backup
            try {
                await fs.copyFile(CACHE_FILE, backupFile);
                console.log(`📦 Backup criado: ${path.basename(backupFile)}`);
            } catch (error) {
                // Arquivo não existe ainda, não é erro
                if (error.code !== 'ENOENT') {
                    throw error;
                }
            }
            
            // Remove backups antigos (mantém apenas os últimos 10)
            await this.cleanupOldBackups();
            
        } catch (error) {
            console.warn('⚠️  Erro ao criar backup:', error.message);
        }
    }

    /**
     * Remove backups antigos, mantendo apenas os últimos 10
     */
    async cleanupOldBackups() {
        try {
            const files = await fs.readdir(BACKUP_DIR);
            const backupFiles = files
                .filter(file => file.startsWith('registered-users-') && file.endsWith('.json'))
                .map(file => ({
                    name: file,
                    path: path.join(BACKUP_DIR, file),
                    stats: null
                }));
            
            // Obtém estatísticas dos arquivos
            for (const file of backupFiles) {
                try {
                    file.stats = await fs.stat(file.path);
                } catch (error) {
                    // Arquivo pode ter sido removido
                    continue;
                }
            }
            
            // Ordena por data de modificação (mais recente primeiro)
            backupFiles.sort((a, b) => b.stats.mtime - a.stats.mtime);
            
            // Remove arquivos antigos (mantém apenas os últimos 10)
            const filesToRemove = backupFiles.slice(10);
            for (const file of filesToRemove) {
                try {
                    await fs.unlink(file.path);
                    console.log(`🗑️  Backup antigo removido: ${file.name}`);
                } catch (error) {
                    console.warn(`⚠️  Erro ao remover backup ${file.name}:`, error.message);
                }
            }
            
        } catch (error) {
            console.warn('⚠️  Erro ao limpar backups antigos:', error.message);
        }
    }

    /**
     * Adiciona usuário ao cache JSON usando inviteId como chave principal
     * Sobrescreve dados existentes se inviteId já existir
     */
    async addUser(deviceIp, userId, userData) {
        try {
            if (!this.cache[deviceIp]) {
                this.cache[deviceIp] = {};
            }
            
            // Usa inviteId como chave principal para sobrescrever dados
            const inviteId = userData.inviteId;
            
            const userRecord = {
                userId,
                inviteId: inviteId,
                name: userData.name,
                email: userData.email,
                document: userData.document,
                cellphone: userData.cellphone,
                type: userData.type,
                registeredAt: new Date().toISOString(),
                lastUpdated: new Date().toISOString()
            };
            
            // Verifica se inviteId já existe
            const existingUser = this.cache[deviceIp][inviteId];
            
            if (existingUser) {
                // Sobrescreve dados existentes
                this.cache[deviceIp][inviteId] = userRecord;
                console.log(`🔄 Usuário sobrescrito - inviteId: ${inviteId} (userId: ${existingUser.userId} → ${userId})`);
            } else {
                // Adiciona novo usuário
                this.cache[deviceIp][inviteId] = userRecord;
                console.log(`➕ Usuário adicionado - inviteId: ${inviteId} (userId: ${userId})`);
            }
            
            await this.save();
            return true;
            
        } catch (error) {
            console.error('❌ Erro ao adicionar usuário ao cache JSON:', error.message);
            return false;
        }
    }

    /**
     * Remove usuário do cache JSON por inviteId
     */
    async removeUser(deviceIp, userId, inviteId = null) {
        try {
            if (this.cache[deviceIp] && inviteId) {
                const hadUser = this.cache[deviceIp].hasOwnProperty(inviteId);
                
                if (hadUser) {
                    delete this.cache[deviceIp][inviteId];
                    await this.save();
                    console.log(`➖ Usuário removido - inviteId: ${inviteId} (userId: ${userId})`);
                    return true;
                }
            }
            
            return false;
            
        } catch (error) {
            console.error('❌ Erro ao remover usuário do cache JSON:', error.message);
            return false;
        }
    }

    /**
     * Obtém usuários registrados de um dispositivo do cache JSON
     */
    getUsers(deviceIp) {
        const deviceUsers = this.cache[deviceIp] || {};
        return Object.values(deviceUsers);
    }

    /**
     * Busca usuário por inviteId em um dispositivo específico
     */
    getUserByInviteId(deviceIp, inviteId) {
        const deviceUsers = this.cache[deviceIp] || {};
        return deviceUsers[inviteId] || null;
    }

    /**
     * Busca usuário por inviteId em todos os dispositivos
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
     * Sincroniza cache JSON com Redis
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
                
                // Limpa chave existente
                await redisClient.del(redisKey);
                
                // Adiciona usuários ao Redis
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
}

module.exports = CacheManager;
