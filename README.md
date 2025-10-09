# BMA Ratchet Script

Script para cadastrar múltiplas catracas via API e registrar usuários nas catracas com sistema de testes automatizados e **cache Redis para prevenção de duplicatas**.

## ✨ Novidades

- 🆕 **Sistema de Cache Redis**: Evita duplicatas automaticamente
- ⚡ **Multi-Threading com Piscina**: Processa múltiplos registros em paralelo
- 🚀 **Performance Ultra-Rápida**: Até 20x mais rápido com worker threads
- 📊 **Gerenciamento de Cache**: Comandos para visualizar e gerenciar o cache
- 🔄 **Modo Resiliente**: Funciona com ou sem Redis disponível
- 🧪 **Testes Abrangentes**: Validação completa do sistema

> 💡 **Guia Rápido**: Veja o arquivo `QUICKSTART.md` para começar rapidamente!

## 📁 Estrutura do Projeto

```
bma-ratchet-script/
├── src/                        # Código fonte principal
│   ├── index.js               # Script principal de registro
│   ├── worker-register-user.js # 🆕 Worker thread para multi-threading
│   ├── redis-cache.js         # Módulo de cache Redis
│   └── cache-manager.js       # Gerenciador de cache CLI
├── test/                      # Scripts de teste
│   ├── test-simple.js         # Testes simples
│   ├── test-user-registration.js  # Testes de registro de usuários
│   ├── test-digest-auth.js    # Testes de autenticação
│   ├── test-redis-cache.js    # Testes do cache Redis
│   ├── test-multi-threading.js # 🆕 Testes de multi-threading
│   └── test.js                # Testes com servidor mock
├── docs/                      # Documentação
│   ├── README.md              # Documentação original
│   ├── TEST-README.md         # Documentação dos testes
│   ├── USER-REGISTRATION.md   # Registro de usuários
│   ├── DUPLICATE-CHECKER.md   # Verificador de duplicatas
│   ├── REDIS-CACHE.md         # Sistema de cache Redis
│   └── MULTI-THREADING.md     # 🆕 Multi-threading com Piscina
├── package.json               # Configurações do projeto
├── env.example                # Exemplo de configuração
├── QUICKSTART.md              # Guia rápido de início
└── README.md                  # Este arquivo
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
```

### Testes
```bash
# Testes simples (recomendado)
npm test

# Testes de registro de usuários
npm run test:users

# Testes de autenticação digest
npm run test:digest

# Testes com servidor mock
npm run test:mock

# Testes em modo watch
npm run test:watch
```

## 📋 Configuração

### 1. Instalar Dependências
```bash
npm install
```

### 2. Instalar Redis (opcional, mas recomendado)

