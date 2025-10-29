const axios = require('axios');
const sharp = require('sharp');
const AxiosDigestAuth = require('@mhoc/axios-digest-auth').default;
const { PrismaClient } = require('@prisma/client');
const redis = require('redis');
const { Queue, Worker } = require('bullmq');
const IORedis = require('ioredis');
require('dotenv').config();

const prisma = new PrismaClient();

// Inicializa cliente Redis
let redisClient = null;
let ioredisClient = null;
let queues = new Map(); // Map para armazenar filas por dispositivo

/**
 * Script para registrar usuários e faces de participantes/convidados em leitoras faciais
 * Fluxo: Verificar existência -> Deletar se existe -> Cadastrar usuário -> Cadastrar face -> Salvar no Redis
 */

/**
 * Inicializa conexão com Redis
 */
async function initRedis() {
    try {
        const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
        redisClient = redis.createClient({ url: redisUrl });
        
        redisClient.on('error', (err) => console.error('❌ Redis Error:', err));
        
        await redisClient.connect();
        console.log('✅ Conectado ao Redis\n');
        
        return redisClient;
    } catch (error) {
        console.warn('⚠️  Redis não disponível, continuando sem cache:', error.message);
        return null;
    }
}

/**
 * Inicializa cliente IORedis para BullMQ
 */
async function initIORedis() {
    try {
        const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
        ioredisClient = new IORedis(redisUrl, {
            maxRetriesPerRequest: 3,
            retryDelayOnFailover: 100,
        });
        
        ioredisClient.on('error', (err) => console.error('❌ IORedis Error:', err));
        
        console.log('✅ Conectado ao IORedis para BullMQ\n');
        return ioredisClient;
    } catch (error) {
        console.warn('⚠️  IORedis não disponível, continuando sem filas:', error.message);
        return null;
    }
}

/**
 * Separa nome completo em nome e sobrenome
 */
function splitName(fullName) {
    if (!fullName || typeof fullName !== 'string') {
        return { firstName: 'Usuario', lastName: 'Sem Nome' };
    }
    
    const nameParts = fullName.trim().split(/\s+/);
    
    if (nameParts.length === 1) {
        return { firstName: nameParts[0], lastName: 'Sem Sobrenome' };
    }
    
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ');
    
    return { firstName, lastName };
}

/**
 * Cria fila BullMQ para um dispositivo específico
 */
function createQueueForDevice(deviceIp) {
    if (!ioredisClient) {
        console.warn(`⚠️  IORedis não disponível, pulando fila para ${deviceIp}`);
        return null;
    }
    
    const queueName = `facial-registration-${deviceIp.replace(/\./g, '-')}`;
    
    if (queues.has(deviceIp)) {
        return queues.get(deviceIp);
    }
    
    const queue = new Queue(queueName, {
        connection: ioredisClient,
        defaultJobOptions: {
            removeOnComplete: 10, // Manter apenas 10 jobs completos
            removeOnFail: 5,      // Manter apenas 5 jobs falhados
            attempts: 3,          // Tentar 3 vezes em caso de falha
            backoff: {
                type: 'exponential',
                delay: 2000,
            },
        },
    });
    
    queues.set(deviceIp, queue);
    console.log(`📋 Fila criada para dispositivo ${deviceIp}: ${queueName}`);
    
    return queue;
}

/**
 * Adiciona job à fila de um dispositivo
 */
async function addJobToQueue(deviceIp, jobData) {
    const queue = createQueueForDevice(deviceIp);
    if (!queue) {
        console.warn(`⚠️  Não foi possível criar fila para ${deviceIp}, processando síncrono`);
        return null;
    }
    
    try {
        const job = await queue.add('process-user', jobData, {
            priority: jobData.priority || 0,
            delay: jobData.delay || 0,
        });
        
        console.log(`📝 Job adicionado à fila ${deviceIp}: ${job.id}`);
        return job;
    } catch (error) {
        console.error(`❌ Erro ao adicionar job à fila ${deviceIp}:`, error.message);
        return null;
    }
}

/**
 * Busca invites com facial_image do banco de dados (com dados adicionais)
 */
