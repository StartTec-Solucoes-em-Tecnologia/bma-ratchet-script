# Facial Registration Script v2.0

Script completo para registrar usuários E faces de participantes e convidados em leitoras faciais biométricas com verificação de duplicatas e cache Redis.

## 🆕 Novidades da Versão 2.0

### Fluxo Completo Implementado

```
Para cada leitora facial:
  1. 🔍 Buscar todos usuários existentes (recordFinder.cgi)
  2. 📦 Para cada lote de 10 usuários:
     a. ✓ Verificar se usuário já existe
     b. 🗑️ Se existe: deletar usuário (recordUpdater.cgi)
     c. 👤 Cadastrar usuário (AccessUser.cgi)  
     d. 🎭 Cadastrar face biométrica (AccessFace.cgi)
     e. 💾 Salvar no Redis para tracking
```

## Funcionalidades

### ✨ Sistema Completo
- ✅ **Verificação de existência**: Busca todos usuários da leitora antes de cadastrar
- ✅ **Remoção inteligente**: Remove usuário existente evitando conflitos
- ✅ **Cadastro de usuário**: Registra UserID, Nome, Autoridade, Portas, Validade
- ✅ **Cadastro de face**: Registra biometria facial em base64
- ✅ **Cache Redis**: Salva IDs cadastrados por dispositivo (`device:{ip}:users`)
- ✅ **Tratamento de erros**: Individual por operação, não interrompe processo completo

### 📸 Processamento de Imagens
- Busca automaticamente invites de evento específico via Prisma
- Filtra participants E guests com `facial_image`
- Busca dados adicionais: document, email, cellphone
- Download de imagens faciais
- Processamento seguindo especificações:
  - Redimensiona para 500x500 pixels (recomendado)
  - Comprime para no máximo 100KB
  - Mantém proporção altura ≤ 2× largura
  - Conversão para JPEG
- Converte para base64

### 🔄 Integração Completa
- Processa múltiplas leitoras simultaneamente
- Batches de até 10 usuários (limite da API)
- Autenticação Digest HTTP
- Relatórios detalhados com estatísticas expandidas

## Requisitos

### Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto:

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

# Redis para cache (NOVO)
REDIS_URL="redis://localhost:6379"
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
- `redis` - Cache de usuários cadastrados (NOVO)
- `dotenv` - Variáveis de ambiente

## APIs Utilizadas

O script interage com as seguintes APIs da leitora:

| API | Método | Função | Versão |
|-----|--------|--------|--------|
| `/recordFinder.cgi?action=doSeekFind` | GET | Listar todos usuários | v2.0 |
| `/recordUpdater.cgi?action=remove` | GET | Deletar usuário por RecNo | v2.0 |
| `/AccessUser.cgi?action=insertMulti` | POST | Cadastrar usuários (max 10) | v2.0 |
| `/AccessFace.cgi?action=insertMulti` | POST | Cadastrar faces (max 10) | v1.0 |

### 1. Buscar Usuários Existentes

```http
GET /cgi-bin/recordFinder.cgi?action=doSeekFind&name=AccessControlCard&count=4300
```

**Resposta** (text/plain):
```
found=3
records[0].UserID=6
records[0].CardName=test
records[0].RecNo=2
records[1].UserID=7
records[1].CardName=test
records[1].RecNo=3
```

### 2. Deletar Usuário

```http
GET /cgi-bin/recordUpdater.cgi?action=remove&name=AccessControlCard&RecNo=2
```

### 3. Cadastrar Usuários

```http
POST /cgi-bin/AccessUser.cgi?action=insertMulti
Content-Type: application/json
```

**Body**:
```json
{
  "UserList": [
    {
      "UserID": "user-id-123",
      "UserName": "João da Silva",
      "UserType": 0,
      "Authority": 1,
      "Doors": [0],
      "TimeSections": [255],
      "ValidFrom": "2024-01-01 00:00:00",
      "ValidTo": "2037-12-31 23:59:59"
    }
  ]
}
```

**Campos**:
- `UserID`: ID único do usuário (string)
- `UserName`: Nome do usuário (max 50 caracteres)
- `UserType`: 0=General user, 2=Guest user
- `Authority`: 1=Admin, 2=Normal
- `Doors`: Array de portas com acesso
- `TimeSections`: Zonas de tempo de acesso (255=sempre)
- `ValidFrom/ValidTo`: Período de validade

### 4. Cadastrar Faces

```http
POST /cgi-bin/AccessFace.cgi?action=insertMulti
Content-Type: application/json
```

