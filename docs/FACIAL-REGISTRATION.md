# Facial Registration Script

Script para registrar faces de participantes e convidados em leitoras faciais biométricas.

## Funcionalidades

- Busca automaticamente todos os convites (invites) de um evento específico
- Filtra participantes e convidados que possuem `facial_image` cadastrado
- Faz download das imagens faciais
- Processa as imagens seguindo as especificações das leitoras:
  - Redimensiona para 500x500 pixels (recomendado)
  - Comprime para no máximo 100KB
  - Mantém proporção altura/largura adequada
- Converte imagens para base64
- Envia para múltiplas leitoras faciais em lotes de até 10 usuários
- Utiliza autenticação Digest HTTP

## Requisitos

### Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto com as seguintes variáveis:

```bash
# Conexão com banco de dados
DATABASE_URL="postgresql://user:password@localhost:5432/database_name?schema=public"

# ID do evento
EVENT_ID="seu-event-id-aqui"

# Credenciais para autenticação Digest nas leitoras
DIGEST_USERNAME="admin"
DIGEST_PASSWORD="sua-senha-aqui"

# IPs das leitoras faciais (separados por vírgula)
FACE_READER_IPS="10.1.35.87,10.1.35.88,10.1.35.89"
```

### Dependências

```bash
npm install
```

O script utiliza:
- `sharp` - Processamento de imagens
- `axios` - Requisições HTTP
- `@mhoc/axios-digest-auth` - Autenticação Digest
- `@prisma/client` - Acesso ao banco de dados
- `dotenv` - Variáveis de ambiente

## Especificações de Imagem

As imagens faciais devem seguir as seguintes especificações para serem aceitas pelas leitoras:

### Requisitos Técnicos
- **Resolução mínima**: 150 × 300 pixels (L × A)
- **Resolução máxima**: 600 × 1200 pixels (L × A)
- **Resolução recomendada**: 500 × 500 pixels ou superior
- **Tamanho máximo**: 100KB
- **Proporção**: A altura não deve exceder 2x a largura
- **Formato**: JPEG

### Requisitos de Qualidade
- Rosto completamente visível
- Testa não coberta por cabelos
- Olhos abertos e olhando para a câmera
- Sem óculos (preferencialmente)
- Sem chapéus ou ornamentos faciais
- Enquadramento: da cabeça aos ombros
- Fundo neutro ou branco
- Sem sombras no rosto
- Expressão neutra e natural
- Padrão similar a foto 3x4 de documentos

## Uso

### Executar o Script

```bash
# Usando npm script
npm run register-faces

# Ou diretamente com node
node src/facial-registration.js
```

### Fluxo de Execução

1. **Conexão com banco de dados** via Prisma
2. **Busca de invites** do evento especificado em `EVENT_ID`
3. **Filtragem** de participantes e guests com `facial_image` não nulo
4. **Download de imagens** a partir das URLs armazenadas
5. **Processamento de imagens**:
   - Redimensionamento para 500x500px
   - Compressão para ≤ 100KB
   - Conversão para base64
6. **Divisão em lotes** de até 10 usuários (limite da API)
7. **Envio para leitoras** via POST com autenticação Digest
8. **Relatório final** com estatísticas de sucesso/erro

## API da Leitora Facial

### Endpoint
```
POST http://{device_ip}/cgi-bin/AccessFace.cgi?action=insertMulti
```

### Autenticação
- Tipo: HTTP Digest Auth
- Username: definido em `DIGEST_USERNAME`
- Password: definido em `DIGEST_PASSWORD`

### Payload
```json
{
  "FaceList": [
    {
      "UserID": "user-id-1",
      "PhotoData": ["base64-encoded-image-data"]
    },
    {
      "UserID": "user-id-2",
      "PhotoData": ["base64-encoded-image-data"]
    }
  ]
}
```

### Limitações
- **Máximo 10 usuários por requisição**
- Timeout: 30 segundos
- Content-Type: application/json

## Relatório de Execução

O script gera um relatório completo ao final:

