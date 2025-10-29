const { Worker } = require('bullmq');
const IORedis = require('ioredis');
const { processUserJob } = require('./facial-registration.js');
require('dotenv').config();

/**
 * Worker BullMQ para processar jobs de registro facial
 * Executa continuamente, processando jobs das filas
 */

// Conecta ao Redis
const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: 3,
    retryDelayOnFailover: 100,
});

// Lista de dispositivos (pode vir do .env)
const devices = process.env.FACE_READER_IPS ? 
    process.env.FACE_READER_IPS.split(',').map(ip => ip.trim()) : 
    ['10.1.35.87', '10.1.35.88']; // fallback

// Cria workers para cada dispositivo
const workers = devices.map(deviceIp => {
    const queueName = `facial-registration-${deviceIp.replace(/\./g, '-')}`;
    
    console.log(`🔧 Criando worker para dispositivo ${deviceIp} (fila: ${queueName})`);
    
    const worker = new Worker(queueName, processUserJob, {
        connection,
        concurrency: 2, // Processa 2 jobs simultaneamente por dispositivo
    });
    
    worker.on('completed', (job) => {
        console.log(`✅ Job ${job.id} concluído na fila ${deviceIp}`);
    });
    
    worker.on('failed', (job, err) => {
        console.error(`❌ Job ${job.id} falhou na fila ${deviceIp}:`, err.message);
    });
    
    worker.on('error', (err) => {
        console.error(`❌ Erro no worker ${deviceIp}:`, err.message);
    });
    
    return worker;
});

console.log(`\n👷 Workers iniciados para ${devices.length} dispositivos`);
console.log(`📋 Filas monitoradas:`);
devices.forEach(ip => {
    console.log(`   - facial-registration-${ip.replace(/\./g, '-')}`);
});
console.log(`\n🔄 Aguardando jobs...\n`);

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Encerrando workers...');
    await Promise.all(workers.map(worker => worker.close()));
    await connection.quit();
    console.log('✅ Workers encerrados');
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Encerrando workers...');
    await Promise.all(workers.map(worker => worker.close()));
    await connection.quit();
    console.log('✅ Workers encerrados');
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
