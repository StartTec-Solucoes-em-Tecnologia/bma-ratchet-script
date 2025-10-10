const axios = require('axios');

/**
 * Test script for the checkin endpoint
 */
async function testCheckinEndpoint() {
  try {
    console.log('🧪 Testando endpoint de checkin...');

    const testData = {
      code: "ABC12345"
    };

    const response = await axios.post('http://localhost:80/api/open/event/checkin', testData, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 5000
    });

    console.log('✅ Resposta recebida:');
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(response.data, null, 2));

    // Validate response structure
    if (response.data.success && response.data.data) {
      const { inviteId, scannedAt, message } = response.data.data;

      if (inviteId && scannedAt && message) {
        console.log('✅ Estrutura da resposta está correta');
        console.log('✅ Teste passou com sucesso!');
      } else {
        console.log('❌ Estrutura da resposta está incorreta');
      }
    } else {
      console.log('❌ Resposta não contém success: true e data');
    }

  } catch (error) {
    console.error('❌ Erro no teste:', error.message);

    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

// Test with missing code
async function testCheckinWithoutCode() {
  try {
    console.log('\n🧪 Testando endpoint sem código...');

    const testData = {};

    const response = await axios.post('http://localhost:80/api/open/event/checkin', testData, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 5000
    });

    console.log('❌ Deveria ter retornado erro 400');
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(response.data, null, 2));

  } catch (error) {
    if (error.response && error.response.status === 400) {
      console.log('✅ Erro 400 retornado corretamente');
      console.log('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('❌ Erro inesperado:', error.message);
    }
  }
}

// Run tests
async function runTests() {
  console.log('🚀 Iniciando testes do endpoint de checkin...\n');

  await testCheckinEndpoint();
  await testCheckinWithoutCode();

  console.log('\n🏁 Testes concluídos!');
}

// Execute if called directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { testCheckinEndpoint, testCheckinWithoutCode };
