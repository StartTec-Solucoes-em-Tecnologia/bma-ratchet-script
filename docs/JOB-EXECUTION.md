# 🚀 Guia de Execução de Jobs BullMQ

## 📋 **Resumo das Opções**

| Método | Uso | Comando | Descrição |
|--------|-----|---------|-----------|
| **Automático** | Desenvolvimento | `npm run register-faces` | Executa tudo de uma vez |
| **Worker** | Produção | `npm run worker` | Worker contínuo para processar jobs |
| **Scheduler** | Produção | `npm run scheduler` | Execução periódica automática |
| **PM2** | Produção | `npm run pm2:start` | Gerenciamento de processos |
| **Docker** | Produção | `npm run docker:up` | Containerização completa |

## 🔧 **1. Execução Automática (Desenvolvimento)**

**Comando:**
```bash
npm run register-faces
```

**Como funciona:**
- Busca usuários do banco
- Processa imagens
- Cria filas automaticamente
- Adiciona jobs às filas
- Cria workers temporários
- Processa todos os jobs
- Fecha workers ao finalizar

**Vantagens:**
- ✅ Simples de usar
- ✅ Não precisa de Redis rodando
- ✅ Fallback síncrono se Redis indisponível

**Desvantagens:**
- ❌ Não é escalável
- ❌ Não processa jobs em background
- ❌ Para se houver erro

## 👷 **2. Worker Separado (Produção)**

**Comando:**
```bash
npm run worker
```

**Como funciona:**
- Conecta ao Redis
- Cria workers para cada dispositivo
- Fica rodando continuamente
- Processa jobs conforme chegam
- Concorrência: 2 jobs por dispositivo

**Configuração:**
```bash
# .env
REDIS_URL="redis://localhost:6379"
FACE_READER_IPS="10.1.35.87,10.1.35.88"
```

**Monitoramento:**
```bash
# Ver logs
npm run pm2:logs

# Status
pm2 status

# Restart
npm run pm2:restart
```

## ⏰ **3. Scheduler (Execução Periódica)**

**Comando:**
```bash
npm run scheduler
```

**Como funciona:**
- Executa `register-faces` periodicamente
- Intervalo configurável (padrão: 30 minutos)
- Pode ser ativado/desativado

**Configuração:**
```bash
# .env
SCHEDULER_INTERVAL_MINUTES="30"  # Intervalo em minutos
ENABLE_SCHEDULER="true"          # Ativar/desativar
```

**Uso típico:**
- Sincronização periódica de usuários
- Atualização automática de faces
- Manutenção de dados

## 🐳 **4. Docker Compose (Recomendado)**

**Comandos:**
```bash
# Subir todos os serviços
npm run docker:up

# Ver logs
npm run docker:logs

# Parar serviços
npm run docker:down
```

**Serviços incluídos:**
- **Redis**: Banco de dados para filas
- **facial-worker**: Worker para processar jobs
- **facial-scheduler**: Scheduler para execução periódica

**Configuração:**
```bash
# .env
DATABASE_URL="postgresql://..."
EVENT_ID="your-event-id"
FACE_READER_IPS="10.1.35.87,10.1.35.88"
DIGEST_USERNAME="admin"
DIGEST_PASSWORD="password"
REDIS_URL="redis://redis:6379"
```

## 📊 **5. PM2 (Gerenciamento de Processos)**

**Comandos:**
```bash
# Instalar PM2
npm install -g pm2

# Iniciar workers
npm run pm2:start

# Ver status
pm2 status

# Ver logs
npm run pm2:logs

# Parar
npm run pm2:stop

# Restart
npm run pm2:restart
```

**Configuração (ecosystem.config.js):**
```javascript
module.exports = {
  apps: [
    {
      name: 'facial-worker',
      script: 'src/worker.js',
      instances: 1,
      autorestart: true,
      max_memory_restart: '1G'
    },
    {
      name: 'facial-scheduler',
      script: 'src/scheduler.js',
      instances: 1,
      autorestart: true,
      max_memory_restart: '1G'
    }
  ]
};
```

## 🔄 **6. Fluxo de Execução**

