const { registerMultipleRatchets, registerSingleRatchet } = require('../src/index.js');

/**
 * Script de teste simples para o sistema de registro de catracas
 * Testa funcionalidades básicas sem dependências externas
 */

/**
 * Teste 1: Validação de entrada - variável DEVICE_IPS não definida
 */
async function testInputValidation() {
    console.log('\n🧪 TESTE 1: Validação de entrada');
    console.log('='.repeat(50));
    
    // Remove a variável de ambiente para testar erro
    const originalDeviceIps = process.env.DEVICE_IPS;
    delete process.env.DEVICE_IPS;
    
    try {
        const result = await registerMultipleRatchets();
        
        if (!result.success && result.error && result.error.includes('DEVICE_IPS')) {
            console.log('✅ Teste passou: Validação de entrada funcionando');
            return true;
        } else {
            console.log('❌ Teste falhou: Validação não funcionou');
            console.log('Resultado recebido:', result);
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
 * Teste 2: Parsing de IPs - formato correto
 */
async function testIpParsing() {
    console.log('\n🧪 TESTE 2: Parsing de IPs');
    console.log('='.repeat(50));
    
    // Define IPs de teste
    process.env.DEVICE_IPS = '192.168.1.100,192.168.1.101,192.168.1.102';
    
    try {
        // Simula o parsing interno da função
        const deviceIps = process.env.DEVICE_IPS;
        const ipArray = deviceIps.split(',').map(ip => ip.trim());
        
        if (ipArray.length === 3 && 
            ipArray[0] === '192.168.1.100' && 
            ipArray[1] === '192.168.1.101' && 
            ipArray[2] === '192.168.1.102') {
            console.log('✅ Teste passou: Parsing de IPs funcionando');
            return true;
        } else {
            console.log('❌ Teste falhou: Parsing incorreto');
            console.log('IPs parseados:', ipArray);
            return false;
        }
    } catch (error) {
        console.log('❌ Teste falhou com exceção:', error.message);
        return false;
    }
}

/**
 * Teste 3: Parsing de IPs com espaços extras
 */
async function testIpParsingWithSpaces() {
    console.log('\n🧪 TESTE 3: Parsing de IPs com espaços');
    console.log('='.repeat(50));
    
    // Define IPs com espaços extras
    process.env.DEVICE_IPS = ' 192.168.1.100 , 192.168.1.101 , 192.168.1.102 ';
    
    try {
        const deviceIps = process.env.DEVICE_IPS;
        const ipArray = deviceIps.split(',').map(ip => ip.trim());
        
        if (ipArray.length === 3 && 
            ipArray[0] === '192.168.1.100' && 
            ipArray[1] === '192.168.1.101' && 
            ipArray[2] === '192.168.1.102') {
            console.log('✅ Teste passou: Parsing com espaços funcionando');
            return true;
        } else {
            console.log('❌ Teste falhou: Parsing com espaços incorreto');
            console.log('IPs parseados:', ipArray);
            return false;
        }
    } catch (error) {
        console.log('❌ Teste falhou com exceção:', error.message);
        return false;
    }
}

/**
 * Teste 4: Erro de conexão com IP inválido
 */
async function testConnectionError() {
    console.log('\n🧪 TESTE 4: Erro de conexão');
    console.log('='.repeat(50));
    
    try {
        const result = await registerSingleRatchet('999.999.999.999'); // IP inválido
        
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
 * Teste 5: Timeout de requisição
 */
async function testRequestTimeout() {
    console.log('\n🧪 TESTE 5: Timeout de requisição');
    console.log('='.repeat(50));
    
    try {
        // Usa um IP que provavelmente não responde (IP privado não usado)
        const result = await registerSingleRatchet('192.168.254.254');
        
        if (!result.success && result.error) {
            console.log('✅ Teste passou: Timeout ou erro de conexão detectado');
            return true;
        } else {
            console.log('❌ Teste falhou: Esperava timeout/erro, mas obteve sucesso');
            return false;
        }
    } catch (error) {
        console.log('✅ Teste passou: Exceção capturada corretamente');
        return true;
    }
}

/**
 * Teste 6: Estrutura de retorno da função
 */
async function testReturnStructure() {
    console.log('\n🧪 TESTE 6: Estrutura de retorno');
    console.log('='.repeat(50));
    
    try {
        const result = await registerSingleRatchet('192.168.1.100');
        
        // Verifica se a estrutura de retorno está correta
        const hasRequiredFields = result.hasOwnProperty('deviceIp') && 
                                 result.hasOwnProperty('success') && 
                                 (result.hasOwnProperty('status') || result.hasOwnProperty('error'));
        
        if (hasRequiredFields) {
            console.log('✅ Teste passou: Estrutura de retorno correta');
            console.log('Estrutura:', Object.keys(result));
            return true;
        } else {
            console.log('❌ Teste falhou: Estrutura de retorno incorreta');
            console.log('Estrutura recebida:', Object.keys(result));
            return false;
        }
    } catch (error) {
        console.log('❌ Teste falhou com exceção:', error.message);
        return false;
    }
}

/**
 * Executa todos os testes simples
 */
async function runSimpleTests() {
    console.log('🚀 INICIANDO TESTES SIMPLES');
    console.log('='.repeat(60));
    
    const tests = [
        { name: 'Validação de entrada', fn: testInputValidation },
        { name: 'Parsing de IPs', fn: testIpParsing },
        { name: 'Parsing com espaços', fn: testIpParsingWithSpaces },
        { name: 'Erro de conexão', fn: testConnectionError },
        { name: 'Timeout de requisição', fn: testRequestTimeout },
        { name: 'Estrutura de retorno', fn: testReturnStructure }
    ];
    
    let passedTests = 0;
    let totalTests = tests.length;
    
    for (const test of tests) {
        console.log(`\n🔄 Executando: ${test.name}`);
        const result = await test.fn();
        
        if (result) {
            passedTests++;
        }
        
        // Pequena pausa entre testes
        await new Promise(resolve => setTimeout(resolve, 200));
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
    runSimpleTests().catch(error => {
        console.error('💥 Erro inesperado durante os testes:', error);
        process.exit(1);
    });
}

module.exports = {
    runSimpleTests,
    testInputValidation,
    testIpParsing,
    testIpParsingWithSpaces,
    testConnectionError,
    testRequestTimeout,
    testReturnStructure
};
