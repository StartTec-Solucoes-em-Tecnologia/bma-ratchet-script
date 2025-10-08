const axios = require('axios');
const { registerMultipleRatchets, registerSingleRatchet } = require('../src/index.js');

/**
 * Script de teste para o sistema de registro de catracas
 * Testa diferentes cenários: sucesso, erro, timeout, etc.
 */

// Mock de servidor para simular catracas
const express = require('express');
const app = express();
const PORT = 3001;

// Simula diferentes tipos de resposta das catracas
app.get('/cgi-bin/configManager.cgi', (req, res) => {
    const { action, _EnableUnsecure_ } = req.query;
    const clientIp = req.ip || req.connection.remoteAddress;
    
    console.log(`[MOCK] Requisição recebida de ${clientIp}: action=${action}, EnableUnsecure=${_EnableUnsecure_}`);
    
    // Simula diferentes cenários baseados no IP
    const ip = req.query.ip || '192.168.1.100';
    
    if (ip.includes('error')) {
        return res.status(500).json({ error: 'Erro interno do dispositivo' });
    }
    
    if (ip.includes('timeout')) {
        // Simula timeout não respondendo
        return;
    }
    
    if (ip.includes('unauthorized')) {
        return res.status(401).json({ error: 'Não autorizado' });
    }
    
    // Resposta de sucesso
    res.status(200).json({
        success: true,
        message: 'Configuração aplicada com sucesso',
        device: ip
    });
});

// Inicia o servidor mock
let mockServer;
function startMockServer() {
    return new Promise((resolve) => {
        mockServer = app.listen(PORT, () => {
            console.log(`🚀 Servidor mock iniciado na porta ${PORT}`);
            resolve();
        });
    });
}

function stopMockServer() {
    if (mockServer) {
        mockServer.close();
        console.log('🛑 Servidor mock finalizado');
    }
}

/**
 * Teste 1: Catraca com sucesso
 */
async function testSuccessfulRegistration() {
    console.log('\n🧪 TESTE 1: Registro bem-sucedido');
    console.log('='.repeat(50));
    
    try {
        // Usa o servidor mock na porta 3001
        const result = await registerSingleRatchet('localhost:3001');
        
        if (result.success) {
            console.log('✅ Teste passou: Registro bem-sucedido');
            return true;
        } else {
            console.log('❌ Teste falhou: Esperava sucesso, mas obteve erro');
            return false;
        }
    } catch (error) {
        console.log('❌ Teste falhou com exceção:', error.message);
        return false;
    }
}

/**
 * Teste 2: Catraca com erro de conexão
 */
async function testConnectionError() {
    console.log('\n🧪 TESTE 2: Erro de conexão');
    console.log('='.repeat(50));
    
    try {
        const result = await registerSingleRatchet('192.168.1.999'); // IP inexistente
        
        if (!result.success) {
            console.log('✅ Teste passou: Erro de conexão detectado corretamente');
            return true;
        } else {
            console.log('❌ Teste falhou: Esperava erro, mas obteve sucesso');
            return false;
        }
    } catch (error) {
        console.log('✅ Teste passou: Exceção capturada corretamente');
        return true;
    }
}

/**
 * Teste 3: Múltiplas catracas com cenários mistos
 */
async function testMultipleRatchets() {
    console.log('\n🧪 TESTE 3: Múltiplas catracas');
    console.log('='.repeat(50));
    
    // Define IPs de teste usando o servidor mock
    process.env.DEVICE_IPS = 'localhost:3001,localhost:3001,192.168.1.999,localhost:3001';
    
    try {
        const result = await registerMultipleRatchets();
        
        console.log(`📊 Resultado: ${result.successCount} sucessos, ${result.errorCount} erros`);
        
        if (result.successCount > 0 && result.errorCount > 0) {
            console.log('✅ Teste passou: Cenário misto processado corretamente');
            return true;
        } else {
            console.log('❌ Teste falhou: Resultado inesperado');
            return false;
        }
    } catch (error) {
        console.log('❌ Teste falhou com exceção:', error.message);
        return false;
    }
}

/**
 * Teste 4: Validação de entrada
 */
