# 🚀 Guia Rápido - Sistema de Cache Redis

Este guia mostra como usar o novo sistema de cache Redis para evitar duplicatas no registro de usuários.

## 📦 O Que Foi Adicionado?

✅ **Cache Redis** para armazenar usuários já registrados  
✅ **Detecção automática** de duplicatas  
✅ **Comandos** para gerenciar o cache  
✅ **Testes** para validar o funcionamento  
✅ **Modo resiliente** (funciona sem Redis, mas permite duplicatas)

## 🏃 Início Rápido

### 1. Instalar Redis

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
docker run -d -p 6379:6379 --name redis redis
```

**Verificar:**
```bash
redis-cli ping
# Deve retornar: PONG
```

### 2. Instalar Dependências

```bash
npm install
```

### 3. Configurar Variáveis de Ambiente

Copie o arquivo de exemplo e edite:
```bash
cp env.example .env
nano .env
```

Configurações principais:
```env
# API
BASE_URL=https://sua-api.com
EVENT_ID=123

# Catracas
DEVICE_IPS=192.168.1.100,192.168.1.101

# Redis (use valores padrão se Redis estiver local)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
```

### 4. Executar

```bash
npm run register-users
```

## 💡 Como Funciona?

### Primeira Execução

```bash
$ npm run register-users

🔌 Conectando ao Redis...
✅ Redis conectado com sucesso!
🔍 Buscando participantes...
✅ Encontrados 50 participantes
🚀 Iniciando registro...

🔄 Registrando João Silva (ABC123) na catraca 192.168.1.100...
✅ Usuário João Silva registrado com sucesso!

🔄 Registrando Maria Santos (DEF456) na catraca 192.168.1.100...
✅ Usuário Maria Santos registrado com sucesso!

📊 RELATÓRIO FINAL:
✅ Sucessos: 100
⏭️  Pulados (cache): 0
❌ Erros: 0
```

### Segunda Execução (com cache)

```bash
$ npm run register-users

🔌 Conectando ao Redis...
✅ Redis conectado com sucesso!
🔍 Buscando participantes...
✅ Encontrados 50 participantes
🚀 Iniciando registro...

⏭️  SKIP: João Silva (ABC123) já registrado na catraca 192.168.1.100 (cache)
⏭️  SKIP: Maria Santos (DEF456) já registrado na catraca 192.168.1.100 (cache)

📊 RELATÓRIO FINAL:
✅ Sucessos: 100
⏭️  Pulados (cache): 100  ← Todos pulados!
❌ Erros: 0

⚡ Execução muito mais rápida!
```

## 🎯 Comandos Úteis

### Ver Estatísticas do Cache

```bash
npm run cache:stats
```

Saída:
```
📊 ESTATÍSTICAS DO CACHE REDIS

✅ Redis conectado
📦 Total de registros: 100

📋 Chaves no cache:
  - ratchet:192.168.1.100:user:1
  - ratchet:192.168.1.100:user:2
  ...
```

### Limpar Todo o Cache

```bash
npm run cache:clear
```

Útil quando você quer forçar o re-registro de todos os usuários.

### Verificar Usuário Específico

```bash
node src/cache-manager.js check 192.168.1.100 42
```

Verifica se o usuário ID 42 está registrado na catraca 192.168.1.100.

### Remover Usuário do Cache

```bash
node src/cache-manager.js remove 192.168.1.100 42
```

Remove o usuário ID 42 da catraca 192.168.1.100 do cache, permitindo re-registro.

## 🧪 Testar o Sistema

```bash
# Testar cache Redis
npm run test:cache

# Testar registro de usuários
npm run test:users

# Todos os testes
npm test
```

## 📊 Cenários Comuns

### Cenário 1: Novo Evento (cache vazio)

```bash
# Limpar cache do evento anterior
npm run cache:clear

