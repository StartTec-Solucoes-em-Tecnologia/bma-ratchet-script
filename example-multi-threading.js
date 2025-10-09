/**
 * Exemplo de uso do Multi-Threading com Piscina
 * 
 * Este arquivo demonstra diferentes formas de usar o sistema
 * de multi-threading para registrar usuários nas catracas
 */

const { registerAllUsersInAllRatchets, redisCache } = require('./src/index');
require('dotenv').config();

async function exemploBasico() {
    console.log('📝 EXEMPLO 1: Uso básico (multi-threading padrão)');
    console.log('━'.repeat(50));
    
    // Por padrão, usa multi-threading com 10 workers
    const result = await registerAllUsersInAllRatchets();
    
    console.log('\n✅ Resultado:', {
        sucesso: result.success,
        participantes: result.participants,
        catracas: result.ratchets,
        sucessos: result.successCount,
        erros: result.errorCount,
        pulados: result.skippedCount
    });
}

async function exemploPersonalizado() {
    console.log('\n\n📝 EXEMPLO 2: Configuração personalizada');
    console.log('━'.repeat(50));
    
    // Personaliza o número de workers
    const result = await registerAllUsersInAllRatchets({
        useMultiThreading: true,  // Habilita multi-threading
        maxConcurrency: 5,        // 5 workers simultâneos
        skipCache: false          // Usa cache Redis
    });
    
    console.log('\n✅ Resultado:', {
        sucesso: result.success,
        participantes: result.participants,
        sucessos: result.successCount
    });
}

async function exemploSequencial() {
    console.log('\n\n📝 EXEMPLO 3: Modo sequencial (sem multi-threading)');
    console.log('━'.repeat(50));
    
    // Desabilita multi-threading
    const result = await registerAllUsersInAllRatchets({
        useMultiThreading: false  // Modo single-thread
    });
    
    console.log('\n✅ Resultado:', {
        sucesso: result.success,
        participantes: result.participants,
        sucessos: result.successCount
    });
}

async function exemploComparativo() {
    console.log('\n\n📝 EXEMPLO 4: Comparação de performance');
    console.log('━'.repeat(50));
    
    // Teste com 5 workers
    console.log('\n🔧 Testando com 5 workers...');
    const inicio1 = Date.now();
    await registerAllUsersInAllRatchets({ maxConcurrency: 5 });
    const tempo1 = ((Date.now() - inicio1) / 1000).toFixed(2);
    
    // Pequena pausa
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Teste com 10 workers
    console.log('\n🔧 Testando com 10 workers...');
    const inicio2 = Date.now();
    await registerAllUsersInAllRatchets({ maxConcurrency: 10 });
    const tempo2 = ((Date.now() - inicio2) / 1000).toFixed(2);
    
    // Comparação
    console.log('\n📊 COMPARAÇÃO:');
    console.log(`   5 workers:  ${tempo1}s`);
    console.log(`   10 workers: ${tempo2}s`);
    
    const melhoria = (((parseFloat(tempo1) - parseFloat(tempo2)) / parseFloat(tempo1)) * 100).toFixed(1);
    if (parseFloat(tempo2) < parseFloat(tempo1)) {
        console.log(`   📈 Ganho: ${melhoria}% mais rápido`);
    }
}

async function main() {
    console.log('🚀 EXEMPLOS DE USO DO MULTI-THREADING');
    console.log('═'.repeat(50));
    console.log();
    
    try {
        // Conecta ao Redis
        await redisCache.connect();
        
        // Escolhe qual exemplo executar
        const exemplo = process.argv[2] || '1';
        
        switch (exemplo) {
            case '1':
                await exemploBasico();
                break;
            case '2':
                await exemploPersonalizado();
                break;
            case '3':
                await exemploSequencial();
                break;
            case '4':
                await exemploComparativo();
                break;
            case 'todos':
                await exemploBasico();
                await new Promise(resolve => setTimeout(resolve, 2000));
                await exemploPersonalizado();
                await new Promise(resolve => setTimeout(resolve, 2000));
                await exemploSequencial();
                break;
            default:
                console.log('❌ Exemplo inválido!');
                console.log('\n📖 Uso:');
                console.log('   node example-multi-threading.js [1|2|3|4|todos]');
                console.log('\nExemplos:');
                console.log('   1 - Uso básico (padrão)');
                console.log('   2 - Configuração personalizada');
                console.log('   3 - Modo sequencial');
                console.log('   4 - Comparação de performance');
                console.log('   todos - Executa todos os exemplos');
        }
        
        console.log('\n\n✅ Exemplos concluídos com sucesso! 🎉\n');
        
    } catch (error) {
        console.error('\n❌ Erro:', error.message);
        console.error(error.stack);
        process.exit(1);
    } finally {
        // Desconecta do Redis
        if (redisCache.isConnected()) {
            await redisCache.disconnect();
        }
    }
}

// Executa se chamado diretamente
if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error('💥 Erro inesperado:', error);
            process.exit(1);
        });
}

module.exports = {
    exemploBasico,
    exemploPersonalizado,
    exemploSequencial,
    exemploComparativo
};

