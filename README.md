# BMA Ratchet Script

Script para cadastrar múltiplas catracas via API, registrar usuários nas catracas e registrar faces biométricas em leitoras faciais com sistema completo de verificação, cache Redis e testes automatizados.

## 🆕 Versão 2.0 - Registro Facial Completo

O sistema de registro facial foi completamente atualizado com:
- ✅ **Verificação automática** de usuários existentes
- ✅ **Remoção inteligente** antes do cadastro (evita duplicatas)
- ✅ **Cadastro de usuário** + **Cadastro de face** em sequência
- ✅ **Cache Redis** para rastreamento de registros
- ✅ **Relatórios expandidos** com estatísticas detalhadas

## 📁 Estrutura do Projeto

```
bma-ratchet-script/
├── src/                       # Código fonte principal
│   ├── index.js              # Script principal de registro de catracas
│   └── facial-registration.js # Script de registro de faces biométricas
├── test/                     # Scripts de teste
│   ├── test-simple.js        # Testes simples (recomendado)
│   └── test.js               # Testes com servidor mock
├── docs/                     # Documentação
│   ├── README.md             # Documentação original
│   ├── TEST-README.md        # Documentação dos testes
│   ├── USER-REGISTRATION.md  # Documentação de registro de usuários
│   └── FACIAL-REGISTRATION.md # Documentação de registro facial
├── package.json              # Configurações do projeto
└── README.md                 # Este arquivo
```

## 🚀 Como Usar

### Instalação
```bash
npm install
```

### Execução
```bash
# Configuração de catracas (modo padrão)
npm start

# Registro de usuários em catracas
npm run register-users

# Registro de faces biométricas em leitoras faciais
npm run register-faces
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
- `DATABASE_URL`: String de conexão PostgreSQL (para registro facial)
- `BASE_URL`: URL base da API (para registro de usuários)
- `EVENT_ID`: ID do evento
- `DEVICE_IPS`: IPs das catracas (separados por vírgula)
- `FACE_READER_IPS`: IPs das leitoras faciais (separados por vírgula)
- `REDIS_URL`: URL do Redis para cache (ex: redis://localhost:6379) **[NOVO v2.0]**
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
- **Registro de Faces v1.0**: `docs/FACIAL-REGISTRATION.md`

## 🔧 Scripts Disponíveis

### Produção
- `npm start` - Configuração de catracas (modo padrão)
- `npm run register-users` - Registro de usuários em catracas
- `npm run register-faces` - Registro de faces biométricas em leitoras faciais

### Testes
- `npm test` - Executa testes simples
- `npm run test:users` - Testa registro de usuários
- `npm run test:faces` - Testa registro de faces biométricas
- `npm run test:digest` - Testa autenticação digest HTTP
- `npm run test:mock` - Executa testes com servidor mock
- `npm run test:watch` - Executa testes em modo watch
- `npm run test:verbose` - Executa testes com saída detalhada
