const axios = require('axios');
const crypto = require('crypto');
const AxiosDigestAuth = require('@mhoc/axios-digest-auth').default;
require('dotenv').config();

/**
 * Script para cadastrar múltiplas catracas via API
 * Processa um array de IPs e chama a rota de configuração para cada um
 */

/**
 * Gera autenticação digest HTTP
 */
function generateDigestAuth(username, password, method, uri, realm, nonce, qop, nc, cnonce) {
    const ha1 = crypto.createHash('md5').update(`${username}:${realm}:${password}`).digest('hex');
    const ha2 = crypto.createHash('md5').update(`${method}:${uri}`).digest('hex');
    const response = crypto.createHash('md5').update(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`).digest('hex');
    
    return `Digest username="${username}", realm="${realm}", nonce="${nonce}", uri="${uri}", qop=${qop}, nc=${nc}, cnonce="${cnonce}", response="${response}"`;
}

/**
 * Busca participantes da API
 */
async function fetchParticipants() {
    try {
        const baseUrl = process.env.BASE_URL;
        const eventId = process.env.EVENT_ID
        
        if (!baseUrl) {
            throw new Error('Variável de ambiente BASE_URL não está definida');
        }

        if (!eventId) {
            throw new Error('Variável de ambiente EVENT_ID não está definida');
        }

        const url = `${baseUrl}/api/open/event/${eventId}/participants`;
        
        console.log(`🔍 Buscando participantes de: ${url}`);
        
        const response = await axios.get(url, {
            timeout: 30000, // Timeout de 30 segundos
            headers: {
                'User-Agent': 'BMA-Ratchet-Script/1.0.0',
                'Content-Type': 'application/json'
            }
        });

        if (response.data.success && response.data.data) {
            console.log(`✅ Encontrados ${response.data.data.length} participantes`);
            return response.data.data;
        } else {
            throw new Error('Resposta da API não contém dados válidos');
        }

    } catch (error) {
        console.error('❌ Erro ao buscar participantes:', error.message);
        throw error;
    }
}

/**
 * Registra um usuário em uma catraca individual
 */
async function registerUserInRatchet(deviceIp, participant) {
    try {
        console.log(`🔄 Registrando ${participant.nome} (${participant.codigo_de_convite}) na catraca ${deviceIp}...`);

        // Monta a URL da requisição
        const url = `http://${deviceIp}/cgi-bin/recordUpdater.cgi?action=insert&name=AccessControlCard&CardNo=${participant.codigo_de_convite}&CardStatus=0&CardName=${encodeURIComponent(participant.nome)}&UserID=${participant.id}&Doors[0]=0&CardStatus=0&CardType=2&UseTimes=1`;

        // Configuração de autenticação digest
        const username = process.env.DIGEST_USERNAME;
        const password = process.env.DIGEST_PASSWORD;
        
        let headers = {
            'User-Agent': 'BMA-Ratchet-Script/1.0.0'
        };

        // Se username e password estão definidos, adiciona autenticação digest
        const axiosDigest = new AxiosDigestAuth({
            username,
            password
        })

        // Faz a requisição HTTP
        const response = await axiosDigest.request({
            headers: headers,
            method: 'GET',
            url
        });

        console.log(`✅ Usuário ${participant.nome} registrado com sucesso na catraca ${deviceIp}! Status: ${response.status}`);
        
        return {
            deviceIp,
            participant,
            success: true,
            status: response.status,
            data: response.data
        };

    } catch (error) {
        console.error(`❌ Erro ao registrar ${participant.nome} na catraca ${deviceIp}:`, error.message);
        
        if (error.response) {
            console.error(`Status HTTP: ${error.response.status}`);
        } else if (error.request) {
            console.error('Erro de conexão - não foi possível conectar ao dispositivo');
        }

        return {
            deviceIp,
            participant,
            success: false,
            error: error.message
        };
    }
}

/**
 * Registra todos os usuários em todas as catracas
 */
