const express = require('express');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const app = express();
const prisma = new PrismaClient();

// Middleware para raw body (necessário para multipart/mixed)
app.use(express.raw({ type: '*/*', limit: '10mb' }));

/**
 * Servidor Express para receber eventos de checkin dos leitores faciais Intelbras
 * 
 * O leitor envia dados via multipart/mixed com:
 * - Parte 1 (info): JSON com dados do evento incluindo UserID
 * - Parte 2 (image): Imagem JPEG da captura facial
 */

/**
 * Parse multipart/mixed body
 * Extrai o JSON da parte "info" do payload
 */
function parseMultipartMixed(body, boundary) {
    try {
        const bodyStr = body.toString('utf-8');
        const parts = bodyStr.split(`--${boundary}`);
        
        for (const part of parts) {
            // Procura pela parte que contém name="info"
            if (part.includes('Content-Disposition: form-data; name="info"')) {
                // Encontra o início do JSON (primeiro '{')
                const jsonStart = part.indexOf('{');
                if (jsonStart !== -1) {
                    // Extrai o JSON
                    let jsonStr = part.substring(jsonStart).trim();
                    
                    // Remove quebras de linha extras e espaços
                    jsonStr = jsonStr.replace(/\r\n$/, '').replace(/\n$/, '');
                    
                    // Parse do JSON
                    const info = JSON.parse(jsonStr);
                    return info;
                }
            }
        }
        
        return null;
    } catch (error) {
        console.error('❌ Erro ao fazer parse do multipart/mixed:', error.message);
        return null;
    }
}

/**
 * Extrai o UserID do payload Intelbras
 */
function extractUserIdFromInfo(info) {
    try {
        if (!info || !info.Events || !Array.isArray(info.Events)) {
            return null;
        }
        
        const firstEvent = info.Events[0];
        if (!firstEvent || !firstEvent.Data) {
            return null;
        }
        
        return firstEvent.Data.UserID || null;
    } catch (error) {
        console.error('❌ Erro ao extrair UserID:', error.message);
        return null;
    }
}

/**
 * Handler para OPTIONS (CORS preflight)
 */
app.options('/api/open/checkin/intelbras-reader/', (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    res.sendStatus(200);
});

/**
 * Rota principal de checkin Intelbras
 * POST /api/open/checkin/intelbras-reader/
 * 
 * Recebe dados multipart/mixed do leitor facial e atualiza scannedAt do convite
 * SEMPRE retorna sucesso (200) mesmo em caso de erro
 */
