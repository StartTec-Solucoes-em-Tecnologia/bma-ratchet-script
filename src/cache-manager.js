#!/usr/bin/env node

/**
 * Utilitário de linha de comando para gerenciar o cache Redis
 * 
 * Uso:
 *   node src/cache-manager.js stats        # Exibe estatísticas do cache
 *   node src/cache-manager.js clear        # Limpa todo o cache
 *   node src/cache-manager.js check <ip> <id>  # Verifica se um usuário está no cache
 *   node src/cache-manager.js remove <ip> <id> # Remove um usuário específico do cache
 */

const redisCache = require('./redis-cache');
require('dotenv').config();

async function showStats() {
    try {
        await redisCache.connect();
        const stats = await redisCache.getStats();
        
        console.log('\n📊 ESTATÍSTICAS DO CACHE REDIS\n');
        
        if (!stats.enabled) {
            console.log('❌ Redis não está disponível');
            return;
        }
        
        console.log(`✅ Redis conectado`);
        console.log(`📦 Total de registros: ${stats.totalRecords}`);
        
        if (stats.totalRecords > 0) {
            console.log(`\n📋 Chaves no cache:`);
            stats.keys.forEach(key => {
                console.log(`  - ${key}`);
            });
        }
        
        await redisCache.disconnect();
    } catch (error) {
        console.error('❌ Erro:', error.message);
        process.exit(1);
    }
}

async function clearCache() {
    try {
        await redisCache.connect();
        
        console.log('\n🗑️  Limpando cache...');
        const success = await redisCache.clearAll();
        
        if (success) {
            console.log('✅ Cache limpo com sucesso!');
        } else {
            console.log('❌ Erro ao limpar cache');
        }
        
        await redisCache.disconnect();
    } catch (error) {
        console.error('❌ Erro:', error.message);
        process.exit(1);
    }
}

async function checkUser(deviceIp, participantId) {
    try {
        await redisCache.connect();
        
        const userInfo = await redisCache.getUserInfo(deviceIp, participantId);
        
        if (userInfo) {
            console.log('\n✅ Usuário encontrado no cache:');
            console.log(`  👤 Nome: ${userInfo.participantName}`);
            console.log(`  🆔 ID: ${userInfo.participantId}`);
            console.log(`  🎫 Código de convite: ${userInfo.inviteCode}`);
            console.log(`  🖥️  IP da catraca: ${userInfo.deviceIp}`);
            console.log(`  📅 Registrado em: ${userInfo.registeredAt}`);
        } else {
            console.log('\n❌ Usuário não encontrado no cache');
        }
        
        await redisCache.disconnect();
    } catch (error) {
        console.error('❌ Erro:', error.message);
        process.exit(1);
    }
}

async function removeUser(deviceIp, participantId) {
    try {
        await redisCache.connect();
        
        console.log(`\n🗑️  Removendo usuário ${participantId} da catraca ${deviceIp}...`);
        const success = await redisCache.removeUser(deviceIp, participantId);
        
        if (success) {
            console.log('✅ Usuário removido com sucesso!');
        } else {
            console.log('❌ Erro ao remover usuário');
        }
        
        await redisCache.disconnect();
    } catch (error) {
        console.error('❌ Erro:', error.message);
        process.exit(1);
    }
}

function showHelp() {
    console.log(`
📦 Gerenciador de Cache Redis
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Comandos disponíveis:

  stats                      Exibe estatísticas do cache
  clear                      Limpa todo o cache
  check <ip> <id>           Verifica se um usuário está no cache
  remove <ip> <id>          Remove um usuário específico do cache
  help                       Exibe esta mensagem de ajuda

Exemplos:

  npm run cache:stats
  npm run cache:clear
  node src/cache-manager.js check 192.168.1.100 42
  node src/cache-manager.js remove 192.168.1.100 42

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
}

// Parse argumentos da linha de comando
const args = process.argv.slice(2);
const command = args[0];

(async () => {
    switch (command) {
        case 'stats':
            await showStats();
            break;
        
        case 'clear':
            await clearCache();
            break;
        
        case 'check':
            if (args.length < 3) {
                console.error('❌ Uso: cache-manager.js check <ip> <id>');
                process.exit(1);
            }
            await checkUser(args[1], args[2]);
            break;
        
        case 'remove':
            if (args.length < 3) {
                console.error('❌ Uso: cache-manager.js remove <ip> <id>');
                process.exit(1);
            }
            await removeUser(args[1], args[2]);
            break;
        
        case 'help':
        case '--help':
        case '-h':
            showHelp();
            break;
        
        default:
            console.error(`❌ Comando desconhecido: ${command}`);
            showHelp();
            process.exit(1);
    }
})();