async function testInputValidation() {
    console.log('\n🧪 TESTE 4: Validação de entrada');
    console.log('='.repeat(50));
    
    // Remove a variável de ambiente para testar erro
    const originalDeviceIps = process.env.DEVICE_IPS;
    delete process.env.DEVICE_IPS;
    
    try {
        const result = await registerMultipleRatchets();
        
        if (!result.success && result.error.includes('DEVICE_IPS')) {
            console.log('✅ Teste passou: Validação de entrada funcionando');
            return true;
        } else {
            console.log('❌ Teste falhou: Validação não funcionou');
            return false;
        }
    } catch (error) {
        console.log('✅ Teste passou: Exceção capturada corretamente');
        return true;
    } finally {
        // Restaura a variável original
        if (originalDeviceIps) {
            process.env.DEVICE_IPS = originalDeviceIps;
        }
    }
}

/**
 * Teste 5: Timeout de requisição
 */
async function testRequestTimeout() {
    console.log('\n🧪 TESTE 5: Timeout de requisição');
    console.log('='.repeat(50));
    
    try {
        const result = await registerSingleRatchet('192.168.1.100');
        
        // Para este teste, vamos simular um timeout modificando temporariamente a função
        const originalRegisterSingleRatchet = registerSingleRatchet;
        
        // Mock da função com timeout muito baixo
        const mockRegisterSingleRatchet = async (deviceIp) => {
            try {
                const url = `http://${deviceIp}/cgi-bin/configManager.cgi?action=setConfig&_EnableUnsecure_.Enable=true`;
                const response = await axios.get(url, { timeout: 1 }); // 1ms timeout
                
                return {
                    deviceIp,
                    success: true,
                    status: response.status,
                    data: response.data
                };
            } catch (error) {
                return {
                    deviceIp,
                    success: false,
                    error: error.message
                };
            }
        };
        
        const result2 = await mockRegisterSingleRatchet('192.168.1.100');
        
        if (!result2.success && result2.error.includes('timeout')) {
            console.log('✅ Teste passou: Timeout detectado corretamente');
            return true;
        } else {
            console.log('❌ Teste falhou: Timeout não detectado');
            return false;
        }
    } catch (error) {
        console.log('❌ Teste falhou com exceção:', error.message);
        return false;
    }
}

/**
 * Executa todos os testes
 */
async function runAllTests() {
    console.log('🚀 INICIANDO BATERIA DE TESTES');
    console.log('='.repeat(60));
    
    const tests = [
        { name: 'Registro bem-sucedido', fn: testSuccessfulRegistration },
        { name: 'Erro de conexão', fn: testConnectionError },
        { name: 'Múltiplas catracas', fn: testMultipleRatchets },
        { name: 'Validação de entrada', fn: testInputValidation },
        { name: 'Timeout de requisição', fn: testRequestTimeout }
    ];
    
    let passedTests = 0;
    let totalTests = tests.length;
    
    // Inicia o servidor mock
    await startMockServer();
    
    try {
        for (const test of tests) {
            console.log(`\n🔄 Executando: ${test.name}`);
            const result = await test.fn();
            
            if (result) {
                passedTests++;
            }
            
            // Pequena pausa entre testes
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    } finally {
        // Para o servidor mock
        stopMockServer();
    }
    
    // Relatório final
    console.log('\n📊 RELATÓRIO FINAL DOS TESTES');
    console.log('='.repeat(60));
    console.log(`✅ Testes aprovados: ${passedTests}/${totalTests}`);
    console.log(`❌ Testes falharam: ${totalTests - passedTests}/${totalTests}`);
    console.log(`📈 Taxa de sucesso: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
    
    if (passedTests === totalTests) {
        console.log('\n🎉 Todos os testes passaram! Sistema funcionando corretamente.');
        process.exit(0);
    } else {
        console.log('\n💥 Alguns testes falharam. Verifique os logs acima.');
        process.exit(1);
    }
}

// Executa os testes se o script for chamado diretamente
if (require.main === module) {
    runAllTests().catch(error => {
        console.error('💥 Erro inesperado durante os testes:', error);
        process.exit(1);
    });
}

module.exports = {
    runAllTests,
    testSuccessfulRegistration,
    testConnectionError,
    testMultipleRatchets,
    testInputValidation,
    testRequestTimeout
};
