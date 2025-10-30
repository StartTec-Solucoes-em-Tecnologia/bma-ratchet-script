const axios = require('axios');
const AxiosDigestAuth = require('@mhoc/axios-digest-auth').default;

/**
 * Cliente para APIs das Catracas Faciais
 * Responsável por todas as operações de comunicação com os dispositivos
 */

class ApiClient {
    constructor() {
        this.username = process.env.DIGEST_USERNAME;
        this.password = process.env.DIGEST_PASSWORD;
    }

    /**
     * Cria instância de autenticação digest
     */
    createDigestAuth() {
        return new AxiosDigestAuth({
            username: this.username,
            password: this.password
        });
    }

    /**
     * Busca usuários existentes na leitora
     */
    async fetchExistingUsers(deviceIp) {
        try {
            const url = `http://${deviceIp}/cgi-bin/recordFinder.cgi?action=doSeekFind&name=AccessControlCard&count=4300`;
            const axiosDigest = this.createDigestAuth();

            const response = await axiosDigest.request({
                method: 'GET',
                url,
                timeout: 30000,
                headers: {
                    'User-Agent': 'BMA-Facial-Registration/2.0.0'
                }
            });

            return this.parseRecordFinderResponse(response.data);
        } catch (error) {
            console.error(`❌ Erro ao buscar usuários existentes em ${deviceIp}:`, error.message);
            return [];
        }
    }

