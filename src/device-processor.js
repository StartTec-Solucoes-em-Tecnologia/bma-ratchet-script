const { spawn } = require('child_process');
const path = require('path');

/**
 * Processador de Dispositivos Individuais
 * Executa um processo Node.js separado para cada catraca
 */

class DeviceProcessor {
    constructor() {
        this.processes = new Map();
        this.results = new Map();
    }

    /**
     * Processa um dispositivo específico
     */
    async processDevice(deviceIp, userBatch, batchIndex) {
        return new Promise((resolve, reject) => {
            console.log(`\n🚀 Iniciando processo para dispositivo ${deviceIp}...`);
            console.log(`   📦 Lote ${batchIndex + 1} - ${userBatch.length} usuários`);
            
            // Cria arquivo temporário com dados do lote
            const tempFile = path.join(__dirname, '..', 'temp', `batch-${deviceIp}-${Date.now()}.json`);
            const fs = require('fs');
            
            // Garante que o diretório temp existe
            const tempDir = path.dirname(tempFile);
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }
            
            // Salva dados do lote
            const batchData = {
                deviceIp,
                users: userBatch,
                batchIndex,
                timestamp: new Date().toISOString()
            };
            
            fs.writeFileSync(tempFile, JSON.stringify(batchData, null, 2));
            
            // Executa processo separado
            const childProcess = spawn('node', [
                path.join(__dirname, 'device-worker.js'),
                tempFile
            ], {
                stdio: ['pipe', 'pipe', 'pipe'],
                cwd: process.cwd()
            });
            
            let output = '';
            let errorOutput = '';
            
            childProcess.stdout.on('data', (data) => {
                const message = data.toString();
                output += message;
                console.log(`[${deviceIp}] ${message.trim()}`);
            });
            
            childProcess.stderr.on('data', (data) => {
                const message = data.toString();
                errorOutput += message;
                console.error(`[${deviceIp}] ${message.trim()}`);
            });
            
            childProcess.on('close', (code) => {
                // Remove arquivo temporário
                try {
                    fs.unlinkSync(tempFile);
                } catch (error) {
                    console.warn(`⚠️  Erro ao remover arquivo temporário: ${error.message}`);
                }
                
                const result = {
                    deviceIp,
                    batchIndex,
                    exitCode: code,
                    success: code === 0,
                    output: output.trim(),
                    error: errorOutput.trim(),
                    timestamp: new Date().toISOString()
                };
                
                this.results.set(deviceIp, result);
                
                if (code === 0) {
                    console.log(`✅ Processo do dispositivo ${deviceIp} concluído com sucesso`);
                    resolve(result);
                } else {
                    console.error(`❌ Processo do dispositivo ${deviceIp} falhou (código: ${code})`);
                    reject(new Error(`Processo falhou: ${errorOutput}`));
                }
            });
            
            childProcess.on('error', (error) => {
                console.error(`❌ Erro ao iniciar processo para ${deviceIp}:`, error.message);
                reject(error);
            });
            
            // Armazena referência do processo
            this.processes.set(deviceIp, childProcess);
        });
    }

    /**
     * Processa múltiplos dispositivos em paralelo
     */
    async processMultipleDevices(deviceIps, userBatch, batchIndex) {
        console.log(`\n🔄 Processando ${deviceIps.length} dispositivos em paralelo...`);
        console.log(`   📦 Lote ${batchIndex + 1} - ${userBatch.length} usuários por dispositivo`);
        
        const promises = deviceIps.map(deviceIp => 
            this.processDevice(deviceIp, userBatch, batchIndex)
        );
        
        try {
            const results = await Promise.allSettled(promises);
            
            const successful = results.filter(r => r.status === 'fulfilled').length;
            const failed = results.filter(r => r.status === 'rejected').length;
            
            console.log(`\n📊 Resultado do lote ${batchIndex + 1}:`);
            console.log(`   ✅ Dispositivos processados com sucesso: ${successful}`);
            console.log(`   ❌ Dispositivos com falha: ${failed}`);
            
            return {
                successful,
                failed,
                results: results.map((result, index) => ({
                    deviceIp: deviceIps[index],
                    success: result.status === 'fulfilled',
                    data: result.status === 'fulfilled' ? result.value : null,
                    error: result.status === 'rejected' ? result.reason.message : null
                }))
            };
        } catch (error) {
            console.error(`❌ Erro ao processar dispositivos:`, error.message);
            throw error;
        }
    }

    /**
     * Mata todos os processos ativos
     */
    killAllProcesses() {
        console.log(`\n🛑 Finalizando ${this.processes.size} processos ativos...`);
        
        for (const [deviceIp, process] of this.processes) {
            try {
                process.kill('SIGTERM');
                console.log(`   ✅ Processo ${deviceIp} finalizado`);
            } catch (error) {
                console.warn(`   ⚠️  Erro ao finalizar processo ${deviceIp}:`, error.message);
            }
        }
        
        this.processes.clear();
    }

    /**
     * Obtém estatísticas dos resultados
     */
    getStats() {
        const results = Array.from(this.results.values());
        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;
        
        return {
            total: results.length,
            successful,
            failed,
            successRate: results.length > 0 ? (successful / results.length * 100).toFixed(2) : 0
        };
    }
}

module.exports = DeviceProcessor;
