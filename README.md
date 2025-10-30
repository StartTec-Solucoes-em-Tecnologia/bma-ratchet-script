# BMA Ratchet Script

Script para cadastrar múltiplas catracas via API, registrar usuários nas catracas e registrar faces biométricas em leitoras faciais com sistema completo de verificação, cache Redis e testes automatizados.

## 🆕 Novidades

### Versão 2.0 - Registro Facial Completo
O sistema de registro facial foi completamente atualizado com:
- ✅ **Verificação automática** de usuários existentes
- ✅ **Remoção inteligente** antes do cadastro (evita duplicatas)
- ✅ **Cadastro de usuário** + **Cadastro de face** em sequência
- ✅ **Cache Redis** para rastreamento de registros
- ✅ **Cache de imagens** para otimizar downloads
- ✅ **Relatórios expandidos** com estatísticas detalhadas

### 🖼️ Sistema de Cache de Imagens (NOVO!)
Sistema inteligente para gerenciar imagens faciais:
- ✅ **Cache local** de imagens baixadas
- ✅ **Verificação automática** antes de download
- ✅ **Download otimizado** apenas de imagens novas
- ✅ **Metadados completos** de cada imagem
- ✅ **Comandos de gerenciamento** do cache

### 🌐 Servidor de Checkin Intelbras (NOVO!)
Servidor Express para receber eventos de checkin dos leitores faciais:
- ✅ **Escuta eventos HTTP** dos leitores Intelbras
- ✅ **Parse automático** de payloads multipart/mixed
- ✅ **Atualização de scanned_at** no banco de dados
- ✅ **Sempre retorna sucesso** (evita retry loops)
- ✅ **Logs detalhados** de cada checkin

## 📁 Estrutura do Projeto

```
bma-ratchet-script/
├── src/                       # Código fonte principal
│   ├── index.js              # Script principal de registro de catracas
│   ├── facial-registration.js # Script de registro de faces biométricas v2.0
│   └── checkin-server.js     # Servidor de checkin Intelbras (NOVO)
├── test/                     # Scripts de teste
│   ├── test-simple.js        # Testes simples (recomendado)
│   └── test.js               # Testes com servidor mock
├── docs/                     # Documentação
│   ├── README.md             # Documentação original
│   ├── TEST-README.md        # Documentação dos testes
│   ├── USER-REGISTRATION.md  # Documentação de registro de usuários
│   ├── FACIAL-REGISTRATION-V2.md # Documentação de registro facial v2.0
│   └── CHECKIN-SERVER.md     # Documentação do servidor de checkin (NOVO)
├── package.json              # Configurações do projeto
└── README.md                 # Este arquivo
```

## 🚀 Como Usar

### Instalação
```bash
npm install
```

### Execução

#### Scripts
```bash
# Configuração de catracas (modo padrão)
npm start

# Registro de usuários em catracas
npm run register-users

# Registro de faces biométricas em leitoras faciais
npm run register-faces
```

#### Servidor de Checkin (NOVO)
```bash
# Iniciar servidor de checkin (produção)
npm run checkin-server

# Iniciar servidor com auto-reload (desenvolvimento)
npm run checkin-server:dev

# O servidor ficará escutando em http://localhost:3001
# Endpoint: POST /api/open/checkin/intelbras-reader/
```

### Testes
```bash
# Testes simples (recomendado)
npm test

# Testes de registro de usuários
npm run test:users

# Testes de registro facial
npm run test:faces

# Testes de autenticação digest
npm run test:digest

# Testes com servidor mock
npm run test:mock

# Testes em modo watch
npm run test:watch
```

## 📋 Configuração

### Para Configuração de Catracas
1. Copie o arquivo `.env.example` para `.env`: `cp .env.example .env`
2. Configure os IPs das catracas na variável `DEVICE_IPS`
3. Execute `npm start`

### Para Registro de Usuários
1. Copie o arquivo `.env.example` para `.env`: `cp .env.example .env`
2. Configure as variáveis:
   - `DEVICE_IPS`: IPs das catracas separados por vírgula
   - `BASE_URL`: URL base da API para buscar participantes
   - `EVENT_ID`: ID do evento para buscar participantes
   - `DIGEST_USERNAME`: Username para autenticação digest HTTP (opcional)
   - `DIGEST_PASSWORD`: Password para autenticação digest HTTP (opcional)
3. Execute `npm run register-users`

Para mais detalhes, consulte `docs/USER-REGISTRATION.md`.