    /**
     * Deleta usuário da leitora
     */
    async deleteUser(deviceIp, recNo) {
        try {
            const url = `http://${deviceIp}/cgi-bin/recordUpdater.cgi?action=remove&name=AccessControlCard&RecNo=${recNo}`;
            const axiosDigest = this.createDigestAuth();

            const response = await axiosDigest.request({
                method: 'GET',
                url,
                timeout: 30000,
                headers: {
                    'User-Agent': 'BMA-Facial-Registration/2.0.0'
                }
            });

            return { success: response.data.trim() === 'OK' };
        } catch (error) {
            console.error(`❌ Erro ao deletar usuário ${recNo} em ${deviceIp}:`, error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Cadastra um único usuário na leitora usando API V2 (individual)
     */
    async registerSingleUser(deviceIp, user) {
        try {
            const axiosDigest = this.createDigestAuth();

            // Valida dados do usuário
            const userName = user.formattedName || user.name || 'Usuario';
            const cleanUserName = userName.substring(0, 50).replace(/[^\w\s]/g, '').trim();
            // USA O INVITE ID COMO USER ID NA CATRACA
            const userIdForDevice = String(user.inviteId || user.userId || Date.now());
            
            // Monta payload para um único usuário
            const userData = {
                UserID: userIdForDevice,
                UserName: cleanUserName,
                UserType: 0, // General user
                Authority: 2, // Usuário normal (não administrador)
                Password: "123456",
                Doors: [0],
                TimeSections: [255],
                ValidFrom: "2024-01-01 00:00:00",
                ValidTo: "2037-12-31 23:59:59"
            };

            const payload = {
                UserList: [userData]
            };

            const url = `http://${deviceIp}/cgi-bin/AccessUser.cgi?action=insertMulti`;

            console.log(`     🔗 URL: ${url}`);
            console.log(`     📝 Payload: ${JSON.stringify(payload, null, 2)}`);

            const response = await axiosDigest.request({
                method: 'POST',
                url,
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'BMA-Facial-Registration/2.0.0'
                },
                data: JSON.stringify(payload),
                timeout: 30000
            });

            const responseText = response.data.trim();
            const isSuccess = responseText === 'OK';
            
            if (!isSuccess) {
                console.warn(`⚠️  Falha ao cadastrar usuário ${userId}: "${responseText}"`);
            } else {
                console.log(`     ✅ Usuário ${userId} cadastrado - ${responseText}`);
            }

            return { 
                success: isSuccess, 
                response: responseText, 
                userId: userId,
                userName: cleanUserName
            };
        } catch (error) {
            let errorDetails = error.message;
            
            if (error.response) {
                const status = error.response.status;
                const statusText = error.response.statusText;
                const responseData = error.response.data;
                errorDetails = `HTTP ${status}: ${statusText} - ${JSON.stringify(responseData)}`;
            }
            
            console.error(`❌ Erro ao cadastrar usuário ${user.userId} em ${deviceIp}:`, errorDetails);
            return { success: false, error: errorDetails, userId: user.userId };
        }
    }

    /**
     * Cadastra múltiplos usuários de uma vez (batch)
     */
    async registerUsers(deviceIp, userBatch) {
        try {
            const axiosDigest = this.createDigestAuth();
            
            console.log(`   📤 Cadastrando ${userBatch.length} usuários em lote em ${deviceIp}...`);
            
            // Prepara lista de usuários para o batch
            const userList = userBatch.map(user => {
                const userName = user.formattedName || user.name || 'Usuario';
                const cleanUserName = userName.substring(0, 50).replace(/[^\w\s]/g, '').trim();
                // USA O INVITE ID COMO USER ID NA CATRACA
                const userIdForDevice = String(user.inviteId || user.userId || Date.now());
                
                return {
                    UserID: userIdForDevice,
                    UserName: cleanUserName,
                    UserType: 0, // General user
                    Authority: 2, // Usuário normal
                    Password: "123456",
                    Doors: [0],
                    TimeSections: [255],
                    ValidFrom: "2024-01-01 00:00:00",
                    ValidTo: "2037-12-31 23:59:59"
                };
            });

            const payload = {
                UserList: userList
            };

            const url = `http://${deviceIp}/cgi-bin/AccessUser.cgi?action=insertMulti`;

            console.log(`   🔗 URL: ${url}`);
            console.log(`   📝 Enviando ${userList.length} usuários DE UMA VEZ no lote`);
            console.log(`   👥 Usuários: ${userList.map(u => u.UserName).join(', ')}`);

            const response = await axiosDigest.request({
                method: 'POST',
                url,
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'BMA-Facial-Registration/2.0.0'
                },
                data: JSON.stringify(payload),
                timeout: 60000 // Aumentado para 60s para lotes maiores
            });

            const responseText = response.data.trim();
            const isSuccess = responseText === 'OK';
            
            if (!isSuccess) {
                console.warn(`   ⚠️  Resposta inesperada: "${responseText}"`);
            } else {
                console.log(`   ✅ Lote cadastrado com sucesso`);
            }

            return { 
                success: isSuccess, 
                response: responseText,
                successCount: isSuccess ? userBatch.length : 0,
                failedCount: isSuccess ? 0 : userBatch.length,
                errors: []
            };
        } catch (error) {
            let errorDetails = error.message;
            
            if (error.response) {
                const status = error.response.status;
                const statusText = error.response.statusText;
                const responseData = error.response.data;
                
                // Decodifica erro se disponível
                if (responseData && responseData.detail && responseData.detail.FailCodes) {
                    const failCodes = responseData.detail.FailCodes;
                    console.error(`   ❌ Códigos de erro: ${failCodes.join(', ')}`);
                    failCodes.forEach(code => {
                        const decodedError = this.decodeErrorCode(code);
                        console.error(`     - ${decodedError}`);
                    });
                    errorDetails = `HTTP ${status}: Batch falhou - ${JSON.stringify(responseData)}`;
                } else {
                    errorDetails = `HTTP ${status}: ${statusText} - ${JSON.stringify(responseData)}`;
                }
            }
            
            console.error(`   ❌ Erro ao cadastrar lote em ${deviceIp}:`, errorDetails);
            return { 
                success: false, 
                error: errorDetails,
                successCount: 0,
                failedCount: userBatch.length,
                errors: [{ batch: 'all', error: errorDetails }]
            };
        }
    }

    /**
     * Decodifica código de erro do dispositivo
     */
    decodeErrorCode(failCode) {
        const errorCodes = {
            286064926: 'Usuário não encontrado no dispositivo (cadastre o usuário primeiro)',
            286064928: 'Dados inválidos ou formato incorreto',
            286064927: 'Foto inválida ou formato não suportado',
            268632336: 'Erro geral de processamento em lote'
        };
        return errorCodes[failCode] || `Código de erro desconhecido: ${failCode}`;
    }

    /**
     * Cadastra uma única face na leitora usando API V2 (individual)
     */
    async registerSingleFace(deviceIp, user) {
        try {
            const axiosDigest = this.createDigestAuth();

            if (!user.photoBase64) {
                console.warn(`⚠️  Usuário ${user.inviteId || user.userId} sem dados de foto`);
                return { success: false, error: 'Sem dados de foto', userId: user.inviteId || user.userId };
            }

            // Usa a API V2 de face (individual)
            const url = `http://${deviceIp}/cgi-bin/AccessFace.cgi?action=insertMulti`;
            
            // USA O INVITE ID COMO USER ID NA CATRACA
            const userIdForDevice = String(user.inviteId || user.userId);
            
            const faceData = {
                UserID: userIdForDevice,
                PhotoData: [user.photoBase64]
            };

            const payload = {
                FaceList: [faceData]
            };

            console.log(`     🎭 Cadastrando face do usuário ${user.userId}...`);
            console.log(`     🔗 URL: ${url}`);

            const response = await axiosDigest.request({
                method: 'POST',
                url,
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'BMA-Facial-Registration/2.0.0'
                },
                data: JSON.stringify(payload),
                timeout: 30000
            });

            const responseText = response.data.trim();
            const isSuccess = responseText === 'OK';
            
            if (!isSuccess) {
                console.warn(`⚠️  Falha ao cadastrar face do usuário ${user.userId}: "${responseText}"`);
            } else {
                console.log(`     ✅ Face do usuário ${user.userId} cadastrada`);
            }

            return { 
                success: isSuccess, 
                response: responseText, 
                userId: user.userId
            };
        } catch (error) {
            let errorDetails = error.message;
            
            if (error.response) {
                const status = error.response.status;
                const statusText = error.response.statusText;
                const responseData = error.response.data;
                
                // Decodifica erro se disponível
                if (responseData && responseData.detail && responseData.detail.FailCodes) {
                    const failCode = responseData.detail.FailCodes[0];
                    const decodedError = this.decodeErrorCode(failCode);
                    console.error(`     ❌ Erro decodificado: ${decodedError}`);
                    errorDetails = `HTTP ${status}: ${decodedError} - ${JSON.stringify(responseData)}`;
                } else {
                    errorDetails = `HTTP ${status}: ${statusText} - ${JSON.stringify(responseData)}`;
                }
            }
            
            console.error(`❌ Erro ao cadastrar face do usuário ${user.userId} em ${deviceIp}:`, errorDetails);
            return { success: false, error: errorDetails, userId: user.userId };
        }
    }

