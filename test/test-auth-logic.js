const axios = require('axios');

/**
 * Test script para verificar se o campo auth está sendo definido corretamente
 * baseado no resultado do checkin
 */
async function testAuthWithSuccessfulCheckin() {
  try {
    console.log('🧪 Testando auth com checkin bem-sucedido...');

    // Simula cartão com acesso concedido (deve resultar em auth: true)
    const cardEventData = {
      Events: [{
        Data: {
          CardNo: "ABC12345",
          CardName: "João Silva",
          UserID: "123",
          UserName: "João Silva",
          Type: 1,
          ErrorCode: 0,
          Status: 1  // 1 = GRANTED
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
      timeout: 15000  // Aumentado para aguardar o checkin
    });

    console.log('✅ Resposta recebida:');
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(response.data, null, 2));

    // Verifica se auth é true quando checkin é bem-sucedido
    if (response.data.auth === true) {
      console.log('✅ auth está correto: true (checkin bem-sucedido)');
    } else {
      console.log('❌ auth deveria ser true, mas foi:', response.data.auth);
    }

  } catch (error) {
    console.error('❌ Erro no teste:', error.message);

    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

async function testAuthWithDeniedAccess() {
  try {
    console.log('\n🧪 Testando auth com acesso negado...');

    // Simula cartão com acesso negado (deve resultar em auth: false)
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

    // Verifica se auth é false quando acesso é negado
    if (response.data.auth === false) {
      console.log('✅ auth está correto: false (acesso negado)');
    } else {
      console.log('❌ auth deveria ser false, mas foi:', response.data.auth);
    }

  } catch (error) {
    console.error('❌ Erro no teste:', error.message);

    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

async function testAuthWithCheckinFailure() {
  try {
    console.log('\n🧪 Testando auth com falha no checkin...');

    // Primeiro, vamos parar temporariamente o endpoint de checkin para simular falha
    // Ou usar um código que sabemos que vai falhar

    // Simula cartão com acesso concedido mas que pode falhar no checkin
    const cardEventData = {
      Events: [{
        Data: {
          CardNo: "FAILCHECKIN",  // Código que pode causar falha
          CardName: "Teste Falha",
          UserID: "999",
          UserName: "Teste Falha",
          Type: 1,
          ErrorCode: 0,
          Status: 1  // 1 = GRANTED
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

    // Verifica se auth é false quando checkin falha
    if (response.data.auth === false) {
      console.log('✅ auth está correto: false (checkin falhou)');
    } else {
      console.log('❌ auth deveria ser false, mas foi:', response.data.auth);
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
async function runAuthTests() {
  console.log('🚀 Iniciando testes de lógica de auth...\n');

  // Testa cenário de sucesso
  await testAuthWithSuccessfulCheckin();

  // Aguarda um pouco entre testes
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Testa cenário de acesso negado
  await testAuthWithDeniedAccess();

  // Aguarda um pouco entre testes
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Testa cenário de falha no checkin
  await testAuthWithCheckinFailure();

  console.log('\n🏁 Testes de auth concluídos!');
  console.log('\n📋 Resumo esperado:');
  console.log('   ✅ Acesso concedido + Checkin OK → auth: true');
  console.log('   ❌ Acesso negado → auth: false');
  console.log('   ❌ Acesso concedido + Checkin falha → auth: false');
}

// Execute se chamado diretamente
if (require.main === module) {
  runAuthTests().catch(console.error);
}

module.exports = {
  testAuthWithSuccessfulCheckin,
  testAuthWithDeniedAccess,
  testAuthWithCheckinFailure
};