async function fetchInvitesWithFacialImages() {
    try {
        const eventId = process.env.EVENT_ID;
        
        if (!eventId) {
            throw new Error('Variável de ambiente EVENT_ID não está definida');
        }

        console.log(`🔍 Buscando invites com facial_image para evento ${eventId}...`);

        // Busca invites do evento com participantes ou guests que tenham facial_image
        const invites = await prisma.invite.findMany({
            where: {
                event_id: eventId,
                deleted_at: null,
                OR: [
                    {
                        participant: {
                            facial_image: {
                                not: null
                            }
                        }
                    },
                    {
                        guest: {
                            facial_image: {
                                not: null
                            }
                        }
                    }
                ]
            },
            include: {
                participant: {
                    select: {
                        id: true,
                        name: true,
                        facial_image: true,
                        document: true,
                        email: true,
                        cellphone: true
                    }
                },
                guest: {
                    select: {
                        id: true,
                        name: true,
                        facial_image: true,
                        cellphone: true,
                        email: true
                    }
                }
            }
        });

        // Processa e filtra os invites para extrair os dados necessários
        const processedUsers = invites
            .map(invite => {
                if (invite.participant && invite.participant.facial_image) {
                    return {
                        userId: invite.id,
                        name: invite.participant.name || 'Sem nome',
                        facialImageUrl: invite.participant.facial_image,
                        document: invite.participant.document || '',
                        email: invite.participant.email || '',
                        cellphone: invite.participant.cellphone || '',
                        type: 'PARTICIPANT',
                        inviteId: invite.id
                    };
                } else if (invite.guest && invite.guest.facial_image) {
                    return {
                        userId: invite.id,
                        name: invite.guest.name || 'Sem nome',
                        facialImageUrl: invite.guest.facial_image,
                        document: '',
                        email: invite.guest.email || '',
                        cellphone: invite.guest.cellphone || '',
                        type: 'GUEST',
                        inviteId: invite.id
                    };
                }
                return null;
            })
            .filter(user => user !== null);

        console.log(`✅ Encontrados ${processedUsers.length} usuários com facial_image`);
        
        return processedUsers;

    } catch (error) {
        console.error('❌ Erro ao buscar invites:', error.message);
        throw error;
    }
}

/**
 * Parser para resposta text/plain do recordFinder
 * Formato: records[0].UserID=6
 */
function parseRecordFinderResponse(textResponse) {
    const users = [];
    const lines = textResponse.split('\n');
    const userMap = new Map();

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // Extrai índice do record e campo
        const match = trimmed.match(/records\[(\d+)\]\.(\w+)=(.+)/);
        if (match) {
            const index = match[1];
            const field = match[2];
            const value = match[3];

            if (!userMap.has(index)) {
                userMap.set(index, {});
            }

            userMap.get(index)[field] = value;
        }
    }

    // Converte map para array
    for (const [, userData] of userMap) {
        if (userData.UserID) {
            users.push({
                userId: userData.UserID,
                recNo: userData.RecNo,
                cardName: userData.CardName || ''
            });
        }
    }

    return users;
}

/**
 * Busca todos os usuários cadastrados em uma leitora
 */
async function fetchExistingUsersFromDevice(deviceIp) {
    try {
        console.log(`   🔍 Buscando usuários existentes na leitora ${deviceIp}...`);

        const url = `http://${deviceIp}/cgi-bin/recordFinder.cgi?action=doSeekFind&name=AccessControlCard&count=4300`;
        
        const username = process.env.DIGEST_USERNAME;
        const password = process.env.DIGEST_PASSWORD;

        const axiosDigest = new AxiosDigestAuth({
            username,
            password
        });

        const response = await axiosDigest.request({
            method: 'GET',
            url,
            timeout: 30000
        });

        const users = parseRecordFinderResponse(response.data);
        console.log(`   ✅ Encontrados ${users.length} usuários na leitora`);

        return users;

    } catch (error) {
        console.error(`   ⚠️  Erro ao buscar usuários existentes: ${error.message}`);
        return [];
    }
}

/**
 * Deleta um usuário da leitora
 */
