const axios = require('axios');

/**
 * Test script para simular evento de leitura de cartão
 * e verificar se a integração com checkin está funcionando
 */
async function simulateCardReading() {
  try {
    console.log('🧪 Simulando leitura de cartão com acesso concedido...');

    // Simula o formato de dados que a catraca envia
    const cardEventData = {
      Events: [{
        Data: {
          CardNo: "ABC12345",
          CardName: "João Silva",
          UserID: "123",
          UserName: "João Silva",
          Type: 1,
          ErrorCode: 0,
          Status: 1  // 1 = GRANTED, 0 = DENIED
        }
      }],
      Time: new Date().toISOString()
    };

    // Simula o formato multipart/form-data que a catraca envia
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

    console.log('✅ Resposta da catraca:');
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(response.data, null, 2));

  } catch (error) {
    console.error('❌ Erro ao simular leitura de cartão:', error.message);

    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

async function simulateCardReadingDenied() {
  try {
    console.log('\n🧪 Simulando leitura de cartão com acesso negado...');

    // Simula o formato de dados que a catraca envia (acesso negado)
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

    // Simula o formato multipart/form-data que a catraca envia
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

    console.log('✅ Resposta da catraca (acesso negado):');
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(response.data, null, 2));

  } catch (error) {
    console.error('❌ Erro ao simular leitura de cartão negada:', error.message);

    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

// Testa se o endpoint de checkin está funcionando
async function testCheckinEndpointDirectly() {
  try {
    console.log('\n🧪 Testando endpoint de checkin diretamente...');

    const response = await axios.post('http://localhost:80/api/open/event/checkin', {
      code: "ABC12345"
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 5000
    });

    console.log('✅ Endpoint de checkin funcionando:');
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(response.data, null, 2));

  } catch (error) {
    console.error('❌ Erro no endpoint de checkin:', error.message);

    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

// Executa todos os testes
async function runIntegrationTests() {
  console.log('🚀 Iniciando testes de integração cartão -> checkin...\n');

  // Primeiro testa se o endpoint de checkin está funcionando
  await testCheckinEndpointDirectly();

  // Aguarda um pouco para o servidor processar
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Simula leitura de cartão com acesso concedido
  await simulateCardReading();

  // Aguarda um pouco para o servidor processar
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Simula leitura de cartão com acesso negado
  await simulateCardReadingDenied();

  console.log('\n🏁 Testes de integração concluídos!');
  console.log('\n📋 Verifique os logs do servidor para ver se:');
  console.log('   1. O evento de cartão foi processado');
  console.log('   2. A chamada para checkin foi feita (apenas para acesso concedido)');
  console.log('   3. A resposta do checkin foi exibida');
}

// Execute se chamado diretamente
if (require.main === module) {
  runIntegrationTests().catch(console.error);
}

module.exports = {
  simulateCardReading,
  simulateCardReadingDenied,
  testCheckinEndpointDirectly
};
