const { registerAllFacesInAllDevices } = require('./facial-registration.js');
require('dotenv').config();

/**
 * Scheduler para execução periódica do registro facial
 * Executa o processo completo em intervalos regulares
 */

// Configuração do scheduler
const INTERVAL_MINUTES = parseInt(process.env.SCHEDULER_INTERVAL_MINUTES) || 30;
const ENABLE_SCHEDULER = process.env.ENABLE_SCHEDULER !== 'false';

console.log('⏰ Facial Registration Scheduler v2.1');
console.log(`📅 Intervalo: ${INTERVAL_MINUTES} minutos`);
console.log(`🔄 Scheduler: ${ENABLE_SCHEDULER ? 'Ativado' : 'Desativado'}\n`);

if (!ENABLE_SCHEDULER) {
    console.log('⚠️  Scheduler desativado via ENABLE_SCHEDULER=false');
    process.exit(0);
}

// Função para executar o registro facial
async function executeFacialRegistration() {
    const startTime = new Date();
    console.log(`\n🕐 [${startTime.toISOString()}] Executando registro facial agendado...`);
    
    try {
        const result = await registerAllFacesInAllDevices();
        
        const endTime = new Date();
        const duration = Math.round((endTime - startTime) / 1000);
        
        if (result.success) {
            console.log(`✅ [${endTime.toISOString()}] Registro facial concluído em ${duration}s`);
            console.log(`📊 Processados: ${result.totalUsers} usuários`);
            console.log(`🖥️  Dispositivos: ${result.devices}`);
            console.log(`📦 Lotes: ${result.batches}`);
        } else {
            console.log(`⚠️  [${endTime.toISOString()}] Registro facial concluído com erros em ${duration}s`);
        }
        
    } catch (error) {
        const endTime = new Date();
        const duration = Math.round((endTime - startTime) / 1000);
        console.error(`❌ [${endTime.toISOString()}] Erro no registro facial após ${duration}s:`, error.message);
    }
}

// Executa imediatamente na primeira vez
console.log('🚀 Executando primeira execução...');
executeFacialRegistration();

// Configura execução periódica
const intervalMs = INTERVAL_MINUTES * 60 * 1000;
const intervalId = setInterval(executeFacialRegistration, intervalMs);

console.log(`⏰ Próxima execução em ${INTERVAL_MINUTES} minutos\n`);

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Encerrando scheduler...');
    clearInterval(intervalId);
    console.log('✅ Scheduler encerrado');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Encerrando scheduler...');
    clearInterval(intervalId);
    console.log('✅ Scheduler encerrado');
    process.exit(0);
});

// Mantém o processo vivo
process.on('uncaughtException', (error) => {
    console.error('❌ Erro não tratado:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Promise rejeitada:', reason);
    process.exit(1);
});
