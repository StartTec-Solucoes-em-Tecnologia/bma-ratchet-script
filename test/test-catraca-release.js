const axios = require('axios');

/**
 * Test script para verificar se a catraca está sendo liberada corretamente
 * após o checkin bem-sucedido
 */
async function testCatracaReleaseWithGrantedAccess() {
  try {
    console.log('🧪 Testando liberação da catraca com acesso concedido...');

    // Simula cartão com acesso concedido (deve liberar a catraca)
    const cardEventData = {
      Events: [{
        Data: {
          CardNo: "ABC12345",
          CardName: "João Silva",
          UserID: "123",
          UserName: "João Silva",
          Type: 1,
          ErrorCode: 0,  // Sem erro
          Status: 1      // 1 = GRANTED
        }
      }],
      Time: new Date().toISOString()
    };

    const boundary = 'myboundary';
    const formData = `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="info"\r\n\r\n` +
      `${JSON.stringify(cardEventData)}\r\n` +
      `--${boundary}--\r\n`;

    const response = await axios.post('http://localhost:80/', formData, {
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`
      },
      timeout: 15000
    });

    console.log('✅ Resposta recebida:');
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(response.data, null, 2));

    // Verifica se a catraca foi liberada (auth: true)
    if (response.data.auth === true) {
      console.log('✅ Catraca LIBERADA - auth: true');
      console.log('🎉 Checkin bem-sucedido e catraca liberada!');
    } else {
      console.log('❌ Catraca NÃO liberada - auth:', response.data.auth);
      console.log('⚠️ Verifique se o checkin foi processado corretamente');
    }

  } catch (error) {
    console.error('❌ Erro no teste:', error.message);

    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

async function testCatracaNotReleasedWithDeniedAccess() {
  try {
    console.log('\n🧪 Testando que catraca NÃO é liberada com acesso negado...');

    // Simula cartão com acesso negado (NÃO deve liberar a catraca)
    const cardEventData = {
      Events: [{
        Data: {
          CardNo: "INVALID123",
          CardName: "Usuário Inválido",
          UserID: "999",
          UserName: "Usuário Inválido",
          Type: 1,
          ErrorCode: 1,  // Erro de acesso
          Status: 0      // 0 = DENIED
        }
      }],
      Time: new Date().toISOString()
    };

    const boundary = 'myboundary';
    const formData = `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="info"\r\n\r\n` +
      `${JSON.stringify(cardEventData)}\r\n` +
      `--${boundary}--\r\n`;

    const response = await axios.post('http://localhost:80/', formData, {
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`
      },
      timeout: 10000
    });

    console.log('✅ Resposta recebida:');
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(response.data, null, 2));

    // Verifica se a catraca NÃO foi liberada (auth: false)
    if (response.data.auth === false) {
      console.log('✅ Catraca BLOQUEADA - auth: false');
      console.log('🔒 Acesso negado e catraca bloqueada corretamente!');
    } else {
      console.log('❌ Catraca foi liberada incorretamente - auth:', response.data.auth);
      console.log('⚠️ Acesso negado deveria resultar em auth: false');
    }

  } catch (error) {
    console.error('❌ Erro no teste:', error.message);

    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

async function testCatracaNotReleasedWithCheckinFailure() {
  try {
    console.log('\n🧪 Testando que catraca NÃO é liberada com falha no checkin...');

    // Simula cartão com acesso concedido mas que pode falhar no checkin
    const cardEventData = {
      Events: [{
        Data: {
          CardNo: "FAILCHECKIN",  // Código que pode causar falha no checkin
          CardName: "Teste Falha",
          UserID: "999",
          UserName: "Teste Falha",
          Type: 1,
          ErrorCode: 0,  // Sem erro de acesso
          Status: 1      // 1 = GRANTED
        }
      }],
      Time: new Date().toISOString()
    };

    const boundary = 'myboundary';
    const formData = `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="info"\r\n\r\n` +
      `${JSON.stringify(cardEventData)}\r\n` +
      `--${boundary}--\r\n`;

    const response = await axios.post('http://localhost:80/', formData, {
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`
      },
      timeout: 15000
    });

    console.log('✅ Resposta recebida:');
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(response.data, null, 2));

    // Verifica se a catraca NÃO foi liberada devido à falha no checkin
    if (response.data.auth === false) {
      console.log('✅ Catraca BLOQUEADA - auth: false');
      console.log('🔒 Falha no checkin e catraca bloqueada corretamente!');
    } else {
      console.log('❌ Catraca foi liberada incorretamente - auth:', response.data.auth);
      console.log('⚠️ Falha no checkin deveria resultar em auth: false');
    }

  } catch (error) {
    console.error('❌ Erro no teste:', error.message);

    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

// Executa todos os testes
async function runCatracaReleaseTests() {
  console.log('🚀 Testando liberação da catraca após checkin...\n');

  // Testa cenário de sucesso (deve liberar)
  await testCatracaReleaseWithGrantedAccess();

  // Aguarda um pouco entre testes
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Testa cenário de acesso negado (não deve liberar)
  await testCatracaNotReleasedWithDeniedAccess();

  // Aguarda um pouco entre testes
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Testa cenário de falha no checkin (não deve liberar)
  await testCatracaNotReleasedWithCheckinFailure();

  console.log('\n🏁 Testes de liberação da catraca concluídos!');
  console.log('\n📋 Resumo esperado:');
  console.log('   ✅ Acesso concedido + Checkin OK → Catraca LIBERADA (auth: true)');
  console.log('   ❌ Acesso negado → Catraca BLOQUEADA (auth: false)');
  console.log('   ❌ Acesso concedido + Checkin falha → Catraca BLOQUEADA (auth: false)');
  console.log('\n🔧 Se a catraca não está liberando, verifique:');
  console.log('   1. Se o endpoint de checkin está funcionando');
  console.log('   2. Se a variável BASE_URL está configurada corretamente');
  console.log('   3. Se o campo auth está sendo retornado como true');
}

// Execute se chamado diretamente
if (require.main === module) {
  runCatracaReleaseTests().catch(console.error);
}

module.exports = {
  testCatracaReleaseWithGrantedAccess,
  testCatracaNotReleasedWithDeniedAccess,
  testCatracaNotReleasedWithCheckinFailure
};
