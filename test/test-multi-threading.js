/**
 * Teste de Multi-Threading com Piscina
 * 
 * Este teste demonstra o uso de worker threads para processar
 * múltiplos registros de usuários em paralelo
 */

const { registerAllUsersInAllRatchets, redisCache } = require('../src/index');
require('dotenv').config();

async function testMultiThreading() {
    console.log('🧪 ========================================');
    console.log('🧪 TESTE DE MULTI-THREADING COM PISCINA');
    console.log('🧪 ========================================\n');

    try {
        console.log('📋 Configuração do teste:');
        console.log(`   - BASE_URL: ${process.env.BASE_URL || 'NÃO DEFINIDO'}`);
        console.log(`   - EVENT_ID: ${process.env.EVENT_ID || 'NÃO DEFINIDO'}`);
        console.log(`   - DEVICE_IPS: ${process.env.DEVICE_IPS || 'NÃO DEFINIDO'}`);
        console.log(`   - Redis: ${process.env.REDIS_ENABLED === 'true' ? 'HABILITADO' : 'DESABILITADO'}\n`);

        // Teste 1: Multi-threading com 5 workers
        console.log('\n📝 TESTE 1: Multi-threading com 5 workers');
        console.log('━'.repeat(50));
        const startTime1 = Date.now();
        
        const result1 = await registerAllUsersInAllRatchets({
            useMultiThreading: true,
            maxConcurrency: 5
        });
        
        const endTime1 = Date.now();
        const duration1 = ((endTime1 - startTime1) / 1000).toFixed(2);
        
        console.log(`\n⏱️  Tempo de execução: ${duration1}s`);
        console.log(`✅ Status: ${result1.success ? 'SUCESSO' : 'ERRO'}`);
        
        // Pequena pausa entre testes
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Teste 2: Multi-threading com 10 workers
        console.log('\n\n📝 TESTE 2: Multi-threading com 10 workers');
        console.log('━'.repeat(50));
        const startTime2 = Date.now();
        
        const result2 = await registerAllUsersInAllRatchets({
            useMultiThreading: true,
            maxConcurrency: 10
        });
        
        const endTime2 = Date.now();
        const duration2 = ((endTime2 - startTime2) / 1000).toFixed(2);
        
        console.log(`\n⏱️  Tempo de execução: ${duration2}s`);
        console.log(`✅ Status: ${result2.success ? 'SUCESSO' : 'ERRO'}`);
        
        // Comparação
        console.log('\n\n📊 COMPARAÇÃO DE PERFORMANCE');
        console.log('━'.repeat(50));
        console.log(`🔧 5 workers:  ${duration1}s`);
        console.log(`🔧 10 workers: ${duration2}s`);
        
        const improvement = (((parseFloat(duration1) - parseFloat(duration2)) / parseFloat(duration1)) * 100).toFixed(1);
        if (parseFloat(duration2) < parseFloat(duration1)) {
            console.log(`📈 Melhoria: ${improvement}% mais rápido com 10 workers`);
        }
        
        // Teste 3: Modo sequencial (para comparação)
        console.log('\n\n📝 TESTE 3: Modo sequencial (single-thread)');
        console.log('━'.repeat(50));
        console.log('⚠️  AVISO: Este teste pode demorar mais tempo...');
        
        const shouldRunSequential = process.argv.includes('--include-sequential');
        
        if (shouldRunSequential) {
            const startTime3 = Date.now();
            
            const result3 = await registerAllUsersInAllRatchets({
                useMultiThreading: false
            });
            
            const endTime3 = Date.now();
            const duration3 = ((endTime3 - startTime3) / 1000).toFixed(2);
            
            console.log(`\n⏱️  Tempo de execução: ${duration3}s`);
            console.log(`✅ Status: ${result3.success ? 'SUCESSO' : 'ERRO'}`);
            
            // Comparação final
            console.log('\n\n📊 COMPARAÇÃO COMPLETA');
            console.log('━'.repeat(50));
            console.log(`📋 Sequencial:  ${duration3}s`);
            console.log(`🔧 5 workers:   ${duration1}s`);
            console.log(`🔧 10 workers:  ${duration2}s`);
            
            const improvementTotal = (((parseFloat(duration3) - parseFloat(duration2)) / parseFloat(duration3)) * 100).toFixed(1);
            console.log(`🚀 Ganho total: ${improvementTotal}% mais rápido com multi-threading (10 workers)`);
        } else {
            console.log('⏭️  PULADO: Use --include-sequential para incluir este teste');
        }
        
        console.log('\n\n✅ TODOS OS TESTES CONCLUÍDOS COM SUCESSO! 🎉\n');
        
    } catch (error) {
        console.error('\n❌ ERRO NO TESTE:', error.message);
        console.error(error.stack);
        process.exit(1);
    } finally {
        // Desconecta do Redis
        if (redisCache.isConnected()) {
            await redisCache.disconnect();
        }
    }
}

// Executa o teste
if (require.main === module) {
    console.log('🏁 Iniciando testes de multi-threading...\n');
    console.log('💡 Dica: Use --include-sequential para testar o modo sequencial também\n');
    
    testMultiThreading()
        .then(() => {
            console.log('🎉 Testes finalizados!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Erro inesperado:', error);
            process.exit(1);
        });
}

module.exports = { testMultiThreading };