async function deleteUserFromDevice(deviceIp, recNo) {
    try {
        const url = `http://${deviceIp}/cgi-bin/recordUpdater.cgi?action=remove&name=AccessControlCard&RecNo=${recNo}`;
        
        const username = process.env.DIGEST_USERNAME;
        const password = process.env.DIGEST_PASSWORD;

        const axiosDigest = new AxiosDigestAuth({
            username,
            password
        });

        await axiosDigest.request({
            method: 'GET',
            url,
            timeout: 10000
        });

        return { success: true };

    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Cadastra um lote de usuários (máximo 10) na leitora
 */
async function registerUsersInDevice(deviceIp, userBatch) {
    try {
        console.log(`   👤 Cadastrando ${userBatch.length} usuários na leitora ${deviceIp}...`);

        const url = `http://${deviceIp}/cgi-bin/AccessUser.cgi?action=insertMulti`;
        
        const username = process.env.DIGEST_USERNAME;
        const password = process.env.DIGEST_PASSWORD;

        // Monta o payload com a lista de usuários (nome e sobrenome separados)
        const payload = {
            UserList: userBatch.map(user => {
                const { firstName, lastName } = splitName(user.name);
                
                return {
                    UserID: user.userId,
                    UserName: `${firstName} ${lastName}`.substring(0, 50), // Nome completo limitado a 50 caracteres
                    FirstName: firstName.substring(0, 25), // Nome limitado a 25 caracteres
                    LastName: lastName.substring(0, 25),   // Sobrenome limitado a 25 caracteres
                    UserType: 0, // 0: General user
                    Authority: 1, // 1: Administrador
                    Doors: [0],
                    TimeSections: [255],
                    ValidFrom: "2024-01-01 00:00:00",
                    ValidTo: "2037-12-31 23:59:59"
                };
            })
        };

        const axiosDigest = new AxiosDigestAuth({
            username,
            password
        });

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

        console.log(`   ✅ Usuários cadastrados com sucesso! Status: ${response.status}`);
        
        return {
            success: true,
            status: response.status,
            response: response.data
        };

    } catch (error) {
        console.error(`   ❌ Erro ao cadastrar usuários: ${error.message}`);
        
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Baixa uma imagem da URL e retorna o buffer
 */
async function downloadImage(url) {
    try {
        const response = await axios.get(url, {
            responseType: 'arraybuffer',
            timeout: 30000
        });
        return Buffer.from(response.data);
    } catch (error) {
        throw new Error(`Erro ao baixar imagem: ${error.message}`);
    }
}

/**
 * Processa imagem: redimensiona e comprime seguindo especificações
 * - Resolução alvo: 500x500 pixels (recomendado)
 * - Tamanho máximo: 100KB
 * - Altura não deve exceder 2x a largura
 */
async function processImage(imageBuffer) {
    try {
        // Obtém metadados da imagem original
        const metadata = await sharp(imageBuffer).metadata();
        
        // Define dimensões alvo (500x500 é recomendado e está dentro dos limites)
        let targetWidth = 500;
        let targetHeight = 500;
        
        // Ajusta proporções se necessário (altura não pode exceder 2x largura)
        if (metadata.height && metadata.width) {
            const aspectRatio = metadata.height / metadata.width;
            if (aspectRatio > 2) {
                // Se a imagem é muito alta, ajusta
                targetHeight = targetWidth * 2;
            }
        }

        // Primeira tentativa: qualidade 85
        let quality = 85;
        let processedImage = await sharp(imageBuffer)
            .resize(targetWidth, targetHeight, {
                fit: 'cover',
                position: 'center'
            })
            .jpeg({ quality })
            .toBuffer();

        // Se ainda estiver acima de 100KB, reduz a qualidade iterativamente
        while (processedImage.length > 100 * 1024 && quality > 40) {
            quality -= 10;
            processedImage = await sharp(imageBuffer)
                .resize(targetWidth, targetHeight, {
                    fit: 'cover',
                    position: 'center'
                })
                .jpeg({ quality })
                .toBuffer();
        }

        // Se ainda estiver grande, reduz as dimensões
        if (processedImage.length > 100 * 1024) {
            targetWidth = 400;
            targetHeight = 400;
            quality = 70;
            
            processedImage = await sharp(imageBuffer)
                .resize(targetWidth, targetHeight, {
                    fit: 'cover',
                    position: 'center'
                })
                .jpeg({ quality })
                .toBuffer();
        }

        const sizeInKB = (processedImage.length / 1024).toFixed(2);
        console.log(`   📐 Imagem processada: ${targetWidth}x${targetHeight}, ${sizeInKB}KB, qualidade ${quality}`);

        return processedImage;

    } catch (error) {
        throw new Error(`Erro ao processar imagem: ${error.message}`);
    }
}

/**
 * Converte buffer de imagem para base64
 */
function imageToBase64(imageBuffer) {
    return imageBuffer.toString('base64');
}

/**
 * Registra um lote de faces (máximo 10) em uma leitora facial
 */
async function registerFacesInDevice(deviceIp, userBatch) {
    try {
        console.log(`   🎭 Registrando ${userBatch.length} faces na leitora ${deviceIp}...`);

        const url = `http://${deviceIp}/cgi-bin/AccessFace.cgi?action=insertMulti`;
        
        const username = process.env.DIGEST_USERNAME;
        const password = process.env.DIGEST_PASSWORD;

        // Monta o payload com a lista de faces
        const payload = {
            FaceList: userBatch.map(user => ({
                UserID: user.userId,
                PhotoData: [user.photoBase64]
            }))
        };

        const axiosDigest = new AxiosDigestAuth({
            username,
            password
        });

        // Faz a requisição HTTP POST
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

        console.log(`   ✅ Faces registradas com sucesso! Status: ${response.status}`);
        
        return {
            success: true,
            status: response.status,
            response: response.data
        };

    } catch (error) {
        console.error(`   ❌ Erro ao registrar faces: ${error.message}`);
        
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Salva usuário cadastrado no Redis
 */
async function saveToRedis(deviceIp, userId) {
    if (!redisClient) return { success: false, message: 'Redis não disponível' };
    
    try {
        const key = `device:${deviceIp}:users`;
        await redisClient.sAdd(key, userId);
        return { success: true };
    } catch (error) {
        console.error(`   ⚠️  Erro ao salvar no Redis: ${error.message}`);
        return { success: false, error: error.message };
    }
}

/**
 * Divide array em lotes de tamanho especificado
 */
function chunkArray(array, chunkSize) {
    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
        chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
}

/**
 * Processa um job individual da fila
 */
async function processUserJob(job) {
    const { deviceIp, user, existingUsers, stats } = job.data;
    
    try {
        console.log(`🔄 Processando job ${job.id} para ${user.name} na leitora ${deviceIp}...`);
        
        const existingUserIds = new Set(existingUsers.map(u => u.userId));
        const existingUserMap = new Map(existingUsers.map(u => [u.userId, u]));
        
        // 1. Deletar se usuário já existe
        if (existingUserIds.has(user.userId)) {
            const existingUser = existingUserMap.get(user.userId);
            if (existingUser && existingUser.recNo) {
                const deleteResult = await deleteUserFromDevice(deviceIp, existingUser.recNo);
                if (deleteResult.success) {
                    stats.usersDeleted++;
                    console.log(`   🗑️  Usuário ${user.name} deletado`);
                }
            }
        }
        
        // 2. Cadastrar usuário
        const userRegResult = await registerUsersInDevice(deviceIp, [user]);
        if (!userRegResult.success) {
            throw new Error(`Falha ao cadastrar usuário: ${userRegResult.error}`);
        }
        stats.usersRegistered++;
        
        // 3. Aguardar um pouco
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // 4. Cadastrar face
        const faceRegResult = await registerFacesInDevice(deviceIp, [user]);
        if (!faceRegResult.success) {
            throw new Error(`Falha ao cadastrar face: ${faceRegResult.error}`);
        }
        stats.facesRegistered++;
        
        // 5. Salvar no Redis
        const redisResult = await saveToRedis(deviceIp, user.userId);
        if (redisResult.success) {
            stats.redisSaves++;
        }
        
        console.log(`   ✅ Job ${job.id} concluído para ${user.name}`);
        
        return { success: true, stats };
        
    } catch (error) {
        console.error(`   ❌ Erro no job ${job.id}:`, error.message);
        throw error;
    }
}

/**
 * Cria worker para processar jobs de um dispositivo
 */
function createWorkerForDevice(deviceIp) {
    if (!ioredisClient) {
        console.warn(`⚠️  IORedis não disponível, pulando worker para ${deviceIp}`);
        return null;
    }
    
    const queueName = `facial-registration-${deviceIp.replace(/\./g, '-')}`;
    
    const worker = new Worker(queueName, processUserJob, {
        connection: ioredisClient,
        concurrency: 2, // Processar até 2 jobs simultaneamente por dispositivo
    });
    
    worker.on('completed', (job) => {
        console.log(`✅ Job ${job.id} concluído na fila ${deviceIp}`);
    });
    
    worker.on('failed', (job, err) => {
        console.error(`❌ Job ${job.id} falhou na fila ${deviceIp}:`, err.message);
    });
    
    worker.on('error', (err) => {
        console.error(`❌ Erro no worker ${deviceIp}:`, err.message);
    });
    
    console.log(`👷 Worker criado para dispositivo ${deviceIp}`);
    return worker;
}

/**
 * Processo completo para um dispositivo usando filas BullMQ
 */
async function processDeviceWithQueue(deviceIp, userBatch, stats) {
    console.log(`\n🖥️  Processando leitora ${deviceIp} com filas BullMQ...`);
    
    // 1. Buscar usuários existentes
    const existingUsers = await fetchExistingUsersFromDevice(deviceIp);
    stats.usersVerified += existingUsers.length;
    
    // 2. Criar worker para o dispositivo
    const worker = createWorkerForDevice(deviceIp);
    if (!worker) {
        console.warn(`⚠️  Não foi possível criar worker para ${deviceIp}, processando síncrono`);
        return await processDeviceComplete(deviceIp, userBatch, stats);
    }
    
    // 3. Adicionar jobs à fila
    const jobs = [];
    for (const user of userBatch) {
        const jobData = {
            deviceIp,
            user,
            existingUsers,
            stats,
            priority: 0,
            delay: 0
        };
        
        const job = await addJobToQueue(deviceIp, jobData);
        if (job) {
            jobs.push(job);
        }
    }
    
    console.log(`📝 ${jobs.length} jobs adicionados à fila ${deviceIp}`);
    
    // 4. Aguardar conclusão de todos os jobs
    const results = await Promise.allSettled(
        jobs.map(job => job.waitUntilFinished())
    );
    
    // 5. Processar resultados
    let successCount = 0;
    let errorCount = 0;
    
    results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
            successCount++;
        } else {
            errorCount++;
            console.error(`❌ Job ${jobs[index].id} falhou:`, result.reason);
        }
    });
    
    console.log(`📊 Fila ${deviceIp}: ${successCount} sucessos, ${errorCount} erros`);
    
    // 6. Fechar worker
    await worker.close();
    
    return {
        success: errorCount === 0,
        stats,
        successCount,
        errorCount
    };
}

/**
 * Processo completo para um dispositivo: verificar -> deletar -> cadastrar usuário -> cadastrar face -> redis
 */
async function processDeviceComplete(deviceIp, userBatch, stats) {
    console.log(`\n🖥️  Processando leitora ${deviceIp}...`);
    
    // 1. Buscar usuários existentes
    const existingUsers = await fetchExistingUsersFromDevice(deviceIp);
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
                const result = await deleteUserFromDevice(deviceIp, existingUser.recNo);
                if (result.success) {
                    stats.usersDeleted++;
                }
                await new Promise(resolve => setTimeout(resolve, 200)); // Pausa curta
            }
        }
        console.log(`   ✅ ${stats.usersDeleted} usuários deletados`);
    }

    // 3. Cadastrar usuários
    const userRegResult = await registerUsersInDevice(deviceIp, userBatch);
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
    const faceRegResult = await registerFacesInDevice(deviceIp, userBatch);
    if (!faceRegResult.success) {
        return {
            success: false,
            error: 'Falha ao cadastrar faces',
            stats
        };
    }
    stats.facesRegistered += userBatch.length;

    // 5. Salvar no Redis
    for (const user of userBatch) {
        const redisResult = await saveToRedis(deviceIp, user.userId);
        if (redisResult.success) {
            stats.redisSaves++;
        }
    }

    console.log(`   ✅ Lote completo registrado na leitora ${deviceIp}`);
    
    return {
        success: true,
        stats
    };
}