    /**
     * Cadastra múltiplas faces de uma vez (batch)
     */
    async registerFaces(deviceIp, userBatch) {
        try {
            const axiosDigest = this.createDigestAuth();
            
            console.log(`   🎭 Cadastrando ${userBatch.length} faces em lote em ${deviceIp}...`);
            
            // Prepara lista de faces para o batch
            const faceList = userBatch.map(user => {
                if (!user.photoBase64) {
                    console.warn(`   ⚠️  Usuário ${user.inviteId || user.userId} sem dados de foto`);
                    return null;
                }
                
                // USA O INVITE ID COMO USER ID NA CATRACA
                const userIdForDevice = String(user.inviteId || user.userId);
                
                return {
                    UserID: userIdForDevice,
                    PhotoData: [user.photoBase64]
                };
            }).filter(face => face !== null);

            if (faceList.length === 0) {
                console.warn(`   ⚠️  Nenhuma face válida para cadastrar`);
                return {
                    success: false,
                    error: 'Nenhuma face válida',
                    successCount: 0,
                    failedCount: userBatch.length,
                    errors: []
                };
            }

            const payload = {
                FaceList: faceList
            };

            const url = `http://${deviceIp}/cgi-bin/AccessFace.cgi?action=insertMulti`;

            console.log(`   🔗 URL: ${url}`);
            console.log(`   📝 Enviando ${faceList.length} faces DE UMA VEZ no lote`);
            console.log(`   🎭 UserIDs: ${faceList.map(f => f.UserID).join(', ')}`);

            const response = await axiosDigest.request({
                method: 'POST',
                url,
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'BMA-Facial-Registration/2.0.0'
                },
                data: JSON.stringify(payload),
                timeout: 90000 // Aumentado para 90s (faces são mais pesadas)
            });

            const responseText = response.data.trim();
            const isSuccess = responseText === 'OK';
            
            if (!isSuccess) {
                console.warn(`   ⚠️  Resposta inesperada: "${responseText}"`);
            } else {
                console.log(`   ✅ Lote de faces cadastrado com sucesso`);
            }

            return { 
                success: isSuccess, 
                response: responseText,
                successCount: isSuccess ? faceList.length : 0,
                failedCount: isSuccess ? 0 : faceList.length,
                errors: []
            };
        } catch (error) {
            let errorDetails = error.message;
            
            if (error.response) {
                const status = error.response.status;
                const statusText = error.response.statusText;
                const responseData = error.response.data;
                
                // Decodifica erro se disponível
                if (responseData && responseData.detail && responseData.detail.FailCodes) {
                    const failCodes = responseData.detail.FailCodes;
                    console.error(`   ❌ Códigos de erro: ${failCodes.join(', ')}`);
                    failCodes.forEach(code => {
                        const decodedError = this.decodeErrorCode(code);
                        console.error(`     - ${decodedError}`);
                    });
                    errorDetails = `HTTP ${status}: Batch de faces falhou - ${JSON.stringify(responseData)}`;
                } else {
                    errorDetails = `HTTP ${status}: ${statusText} - ${JSON.stringify(responseData)}`;
                }
            }
            
            console.error(`   ❌ Erro ao cadastrar lote de faces em ${deviceIp}:`, errorDetails);
            return { 
                success: false, 
                error: errorDetails,
                successCount: 0,
                failedCount: userBatch.length,
                errors: [{ batch: 'all', error: errorDetails }]
            };
        }
    }

    /**
     * Processa lote completo: verificar -> deletar -> cadastrar usuário -> cadastrar face
     */
    async processBatch(deviceIp, userBatch, stats, retryCount = 0) {
        try {
            console.log(`\n🖥️  Processando leitora ${deviceIp}...`);
            
            // 1. Buscar usuários existentes
            const existingUsers = await this.fetchExistingUsers(deviceIp);
            const existingUserIds = new Set(existingUsers.map(u => u.userId));
            const existingUserMap = new Map(existingUsers.map(u => [u.userId, u]));
            
            stats.usersVerified += existingUsers.length;

            // 2. Deletar usuários que já existem
            const usersToDelete = userBatch.filter(u => existingUserIds.has(u.userId));
            if (usersToDelete.length > 0) {
                console.log(`   🗑️  Deletando ${usersToDelete.length} usuários existentes...`);
                
                for (const user of usersToDelete) {
                    const existingUser = existingUserMap.get(user.userId);
                    if (existingUser && existingUser.recNo) {
                        const result = await this.deleteUser(deviceIp, existingUser.recNo);
                        if (result.success) {
                            stats.usersDeleted++;
                        }
                        await new Promise(resolve => setTimeout(resolve, 200));
                    }
                }
                console.log(`   ✅ ${stats.usersDeleted} usuários deletados`);
            }

            // 3. Cadastrar usuários (SEM faces ainda)
            console.log(`   👤 Cadastrando ${userBatch.length} usuários...`);
            const userRegResult = await this.registerUsers(deviceIp, userBatch);
            if (!userRegResult.success) {
                // Retry se for erro 400 e ainda temos tentativas
                if (userRegResult.error.includes('HTTP 400') && retryCount < 2) {
                    console.log(`   🔄 Tentativa ${retryCount + 1} falhou, tentando novamente em 5s...`);
                    await new Promise(resolve => setTimeout(resolve, 5000));
                    return this.processBatch(deviceIp, userBatch, stats, retryCount + 1);
                }
                
                return {
                    success: false,
                    error: `Falha ao cadastrar usuários: ${userRegResult.error}`,
                    stats
                };
            }
            stats.usersRegistered += userRegResult.successCount || userBatch.length;
            console.log(`   ✅ ${userRegResult.successCount || userBatch.length} usuários cadastrados`);

            // 4. Aguardar estabilização
            console.log(`   ⏳ Aguardando estabilização (2s)...`);
            await new Promise(resolve => setTimeout(resolve, 2000));

            // 5. Cadastrar faces
            console.log(`   🎭 Cadastrando ${userBatch.length} faces...`);
            const faceRegResult = await this.registerFaces(deviceIp, userBatch);
            if (!faceRegResult.success) {
                // Retry se for erro 400 e ainda temos tentativas
                if (faceRegResult.error.includes('HTTP 400') && retryCount < 2) {
                    console.log(`   🔄 Tentativa ${retryCount + 1} falhou, tentando novamente em 5s...`);
                    await new Promise(resolve => setTimeout(resolve, 5000));
                    return this.processBatch(deviceIp, userBatch, stats, retryCount + 1);
                }
                
                return {
                    success: false,
                    error: `Falha ao cadastrar faces: ${faceRegResult.error}`,
                    stats
                };
            }
            stats.facesRegistered += faceRegResult.successCount || userBatch.length;
            console.log(`   ✅ ${faceRegResult.successCount || userBatch.length} faces cadastradas`);

            console.log(`   ✅ Lote completo registrado na leitora ${deviceIp}`);
            
            return {
                success: true,
                stats
            };

        } catch (error) {
            console.error(`❌ Erro ao processar lote em ${deviceIp}:`, error.message);
            return {
                success: false,
                error: error.message,
                stats
            };
        }
    }

    /**
     * Parse da resposta text/plain do recordFinder
     */
    parseRecordFinderResponse(responseText) {
        const users = [];
        const lines = responseText.split('\n');
        
        let recordIndex = 0;
        let currentRecord = {};
        
        for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine) continue;
            
            if (trimmedLine.startsWith('records[') && trimmedLine.includes(']=')) {
                // Nova linha de registro
                const match = trimmedLine.match(/records\[(\d+)\]\.(.+)=(.+)/);
                if (match) {
                    const [, index, field, value] = match;
                    const recordNum = parseInt(index);
                    
                    if (recordNum !== recordIndex) {
                        // Novo registro, salva o anterior
                        if (Object.keys(currentRecord).length > 0) {
                            users.push(currentRecord);
                        }
                        currentRecord = {};
                        recordIndex = recordNum;
                    }
                    
                    currentRecord[field] = value;
                }
            }
        }
        
        // Adiciona o último registro
        if (Object.keys(currentRecord).length > 0) {
            users.push(currentRecord);
        }
        
        return users.map(user => ({
            userId: user.UserID,
            recNo: user.RecNo,
            name: user.CardName
        }));
    }
}

module.exports = ApiClient;