### Para Registro de Faces Biométricas (v2.0)
1. Copie o arquivo `.env.example` para `.env`: `cp .env.example .env`
2. Configure as variáveis:
   - `DATABASE_URL`: String de conexão PostgreSQL
   - `EVENT_ID`: ID do evento para buscar participantes
   - `FACE_READER_IPS`: IPs das leitoras faciais separados por vírgula
   - `DIGEST_USERNAME`: Username para autenticação digest HTTP
   - `DIGEST_PASSWORD`: Password para autenticação digest HTTP
   - `REDIS_URL`: URL do Redis (ex: redis://localhost:6379) **[NOVO]**
3. Certifique-se que o Redis está rodando: `redis-server`
4. Execute `npm run register-faces`

**Novo em v2.0**: O script agora cadastra o usuário ANTES da face, verifica duplicatas e salva no Redis.

Para mais detalhes, consulte `docs/FACIAL-REGISTRATION-V2.md`.

### Para Servidor de Checkin Intelbras (NOVO)
1. Copie o arquivo `.env.example` para `.env`: `cp .env.example .env`
2. Configure as variáveis:
   - `DATABASE_URL`: String de conexão PostgreSQL
   - `CHECKIN_SERVER_PORT`: Porta do servidor (padrão: 3001)
3. Execute `npm run checkin-server`
4. Configure o leitor Intelbras para enviar eventos para:
   - URL: `http://seu-servidor:3001/api/open/checkin/intelbras-reader/`

**Funcionalidade**: O servidor recebe eventos HTTP dos leitores faciais e atualiza automaticamente o campo `scanned_at` dos convites no banco de dados.

Para mais detalhes, consulte `docs/CHECKIN-SERVER.md`.

## 🔐 Autenticação Digest HTTP

O script suporta autenticação digest HTTP para as requisições às catracas. Para habilitar:

1. Configure as variáveis de ambiente `DIGEST_USERNAME` e `DIGEST_PASSWORD` no arquivo `.env`
2. Se essas variáveis estiverem definidas, o script automaticamente incluirá autenticação digest nas requisições
3. Se não estiverem definidas, as requisições serão feitas sem autenticação

**Exemplo de configuração:**
```env
DIGEST_USERNAME=admin
DIGEST_PASSWORD=senha123
```

## 📄 Arquivo de Configuração

O projeto inclui um arquivo `.env.example` com todas as variáveis de ambiente necessárias:

```bash
# Copie o arquivo de exemplo
cp .env.example .env

# Edite as configurações conforme necessário
nano .env
```

**Variáveis disponíveis:**
- `DATABASE_URL`: String de conexão PostgreSQL (registro facial e checkin server)
- `BASE_URL`: URL base da API (para registro de usuários)
- `EVENT_ID`: ID do evento
- `DEVICE_IPS`: IPs das catracas (separados por vírgula)
- `FACE_READER_IPS`: IPs das leitoras faciais (separados por vírgula)
- `REDIS_URL`: URL do Redis para cache (ex: redis://localhost:6379) **[NOVO v2.0]**
- `CHECKIN_SERVER_PORT`: Porta do servidor de checkin (padrão: 3001) **[NOVO]**
- `DIGEST_USERNAME`: Username para autenticação digest (opcional)
- `DIGEST_PASSWORD`: Password para autenticação digest (opcional)

## 🧪 Sistema de Testes

O projeto inclui um sistema completo de testes que valida:
- ✅ Validação de entrada
- ✅ Parsing de IPs
- ✅ Erro de conexão
- ✅ Timeout de requisição
- ✅ Estrutura de retorno
- ✅ Múltiplas catracas

Para mais detalhes sobre os testes, consulte `docs/TEST-README.md`.

## 📚 Documentação

- **Documentação Principal**: `docs/README.md`
- **Documentação dos Testes**: `docs/TEST-README.md`
- **Registro de Usuários**: `docs/USER-REGISTRATION.md`
- **Registro de Faces v2.0 (Completo)**: `docs/FACIAL-REGISTRATION-V2.md` ⭐ **Recomendado**
- **Cadastro Incremental (Apenas Novos)**: `docs/INCREMENTAL-REGISTRATION.md` 🆕 **Otimizado**
- **Sistema de Cache de Imagens**: `docs/IMAGE-CACHE-SYSTEM.md`
- **Servidor de Checkin Intelbras**: `docs/CHECKIN-SERVER.md`
- **Registro de Faces v1.0**: `docs/FACIAL-REGISTRATION.md`

## 🔧 Scripts Disponíveis

### Produção
- `npm start` - Configuração de catracas (modo padrão)
- `npm run register-users` - Registro de usuários em catracas
- `npm run register-faces-v2` - Registro facial completo (paralelo) ⭐ **Recomendado**
- `npm run register-faces-individual` - Registro facial completo (sequencial)
- `npm run register-faces-incremental` - Cadastro apenas de novos usuários 🆕
- `npm run checkin-server` - Servidor de checkin Intelbras

### Desenvolvimento
- `npm run checkin-server:dev` - Servidor de checkin com auto-reload **[NOVO]**

### Gerenciamento de Cache
- `npm run cache:list` - Lista usuários registrados (todos os dispositivos)
- `npm run cache:device <ip>` - Lista usuários de um dispositivo específico
- `npm run cache:search <query>` - Busca usuários por nome/documento/email
- `npm run cache:stats` - Estatísticas do cache
- `npm run cache:clear [ip]` - Limpa cache (dispositivo específico ou todos)
- `npm run cache:export [filename]` - Exporta cache para arquivo

### Gerenciamento de Imagens
- `npm run images:list` - Lista imagens em cache
- `npm run images:stats` - Estatísticas do cache de imagens
- `npm run images:cleanup` - Limpa imagens antigas
- `npm run images:check` - Verifica integridade do cache

### Testes
- `npm test` - Executa testes simples
- `npm run test:users` - Testa registro de usuários
- `npm run test:faces` - Testa registro de faces biométricas
- `npm run test:digest` - Testa autenticação digest HTTP
- `npm run test:mock` - Executa testes com servidor mock
- `npm run test:watch` - Executa testes em modo watch
- `npm run test:verbose` - Executa testes com saída detalhada
