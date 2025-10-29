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
     * Adiciona usuário ao cache JSON
     */
    async addUser(deviceIp, userId, userData) {
        try {
            if (!this.cache[deviceIp]) {
                this.cache[deviceIp] = [];
            }
            
            // Verifica se usuário já existe
            const existingIndex = this.cache[deviceIp].findIndex(u => u.userId === userId);
            
            const userRecord = {
                userId,
                name: userData.name,
                email: userData.email,
                document: userData.document,
                cellphone: userData.cellphone,
                type: userData.type,
                registeredAt: new Date().toISOString(),
                lastUpdated: new Date().toISOString()
            };
            
            if (existingIndex >= 0) {
                // Atualiza usuário existente
                this.cache[deviceIp][existingIndex] = userRecord;
                console.log(`🔄 Usuário ${userId} atualizado no cache JSON`);
            } else {
                // Adiciona novo usuário
                this.cache[deviceIp].push(userRecord);
                console.log(`➕ Usuário ${userId} adicionado ao cache JSON`);
            }
            
            await this.save();
            return true;
            
        } catch (error) {
            console.error('❌ Erro ao adicionar usuário ao cache JSON:', error.message);
            return false;
        }
    }

    /**
     * Remove usuário do cache JSON
     */
    async removeUser(deviceIp, userId) {
        try {
            if (this.cache[deviceIp]) {
                const initialLength = this.cache[deviceIp].length;
                this.cache[deviceIp] = this.cache[deviceIp].filter(u => u.userId !== userId);
                
                if (this.cache[deviceIp].length < initialLength) {
                    await this.save();
                    console.log(`➖ Usuário ${userId} removido do cache JSON`);
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
        return this.cache[deviceIp] || [];
    }

    /**
     * Obtém todos os usuários de todos os dispositivos
     */
    getAllUsers() {
        const allUsers = [];
        for (const [deviceIp, users] of Object.entries(this.cache)) {
            allUsers.push(...users.map(user => ({ ...user, deviceIp })));
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

        for (const [deviceIp, users] of Object.entries(this.cache)) {
            stats.usersByDevice[deviceIp] = users.length;
            stats.totalUsers += users.length;
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
            
            for (const [deviceIp, users] of Object.entries(this.cache)) {
                const userIds = users.map(u => u.userId);
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