/**
 * Processo principal: busca usuários, processa imagens e registra em todas as leitoras
 */
async function registerAllFacesInAllDevices() {
    try {
        console.log('🚀 BMA Facial Registration Script v2.0.0');
        console.log('   Sistema Completo: Usuário + Face + Redis\n');

        // Inicializa Redis
        await initRedis();

        // Verifica variáveis de ambiente
        const deviceIps = process.env.FACE_READER_IPS;
        
        if (!deviceIps) {
            throw new Error('Variável de ambiente FACE_READER_IPS não está definida');
        }

        // Busca usuários com facial_image
        const users = await fetchInvitesWithFacialImages();

        if (users.length === 0) {
            console.log('⚠️  Nenhum usuário com facial_image encontrado');
            return {
                success: true,
                message: 'Nenhum usuário para processar'
            };
        }

        console.log(`\n📸 Processando ${users.length} imagens faciais...\n`);

        // Processa imagens de todos os usuários
        const processedUsers = [];
        let processedCount = 0;
        let errorCount = 0;

        for (const user of users) {
            try {
                console.log(`🔄 ${user.name} (${user.type})...`);
                
                // Download da imagem
                const imageBuffer = await downloadImage(user.facialImageUrl);
                
                // Processa imagem (redimensiona e comprime)
                const processedImage = await processImage(imageBuffer);
                
                // Converte para base64
                const photoBase64 = imageToBase64(processedImage);
                
                processedUsers.push({
                    ...user,
                    photoBase64
                });
                
                processedCount++;
                console.log(`✅ ${user.name} processado\n`);

            } catch (error) {
                errorCount++;
                console.error(`❌ Erro ao processar ${user.name}: ${error.message}\n`);
            }
        }

        console.log(`\n📊 Processamento de imagens concluído:`);
        console.log(`   ✅ Sucesso: ${processedCount}`);
        console.log(`   ❌ Erros: ${errorCount}\n`);

        if (processedUsers.length === 0) {
            throw new Error('Nenhuma imagem foi processada com sucesso');
        }

        // Converte string de IPs em array
        const ipArray = deviceIps.split(',').map(ip => ip.trim());
        
        console.log(`📡 Registrando em ${ipArray.length} leitora(s) facial(is)...`);
        console.log(`   IPs: ${ipArray.join(', ')}\n`);

        // Divide usuários em lotes de 10 (limite da API)
        const batches = chunkArray(processedUsers, 10);
        console.log(`📦 Total de lotes: ${batches.length} (máx 10 usuários por lote)\n`);

        // Estatísticas globais
        const globalStats = {
            usersVerified: 0,
            usersDeleted: 0,
            usersRegistered: 0,
            facesRegistered: 0,
            redisSaves: 0,
            successfulBatches: 0,
            failedBatches: 0
        };

        const results = [];

        // Inicializa IORedis para BullMQ
        await initIORedis();
        
        // Processa cada lote em cada leitora usando filas BullMQ
        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
            const batch = batches[batchIndex];
            console.log(`\n═══════════════════════════════════════════`);
            console.log(`📦 Lote ${batchIndex + 1}/${batches.length} (${batch.length} usuários) - BULLMQ`);
            console.log(`═══════════════════════════════════════════`);
            
            for (const deviceIp of ipArray) {
                const batchStats = {
                    usersVerified: 0,
                    usersDeleted: 0,
                    usersRegistered: 0,
                    facesRegistered: 0,
                    redisSaves: 0
                };

                // Usa filas BullMQ se disponível, senão processa síncrono
                const result = ioredisClient 
                    ? await processDeviceWithQueue(deviceIp, batch, batchStats)
                    : await processDeviceComplete(deviceIp, batch, batchStats);
                
                // Atualiza estatísticas globais
                globalStats.usersVerified += batchStats.usersVerified;
                globalStats.usersDeleted += batchStats.usersDeleted;
                globalStats.usersRegistered += batchStats.usersRegistered;
                globalStats.facesRegistered += batchStats.facesRegistered;
                globalStats.redisSaves += batchStats.redisSaves;
                
                if (result.success) {
                    globalStats.successfulBatches++;
                } else {
                    globalStats.failedBatches++;
                }

                results.push({
                    deviceIp,
                    batch: batchIndex + 1,
                    success: result.success,
                    stats: batchStats,
                    successCount: result.successCount || 0,
                    errorCount: result.errorCount || 0
                });

                // Pausa entre dispositivos
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        // Relatório final
        console.log('\n\n═══════════════════════════════════════════');
        console.log('📊 RELATÓRIO FINAL COMPLETO - BULLMQ v2.1');
        console.log('═══════════════════════════════════════════');
        console.log(`👥 Total de usuários: ${users.length}`);
        console.log(`✅ Imagens processadas: ${processedCount}`);
        console.log(`❌ Erros no processamento: ${errorCount}`);
        console.log(`📡 Leitoras faciais: ${ipArray.length}`);
        console.log(`📦 Lotes processados: ${batches.length}`);
        console.log(`🔄 Processamento: ${ioredisClient ? 'BullMQ (Assíncrono)' : 'Síncrono'}`);
        console.log(`\n🔍 Operações Realizadas:`);
        console.log(`   👀 Usuários verificados: ${globalStats.usersVerified}`);
        console.log(`   🗑️  Usuários deletados: ${globalStats.usersDeleted}`);
        console.log(`   👤 Usuários cadastrados: ${globalStats.usersRegistered}`);
        console.log(`   🎭 Faces cadastradas: ${globalStats.facesRegistered}`);
        console.log(`   💾 Saves no Redis: ${globalStats.redisSaves}`);
        console.log(`\n📈 Resultados:`);
        console.log(`   ✅ Lotes bem-sucedidos: ${globalStats.successfulBatches}`);
        console.log(`   ❌ Lotes com erro: ${globalStats.failedBatches}`);
        
        // Estatísticas das filas BullMQ
        if (ioredisClient) {
            const totalSuccess = results.reduce((sum, r) => sum + (r.successCount || 0), 0);
            const totalErrors = results.reduce((sum, r) => sum + (r.errorCount || 0), 0);
            console.log(`\n🔄 Estatísticas BullMQ:`);
            console.log(`   📝 Jobs processados: ${totalSuccess + totalErrors}`);
            console.log(`   ✅ Jobs bem-sucedidos: ${totalSuccess}`);
            console.log(`   ❌ Jobs com erro: ${totalErrors}`);
        }
        
        console.log('═══════════════════════════════════════════\n');

        // Detalhes por leitora
        console.log('📋 DETALHES POR LEITORA:');
        ipArray.forEach(ip => {
            const deviceResults = results.filter(r => r.deviceIp === ip);
            const deviceSuccess = deviceResults.filter(r => r.success).length;
            const deviceFailure = deviceResults.filter(r => !r.success).length;
            const status = deviceFailure === 0 ? '✅' : '⚠️';
            
            console.log(`${status} ${ip}: ${deviceSuccess}/${deviceResults.length} lotes OK`);
        });

        // Fecha conexões
        await prisma.$disconnect();
        if (redisClient) {
            await redisClient.quit();
            console.log('\n✅ Conexão Redis encerrada');
        }
        if (ioredisClient) {
            await ioredisClient.quit();
            console.log('✅ Conexão IORedis encerrada');
        }

        return {
            success: globalStats.failedBatches === 0,
            totalUsers: users.length,
            processedImages: processedCount,
            processingErrors: errorCount,
            devices: ipArray.length,
            batches: batches.length,
            stats: globalStats,
            results
        };

    } catch (error) {
        console.error('💥 Erro geral no processamento:', error.message);
        await prisma.$disconnect();
        if (redisClient) {
            await redisClient.quit();
        }
        return {
            success: false,
            error: error.message
        };
    }
}

// Executa o script se for chamado diretamente
if (require.main === module) {
    registerAllFacesInAllDevices()
        .then(result => {
            if (result.success) {
                console.log('\n🎉 Registro completo concluído com sucesso!');
                process.exit(0);
            } else {
                console.log('\n⚠️  Registro concluído com erros');
                process.exit(1);
            }
        })
        .catch(error => {
            console.error('💥 Erro inesperado:', error);
            process.exit(1);
        });
}

module.exports = {
    registerAllFacesInAllDevices,
    fetchInvitesWithFacialImages,
    processImage,
    registerFacesInDevice,
    registerUsersInDevice,
    fetchExistingUsersFromDevice,
    deleteUserFromDevice,
    saveToRedis
};
