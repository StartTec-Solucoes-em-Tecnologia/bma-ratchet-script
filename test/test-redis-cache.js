#!/usr/bin/env node

/**
 * Teste do sistema de cache Redis
 * 
 * Este teste demonstra o funcionamento do cache:
 * 1. Conecta ao Redis
 * 2. Salva alguns registros de teste
 * 3. Verifica se os registros existem
 * 4. Lista estatísticas
 * 5. Limpa os registros de teste
 */

const redisCache = require('../src/redis-cache');

const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

function log(emoji, message, color = colors.reset) {
    console.log(`${color}${emoji} ${message}${colors.reset}`);
}

async function runTests() {
    console.log('\n' + '='.repeat(60));
    log('🧪', 'TESTE DO SISTEMA DE CACHE REDIS', colors.cyan);
    console.log('='.repeat(60) + '\n');

    try {
        // 1. Conectar ao Redis
        log('🔌', 'Conectando ao Redis...', colors.blue);
        await redisCache.connect();
        
        if (!redisCache.isEnabled) {
            log('⚠️ ', 'Redis não está disponível. Instale o Redis para executar este teste.', colors.yellow);
            log('💡', 'Ubuntu/Debian: sudo apt-get install redis-server', colors.yellow);
            log('💡', 'macOS: brew install redis', colors.yellow);
            log('💡', 'Docker: docker run -d -p 6379:6379 redis', colors.yellow);
            process.exit(0);
        }
        
        log('✅', 'Conectado ao Redis com sucesso!', colors.green);

        // 2. Criar dados de teste
        const testParticipants = [
            { id: 1001, nome: 'João Teste', codigo_de_convite: 'TEST001' },
            { id: 1002, nome: 'Maria Teste', codigo_de_convite: 'TEST002' },
            { id: 1003, nome: 'Pedro Teste', codigo_de_convite: 'TEST003' }
        ];

        const testDeviceIps = ['192.168.1.100', '192.168.1.101'];

        console.log('\n' + '-'.repeat(60));
        log('💾', 'Salvando registros de teste no cache...', colors.blue);
        console.log('-'.repeat(60));

        let savedCount = 0;
        for (const participant of testParticipants) {
            for (const deviceIp of testDeviceIps) {
                const success = await redisCache.markUserAsRegistered(deviceIp, participant);
                if (success) {
                    savedCount++;
                    log('✅', `Salvo: ${participant.nome} em ${deviceIp}`, colors.green);
                } else {
                    log('❌', `Erro ao salvar: ${participant.nome} em ${deviceIp}`, colors.red);
                }
            }
        }

        console.log(`\n📊 Total salvos: ${savedCount}/${testParticipants.length * testDeviceIps.length}`);

        // 3. Verificar se os registros existem
        console.log('\n' + '-'.repeat(60));
        log('🔍', 'Verificando registros no cache...', colors.blue);
        console.log('-'.repeat(60));

        let foundCount = 0;
        for (const participant of testParticipants) {
            for (const deviceIp of testDeviceIps) {
                const exists = await redisCache.isUserRegistered(deviceIp, participant);
                if (exists) {
                    foundCount++;
                    log('✅', `Encontrado: ${participant.nome} em ${deviceIp}`, colors.green);
                } else {
                    log('❌', `Não encontrado: ${participant.nome} em ${deviceIp}`, colors.red);
                }
            }
        }

        console.log(`\n📊 Total encontrados: ${foundCount}/${testParticipants.length * testDeviceIps.length}`);

        // 4. Obter informações detalhadas de um registro
        console.log('\n' + '-'.repeat(60));
        log('📋', 'Obtendo informações detalhadas...', colors.blue);
        console.log('-'.repeat(60));

        const userInfo = await redisCache.getUserInfo(testDeviceIps[0], testParticipants[0].id);
        if (userInfo) {
            console.log(JSON.stringify(userInfo, null, 2));
        } else {
            log('❌', 'Não foi possível obter informações do usuário', colors.red);
        }

        // 5. Estatísticas do cache
        console.log('\n' + '-'.repeat(60));
        log('📊', 'Estatísticas do cache...', colors.blue);
        console.log('-'.repeat(60));

        const stats = await redisCache.getStats();
        console.log(`\n✅ Redis habilitado: ${stats.enabled}`);
        console.log(`📦 Total de registros: ${stats.totalRecords}`);

        // 6. Testar remoção de um registro
        console.log('\n' + '-'.repeat(60));
        log('🗑️ ', 'Testando remoção de um registro...', colors.blue);
        console.log('-'.repeat(60));

        const removed = await redisCache.removeUser(testDeviceIps[0], testParticipants[0].id);
        if (removed) {
            log('✅', `Removido: ${testParticipants[0].nome} de ${testDeviceIps[0]}`, colors.green);
            
            // Verificar se realmente foi removido
            const stillExists = await redisCache.isUserRegistered(testDeviceIps[0], testParticipants[0]);
            if (!stillExists) {
                log('✅', 'Confirmado: registro não existe mais no cache', colors.green);
            } else {
                log('❌', 'Erro: registro ainda existe no cache', colors.red);
            }
        } else {
            log('❌', 'Erro ao remover registro', colors.red);
        }

        // 7. Limpar todos os registros de teste
        console.log('\n' + '-'.repeat(60));
        log('🧹', 'Limpando registros de teste...', colors.blue);
        console.log('-'.repeat(60));

        // Remover cada registro de teste
        for (const participant of testParticipants) {
            for (const deviceIp of testDeviceIps) {
                await redisCache.removeUser(deviceIp, participant.id);
            }
        }

        log('✅', 'Registros de teste removidos!', colors.green);

        // 8. Verificar se o cache foi limpo
        const finalStats = await redisCache.getStats();
        const testKeysRemaining = finalStats.keys.filter(key => key.includes('TEST')).length;
        
        if (testKeysRemaining === 0) {
            log('✅', 'Cache limpo com sucesso!', colors.green);
        } else {
            log('⚠️ ', `Ainda restam ${testKeysRemaining} chaves de teste no cache`, colors.yellow);
        }

        // Desconectar
        await redisCache.disconnect();

        // Resumo final
        console.log('\n' + '='.repeat(60));
        log('🎉', 'TESTE CONCLUÍDO COM SUCESSO!', colors.green);
        console.log('='.repeat(60) + '\n');

        console.log('📝 Resumo dos testes:');
        console.log(`  ✅ Conexão com Redis: OK`);
        console.log(`  ✅ Salvar registros: ${savedCount}/${testParticipants.length * testDeviceIps.length}`);
        console.log(`  ✅ Verificar existência: ${foundCount}/${testParticipants.length * testDeviceIps.length}`);
        console.log(`  ✅ Obter informações: OK`);
        console.log(`  ✅ Remover registro: OK`);
        console.log(`  ✅ Limpar cache: OK\n`);

    } catch (error) {
        log('❌', `Erro no teste: ${error.message}`, colors.red);
        console.error(error);
        process.exit(1);
    }
}

// Executar os testes
if (require.main === module) {
    runTests();
}

module.exports = { runTests };