O Redis é usado para cache e prevenção de duplicatas:

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install redis-server
sudo systemctl start redis
```

**macOS:**
```bash
brew install redis
brew services start redis
```

**Docker:**
```bash
docker run -d -p 6379:6379 --name redis redis:latest
```

**Verificar instalação:**
```bash
redis-cli ping
# Deve retornar: PONG
```

> **Nota:** Se o Redis não estiver instalado, o sistema continuará funcionando, mas sem prevenção de duplicatas.

### 3. Configurar Variáveis de Ambiente

1. Copie o arquivo de exemplo:
   ```bash
   cp env.example .env
   ```

2. Edite o arquivo `.env` com suas configurações:
   ```env
   # API
   BASE_URL=https://sua-api.com
   EVENT_ID=123
   
   # Catracas
   DEVICE_IPS=192.168.1.100,192.168.1.101
   
   # Autenticação
   DIGEST_USERNAME=admin
   DIGEST_PASSWORD=senha123
   
   # Redis (opcional)
   REDIS_HOST=localhost
   REDIS_PORT=6379
   REDIS_PASSWORD=
   REDIS_DB=0
   ```

### 4. Executar

**Para configuração de catracas:**
```bash
npm start
```

**Para registro de usuários:**
```bash
npm run register-users
```

Para mais detalhes, consulte `docs/USER-REGISTRATION.md`.

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
- `BASE_URL`: URL base da API
- `EVENT_ID`: ID do evento
- `DEVICE_IPS`: IPs das catracas (separados por vírgula)
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
- **Multi-Threading com Piscina**: `docs/MULTI-THREADING.md` 🆕
- **Sistema de Cache Redis**: `docs/REDIS-CACHE.md`
- **Verificador de Duplicatas**: `docs/DUPLICATE-CHECKER.md`
- **Registro de Usuários**: `docs/USER-REGISTRATION.md`

## 💾 Sistema de Cache Redis

O projeto agora inclui um sistema de cache Redis para evitar duplicatas e melhorar a performance:

### Recursos do Cache:
- ✅ **Evita duplicatas**: Pula usuários já registrados em cada catraca
- ⚡ **Melhora performance**: Reduz tempo de execução em re-processamentos
- 🔄 **Resiliente**: Funciona normalmente se o Redis não estiver disponível
- 📊 **Rastreável**: Mantém histórico de registros realizados

### Comandos do Cache:
```bash
# Ver estatísticas do cache
npm run cache:stats

# Limpar todo o cache
npm run cache:clear

# Verificar usuário específico
node src/cache-manager.js check <ip> <id>

# Remover usuário do cache
node src/cache-manager.js remove <ip> <id>
```

### Configuração do Redis:
Adicione ao seu arquivo `.env`:
```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
```

Para mais detalhes, consulte `docs/REDIS-CACHE.md`.

## ⚡ Multi-Threading com Piscina

O sistema agora suporta **processamento paralelo** usando worker threads via Piscina.js:

### Benefícios:
- ⚡ **Até 20x mais rápido**: Processa múltiplos registros simultaneamente
- 🔧 **Configurável**: Ajuste o número de workers conforme necessário
- 📊 **Monitoramento**: Logs em tempo real do progresso
- 🔄 **Compatível**: Mantém modo sequencial como opção

### Uso Básico:
```javascript
// Multi-threading habilitado por padrão
await registerAllUsersInAllRatchets();

// Personalizar número de workers
await registerAllUsersInAllRatchets({
    maxConcurrency: 15  // 15 workers simultâneos
});

// Desabilitar multi-threading (modo sequencial)
await registerAllUsersInAllRatchets({
    useMultiThreading: false
});
```

### Performance Esperada:
Com **100 usuários** e **5 catracas** (500 operações):
- 📋 Sequencial: ~4 minutos
- ⚡ 10 workers: ~25 segundos (9.6x mais rápido)
- 🚀 20 workers: ~13 segundos (18.5x mais rápido)

### Teste de Performance:
```bash
# Testa multi-threading com diferentes configurações
npm run test:mt

# Inclui comparação com modo sequencial
npm run test:mt -- --include-sequential
```

Para mais detalhes, consulte `docs/MULTI-THREADING.md`.

## 🔧 Scripts Disponíveis

### Principais:
- `npm start` - Configuração de catracas (modo padrão)
- `npm run register-users` - Registro de usuários em catracas

### Cache:
- `npm run cache:stats` - Estatísticas do cache Redis
- `npm run cache:clear` - Limpar cache Redis
- `npm run cache:help` - Ajuda sobre comandos de cache

### Testes:
- `npm test` - Executa testes simples
- `npm run test:users` - Testa registro de usuários
- `npm run test:digest` - Testa autenticação digest HTTP
- `npm run test:cache` - Testa sistema de cache Redis
- `npm run test:mt` - Testa multi-threading e performance 🆕
- `npm run test:mock` - Executa testes com servidor mock
- `npm run test:watch` - Executa testes em modo watch
- `npm run test:verbose` - Executa testes com saída detalhada
