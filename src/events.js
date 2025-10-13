var log = console.log;
require('dotenv').config();

console.log = function () {
  let ts = Date.now();
  let date_ob = new Date(ts);
  log.apply(console, [date_ob.toLocaleString()].concat(arguments));
};

/**
 * Formata timestamp UTC para horário local brasileiro (HH:mm)
 * O timestamp vem do banco em UTC e precisa ser convertido para localtime
 */
function formatTimestampToBrazilianTime(timestamp) {
  try {
    // Cria a data a partir do timestamp UTC
    const utcDate = new Date(timestamp);

    // Converte para horário local brasileiro (America/Sao_Paulo)
    return utcDate.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Sao_Paulo',
      hour12: false
    });
  } catch (error) {
    console.error('Erro ao formatar timestamp UTC para horário local:', error);
    return 'horário não disponível';
  }
}

var http = require('http');
const axios = require('axios');
const baseUrl = process.env.BASE_URL;
/**
 * Faz chamada para a API de checkin
 */
async function callCheckinAPI(cardNo) {
  try {
    console.log(`🔄 Fazendo checkin para cartão: ${cardNo}`);

    const response = await axios.post(`${baseUrl}api/open/event/checkin`, {
      code: cardNo
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 5000
    });

    if (response.data.success) {
      console.log('✅ Checkin realizado com sucesso!');
      console.log('📋 Detalhes do checkin:');
      console.log('   - Invite ID:', response.data.data.inviteId);
      console.log('   - Scanned At:', response.data.data.scannedAt);
      console.log('   - Message:', response.data.data.message);
      return response.data;
    } else {
      console.log('❌ Checkin falhou:', response.data.error);
      return null;
    }

  } catch (error) {
    console.error('❌ Erro ao fazer checkin:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    }
    return error.response.data;
  }
}

var server = http.createServer(function (request, response) {

  if (request.method == "GET") {
    console.log('GET at ' + request.url);
    var body = '';
    request.on('data', function (data) {
      body += data;
      //console.log('Partial body: ' + body)
    });
    request.on('end', function () {
      //console.log('header: ' + request.rawHeaders)

      var waitTill = new Date(new Date().getTime() + 4 * 1000);
      while (waitTill > new Date()) { }
      console.log('Body: ' + body);
      response.writeHead(200, { "Content-Type": "text/plain" });
      response.end("OK");
    });

  }
  else if (request.method == "POST") {
    console.log('POST at ' + request.url);
    var body = '';
    request.on('data', function (data) {
      body += data;
      //console.log('Partial body: ' + body)
    });
    request.on('end', async function () {
      //console.log('header: ' + request.rawHeaders)
      //console.log('Body: ' + body);

      // Extract and log card number
      try {
        // Find the JSON part between Content-Disposition header and the next boundary
        const jsonStartMarker = 'Content-Disposition: form-data; name="info"';
        const jsonStart = body.indexOf(jsonStartMarker);

        if (jsonStart !== -1) {
          // Find where the JSON actually starts (after the headers)
          const dataStart = body.indexOf('\r\n\r\n', jsonStart) + 4;
          // Find where this part ends (next boundary marker)
          const dataEnd = body.indexOf('\r\n--myboundary', dataStart);

          if (dataStart > 3 && dataEnd !== -1) {
            const jsonStr = body.substring(dataStart, dataEnd).trim();
            const jsonData = JSON.parse(jsonStr);

            // Extract card number from Events array
            if (jsonData.Events && jsonData.Events.length > 0) {
              const eventData = jsonData.Events[0].Data || {};
              const cardNo = eventData.CardNo;
              const cardName = eventData.CardName;
              const userID = eventData.UserID;
              const userName = eventData.UserName;
              const eventType = eventData.Type;
              const errorCode = eventData.ErrorCode;
              const status = eventData.Status;
              const timestamp = jsonData.Time;

              console.log('=== Access Control Event ===');
              console.log('Card Number:', cardNo);
              console.log('Card Name:', cardName || '(empty)');
              console.log('User ID:', userID || '(empty)');
              console.log('User Name:', userName || '(empty)');
              console.log('Event Type:', eventType);
              console.log('Status:', status);
              console.log('Error Code:', errorCode || '(none)');

              // Validação instantânea: rejeita se o código estiver vazio ou inválido
              if (!cardNo || cardNo.trim() === '') {
                console.log('🚫 Código inválido - Rejeição instantânea');
                response.writeHead(200, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({
                  "message": "não aceitamos facial",
                  "code": 200,
                  "auth": "false"
                }));
                return; // Importante: retorna para evitar processamento adicional
              }

              // Determina se deve fazer checkin e define auth
              let authResult = false;

              console.log('🎫 Codigo Capturado - Iniciando processo de checkin...');

              const checkinResult = await callCheckinAPI(cardNo);
              console.log('Checkin Result:', JSON.stringify(checkinResult));

              if (checkinResult && checkinResult.success) {
                console.log('🎉 Checkin processado com sucesso!');
                authResult = true;
                response.writeHead(200, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({
                  "message": "Checkin realizado",
                  "code": 200,
                  "auth": "true"
                }));

              } else {
                let message = "";
                console.log('⚠️ Checkin não foi processado');
                authResult = false;
                response.writeHead(200, { 'Content-Type': 'application/json' });
                console.log('Checkin error:', JSON.stringify(checkinResult));

                // Tratamento específico para diferentes tipos de erro
                if (checkinResult?.error === "Código obrigatório" ||
                  checkinResult?.message === "O código do convite é obrigatório") {
                  message = "não aceitamos facial";
                } else if (checkinResult?.error === "Convite não encontrado" ||
                  checkinResult?.message === "Nenhum convite encontrado com este código") {
                  message = "convite não encontrado";
                } else if (checkinResult?.error && checkinResult?.data?.previousScan) {
                  message = `Utilizado às ${formatTimestampToBrazilianTime(checkinResult.data.previousScan)}`;
                  console.log(message);
                } else {
                  message = "não aceitamos facial";
                }

                response.end(JSON.stringify({
                  "message": message,
                  "code": 200,
                  "auth": "false"
                }));
              }

            } else {
              console.log('🚫 Acesso negado - Evento não capturado');
              response.writeHead(200, { 'Content-Type': 'application/json' });
              response.end(JSON.stringify({ "message": "Evento não capturado", "code": 200, "auth": "false" }));
            }

          }
        }

      } catch (err) {
        console.log('Error parsing card data:', err.message);
        // Em caso de erro no parsing, envia resposta padrão
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ "message": "Algo falhou", "code": 200, "auth": "false" }));
      }
    });

  }
  else {
    response.writeHead(200, { "Content-Type": "text/plain" });
    response.end("Undefined request.");
  }
});

server.listen(80);
console.log("Server running on port 80");