```
═══════════════════════════════════════════
📊 RELATÓRIO FINAL
═══════════════════════════════════════════
👥 Total de usuários: 45
✅ Imagens processadas: 43
❌ Erros no processamento: 2
📡 Leitoras faciais: 3
📦 Lotes enviados: 5
🔄 Total de operações: 15
✅ Envios bem-sucedidos: 14
❌ Envios com erro: 1
═══════════════════════════════════════════

📋 DETALHES POR LEITORA:
✅ 10.1.35.87: 5/5 lotes OK
✅ 10.1.35.88: 5/5 lotes OK
⚠️  10.1.35.89: 4/5 lotes OK
```

## Estrutura do Banco de Dados

O script consulta as seguintes tabelas:

- `invite` - Convites do evento
- `participant` - Participantes com facial_image
- `guest` - Convidados com facial_image

### Campos Utilizados
- `invite.event_id` - Filtro por evento
- `invite.deleted_at` - Exclusão de convites deletados
- `participant.id` - ID do usuário
- `participant.name` - Nome do usuário
- `participant.facial_image` - URL da imagem facial
- `guest.id` - ID do convidado
- `guest.name` - Nome do convidado
- `guest.facial_image` - URL da imagem facial

## Tratamento de Erros

### Erros de Processamento de Imagem
- Download falhou
- Imagem corrompida
- Formato não suportado
- Não foi possível comprimir para ≤ 100KB

Ação: Usuário é pulado, erro é registrado no log

### Erros de Envio para Leitora
- Timeout de conexão
- Erro de autenticação
- Erro HTTP (4xx, 5xx)
- Leitora indisponível

Ação: Tentativa continua com próximas leitoras, erro é registrado

### Erros Críticos
- `EVENT_ID` não definido
- `FACE_READER_IPS` não definido
- Credenciais de autenticação ausentes
- Erro de conexão com banco de dados

Ação: Script é interrompido com código de saída 1

## Troubleshooting

### "Erro ao buscar invites"
- Verifique a conexão com o banco de dados
- Confirme que `DATABASE_URL` está correta
- Verifique se o Prisma Client foi gerado: `npx prisma generate`

### "Nenhum usuário com facial_image encontrado"
- Confirme que o `EVENT_ID` está correto
- Verifique se existem participantes/guests com `facial_image` preenchido
- Confirme que os invites não estão deletados (`deleted_at IS NULL`)

### "Erro ao processar imagem"
- Verifique se as URLs das imagens são acessíveis
- Confirme que as imagens são formatos válidos (JPEG, PNG)
- Verifique permissões de rede

### "Erro ao registrar na leitora"
- Confirme que os IPs das leitoras estão corretos
- Verifique credenciais de autenticação
- Teste conectividade: `ping {device_ip}`
- Confirme que o endpoint `/cgi-bin/AccessFace.cgi` está disponível

## Logs Detalhados

Durante a execução, o script exibe:

- 🔍 Busca de dados
- 🔄 Processamento em andamento
- ✅ Operações bem-sucedidas
- ❌ Erros encontrados
- 📸 Detalhes de processamento de imagem
- 📦 Progresso de lotes
- 📊 Estatísticas finais

## Performance

### Tempos Estimados
- Download de imagem: ~1-2s por imagem
- Processamento de imagem: ~0.5-1s por imagem
- Envio para leitora: ~1-2s por lote
- Pausa entre requisições: 1s

### Exemplo: 50 usuários, 3 leitoras
- Processamento de imagens: ~75-150s
- Envio (5 lotes × 3 leitoras): ~45-90s
- **Total estimado**: ~2-4 minutos

## Módulos Exportados

O script exporta funções para uso programático:

```javascript
const {
    registerAllFacesInAllDevices,
    fetchInvitesWithFacialImages,
    processImage,
    registerFacesInDevice
} = require('./src/facial-registration');
```

## Segurança

- Credenciais nunca são expostas em logs
- Autenticação Digest para comunicação com leitoras
- Dados base64 de imagens não são salvos em disco
- Conexão com banco via variável de ambiente

## Suporte

Para problemas ou dúvidas:
1. Verifique os logs de execução
2. Consulte a seção de Troubleshooting
3. Revise as configurações do `.env`
4. Confirme versões das dependências

