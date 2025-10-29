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

            const payload = {
                UserList: userBatch.map(user => ({
                    UserID: user.userId,
                    UserName: user.name.substring(0, 50),
                    UserType: 0,
                    Authority: 1,
                    Doors: [0],
                    TimeSections: [255],
                    ValidFrom: "2024-01-01 00:00:00",
                    ValidTo: "2037-12-31 23:59:59"
                }))
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

            return { success: response.data.trim() === 'OK' };
        } catch (error) {
            console.error(`❌ Erro ao cadastrar usuários em ${deviceIp}:`, error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Cadastra faces na leitora
     */
    async registerFaces(deviceIp, userBatch) {
        try {
            const url = `http://${deviceIp}/cgi-bin/AccessFace.cgi?action=insertMulti`;
            const axiosDigest = this.createDigestAuth();

            const payload = {
                FaceList: userBatch.map(user => ({
                    UserID: user.userId,
                    PhotoData: [user.photoBase64]
                }))
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

            return { success: response.data.trim() === 'OK' };
        } catch (error) {
            console.error(`❌ Erro ao cadastrar faces em ${deviceIp}:`, error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Processa lote completo: verificar -> deletar -> cadastrar usuário -> cadastrar face
     */
    async processBatch(deviceIp, userBatch, stats) {
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

            // 3. Cadastrar usuários
            const userRegResult = await this.registerUsers(deviceIp, userBatch);
            if (!userRegResult.success) {
                return {
                    success: false,
                    error: 'Falha ao cadastrar usuários',
                    stats
                };
            }
            stats.usersRegistered += userBatch.length;

            // Pequena pausa entre cadastro de usuário e face
            await new Promise(resolve => setTimeout(resolve, 1000));

            // 4. Cadastrar faces
            const faceRegResult = await this.registerFaces(deviceIp, userBatch);
            if (!faceRegResult.success) {
                return {
                    success: false,
                    error: 'Falha ao cadastrar faces',
                    stats
                };
            }
            stats.facesRegistered += userBatch.length;

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
