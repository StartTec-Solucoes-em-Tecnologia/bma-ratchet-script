const axios = require('axios');
require('dotenv').config();

/**
 * Script para cadastrar múltiplas catracas via API
 * Processa um array de IPs e chama a rota de configuração para cada um
 */

/**
 * Cadastra uma catraca individual
 */
async function registerSingleRatchet(deviceIp) {
    try {
        console.log(`\n🔄 Processando catraca  (${deviceIp})...`);

        // Monta a URL da requisição
        const url = `http://${deviceIp}/cgi-bin/configManager.cgi?action=setConfig&_EnableUnsecure_.Enable=true`;

        // Faz a requisição HTTP
        const response = await axios.get(url, {
            timeout: 10000, // Timeout de 10 segundos
            headers: {
                'User-Agent': 'BMA-Ratchet-Script/1.0.0'
            }
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

module.exports = { registerMultipleRatchets, registerSingleRatchet };