### **Modo Automático:**
```
1. Executa register-faces
2. Busca usuários do banco
3. Processa imagens
4. Para cada dispositivo:
   - Cria fila temporária
   - Adiciona jobs
   - Cria worker temporário
   - Processa jobs
   - Fecha worker
5. Gera relatório
```

### **Modo Worker:**
```
1. Conecta ao Redis
2. Cria workers para cada dispositivo
3. Fica aguardando jobs
4. Quando job chega:
   - Processa usuário
   - Deleta se existe
   - Cadastra usuário
   - Cadastra face
   - Salva no Redis
5. Continua aguardando
```

### **Modo Scheduler:**
```
1. Executa register-faces
2. Aguarda intervalo configurado
3. Repete processo
```

## 📈 **7. Monitoramento e Logs**

### **Logs do Worker:**
```bash
# PM2
pm2 logs facial-worker

# Docker
docker logs facial-worker

# Direto
npm run worker
```

### **Logs do Scheduler:**
```bash
# PM2
pm2 logs facial-scheduler

# Docker
docker logs facial-scheduler

# Direto
npm run scheduler
```

### **Logs do Redis:**
```bash
# Docker
docker logs facial-redis

# Redis CLI
redis-cli monitor
```

## 🛠️ **8. Troubleshooting**

### **Worker não processa jobs:**
```bash
# Verificar Redis
redis-cli ping

# Verificar filas
redis-cli keys "facial-registration-*"

# Ver jobs na fila
redis-cli llen "facial-registration-10-1-35-87"
```

### **Scheduler não executa:**
```bash
# Verificar variável
echo $ENABLE_SCHEDULER

# Verificar logs
pm2 logs facial-scheduler
```

### **Docker não sobe:**
```bash
# Verificar logs
docker-compose logs

# Rebuild
docker-compose up --build
```

## 🎯 **9. Recomendações por Ambiente**

### **Desenvolvimento:**
```bash
# Execução simples
npm run register-faces

# Ou com worker para testar
npm run worker
```

### **Produção:**
```bash
# Docker (recomendado)
npm run docker:up

# Ou PM2
npm run pm2:start
```

### **Teste:**
```bash
# Teste das funcionalidades
npm run test:faces
```

## 📋 **10. Variáveis de Ambiente**

```bash
# Obrigatórias
DATABASE_URL="postgresql://..."
EVENT_ID="event-id"
FACE_READER_IPS="ip1,ip2,ip3"
DIGEST_USERNAME="admin"
DIGEST_PASSWORD="password"

# Redis
REDIS_URL="redis://localhost:6379"

# Scheduler
SCHEDULER_INTERVAL_MINUTES="30"
ENABLE_SCHEDULER="true"

# Ambiente
NODE_ENV="production"
```

## 🚀 **11. Quick Start**

```bash
# 1. Instalar dependências
npm install

# 2. Configurar .env
cp .env.example .env
# Editar .env com suas configurações

# 3. Executar (escolha uma opção)

# Opção A: Execução automática
npm run register-faces

# Opção B: Worker + Scheduler
npm run worker & npm run scheduler

# Opção C: Docker
npm run docker:up

# Opção D: PM2
npm install -g pm2
npm run pm2:start
```

## 📊 **12. Estatísticas e Monitoramento**

### **Redis Dashboard:**
```bash
# Instalar RedisInsight
# Conectar em localhost:6379
# Ver filas: facial-registration-*
```

### **PM2 Dashboard:**
```bash
# Instalar PM2 Plus
pm2 plus

# Ou usar PM2 monit
pm2 monit
```

### **Docker Stats:**
```bash
# Ver uso de recursos
docker stats

# Logs em tempo real
docker-compose logs -f
```

---

## 🎉 **Conclusão**

Escolha o método que melhor se adapta ao seu ambiente:

- **Desenvolvimento**: `npm run register-faces`
- **Produção simples**: `npm run worker`
- **Produção robusta**: `npm run docker:up`
- **Produção enterprise**: `npm run pm2:start`

Todos os métodos são compatíveis e podem ser usados em conjunto! 🚀
