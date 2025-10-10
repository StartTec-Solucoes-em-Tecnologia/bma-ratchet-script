var log = console.log;

console.log = function () {
  let ts = Date.now();
  let date_ob = new Date(ts);
  log.apply(console, [date_ob.toLocaleString()].concat(arguments));
};

var http = require('http');
const axios = require('axios');

/**
 * Faz chamada para a API de checkin
 */
async function callCheckinAPI(cardNo) {
  try {
    console.log(`🔄 Fazendo checkin para cartão: ${cardNo}`);

    const response = await axios.post('http://localhost:80/api/open/event/checkin', {
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
    return null;
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
              const cardNo = jsonData.Events[0].Data.CardNo;
              const cardName = jsonData.Events[0].Data.CardName;
              const userID = jsonData.Events[0].Data.UserID;
              const userName = jsonData.Events[0].Data.UserName;
              const eventType = jsonData.Events[0].Data.Type;
              const errorCode = jsonData.Events[0].Data.ErrorCode;
              const status = jsonData.Events[0].Data.Status;
              const timestamp = jsonData.Time;

              console.log('=== Access Control Event ===');
              console.log('Card Number:', cardNo);
              console.log('Card Name:', cardName || '(empty)');
              console.log('User ID:', userID || '(empty)');
              console.log('User Name:', userName || '(empty)');
              console.log('Event Type:', eventType);
              console.log('Status:', status === 1 ? 'GRANTED ✓' : 'DENIED ✗');
              console.log('Error Code:', errorCode);

              // Determina se deve fazer checkin e define auth
              let authResult = false;

              if (status === 1 && errorCode === 0) {
                console.log('🎫 Codigo Capturado - Iniciando processo de checkin...');

                try {
                  const checkinResult = await callCheckinAPI(cardNo);
                  if (checkinResult && checkinResult.success) {
                    console.log('🎉 Checkin processado com sucesso!');
                    authResult = true;
                  } else {
                    console.log('⚠️ Checkin não foi processado');
                    authResult = false;
                  }
                } catch (err) {
                  console.error('💥 Erro no processo de checkin:', err.message);
                  authResult = false;
                }
              } else {
                console.log('🚫 Acesso negado - Checkin não será processado');
                authResult = false;
              }

              if (errorCode !== 0) {
                console.log('*** ACCESS DENIED - Error:', errorCode);
              }
              console.log('Timestamp:', timestamp);
              console.log('===========================');
            }
          }
        }
      } catch (err) {
        console.log('Error parsing card data:', err.message);
      }

      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ "message": "ABBCASDF", "code": 200, "auth": authResult }));
    });

  }
  else {
    response.writeHead(200, { "Content-Type": "text/plain" });
    response.end("Undefined request.");
  }
});

server.listen(80);
console.log("Server running on port 80");