const CacheManager = require('./modules/cache-manager');

/**
 * Visualizador de Cache de Usuários Registrados
 * Permite visualizar, buscar e gerenciar o cache de usuários por dispositivo
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
    }

    /**
     * Lista todos os usuários registrados
     */
    listAllUsers() {
        const allUsers = this.cacheManager.getAllUsers();
        
        console.log('\n👥 USUÁRIOS REGISTRADOS:');
        console.log('═'.repeat(80));
        
        if (allUsers.length === 0) {
            console.log('   Nenhum usuário encontrado no cache');
            return;
        }

        // Agrupa por dispositivo
        const usersByDevice = {};
        allUsers.forEach(user => {
            if (!usersByDevice[user.deviceIp]) {
                usersByDevice[user.deviceIp] = [];
            }
            usersByDevice[user.deviceIp].push(user);
        });

        let userIndex = 1;
        for (const [deviceIp, deviceUsers] of Object.entries(usersByDevice)) {
            console.log(`\n🖥️  DISPOSITIVO: ${deviceIp} (${deviceUsers.length} usuários)`);
            console.log('─'.repeat(60));
            
            deviceUsers.forEach(user => {
                console.log(`${userIndex}. ${user.name} (${user.type})`);
                console.log(`   🎫 InviteId: ${user.inviteId}`);
                console.log(`   📧 Email: ${user.email || 'N/A'}`);
                console.log(`   📄 Documento: ${user.document || 'N/A'}`);
                console.log(`   📱 Telefone: ${user.cellphone || 'N/A'}`);
                console.log(`   📅 Registrado: ${new Date(user.registeredAt).toLocaleString()}`);
                console.log(`   🔄 Atualizado: ${new Date(user.lastUpdated).toLocaleString()}`);
                console.log('');
                userIndex++;
            });
        }

        console.log(`\n📊 Total: ${allUsers.length} usuários em ${Object.keys(usersByDevice).length} dispositivos`);
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
            
            if (users.length === 0) {
                console.log('   Nenhum usuário encontrado neste dispositivo');
                return;
            }
            
            users.forEach((user, index) => {
                console.log(`${index + 1}. ${user.name} (${user.type})`);
                console.log(`   🎫 InviteId: ${user.inviteId}`);
                console.log(`   📧 ${user.email || 'N/A'} | 📄 ${user.document || 'N/A'}`);
                console.log(`   📅 ${new Date(user.registeredAt).toLocaleString()}`);
                console.log('');
            });
        } else {
            if (stats.totalDevices === 0) {
                console.log('   Nenhum dispositivo encontrado no cache');
                return;
            }
            
            Object.entries(stats.usersByDevice).forEach(([device, count]) => {
                console.log(`🖥️  ${device}: ${count} usuários`);
            });
        }
    }

    /**
     * Busca usuário por nome, documento, email ou inviteId
     */
    searchUsers(query) {
        if (!query) {
            console.log('❌ Forneça um termo de busca');
            return;
        }

        const allUsers = this.cacheManager.getAllUsers();
        const searchTerm = query.toLowerCase();
        
        const results = allUsers.filter(user => 
            user.name.toLowerCase().includes(searchTerm) ||
            (user.document && user.document.toLowerCase().includes(searchTerm)) ||
            (user.email && user.email.toLowerCase().includes(searchTerm)) ||
            (user.inviteId && user.inviteId.toLowerCase().includes(searchTerm))
        );

        console.log(`\n🔍 RESULTADOS DA BUSCA: "${query}"`);
        console.log('═'.repeat(60));
        
        if (results.length === 0) {
            console.log('   Nenhum usuário encontrado');
            return;
        }

        results.forEach((user, index) => {
            console.log(`${index + 1}. ${user.name} (${user.type})`);
            console.log(`   🎫 InviteId: ${user.inviteId}`);
            console.log(`   📧 Email: ${user.email || 'N/A'}`);
            console.log(`   📄 Documento: ${user.document || 'N/A'}`);
            console.log(`   📱 Telefone: ${user.cellphone || 'N/A'}`);
            console.log(`   🖥️  Dispositivo: ${user.deviceIp}`);
            console.log(`   📅 Registrado: ${new Date(user.registeredAt).toLocaleString()}`);
            console.log('─'.repeat(60));
        });

        console.log(`\n📊 Encontrados: ${results.length} usuário(s)`);
    }

    /**
     * Mostra estatísticas do cache
     */
    showStats() {
        const stats = this.cacheManager.getStats();
        
        console.log('\n📊 ESTATÍSTICAS DO CACHE:');
        console.log('═'.repeat(50));
        console.log(`🖥️  Total de dispositivos: ${stats.totalDevices}`);
        console.log(`👥 Total de usuários: ${stats.totalUsers}`);
        console.log(`📁 Diretório de cache: cache/`);
        console.log(`📄 Arquivos por dispositivo: device-{IP}.json`);
        
        if (stats.totalDevices > 0) {
            console.log('\n📱 USUÁRIOS POR DISPOSITIVO:');
            Object.entries(stats.usersByDevice).forEach(([device, count]) => {
                console.log(`   🖥️  ${device}: ${count} usuários`);
            });
        }
    }

    /**
     * Limpa cache de um dispositivo específico ou todos
     */
    async clearCache(deviceIp = null) {
        if (deviceIp) {
            console.log(`\n🗑️  Limpando cache do dispositivo ${deviceIp}...`);
            const success = await this.cacheManager.clearDevice(deviceIp);
            if (success) {
                console.log(`✅ Cache do dispositivo ${deviceIp} limpo com sucesso`);
            } else {
                console.log(`❌ Erro ao limpar cache do dispositivo ${deviceIp}`);
            }
        } else {
            console.log('\n🗑️  Limpando cache de todos os dispositivos...');
            await this.cacheManager.clearAll();
            console.log('✅ Cache de todos os dispositivos limpo');
        }
    }

    /**
     * Exporta cache para arquivo
     */
    async exportCache(filename = null) {
        const allUsers = this.cacheManager.getAllUsers();
        const stats = this.cacheManager.getStats();
        
        const exportData = {
            exportedAt: new Date().toISOString(),
            stats: stats,
            users: allUsers
        };

        const fs = require('fs').promises;
        const path = require('path');
        
        const exportFile = filename || `cache-export-${new Date().toISOString().split('T')[0]}.json`;
        const exportPath = path.join(process.cwd(), exportFile);
        
        try {
            await fs.writeFile(exportPath, JSON.stringify(exportData, null, 2), 'utf8');
            console.log(`\n📤 Cache exportado para: ${exportFile}`);
            console.log(`📊 ${allUsers.length} usuários exportados`);
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
        console.log('node src/cache-viewer.js clear [ip]              - Limpa cache (dispositivo ou todos)');
        console.log('node src/cache-viewer.js export [filename]       - Exporta cache para arquivo');
        console.log('node src/cache-viewer.js help                    - Mostra esta ajuda');
        console.log('\n💡 Exemplos:');
        console.log('  node src/cache-viewer.js device 10.1.35.87');
        console.log('  node src/cache-viewer.js search "João Silva"');
        console.log('  node src/cache-viewer.js clear 10.1.35.87');
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
            viewer.listUsersByDevice(arg);
            break;
        case 'search':
            viewer.searchUsers(arg);
            break;
        case 'stats':
            viewer.showStats();
            break;
        case 'clear':
            await viewer.clearCache(arg);
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