app.post('/api/open/checkin/intelbras-reader/', async (req, res) => {
    const startTime = Date.now();
    
    // Headers CORS
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    
    try {
        console.log('\n📥 Recebido evento de checkin Intelbras');
        
        // Validar Content-Type
        const contentType = req.headers['content-type'] || '';
        if (!contentType.includes('multipart/mixed')) {
            console.warn('⚠️  Content-Type não é multipart/mixed:', contentType);
            // Ainda assim retorna sucesso
            return res.status(200).json({ success: true });
        }
        
        // Extrair boundary
        const boundaryMatch = contentType.match(/boundary=([^;]+)/);
        if (!boundaryMatch) {
            console.warn('⚠️  Boundary não encontrado no Content-Type');
            return res.status(200).json({ success: true });
        }
        
        const boundary = boundaryMatch[1].replace(/['"]/g, ''); // Remove aspas se houver
        console.log(`🔍 Boundary extraído: ${boundary}`);
        
        // Parse multipart/mixed
        const info = parseMultipartMixed(req.body, boundary);
        if (!info) {
            console.warn('⚠️  Não foi possível extrair info do payload');
            return res.status(200).json({ success: true });
        }
        
        console.log('📋 Info extraído:', JSON.stringify(info, null, 2));
        
        // Extrair UserID
        const userId = extractUserIdFromInfo(info);
        if (!userId) {
            console.warn('⚠️  UserID não encontrado no payload');
            return res.status(200).json({ success: true });
        }
        
        console.log(`🆔 UserID extraído: ${userId}`);
        
        // Buscar convite no banco
        const invite = await prisma.invite.findFirst({
            where: {
                id: userId,
                deleted_at: null
            },
            include: {
                participant: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                },
                guest: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                },
                event: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            }
        });
        
        if (!invite) {
            console.warn(`⚠️  Convite não encontrado: ${userId}`);
            return res.status(200).json({ success: true });
        }
        
        console.log(`✅ Convite encontrado: ${invite.id}`);
        
        // Extrair dados adicionais do evento Intelbras
        const eventData = info.Events?.[0]?.Data || {};
        const cardName = eventData.CardName || 'Desconhecido';
        const similarity = eventData.Similarity || 0;
        const status = eventData.Status;
        
        console.log(`👤 CardName: ${cardName}`);
        console.log(`🎯 Similarity: ${similarity}%`);
        console.log(`📊 Status: ${status}`);
        
        // Atualizar scannedAt
        const now = new Date();
        await prisma.invite.update({
            where: {
                id: invite.id
            },
            data: {
                scanned_at: now
            }
        });
        
        const processingTime = Date.now() - startTime;
        console.log(`✅ scannedAt atualizado para ${now.toISOString()}`);
        console.log(`⏱️  Tempo de processamento: ${processingTime}ms`);
        
        // Informações do usuário
        const userName = invite.participant?.name || invite.guest?.name || 'Sem nome';
        const userType = invite.participant ? 'PARTICIPANT' : 'GUEST';
        
        console.log(`👥 Usuário: ${userName} (${userType})`);
        console.log(`🎪 Evento: ${invite.event?.name || 'Desconhecido'}`);
        console.log('─'.repeat(60));
        
        // Retornar sucesso com dados
        return res.status(200).json({
            success: true,
            data: {
                inviteId: invite.id,
                scannedAt: now,
                userName,
                eventName: invite.event?.name,
                similarity,
                processingTime: `${processingTime}ms`
            }
        });
        
    } catch (error) {
        // Log do erro mas sempre retorna sucesso
        console.error('❌ Erro ao processar checkin:', error.message);
        console.error(error.stack);
        
        // SEMPRE retorna sucesso para evitar retry loops no dispositivo
        return res.status(200).json({ success: true });
    }
});

/**
 * Rota de health check
 */
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        service: 'intelbras-checkin-server',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

/**
 * Rota raiz
 */
app.get('/', (req, res) => {
    res.status(200).json({
        service: 'BMA Intelbras Checkin Server',
        version: '1.0.0',
        endpoints: {
            checkin: 'POST /api/open/checkin/intelbras-reader/',
            health: 'GET /health'
        }
    });
});

/**
 * Handler de erros global
 */
app.use((err, req, res, next) => {
    console.error('❌ Erro não tratado:', err);
    res.status(200).json({ success: true }); // Sempre retorna sucesso
});

/**
 * Inicializa o servidor
 */
const PORT = process.env.CHECKIN_SERVER_PORT || 3001;

const server = app.listen(PORT, () => {
    console.log('═══════════════════════════════════════════');
    console.log('🚀 BMA Intelbras Checkin Server');
    console.log('═══════════════════════════════════════════');
    console.log(`📡 Servidor rodando na porta ${PORT}`);
    console.log(`🌐 Endpoint: http://localhost:${PORT}/api/open/checkin/intelbras-reader/`);
    console.log(`❤️  Health check: http://localhost:${PORT}/health`);
    console.log('═══════════════════════════════════════════');
    console.log('Aguardando eventos dos leitores faciais...\n');
});

/**
 * Graceful shutdown
 */
process.on('SIGTERM', async () => {
    console.log('\n🛑 Recebido SIGTERM, encerrando servidor...');
    
    server.close(async () => {
        console.log('✅ Servidor HTTP encerrado');
        
        await prisma.$disconnect();
        console.log('✅ Prisma desconectado');
        
        process.exit(0);
    });
});

process.on('SIGINT', async () => {
    console.log('\n🛑 Recebido SIGINT, encerrando servidor...');
    
    server.close(async () => {
        console.log('✅ Servidor HTTP encerrado');
        
        await prisma.$disconnect();
        console.log('✅ Prisma desconectado');
        
        process.exit(0);
    });
});

module.exports = app;

