const axios = require('axios');
const AxiosDigestAuth = require('@mhoc/axios-digest-auth').default;
const redisCache = require('./redis-cache');
require('dotenv').config();

/**
 * Worker thread para registrar um usuário em uma catraca
 * Este worker é executado em paralelo usando Piscina
 */

/**
 * Registra um usuário em uma catraca individual
 * @param {Object} task - Objeto contendo deviceIp, participant e skipCache
 * @returns {Promise<Object>} Resultado do registro
 */
async function registerUser({ deviceIp, participant, skipCache = false }) {
    try {
        // Verifica se o usuário já foi registrado (cache)
        if (!skipCache) {
            // Garante que o Redis está conectado
            if (!redisCache.isConnected()) {
                await redisCache.connect();
            }
            
            const isAlreadyRegistered = await redisCache.isUserRegistered(deviceIp, participant);
            if (isAlreadyRegistered) {
                return {
                    deviceIp,
                    participant,
                    success: true,
                    skipped: true,
                    fromCache: true,
                    message: 'Usuário já registrado anteriormente (verificado via cache)'
                };
            }
        }

        // Processa o nome para o CardName
        // Remove "convidado", remove hífens, pega os dois primeiros nomes
        let processedName = participant.nome
            .toLowerCase()
            .replace(/convidado/gi, '') // Remove a palavra "convidado" (case insensitive)
            .replace(/-/g, '') // Remove hífens
            .trim()
            .split(/\s+/) // Divide por espaços
            .slice(0, 2) // Pega apenas os dois primeiros nomes
            .join(' '); // Junta com espaço entre os nomes
        
        // Monta a URL da requisição
        const url = `http://${deviceIp}/cgi-bin/recordUpdater.cgi?action=insert&name=AccessControlCard&CardNo=${participant.codigo_de_convite}&CardStatus=0&CardName=${encodeURIComponent(processedName)}&UserID=${participant.id}&Doors[0]=0&CardStatus=0&CardType=2&UseTime=1`;

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
        });

        // Faz a requisição HTTP
        const response = await axiosDigest.request({
            headers: headers,
            method: 'GET',
            url
        });
        
        // Marca o usuário como registrado no cache
        if (!redisCache.isConnected()) {
            await redisCache.connect();
        }
        await redisCache.markUserAsRegistered(deviceIp, participant);
        
        return {
            deviceIp,
            participant,
            success: true,
            skipped: false,
            status: response.status,
            data: response.data
        };

    } catch (error) {
        return {
            deviceIp,
            participant,
            success: false,
            skipped: false,
            error: error.message
        };
    }
}

module.exports = registerUser;