# Registrar usuários do novo evento
npm run register-users
```

### Cenário 2: Adicionar Novos Participantes

```bash
# Simplesmente execute novamente
npm run register-users

# Usuários antigos serão pulados
# Apenas novos usuários serão registrados
```

### Cenário 3: Corrigir Registro de Um Usuário

```bash
# Remover do cache
node src/cache-manager.js remove 192.168.1.100 42

# Registrar novamente
npm run register-users
```

### Cenário 4: Re-registrar Todos na Catraca Específica

```bash
# Remover todos registros dessa catraca
redis-cli KEYS "ratchet:192.168.1.100:*" | xargs redis-cli DEL

# Registrar novamente
npm run register-users
```

### Cenário 5: Redis Não Disponível

```bash
$ npm run register-users

🔌 Conectando ao Redis...
⚠️  Redis não disponível: connect ECONNREFUSED
⚠️  Continuando sem cache (permitindo duplicatas)

# O script continua normalmente
# Mas todos os usuários serão registrados (sem cache)
```

## 🔍 Verificando o Redis Diretamente

### Listar todas as chaves
```bash
redis-cli KEYS "ratchet:*"
```

### Ver dados de uma chave
```bash
redis-cli GET "ratchet:192.168.1.100:user:42"
```

### Contar registros
```bash
redis-cli KEYS "ratchet:*" | wc -l
```

### Limpar tudo manualmente
```bash
redis-cli FLUSHDB
```

## ⚙️ Configurações Avançadas

### Cache com TTL (Expiração Automática)

Se você quiser que os registros expirem automaticamente após um tempo, edite o arquivo `src/index.js`:

```javascript
// Linha ~114: Adicionar TTL de 7 dias (em segundos)
await redisCache.markUserAsRegistered(deviceIp, participant, 604800);
```

### Redis Remoto

Se você tem um servidor Redis em outra máquina:

```env
REDIS_HOST=redis.exemplo.com
REDIS_PORT=6379
REDIS_PASSWORD=sua_senha_segura
REDIS_DB=0
```

### Múltiplos Ambientes

Use diferentes bancos Redis para diferentes ambientes:

```env
# Desenvolvimento
REDIS_DB=0

# Homologação
REDIS_DB=1

# Produção
REDIS_DB=2
```

## 🚨 Troubleshooting

### Redis não conecta

```bash
# Verificar se está rodando
sudo systemctl status redis

# Iniciar se necessário
sudo systemctl start redis

# Testar conexão
redis-cli ping
```

### Cache não está funcionando

```bash
# Verificar configuração
npm run cache:stats

# Verificar variáveis de ambiente
cat .env | grep REDIS
```

### Limpar cache não funciona

```bash
# Usar comando direto do Redis
redis-cli FLUSHDB

# Ou deletar chaves específicas
redis-cli DEL $(redis-cli KEYS "ratchet:*")
```

## 📚 Mais Informações

- **Documentação Completa do Cache**: `docs/REDIS-CACHE.md`
- **Registro de Usuários**: `docs/USER-REGISTRATION.md`
- **README Principal**: `README.md`

## 💪 Benefícios do Cache

| Aspecto | Sem Cache | Com Cache |
|---------|-----------|-----------|
| **Primeira execução** | 100 registros (~50s) | 100 registros (~50s) |
| **Segunda execução** | 100 registros (~50s) | 0 registros (~2s) |
| **Duplicatas** | Possíveis | Prevenidas |
| **Requisições** | Sempre faz | Pula se já registrado |
| **Rastreamento** | Não tem | Histórico completo |

## 🎉 Pronto!

Agora você tem um sistema robusto que:
- ✅ Previne duplicatas automaticamente
- ⚡ É muito mais rápido em re-execuções
- 📊 Mantém histórico de registros
- 🔄 Funciona mesmo sem Redis (modo fallback)
- 🛠️ Fácil de gerenciar e debugar

**Dica:** Execute `npm run test:cache` para ver o sistema em ação!

