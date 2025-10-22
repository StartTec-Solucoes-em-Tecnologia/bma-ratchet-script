# Quick Start - Registro Facial

Guia rápido para registrar faces biométricas em leitoras faciais.

## Pré-requisitos

1. Node.js instalado
2. Banco de dados PostgreSQL com o schema configurado
3. Leitoras faciais acessíveis na rede
4. Imagens faciais cadastradas para participants/guests

## Passo a Passo

### 1. Instalar Dependências

```bash
npm install
```

Isso instalará:
- `sharp` - Processamento de imagens
- `axios` - Requisições HTTP
- `@mhoc/axios-digest-auth` - Autenticação Digest
- `@prisma/client` - Cliente do banco de dados

### 2. Configurar Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto:

```bash
# String de conexão PostgreSQL
DATABASE_URL="postgresql://usuario:senha@localhost:5432/nome_do_banco?schema=public"

# ID do evento para buscar participantes
EVENT_ID="seu-event-id-aqui"

# IPs das leitoras faciais (separados por vírgula)
FACE_READER_IPS="10.1.35.87,10.1.35.88,10.1.35.89"

# Credenciais para autenticação nas leitoras
DIGEST_USERNAME="admin"
DIGEST_PASSWORD="sua-senha-aqui"
```

### 3. Testar a Configuração

```bash
npm run test:faces
```

Este comando testa se:
- O módulo foi carregado corretamente
- As dependências estão instaladas
- A estrutura está funcionando

### 4. Executar o Registro

```bash
npm run register-faces
```

Ou diretamente:

```bash
node src/facial-registration.js
```

## O que o Script Faz

1. **Busca no banco de dados**
   - Conecta ao PostgreSQL via Prisma
   - Busca todos os invites do evento especificado
   - Filtra participantes e guests que têm `facial_image`

2. **Processa as imagens**
   - Faz download de cada imagem facial
   - Redimensiona para 500x500 pixels
   - Comprime para máximo 100KB
   - Converte para base64

3. **Envia para as leitoras**
   - Divide em lotes de 10 usuários (limite da API)
   - Envia para cada leitora facial configurada
   - Usa autenticação Digest HTTP
   - Exibe progresso em tempo real

4. **Gera relatório**
   - Total de usuários processados
   - Sucesso/erro por leitora
   - Estatísticas detalhadas

## Exemplo de Saída

```
🚀 Iniciando registro de faces...

🔍 Buscando invites com facial_image para evento abc123...
✅ Encontrados 45 usuários com facial_image

📸 Processando 45 imagens faciais...

🔄 João da Silva (PARTICIPANT)...
   📐 Imagem processada: 500x500, 87.23KB, qualidade 85
✅ João da Silva processado

📊 Processamento de imagens concluído:
   ✅ Sucesso: 43
   ❌ Erros: 2

📡 Enviando para 3 leitora(s) facial(is)...
   IPs: 10.1.35.87, 10.1.35.88, 10.1.35.89

📦 Total de lotes: 5 (máx 10 usuários por lote)

📦 Processando lote 1/5 (10 usuários)...
🔄 Registrando 10 faces na leitora 10.1.35.87...
✅ Lote registrado com sucesso na leitora 10.1.35.87! Status: 200

═══════════════════════════════════════════
📊 RELATÓRIO FINAL
═══════════════════════════════════════════
👥 Total de usuários: 45
✅ Imagens processadas: 43
❌ Erros no processamento: 2
📡 Leitoras faciais: 3
📦 Lotes enviados: 5
🔄 Total de operações: 15
✅ Envios bem-sucedidos: 15
❌ Envios com erro: 0
═══════════════════════════════════════════

📋 DETALHES POR LEITORA:
✅ 10.1.35.87: 5/5 lotes OK
✅ 10.1.35.88: 5/5 lotes OK
✅ 10.1.35.89: 5/5 lotes OK
```

## Especificações de Imagem

As imagens devem atender aos seguintes requisitos:

### Técnicas
- ✅ Resolução: 150×300 até 600×1200 pixels
- ✅ Recomendado: 500×500 pixels ou superior
- ✅ Tamanho máximo: 100KB
- ✅ Proporção: altura ≤ 2× largura
- ✅ Formato: JPEG

### Qualidade
- ✅ Rosto completamente visível
- ✅ Testa não coberta por cabelos
- ✅ Olhos abertos, olhando para câmera
- ✅ Sem óculos (preferencialmente)
- ✅ Sem chapéus ou ornamentos
- ✅ Fundo neutro ou branco
- ✅ Sem sombras
- ✅ Expressão neutra
- ✅ Padrão 3x4 (como documento)

## Solução de Problemas

### "Erro ao buscar invites"
```bash
# Verifique a conexão com o banco
psql $DATABASE_URL -c "SELECT 1"

# Verifique se o EVENT_ID existe
```

### "Nenhum usuário com facial_image encontrado"
```sql
-- Consulta SQL para verificar
SELECT COUNT(*)
FROM invite i
LEFT JOIN participant p ON i.participant_id = p.id
LEFT JOIN guest g ON i.guest_id = g.id
WHERE i.event_id = 'SEU_EVENT_ID'
  AND i.deleted_at IS NULL
  AND (p.facial_image IS NOT NULL OR g.facial_image IS NOT NULL);
```

### "Erro ao processar imagem"
- Verifique se as URLs das imagens são acessíveis
- Teste download manual: `curl -I {url_da_imagem}`
- Verifique formatos suportados (JPEG, PNG)

### "Erro ao registrar na leitora"
```bash
# Teste conectividade
ping 10.1.35.87

# Teste endpoint (com autenticação)
curl -u admin:senha --digest \
  http://10.1.35.87/cgi-bin/AccessFace.cgi?action=insertMulti
```

## Performance

### Tempos Estimados
- Download de imagem: ~1-2s cada
- Processamento: ~0.5-1s cada
- Upload para leitora: ~1-2s por lote

### Exemplo: 50 usuários, 3 leitoras
- Processamento de imagens: ~2-3 minutos
- Upload (5 lotes × 3 leitoras): ~1-2 minutos
- **Total**: ~3-5 minutos

## Comandos Úteis

```bash
# Testar estrutura
npm run test:faces

# Executar em produção
npm run register-faces

# Ver logs detalhados
node src/facial-registration.js 2>&1 | tee facial-registration.log

# Verificar último relatório
tail -100 facial-registration.log
```

## Próximos Passos

Após o registro bem-sucedido:

1. ✅ Verifique nas leitoras se os usuários foram cadastrados
2. ✅ Teste reconhecimento facial com alguns usuários
3. ✅ Configure os eventos para usar `credential_type = 'FACIAL'`
4. ✅ Monitore logs de acesso em produção

## Suporte

Para mais detalhes técnicos, consulte:
- 📖 [Documentação completa](FACIAL-REGISTRATION.md)
- 🧪 [Testes](../test/test-facial-registration.js)
- 💻 [Código fonte](../src/facial-registration.js)

