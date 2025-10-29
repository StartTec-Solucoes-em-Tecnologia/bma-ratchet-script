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
     * Cadastra usuários na leitora
     */
    async registerUsers(deviceIp, userBatch) {
        try {
            const url = `http://${deviceIp}/cgi-bin/AccessUser.cgi?action=insertMulti`;
            const axiosDigest = this.createDigestAuth();

            // Valida dados antes de enviar
            const validatedUsers = userBatch.map(user => {
                const userName = user.formattedName || user.name || 'Usuario';
                const cleanUserName = userName.substring(0, 50).replace(/[^\w\s]/g, ''); // Remove caracteres especiais
                
                return {
                    UserID: String(user.userId || '0'),
                    UserName: cleanUserName || 'Usuario',
                    UserType: 0,
                    Authority: 1,
                    Doors: [0],
                    TimeSections: [255],
                    ValidFrom: "2024-01-01 00:00:00",
                    ValidTo: "2037-12-31 23:59:59"
                };
            });

            const payload = {
                UserList: validatedUsers
            };

            console.log(`   📤 Enviando ${userBatch.length} usuários para ${deviceIp}...`);
            console.log(`   📝 Nomes: ${userBatch.map(u => u.formattedName || u.name).join(', ')}`);

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
                console.warn(`⚠️  Resposta inesperada do dispositivo ${deviceIp}: "${responseText}"`);
            } else {
                console.log(`   ✅ Usuários cadastrados com sucesso em ${deviceIp}`);
            }

            return { success: isSuccess, response: responseText };
        } catch (error) {
            let errorDetails = error.message;
            
            if (error.response) {
                // Erro HTTP com resposta
                const status = error.response.status;
                const statusText = error.response.statusText;
                const responseData = error.response.data;
                
                console.error(`❌ Erro HTTP ${status} (${statusText}) ao cadastrar usuários em ${deviceIp}`);
                console.error(`   📄 Resposta: ${JSON.stringify(responseData)}`);
                console.error(`   📤 Payload enviado: ${JSON.stringify(payload, null, 2)}`);
                
                errorDetails = `HTTP ${status}: ${statusText} - ${JSON.stringify(responseData)}`;
            } else if (error.request) {
                // Erro de rede
                console.error(`❌ Erro de rede ao cadastrar usuários em ${deviceIp}:`, error.message);
                errorDetails = `Erro de rede: ${error.message}`;
            } else {
                // Outros erros
                console.error(`❌ Erro ao cadastrar usuários em ${deviceIp}:`, error.message);
                errorDetails = error.message;
            }
            
            return { success: false, error: errorDetails };
        }
    }

    /**
     * Cadastra faces na leitora
     */
    async registerFaces(deviceIp, userBatch) {
        try {
            const url = `http://${deviceIp}/cgi-bin/AccessFace.cgi?action=insertMulti`;
            const axiosDigest = this.createDigestAuth();

            // Valida dados antes de enviar
            const validatedFaces = userBatch.map(user => {
                if (!user.photoBase64) {
                    console.warn(`⚠️  Usuário ${user.userId} sem dados de foto`);
                    return null;
                }
                
                return {
                    UserID: String(user.userId || '0'),
                    PhotoData: [user.photoBase64]
                };
            }).filter(face => face !== null);

            if (validatedFaces.length === 0) {
                console.warn(`⚠️  Nenhuma face válida para cadastrar em ${deviceIp}`);
                return { success: false, error: 'Nenhuma face válida' };
            }

            const payload = {
                FaceList: validatedFaces
            };

            console.log(`   🎭 Enviando ${userBatch.length} faces para ${deviceIp}...`);

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
                console.warn(`⚠️  Resposta inesperada do dispositivo ${deviceIp} (faces): "${responseText}"`);
            } else {
                console.log(`   ✅ Faces cadastradas com sucesso em ${deviceIp}`);
            }

            return { success: isSuccess, response: responseText };
        } catch (error) {
            let errorDetails = error.message;
            
            if (error.response) {
                // Erro HTTP com resposta
                const status = error.response.status;
                const statusText = error.response.statusText;
                const responseData = error.response.data;
                
                console.error(`❌ Erro HTTP ${status} (${statusText}) ao cadastrar faces em ${deviceIp}`);
                console.error(`   📄 Resposta: ${JSON.stringify(responseData)}`);
                console.error(`   📤 Payload enviado: ${JSON.stringify(payload, null, 2)}`);
                
                errorDetails = `HTTP ${status}: ${statusText} - ${JSON.stringify(responseData)}`;
            } else if (error.request) {
                // Erro de rede
                console.error(`❌ Erro de rede ao cadastrar faces em ${deviceIp}:`, error.message);
                errorDetails = `Erro de rede: ${error.message}`;
            } else {
                // Outros erros
                console.error(`❌ Erro ao cadastrar faces em ${deviceIp}:`, error.message);
                errorDetails = error.message;
            }
            
            return { success: false, error: errorDetails };
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
            stats.usersRegistered += userBatch.length;
            console.log(`   ✅ ${userBatch.length} usuários cadastrados`);

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
            stats.facesRegistered += userBatch.length;
            console.log(`   ✅ ${userBatch.length} faces cadastradas`);

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
