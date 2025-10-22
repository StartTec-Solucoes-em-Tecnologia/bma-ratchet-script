const axios = require('axios');
const sharp = require('sharp');
const AxiosDigestAuth = require('@mhoc/axios-digest-auth').default;
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

/**
 * Script para registrar faces de participantes e convidados em leitoras faciais
 * Processa imagens, redimensiona, comprime e envia para múltiplos dispositivos
 */

/**
 * Busca invites com facial_image do banco de dados
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
                        facial_image: true
                    }
                },
                guest: {
                    select: {
                        id: true,
                        name: true,
                        facial_image: true
                    }
                }
            }
        });

        // Processa e filtra os invites para extrair os dados necessários
        const processedUsers = invites
            .map(invite => {
                if (invite.participant && invite.participant.facial_image) {
                    return {
                        userId: invite.participant.id,
                        name: invite.participant.name || 'Sem nome',
                        facialImageUrl: invite.participant.facial_image,
                        type: 'PARTICIPANT',
                        inviteId: invite.id
                    };
                } else if (invite.guest && invite.guest.facial_image) {
                    return {
                        userId: invite.guest.id,
                        name: invite.guest.name || 'Sem nome',
                        facialImageUrl: invite.guest.facial_image,
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
 * Registra um lote de usuários (máximo 10) em uma leitora facial
 */
async function registerFacesInDevice(deviceIp, userBatch) {
    try {
        console.log(`🔄 Registrando ${userBatch.length} faces na leitora ${deviceIp}...`);

        const url = `http://${deviceIp}/cgi-bin/AccessFace.cgi?action=insertMulti`;
        
        const username = process.env.DIGEST_USERNAME;
        const password = process.env.DIGEST_PASSWORD;

        if (!username || !password) {
            throw new Error('DIGEST_USERNAME e DIGEST_PASSWORD devem estar definidos no .env');
        }

        // Monta o payload com a lista de faces
        const payload = {
            FaceList: userBatch.map(user => ({
                UserID: user.userId,
                PhotoData: [user.photoBase64]
            }))
        };

        // Configuração de autenticação digest
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
                'User-Agent': 'BMA-Facial-Registration/1.0.0'
            },
            data: JSON.stringify(payload),
            timeout: 30000
        });

        console.log(`✅ Lote registrado com sucesso na leitora ${deviceIp}! Status: ${response.status}`);
        
        return {
            deviceIp,
            userBatch,
            success: true,
            status: response.status,
            response: response.data
        };

    } catch (error) {
        console.error(`❌ Erro ao registrar lote na leitora ${deviceIp}:`, error.message);
        
        if (error.response) {
            console.error(`   Status HTTP: ${error.response.status}`);
            console.error(`   Resposta: ${JSON.stringify(error.response.data)}`);
        }

        return {
            deviceIp,
            userBatch,
            success: false,
            error: error.message
        };
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
 * Processo principal: busca usuários, processa imagens e registra em todas as leitoras
 */
async function registerAllFacesInAllDevices() {
    try {
        console.log('🚀 Iniciando registro de faces...\n');

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
        
        console.log(`📡 Enviando para ${ipArray.length} leitora(s) facial(is)...`);
        console.log(`   IPs: ${ipArray.join(', ')}\n`);

        // Divide usuários em lotes de 10 (limite da API)
        const batches = chunkArray(processedUsers, 10);
        console.log(`📦 Total de lotes: ${batches.length} (máx 10 usuários por lote)\n`);

        const results = [];
        let totalOperations = 0;
        let successCount = 0;
        let failureCount = 0;

        // Processa cada lote em cada leitora
        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
            const batch = batches[batchIndex];
            console.log(`\n📦 Processando lote ${batchIndex + 1}/${batches.length} (${batch.length} usuários)...`);
            
            for (const deviceIp of ipArray) {
                totalOperations++;
                
                const result = await registerFacesInDevice(deviceIp, batch);
                results.push(result);
                
                if (result.success) {
                    successCount++;
                } else {
                    failureCount++;
                }

                // Pequena pausa entre requisições
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        // Relatório final
        console.log('\n\n═══════════════════════════════════════════');
        console.log('📊 RELATÓRIO FINAL');
        console.log('═══════════════════════════════════════════');
        console.log(`👥 Total de usuários: ${users.length}`);
        console.log(`✅ Imagens processadas: ${processedCount}`);
        console.log(`❌ Erros no processamento: ${errorCount}`);
        console.log(`📡 Leitoras faciais: ${ipArray.length}`);
        console.log(`📦 Lotes enviados: ${batches.length}`);
        console.log(`🔄 Total de operações: ${totalOperations}`);
        console.log(`✅ Envios bem-sucedidos: ${successCount}`);
        console.log(`❌ Envios com erro: ${failureCount}`);
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

        await prisma.$disconnect();

        return {
            success: failureCount === 0,
            totalUsers: users.length,
            processedImages: processedCount,
            processingErrors: errorCount,
            devices: ipArray.length,
            batches: batches.length,
            totalOperations,
            successCount,
            failureCount,
            results
        };

    } catch (error) {
        console.error('💥 Erro geral no processamento:', error.message);
        await prisma.$disconnect();
        return {
            success: false,
            error: error.message
        };
    }
}

// Executa o script se for chamado diretamente
if (require.main === module) {
    console.log('🎭 BMA Facial Registration Script v1.0.0\n');
    
    registerAllFacesInAllDevices()
        .then(result => {
            if (result.success) {
                console.log('\n🎉 Registro de faces concluído com sucesso!');
                process.exit(0);
            } else {
                console.log('\n⚠️  Registro de faces concluído com erros');
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
    registerFacesInDevice
};

