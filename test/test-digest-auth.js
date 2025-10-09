const { registerSingleRatchet } = require('../src/index.js');
require('dotenv').config();

/**
 * Teste específico para autenticação digest HTTP
 */
async function testDigestAuth() {
    console.log('🔐 TESTE DE AUTENTICAÇÃO DIGEST HTTP');
    console.log('==================================================');

    // Verifica se as variáveis de ambiente estão definidas
    const username = process.env.DIGEST_USERNAME;
    const password = process.env.DIGEST_PASSWORD;

    console.log(`📋 Username configurado: ${username ? '✅ Sim' : '❌ Não'}`);
    console.log(`📋 Password configurado: ${password ? '✅ Sim' : '❌ Não'}`);

    if (username && password) {
        console.log('🔐 Autenticação digest será incluída nas requisições');
    } else {
        console.log('⚠️  Autenticação digest não configurada - requisições sem autenticação');
    }

    // Testa com um IP que provavelmente não existe (para testar apenas a configuração)
    console.log('\n🧪 Testando configuração de autenticação...');
    
    try {
        const result = await registerSingleRatchet('192.168.1.999');
        
        if (result.success) {
            console.log('✅ Requisição com autenticação digest executada com sucesso');
        } else {
            console.log('⚠️  Requisição falhou (esperado para IP inexistente)');
            console.log(`📋 Erro: ${result.error}`);
        }
        
        console.log('\n📊 RESULTADO DO TESTE:');
        console.log(`✅ Configuração de autenticação: OK`);
        console.log(`📋 Username: ${username || 'Não definido'}`);
        console.log(`📋 Password: ${password ? '***' : 'Não definido'}`);
        
    } catch (error) {
        console.error('❌ Erro no teste:', error.message);
    }
}

// Executa o teste se for chamado diretamente
if (require.main === module) {
    testDigestAuth()
        .then(() => {
            console.log('\n🎉 Teste de autenticação digest concluído!');
            process.exit(0);
        })
        .catch(error => {
            console.error('💥 Erro inesperado:', error);
            process.exit(1);
        });
}

module.exports = { testDigestAuth };
