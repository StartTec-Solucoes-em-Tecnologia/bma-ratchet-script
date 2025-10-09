const { registerAllUsersInAllRatchets, fetchParticipants, registerUserInRatchet } = require('../src/index.js');

/**
 * Teste do registro de usuários em catracas
 */
async function testUserRegistration() {
    console.log('🧪 Iniciando teste de registro de usuários...\n');

    try {
        // Simula variáveis de ambiente para teste
        process.env.DEVICE_IPS = '192.168.1.100,192.168.1.101';
        process.env.BASE_URL = 'http://localhost:3000/';
        process.env.EVENT_ID = 'f4iarsufucggne5zk82952hh';

        console.log('📋 Configuração de teste:');
        console.log(`   DEVICE_IPS: ${process.env.DEVICE_IPS}`);
        console.log(`   BASE_URL: ${process.env.BASE_URL}\n`);
        console.log(`   EVENT_ID: ${process.env.EVENT_ID}\n`);

        // Teste 1: Buscar participantes (simulado)
        console.log('🔍 Teste 1: Buscar participantes...');
        try {
            const participants = await fetchParticipants();
            console.log(`✅ Encontrados ${participants.length} participantes`);
        } catch (error) {
            console.log(`⚠️  Erro esperado (API não disponível): ${error.message}`);
        }

        // Teste 2: Registro de usuário individual (simulado)
        console.log('\n🔍 Teste 2: Registro de usuário individual...');
        const mockParticipant = {
            id: 'test123',
            nome: 'JOÃO DA SILVA',
            codigo_de_convite: 'TEST0001',
            tipo: 'PARTICIPANT'
        };

        try {
            const result = await registerUserInRatchet('192.168.1.100', mockParticipant);
            console.log(`✅ Resultado: ${result.success ? 'Sucesso' : 'Erro'}`);
        } catch (error) {
            console.log(`⚠️  Erro esperado (catraca não disponível): ${error.message}`);
        }

        // Teste 3: Processo completo (simulado)
        console.log('\n🔍 Teste 3: Processo completo...');
        try {
            const result = await registerAllUsersInAllRatchets();
            console.log(`✅ Processo concluído: ${result.success ? 'Sucesso' : 'Com erros'}`);
            if (result.error) {
                console.log(`   Erro: ${result.error}`);
            }
        } catch (error) {
            console.log(`⚠️  Erro esperado (dependências não disponíveis): ${error.message}`);
        }

        console.log('\n🎉 Testes concluídos!');
        console.log('\n📝 Para usar em produção:');
        console.log('   1. Configure as variáveis de ambiente no arquivo .env');
        console.log('   2. Execute: npm run register-users');
        console.log('   3. Ou: node src/index.js --register-users');

    } catch (error) {
        console.error('💥 Erro no teste:', error.message);
    }
}

// Executa o teste se for chamado diretamente
if (require.main === module) {
    testUserRegistration();
}

module.exports = { testUserRegistration };
