# Sistema de Cache Redis

Este documento descreve o sistema de cache Redis implementado para evitar duplicatas no registro de usuários nas catracas.

## 📋 Índice

- [Visão Geral](#visão-geral)
- [Instalação do Redis](#instalação-do-redis)
- [Configuração](#configuração)
- [Como Funciona](#como-funciona)
- [Comandos Disponíveis](#comandos-disponíveis)
- [Casos de Uso](#casos-de-uso)
- [Gerenciamento do Cache](#gerenciamento-do-cache)

## 🎯 Visão Geral

O sistema de cache Redis foi implementado para:
- ✅ **Evitar duplicatas**: Impede que o mesmo usuário seja registrado múltiplas vezes na mesma catraca
- ⚡ **Melhorar performance**: Pula registros já processados, economizando tempo e requisições
- 📊 **Rastrear registros**: Mantém histórico de quais usuários foram registrados em quais catracas
- 🔄 **Ser resiliente**: Se o Redis não estiver disponível, o sistema continua funcionando (sem cache)

## 🔧 Instalação do Redis

### Ubuntu/Debian
```bash
sudo apt-get update
sudo apt-get install redis-server
sudo systemctl start redis
sudo systemctl enable redis
```

### macOS
```bash
brew install redis
brew services start redis
```

### Docker
```bash
docker run -d -p 6379:6379 --name redis redis:latest
```

### Verificar instalação
```bash
redis-cli ping
# Deve retornar: PONG
```

## ⚙️ Configuração

### Variáveis de Ambiente

Adicione as seguintes variáveis ao seu arquivo `.env`:

```env
# Configurações do Redis
REDIS_HOST=localhost        # Host do servidor Redis
REDIS_PORT=6379            # Porta do servidor Redis
REDIS_PASSWORD=            # Senha (deixe vazio se não houver)
REDIS_DB=0                 # Número do banco de dados (0-15)
```

### Valores Padrão

Se as variáveis não forem definidas, os seguintes valores padrão serão usados:
- `REDIS_HOST`: `localhost`
- `REDIS_PORT`: `6379`
- `REDIS_PASSWORD`: (vazio)
- `REDIS_DB`: `0`

## 🔍 Como Funciona

### Fluxo de Registro com Cache

```
1. Usuário precisa ser registrado na catraca
   ↓
2. Sistema verifica se já existe no cache Redis
   ↓
   ├─ SIM → Pula o registro (⏭️)
   │         - Retorna sucesso imediato
   │         - Não faz requisição à catraca
   │         - Pausa curta (50ms)
   │
   └─ NÃO → Registra na catraca (✅)
             - Faz requisição HTTP
             - Se sucesso, salva no cache
             - Pausa normal (500ms)
```

### Estrutura das Chaves

As chaves no Redis seguem o padrão:
```
ratchet:{IP_CATRACA}:user:{ID_PARTICIPANTE}
```

Exemplo:
```
ratchet:192.168.1.100:user:42
ratchet:192.168.1.101:user:42
```

### Dados Armazenados

Para cada usuário registrado, o cache armazena:
```json
{
  "participantId": 42,
  "participantName": "João Silva",
  "inviteCode": "ABC123",
  "deviceIp": "192.168.1.100",
  "registeredAt": "2025-10-09T10:30:00.000Z"
}
```

## 💻 Comandos Disponíveis

### Via NPM Scripts

```bash
# Ver estatísticas do cache
npm run cache:stats

# Limpar todo o cache
npm run cache:clear

# Ver ajuda sobre comandos
npm run cache:help
```

### Via Node.js Direto

```bash
# Verificar se um usuário específico está no cache
node src/cache-manager.js check <IP_CATRACA> <ID_PARTICIPANTE>

# Remover um usuário específico do cache
node src/cache-manager.js remove <IP_CATRACA> <ID_PARTICIPANTE>
```

#### Exemplos:
```bash
# Verificar se o usuário 42 está registrado na catraca 192.168.1.100
node src/cache-manager.js check 192.168.1.100 42

# Remover o usuário 42 da catraca 192.168.1.100 do cache
node src/cache-manager.js remove 192.168.1.100 42
```

## 📖 Casos de Uso

### 1. Primeiro Registro

```bash
npm run register-users
```

**Comportamento:**
- Cache está vazio
- Todos os usuários são registrados normalmente
- Cada registro bem-sucedido é salvo no cache

**Saída esperada:**
```
✅ Sucessos: 100
⏭️  Pulados (cache): 0
❌ Erros: 0
```

### 2. Segunda Execução (com cache)

```bash
npm run register-users
```

**Comportamento:**
- Cache contém registros anteriores
- Usuários já registrados são pulados
- Processo é muito mais rápido

**Saída esperada:**
```
✅ Sucessos: 100
⏭️  Pulados (cache): 100
❌ Erros: 0
```

### 3. Novos Usuários

Se novos participantes forem adicionados ao evento:

```bash
npm run register-users
```

**Comportamento:**
- Usuários antigos são pulados (cache)
- Apenas novos usuários são registrados
- Cache é atualizado com os novos registros

**Saída esperada:**
```
✅ Sucessos: 105
⏭️  Pulados (cache): 100
❌ Erros: 0
```

### 4. Forçar Novo Registro

Se você precisar forçar o registro de um usuário específico:

```bash
# Remover do cache
node src/cache-manager.js remove 192.168.1.100 42

# Registrar novamente
npm run register-users
```

### 5. Recomeçar do Zero

Para limpar todo o cache e registrar todos novamente:

```bash
# Limpar cache
npm run cache:clear

# Registrar todos
npm run register-users
```

## 🔧 Gerenciamento do Cache

### Ver Estatísticas

```bash
npm run cache:stats
```

**Saída:**
```
📊 ESTATÍSTICAS DO CACHE REDIS

✅ Redis conectado
📦 Total de registros: 200

📋 Chaves no cache:
  - ratchet:192.168.1.100:user:1
  - ratchet:192.168.1.100:user:2
  - ratchet:192.168.1.101:user:1
  - ratchet:192.168.1.101:user:2
  ...
```

### Limpar Cache Completo

```bash
npm run cache:clear
```

**Saída:**
```
🗑️  Limpando cache...
🗑️  200 registros removidos do cache
✅ Cache limpo com sucesso!
```

### Verificar Usuário Específico

```bash
node src/cache-manager.js check 192.168.1.100 42
```

**Saída se encontrado:**
```
✅ Usuário encontrado no cache:
  👤 Nome: João Silva
  🆔 ID: 42
  🎫 Código de convite: ABC123
  🖥️  IP da catraca: 192.168.1.100
  📅 Registrado em: 2025-10-09T10:30:00.000Z
```

**Saída se não encontrado:**
```
❌ Usuário não encontrado no cache
```

### Remover Usuário Específico

```bash
node src/cache-manager.js remove 192.168.1.100 42
```

**Saída:**
```
🗑️  Removendo usuário 42 da catraca 192.168.1.100...
✅ Usuário removido com sucesso!
```

## 🛡️ Comportamento Resiliente

### Redis Não Disponível

Se o Redis não estiver rodando ou não puder ser acessado:

```
⚠️  Redis não disponível: connect ECONNREFUSED
⚠️  Continuando sem cache (permitindo duplicatas)
```

**Comportamento:**
- O script continua funcionando normalmente
- Todos os usuários são registrados (sem cache)
- Nenhum erro é lançado
- Avisos são exibidos no console

### Erros no Cache

Se houver erros ao ler/escrever no cache:

```
⚠️  Erro ao verificar cache: Connection timeout
```

**Comportamento:**
- A operação prossegue sem cache
- Em caso de dúvida, o registro é feito
- Previne perda de dados

## 📊 Relatório de Execução

O relatório agora inclui informações sobre cache:

```
📊 RELATÓRIO FINAL:
👥 Participantes: 50
🏢 Catracas: 2
🔄 Total de operações: 100
✅ Sucessos: 100
⏭️  Pulados (cache): 75
❌ Erros: 0

💾 Cache Redis:
  📦 Total de registros no cache: 100

📋 DETALHES POR PARTICIPANTE:

👤 João Silva (ABC123):
  ⏭️  192.168.1.100  (pulado - cache)
  ⏭️  192.168.1.101  (pulado - cache)

👤 Maria Santos (DEF456):
  ✅ 192.168.1.100  (registrado)
  ✅ 192.168.1.101  (registrado)
```

### Símbolos do Relatório:
- ✅ = Registrado com sucesso
- ⏭️ = Pulado (já estava no cache)
- ❌ = Erro ao registrar

## 🔍 Depuração

### Verificar conexão Redis
```bash
redis-cli ping
```

### Listar todas as chaves
```bash
redis-cli KEYS "ratchet:*"
```

### Ver valor de uma chave
```bash
redis-cli GET "ratchet:192.168.1.100:user:42"
```

### Limpar tudo manualmente
```bash
redis-cli FLUSHDB
```

## 💡 Dicas e Boas Práticas

1. **Primeira execução**: Execute sem cache para garantir que todos os usuários sejam registrados
2. **Testes**: Use `npm run cache:clear` antes de testes para começar limpo
3. **Monitoramento**: Use `npm run cache:stats` regularmente para verificar o estado do cache
4. **Backup**: O cache é volátil - não use como única fonte de dados
5. **Performance**: O cache melhora muito a performance em re-execuções
6. **Redis separado**: Em produção, considere usar um servidor Redis dedicado

## 🚨 Troubleshooting

### Problema: Redis não conecta
**Solução:**
```bash
# Verificar se Redis está rodando
sudo systemctl status redis
# ou
redis-cli ping

# Iniciar Redis se necessário
sudo systemctl start redis
```

### Problema: Usuários não estão sendo pulados
**Solução:**
```bash
# Verificar se o cache tem dados
npm run cache:stats

# Se vazio, os usuários precisam ser registrados primeiro
npm run register-users
```

### Problema: Cache desatualizado
**Solução:**
```bash
# Limpar cache e reprocessar
npm run cache:clear
npm run register-users
```

### Problema: Erro de permissão no Redis
**Solução:**
```bash
# Verificar permissões do Redis
sudo chown redis:redis /var/lib/redis
sudo systemctl restart redis
```

## 📞 Suporte

Para mais informações ou problemas, consulte:
- Documentação do Redis: https://redis.io/documentation
- Issues do projeto: (adicione URL do repositório)

