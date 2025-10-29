const CacheManager = require('./modules/cache-manager');
const path = require('path');

/**
 * Visualizador de Cache JSON
 * Permite visualizar, filtrar e gerenciar o cache de usuários registrados
 */

class CacheViewer {
    constructor() {
        this.cacheManager = new CacheManager();
    }

    /**
     * Inicializa o visualizador
     */
    async init() {
        await this.cacheManager.init();
        await this.cacheManager.load();
    }

    /**
     * Lista todos os usuários do cache
     */
    listAllUsers() {
        const allUsers = this.cacheManager.getAllUsers();
        
        console.log('\n📋 TODOS OS USUÁRIOS NO CACHE:');
        console.log('═'.repeat(80));
        
        if (allUsers.length === 0) {
            console.log('   Nenhum usuário encontrado no cache');
            return;
        }

        allUsers.forEach((user, index) => {
            console.log(`${index + 1}. ${user.name} (${user.type})`);
            console.log(`   📧 Email: ${user.email || 'N/A'}`);
            console.log(`   📄 Documento: ${user.document || 'N/A'}`);
            console.log(`   📱 Telefone: ${user.cellphone || 'N/A'}`);
            console.log(`   🖥️  Dispositivo: ${user.deviceIp}`);
            console.log(`   📅 Registrado: ${new Date(user.registeredAt).toLocaleString()}`);
            console.log(`   🔄 Atualizado: ${new Date(user.lastUpdated).toLocaleString()}`);
            console.log('─'.repeat(80));
        });

        console.log(`\n📊 Total: ${allUsers.length} usuários`);
    }

    /**
     * Lista usuários por dispositivo
     */
    listUsersByDevice(deviceIp = null) {
        const stats = this.cacheManager.getStats();
        
        console.log('\n📱 USUÁRIOS POR DISPOSITIVO:');
        console.log('═'.repeat(60));
        
        if (deviceIp) {
            const users = this.cacheManager.getUsers(deviceIp);
            console.log(`\n🖥️  Dispositivo: ${deviceIp}`);
            console.log(`👥 Usuários: ${users.length}`);
            console.log('─'.repeat(60));
            
            users.forEach((user, index) => {
                console.log(`${index + 1}. ${user.name} (${user.type})`);
                console.log(`   📧 ${user.email || 'N/A'} | 📄 ${user.document || 'N/A'}`);
                console.log(`   📅 ${new Date(user.registeredAt).toLocaleString()}`);
            });
        } else {
            Object.entries(stats.usersByDevice).forEach(([device, count]) => {
                console.log(`🖥️  ${device}: ${count} usuários`);
            });
        }
    }

    /**
     * Busca usuário por nome ou documento
     */
    searchUser(query) {
        const allUsers = this.cacheManager.getAllUsers();
        const results = allUsers.filter(user => 
            user.name.toLowerCase().includes(query.toLowerCase()) ||
            user.document?.includes(query) ||
            user.email?.toLowerCase().includes(query.toLowerCase())
        );

        console.log(`\n🔍 RESULTADOS DA BUSCA: "${query}"`);
        console.log('═'.repeat(60));
        
        if (results.length === 0) {
            console.log('   Nenhum usuário encontrado');
            return;
        }

        results.forEach((user, index) => {
            console.log(`${index + 1}. ${user.name} (${user.type})`);
            console.log(`   📧 ${user.email || 'N/A'} | 📄 ${user.document || 'N/A'}`);
            console.log(`   🖥️  ${user.deviceIp} | 📅 ${new Date(user.registeredAt).toLocaleString()}`);
        });

        console.log(`\n📊 Encontrados: ${results.length} usuários`);
    }

    /**
     * Mostra estatísticas do cache
     */
    showStats() {
        const stats = this.cacheManager.getStats();
        
        console.log('\n📊 ESTATÍSTICAS DO CACHE:');
        console.log('═'.repeat(40));
        console.log(`📱 Total de dispositivos: ${stats.totalDevices}`);
        console.log(`👥 Total de usuários: ${stats.totalUsers}`);
        console.log(`📄 Arquivo: ${path.join(__dirname, '..', 'cache', 'registered-users.json')}`);
        console.log(`📦 Backups: ${path.join(__dirname, '..', 'cache', 'backups')}`);
        
        if (stats.totalDevices > 0) {
            console.log('\n📱 Por dispositivo:');
            Object.entries(stats.usersByDevice).forEach(([device, count]) => {
                console.log(`   ${device}: ${count} usuários`);
            });
        }
    }

    /**
     * Limpa cache de um dispositivo específico
     */
    async clearDevice(deviceIp) {
        try {
            const users = this.cacheManager.getUsers(deviceIp);
            if (users.length === 0) {
                console.log(`⚠️  Nenhum usuário encontrado no dispositivo ${deviceIp}`);
                return;
            }

            console.log(`🗑️  Removendo ${users.length} usuários do dispositivo ${deviceIp}...`);
            
            for (const user of users) {
                await this.cacheManager.removeUser(deviceIp, user.userId);
            }
            
            console.log(`✅ Dispositivo ${deviceIp} limpo com sucesso`);
        } catch (error) {
            console.error(`❌ Erro ao limpar dispositivo ${deviceIp}:`, error.message);
        }
    }

    /**
     * Exporta cache para arquivo
     */
    async exportCache(filename = null) {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const exportFile = filename || `cache-export-${timestamp}.json`;
            const exportPath = path.join(__dirname, '..', 'cache', exportFile);
            
            const fs = require('fs').promises;
            await fs.writeFile(exportPath, JSON.stringify(this.cacheManager.cache, null, 2));
            
            console.log(`📤 Cache exportado para: ${exportPath}`);
        } catch (error) {
            console.error('❌ Erro ao exportar cache:', error.message);
        }
    }

    /**
     * Mostra ajuda
     */
    showHelp() {
        console.log('\n📖 COMANDOS DISPONÍVEIS:');
        console.log('═'.repeat(50));
        console.log('node src/cache-viewer.js list                    - Lista todos os usuários');
        console.log('node src/cache-viewer.js device <ip>             - Lista usuários de um dispositivo');
        console.log('node src/cache-viewer.js search <query>          - Busca usuários');
        console.log('node src/cache-viewer.js stats                   - Mostra estatísticas');
        console.log('node src/cache-viewer.js clear <ip>              - Limpa dispositivo');
        console.log('node src/cache-viewer.js export [filename]       - Exporta cache');
        console.log('node src/cache-viewer.js help                    - Mostra esta ajuda');
    }
}

// Execução via linha de comando
async function main() {
    const viewer = new CacheViewer();
    await viewer.init();

    const command = process.argv[2];
    const arg = process.argv[3];

    switch (command) {
        case 'list':
            viewer.listAllUsers();
            break;
        case 'device':
            if (!arg) {
                console.log('❌ Especifique o IP do dispositivo');
                process.exit(1);
            }
            viewer.listUsersByDevice(arg);
            break;
        case 'search':
            if (!arg) {
                console.log('❌ Especifique o termo de busca');
                process.exit(1);
            }
            viewer.searchUser(arg);
            break;
        case 'stats':
            viewer.showStats();
            break;
        case 'clear':
            if (!arg) {
                console.log('❌ Especifique o IP do dispositivo');
                process.exit(1);
            }
            await viewer.clearDevice(arg);
            break;
        case 'export':
            await viewer.exportCache(arg);
            break;
        case 'help':
        default:
            viewer.showHelp();
            break;
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = CacheViewer;
