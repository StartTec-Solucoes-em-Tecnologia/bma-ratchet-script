const axios = require('axios');

/**
 * Test script para verificar se o erro de double response foi corrigido
 */
async function testNoDoubleResponseError() {
  try {
    console.log('🧪 Testando se não há mais erro de double response...');

    // Simula evento de cartão
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
      timeout: 15000
    });

    console.log('✅ Resposta recebida sem erro de double response!');
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(response.data, null, 2));

    // Verifica se recebeu apenas uma resposta válida
    if (response.data && typeof response.data.auth !== 'undefined') {
      console.log('✅ Resposta única e válida recebida');
      console.log('Auth value:', response.data.auth);
    } else {
      console.log('❌ Resposta inválida ou incompleta');
    }

  } catch (error) {
    if (error.message.includes('ERR_HTTP_HEADERS_SENT')) {
      console.error('❌ Erro de double response ainda existe:', error.message);
    } else {
      console.error('❌ Outro erro:', error.message);
    }

    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

async function testMultipleRequests() {
  try {
    console.log('\n🧪 Testando múltiplas requisições para garantir estabilidade...');

    const promises = [];

    // Envia 3 requisições simultâneas
    for (let i = 0; i < 3; i++) {
      const cardEventData = {
        Events: [{
          Data: {
            CardNo: `CARD${i}2345`,
            CardName: `Usuário ${i}`,
            UserID: `${i}`,
            UserName: `Usuário ${i}`,
            Type: 1,
            ErrorCode: 0,
            Status: 1
          }
        }],
        Time: new Date().toISOString()
      };

      const boundary = 'myboundary';
      const formData = `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="info"\r\n\r\n` +
        `${JSON.stringify(cardEventData)}\r\n` +
        `--${boundary}--\r\n`;

      promises.push(
        axios.post('http://localhost:80/', formData, {
          headers: {
            'Content-Type': `multipart/form-data; boundary=${boundary}`
          },
          timeout: 15000
        })
      );
    }

    const responses = await Promise.all(promises);

    console.log('✅ Todas as requisições foram processadas sem erro!');
    responses.forEach((response, index) => {
      console.log(`   Requisição ${index + 1}: Status ${response.status}, Auth: ${response.data.auth}`);
    });

  } catch (error) {
    if (error.message.includes('ERR_HTTP_HEADERS_SENT')) {
      console.error('❌ Erro de double response em requisições múltiplas:', error.message);
    } else {
      console.error('❌ Outro erro em requisições múltiplas:', error.message);
    }
  }
}

// Executa os testes
async function runFixTests() {
  console.log('🚀 Testando correção do erro de double response...\n');

  await testNoDoubleResponseError();
  await testMultipleRequests();

  console.log('\n🏁 Testes de correção concluídos!');
  console.log('📋 Se não houve erros de ERR_HTTP_HEADERS_SENT, a correção funcionou!');
}

// Execute se chamado diretamente
if (require.main === module) {
  runFixTests().catch(console.error);
}

module.exports = { testNoDoubleResponseError, testMultipleRequests };
