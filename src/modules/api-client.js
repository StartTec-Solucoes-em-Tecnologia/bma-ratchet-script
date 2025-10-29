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
     * Cadastra um único usuário na leitora
     */
    async registerSingleUser(deviceIp, user) {
        try {
            const url = `http://${deviceIp}/cgi-bin/AccessUser.cgi?action=insertMulti`;
            const axiosDigest = this.createDigestAuth();

            // Valida dados do usuário
            const userName = user.formattedName || user.name || 'Usuario';
            const cleanUserName = userName.substring(0, 50).replace(/[^\w\s]/g, '').trim();
            
            const validatedUser = {
                UserID: String(user.userId || Date.now()),
                UserName: cleanUserName || 'Usuario',
                UserType: 0,
                Authority: 1,
                Doors: [0],
                TimeSections: [255],
                ValidFrom: "2024-01-01 00:00:00",
                ValidTo: "2037-12-31 23:59:59"
            };

            const payload = {
                UserList: [validatedUser]
            };

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
                console.warn(`⚠️  Falha ao cadastrar usuário ${user.userId}: "${responseText}"`);
            }

            return { 
                success: isSuccess, 
                response: responseText, 
                userId: user.userId,
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
     * Cadastra usuários individualmente com multithread
     */
    async registerUsers(deviceIp, userBatch) {
        console.log(`   📤 Cadastrando ${userBatch.length} usuários individualmente em ${deviceIp}...`);
        
        const results = {
            success: 0,
            failed: 0,
            errors: []
        };

        // Processa em lotes de 3 usuários simultâneos para não sobrecarregar
        const batchSize = 3;
        const batches = [];
        for (let i = 0; i < userBatch.length; i += batchSize) {
            batches.push(userBatch.slice(i, i + batchSize));
        }

        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
            const batch = batches[batchIndex];
            console.log(`   🔄 Processando lote ${batchIndex + 1}/${batches.length} (${batch.length} usuários)...`);

            // Processa usuários em paralelo
            const promises = batch.map(async (user, userIndex) => {
                const globalIndex = batchIndex * batchSize + userIndex + 1;
                console.log(`     👤 ${globalIndex}/${userBatch.length} - ${user.formattedName || user.name}...`);
                
                const result = await this.registerSingleUser(deviceIp, user);
                
                if (result.success) {
                    results.success++;
                    console.log(`     ✅ ${globalIndex}/${userBatch.length} - ${result.userName} cadastrado`);
                } else {
                    results.failed++;
                    results.errors.push({
                        userId: result.userId,
                        error: result.error
                    });
                    console.log(`     ❌ ${globalIndex}/${userBatch.length} - ${user.formattedName || user.name} falhou`);
                }
                
                // Pequena pausa entre usuários para não sobrecarregar
                await new Promise(resolve => setTimeout(resolve, 200));
                
                return result;
            });

            // Aguarda todos os usuários do lote
            await Promise.all(promises);
            
            // Pausa entre lotes
            if (batchIndex < batches.length - 1) {
                console.log(`   ⏳ Pausa entre lotes (1s)...`);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        console.log(`   📊 Resultado: ${results.success} sucessos, ${results.failed} falhas`);
        
        if (results.errors.length > 0) {
            console.log(`   ❌ Erros encontrados:`);
            results.errors.forEach(error => {
                console.log(`     - UserID ${error.userId}: ${error.error}`);
            });
        }

        return { 
            success: results.failed === 0, 
            successCount: results.success,
            failedCount: results.failed,
            errors: results.errors
        };
    }

    /**
     * Cadastra uma única face na leitora
     */
    async registerSingleFace(deviceIp, user) {
        try {
            const url = `http://${deviceIp}/cgi-bin/AccessFace.cgi?action=insertMulti`;
            const axiosDigest = this.createDigestAuth();

            if (!user.photoBase64) {
                console.warn(`⚠️  Usuário ${user.userId} sem dados de foto`);
                return { success: false, error: 'Sem dados de foto', userId: user.userId };
            }

            const payload = {
                FaceList: [{
                    UserID: String(user.userId),
                    PhotoData: [user.photoBase64]
                }]
            };

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
                errorDetails = `HTTP ${status}: ${statusText} - ${JSON.stringify(responseData)}`;
            }
            
            console.error(`❌ Erro ao cadastrar face do usuário ${user.userId} em ${deviceIp}:`, errorDetails);
            return { success: false, error: errorDetails, userId: user.userId };
        }
    }

    /**
     * Cadastra faces individualmente com multithread
     */
    async registerFaces(deviceIp, userBatch) {
        console.log(`   🎭 Cadastrando ${userBatch.length} faces individualmente em ${deviceIp}...`);
        
        const results = {
            success: 0,
            failed: 0,
            errors: []
        };

        // Processa em lotes de 2 faces simultâneas (mais pesado que usuários)
        const batchSize = 2;
        const batches = [];
        for (let i = 0; i < userBatch.length; i += batchSize) {
            batches.push(userBatch.slice(i, i + batchSize));
        }

        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
            const batch = batches[batchIndex];
            console.log(`   🔄 Processando lote ${batchIndex + 1}/${batches.length} (${batch.length} faces)...`);

            // Processa faces em paralelo
            const promises = batch.map(async (user, userIndex) => {
                const globalIndex = batchIndex * batchSize + userIndex + 1;
                console.log(`     🎭 ${globalIndex}/${userBatch.length} - ${user.formattedName || user.name}...`);
                
                const result = await this.registerSingleFace(deviceIp, user);
                
                if (result.success) {
                    results.success++;
                    console.log(`     ✅ ${globalIndex}/${userBatch.length} - face cadastrada`);
                } else {
                    results.failed++;
                    results.errors.push({
                        userId: result.userId,
                        error: result.error
                    });
                    console.log(`     ❌ ${globalIndex}/${userBatch.length} - face falhou`);
                }
                
                // Pausa maior entre faces (mais pesado)
                await new Promise(resolve => setTimeout(resolve, 500));
                
                return result;
            });

            // Aguarda todas as faces do lote
            await Promise.all(promises);
            
            // Pausa entre lotes
            if (batchIndex < batches.length - 1) {
                console.log(`   ⏳ Pausa entre lotes (2s)...`);
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        console.log(`   📊 Resultado: ${results.success} sucessos, ${results.failed} falhas`);
        
        if (results.errors.length > 0) {
            console.log(`   ❌ Erros encontrados:`);
            results.errors.forEach(error => {
                console.log(`     - UserID ${error.userId}: ${error.error}`);
            });
        }

        return { 
            success: results.failed === 0, 
            successCount: results.success,
            failedCount: results.failed,
            errors: results.errors
        };
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