**Body**:
```json
{
  "FaceList": [
    {
      "UserID": "user-id-123",
      "PhotoData": ["base64-encoded-jpeg-image"]
    }
  ]
}
```

## Uso

### Executar o Script

```bash
# Usando npm script
npm run register-faces

# Ou diretamente com node
node src/facial-registration.js
```

### Fluxo de Execução Detalhado

```
1. Inicializar Redis
   └─ Conecta em redis://localhost:6379

2. Buscar dados do banco
   ├─ Consulta invites do evento
   ├─ Filtra com facial_image != null
   └─ Busca campos: id, name, document, email, cellphone

3. Processar imagens
   ├─ Download de cada imagem
   ├─ Redimensionar para 500x500px
   ├─ Comprimir até ≤ 100KB
   └─ Converter para base64

4. Para cada leitora facial:
   ├─ Buscar usuários existentes na leitora
   ├─ Para cada lote de 10 usuários:
   │  ├─ Verificar se usuário existe
   │  ├─ Se existe: deletar por RecNo
   │  ├─ Cadastrar usuário (AccessUser.cgi)
   │  ├─ Aguardar 1 segundo
   │  ├─ Cadastrar face (AccessFace.cgi)
   │  └─ Salvar no Redis (device:{ip}:users)
   └─ Aguardar 1 segundo antes da próxima leitora

5. Gerar relatório completo
   ├─ Usuários verificados
   ├─ Usuários deletados
   ├─ Usuários cadastrados
   ├─ Faces cadastradas
   └─ Saves no Redis

6. Encerrar conexões
   ├─ Prisma disconnect
   └─ Redis quit
```

## Relatório de Execução

O script v2.0 gera um relatório expandido:

```
═══════════════════════════════════════════
📊 RELATÓRIO FINAL COMPLETO
═══════════════════════════════════════════
👥 Total de usuários: 45
✅ Imagens processadas: 43
❌ Erros no processamento: 2
📡 Leitoras faciais: 3
📦 Lotes processados: 5

🔍 Operações Realizadas:
   👀 Usuários verificados: 120
   🗑️  Usuários deletados: 15
   👤 Usuários cadastrados: 129
   🎭 Faces cadastradas: 129
   💾 Saves no Redis: 129

📈 Resultados:
   ✅ Lotes bem-sucedidos: 15
   ❌ Lotes com erro: 0
═══════════════════════════════════════════

📋 DETALHES POR LEITORA:
✅ 10.1.35.87: 5/5 lotes OK
✅ 10.1.35.88: 5/5 lotes OK
✅ 10.1.35.89: 5/5 lotes OK
```

## Cache Redis

### Estrutura de Dados

Para cada dispositivo, mantém um Set de UserIDs cadastrados:

```
Key: device:10.1.35.87:users
Type: Set
Members: ["user-id-1", "user-id-2", "user-id-3", ...]
```

### Operações

```javascript
// Salvar usuário cadastrado
SADD device:10.1.35.87:users "user-id-123"

// Verificar se usuário está cadastrado
SISMEMBER device:10.1.35.87:users "user-id-123"

// Listar todos usuários de um dispositivo
SMEMBERS device:10.1.35.87:users

// Contar usuários cadastrados
SCARD device:10.1.35.87:users
```

### Benefícios

- ✅ Rastreamento de usuários por dispositivo
- ✅ Histórico de cadastros
- ✅ Sincronização futura facilitada
- ✅ Auditoria e debugging

## Estrutura do Banco de Dados

### Tabelas Consultadas

- `invite` - Convites do evento
- `participant` - Participantes (UserType: PARTICIPANT)
- `guest` - Convidados (UserType: GUEST)

### Campos Utilizados

**Participant**:
- `id` → UserID
- `name` → UserName
- `facial_image` → URL da foto
- `document` → Documento (opcional)
- `email` → Email (opcional)
- `cellphone` → Celular (opcional)

**Guest**:
- `id` → UserID
- `name` → UserName  
- `facial_image` → URL da foto
- `email` → Email (opcional)
- `cellphone` → Celular (opcional)

## Tratamento de Erros

### Por Operação

Cada operação tem tratamento individual:

1. **Erro ao buscar usuários existentes**
   - Continua sem verificação
   - Não deleta usuários
   - Log: ⚠️ warning

2. **Erro ao deletar usuário**
   - Continua para próximo
   - Pode causar erro no cadastro
   - Log: ❌ erro individual