async function registerAllUsersInAllRatchets() {
    try {
        // Verifica se as variáveis de ambiente estão definidas
        const deviceIps = process.env.DEVICE_IPS;
        const baseUrl = process.env.BASE_URL;

        if (!deviceIps) {
            throw new Error('Variável de ambiente DEVICE_IPS não está definida');
        }

        if (!baseUrl) {
            throw new Error('Variável de ambiente BASE_URL não está definida');
        }

        // Busca os participantes
        const participants = fetchParticipants();
        
        // Converte a string de IPs em array
        const ipArray = deviceIps.split(',').map(ip => ip.trim());
        
        console.log(`🚀 Iniciando registro de ${participants.length} usuários em ${ipArray.length} catracas...`);
        console.log(`IPs das catracas: ${ipArray.join(', ')}`);

        const results = [];
        let totalOperations = 0;
        let successCount = 0;
        let errorCount = 0;

        // Processa cada participante em cada catraca
        for (let i = 0; i < participants.length; i++) {
            const participant = participants[i];
            
            for (let j = 0; j < ipArray.length; j++) {
                const deviceIp = ipArray[j];
                totalOperations++;
                
                const result = await registerUserInRatchet(deviceIp, participant);
                results.push(result);
                
                if (result.success) {
                    successCount++;
                } else {
                    errorCount++;
                }

                // Pequena pausa entre requisições para não sobrecarregar
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        // Relatório final
        console.log('\n📊 RELATÓRIO FINAL:');
        console.log(`👥 Participantes: ${participants.length}`);
        console.log(`🏢 Catracas: ${ipArray.length}`);
        console.log(`🔄 Total de operações: ${totalOperations}`);
        console.log(`✅ Sucessos: ${successCount}`);
        console.log(`❌ Erros: ${errorCount}`);

        // Lista detalhada dos resultados por participante
        console.log('\n📋 DETALHES POR PARTICIPANTE:');
        participants.forEach(participant => {
            console.log(`\n👤 ${participant.nome} (${participant.codigo_de_convite}):`);
            const participantResults = results.filter(r => r.participant.id === participant.id);
            participantResults.forEach(result => {
                const status = result.success ? '✅' : '❌';
                console.log(`  ${status} ${result.deviceIp}`);
            });
        });

        return {
            success: errorCount === 0,
            participants: participants.length,
            ratchets: ipArray.length,
            totalOperations,
            successCount,
            errorCount,
            results
        };

    } catch (error) {
        console.error('💥 Erro geral no processamento:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Cadastra uma catraca individual
 */
async function registerSingleRatchet(deviceIp) {
    try {
        console.log(`\n🔄 Processando catraca  (${deviceIp})...`);

        // Monta a URL da requisição
        const url = `http://${deviceIp}/cgi-bin/configManager.cgi?action=setConfig&_EnableUnsecure_.Enable=true`;

        // Configuração de autenticação digest
        const username = process.env.DIGEST_USERNAME;
        const password = process.env.DIGEST_PASSWORD;
        
        let headers = {
            'User-Agent': 'BMA-Ratchet-Script/1.0.0'
        };

        // Se username e password estão definidos, adiciona autenticação digest
        const axiosDigest = new AxiosDigestAuth({
            username,
            password
        })

        // Faz a requisição HTTP
        const response = await axiosDigest.request({
            headers: headers,
            method: 'GET',
            url
        });

        console.log(`✅ Sucesso para ${deviceIp}! Status: ${response.status}`);
        
        return {
            deviceIp,
            success: true,
            status: response.status,
            data: response.data
        };

    } catch (error) {
        console.error(`❌ Erro ao cadastrar ${deviceIp}:`, error.message);
        
        if (error.response) {
            console.error(`Status HTTP: ${error.response.status}`);
        } else if (error.request) {
            console.error('Erro de conexão - não foi possível conectar ao dispositivo');
        }

        return {
            deviceIp,
            success: false,
            error: error.message
        };
    }
}

/**
 * Processa múltiplas catracas
 */
async function registerMultipleRatchets() {
    try {
        // Verifica se as variáveis de ambiente estão definidas
        const deviceIps = process.env.DEVICE_IPS;

        if (!deviceIps) {
            throw new Error('Variável de ambiente DEVICE_IPS não está definida');
        }

        // Converte a string de IPs em array
        const ipArray = deviceIps.split(',').map(ip => ip.trim());
        
        console.log(`🚀 Iniciando cadastro de ${ipArray.length} catracas...`);
        console.log(`IPs a processar: ${ipArray.join(', ')}`);

        const results = [];
        let successCount = 0;
        let errorCount = 0;

        // Processa cada IP sequencialmente
        for (let i = 0; i < ipArray.length; i++) {
            const deviceIp = ipArray[i];
            
            const result = await registerSingleRatchet(deviceIp);
            results.push(result);
            
            if (result.success) {
                successCount++;
            } else {
                errorCount++;
            }

            // Pequena pausa entre requisições para não sobrecarregar
            if (i < ipArray.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        // Relatório final
        console.log('\n📊 RELATÓRIO FINAL:');
        console.log(`✅ Sucessos: ${successCount}`);
        console.log(`❌ Erros: ${errorCount}`);
        console.log(`📈 Total processado: ${ipArray.length}`);

        // Lista detalhada dos resultados
        console.log('\n📋 DETALHES:');
        results.forEach(result => {
            const status = result.success ? '✅' : '❌';
            console.log(`${status} ${result.deviceIp}`);
        });

        return {
            success: errorCount === 0,
            total: ipArray.length,
            successCount,
            errorCount,
            results
        };

    } catch (error) {
        console.error('💥 Erro geral no processamento:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

// Executa o script se for chamado diretamente
if (require.main === module) {
    // Verifica se deve executar o registro de usuários ou configuração de catracas
    const args = process.argv.slice(2);
    const shouldRegisterUsers = args.includes('--register-users') || args.includes('-u');
    
    if (shouldRegisterUsers) {
        console.log('🚀 Modo: Registro de usuários em catracas');
        registerAllUsersInAllRatchets()
            .then(result => {
                if (result.success) {
                    console.log('\n🎉 Registro de usuários concluído com sucesso!');
                    process.exit(0);
                } else {
                    console.log('\n💥 Registro de usuários concluído com erros');
                    process.exit(1);
                }
            })
            .catch(error => {
                console.error('💥 Erro inesperado:', error);
                process.exit(1);
            });
    } else {
        console.log('🚀 Modo: Configuração de catracas');
        registerMultipleRatchets()
            .then(result => {
                if (result.success) {
                    console.log('\n🎉 Processamento concluído com sucesso!');
                    process.exit(0);
                } else {
                    console.log('\n💥 Processamento concluído com erros');
                    process.exit(1);
                }
            })
            .catch(error => {
                console.error('💥 Erro inesperado:', error);
                process.exit(1);
            });
    }
}

module.exports = { 
    registerMultipleRatchets, 
    registerSingleRatchet,
    registerAllUsersInAllRatchets,
    registerUserInRatchet,
    fetchParticipants
};