3. **Erro ao cadastrar usuário**
   - Para lote atual
   - Não tenta cadastrar face
   - Log: ❌ erro de lote

4. **Erro ao cadastrar face**
   - Marca lote como falho
   - Usuário fica sem biometria
   - Log: ❌ erro de lote

5. **Erro no Redis**
   - Continua operação
   - Apenas não salva cache
   - Log: ⚠️ warning

### Erros Críticos

Interrompem o script:
- `EVENT_ID` não definido
- `FACE_READER_IPS` não definido
- Credenciais ausentes
- Erro de conexão com banco
- Nenhuma imagem processada

## Performance

### Tempos Estimados (50 usuários, 3 leitoras)

| Etapa | Tempo |
|-------|-------|
| Download imagens | ~75-150s |
| Processamento | ~25-50s |
| Buscar usuários (3× leitoras) | ~5-10s |
| Deletar usuários (15 usuários) | ~5-10s |
| Cadastrar usuários (5 lotes × 3) | ~15-30s |
| Cadastrar faces (5 lotes × 3) | ~15-30s |
| Saves no Redis | ~1-2s |
| **Total** | **~140-280s** (~3-5 min) |

### Otimizações

- ✅ Processamento de imagens em série (evita sobrecarga de memória)
- ✅ Pausas entre requisições (evita timeout)
- ✅ Batching de 10 usuários (máximo permitido)
- ✅ Cache Redis assíncrono
- ✅ Conexões reutilizadas (Digest Auth)

## Troubleshooting

### "Erro ao conectar ao Redis"
- Verifique se Redis está rodando: `redis-cli ping`
- Verifique REDIS_URL no .env
- Script continua sem Redis (apenas sem cache)

### "Erro ao buscar usuários existentes"
- Verifique conectividade: `ping {device_ip}`
- Verifique credenciais Digest
- Script continua sem deletar duplicatas

### "Erro ao cadastrar usuário"
- Verifique se UserID é válido (max 30 dígitos decimais)
- Verifique se UserName tem ≤ 50 caracteres
- Verifique datas de validade no formato correto

### "Erro ao cadastrar face"
- Verifique se usuário foi cadastrado primeiro
- Verifique tamanho da imagem base64 (≤ 100KB recomendado)
- Aguarde 1s entre cadastro de usuário e face

## Módulos Exportados

```javascript
const {
    registerAllFacesInAllDevices,      // Função principal
    fetchInvitesWithFacialImages,      // Busca dados do banco
    processImage,                       // Processa imagem
    registerUsersInDevice,              // Cadastra usuários
    registerFacesInDevice,              // Cadastra faces
    fetchExistingUsersFromDevice,       // Lista usuários
    deleteUserFromDevice,               // Deleta usuário
    saveToRedis                         // Salva no cache
} = require('./src/facial-registration');
```

## Comparação de Versões

| Recurso | v1.0 | v2.0 |
|---------|------|------|
| Cadastro de faces | ✅ | ✅ |
| Processamento de imagens | ✅ | ✅ |
| Cadastro de usuários | ❌ | ✅ |
| Verificação de duplicatas | ❌ | ✅ |
| Remoção automática | ❌ | ✅ |
| Cache Redis | ❌ | ✅ |
| Dados adicionais do banco | ❌ | ✅ |
| Relatório expandido | ❌ | ✅ |

## Segurança

- ✅ Credenciais via variáveis de ambiente
- ✅ Senhas não expostas em logs
- ✅ Autenticação Digest HTTP (mais segura que Basic)
- ✅ Conexão segura com banco via Prisma
- ✅ Validação de dados antes do envio
- ✅ Redis local (sem exposição externa recomendada)

## Próximos Passos

Após o registro bem-sucedido:

1. ✅ Verificar nas leitoras se os usuários foram cadastrados
2. ✅ Testar reconhecimento facial com alguns usuários
3. ✅ Configurar eventos para usar `credential_type = 'FACIAL'`
4. ✅ Monitorar Redis para verificar consistência
5. ✅ Implementar rotina de sincronização periódica
6. ✅ Configurar backup do Redis

## Suporte

Para dúvidas técnicas:
- 📖 [Quick Start](QUICK-START-FACIAL.md)
- 💻 [Código fonte](../src/facial-registration.js)
- 🧪 [Testes](../test/test-facial-registration.js)
- 📋 [Resumo de implementação](../IMPLEMENTATION-SUMMARY.md)

---

**Versão**: 2.0.0  
**Data**: Outubro 2025  
**Status**: ✅ Produção

