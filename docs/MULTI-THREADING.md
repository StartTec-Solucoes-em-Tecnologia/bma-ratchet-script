# Multi-Threading com Piscina

## 📚 Visão Geral

O sistema agora suporta processamento multi-threading usando **Piscina.js**, uma biblioteca de worker threads de alto desempenho para Node.js. Isso permite processar múltiplos registros de usuários em paralelo, acelerando significativamente o tempo de processamento.

## ⚡ Como Funciona

### Arquitetura

1. **Thread Principal (`src/index.js`)**: Coordena o processamento e gerencia o pool de workers
2. **Worker Threads (`src/worker-register-user.js`)**: Executam o registro de usuários nas catracas em paralelo

### Fluxo de Processamento

```
┌─────────────────────┐
│  Thread Principal   │
│   (index.js)        │
└──────────┬──────────┘
           │
           ├─────────┐
           │         │
      ┌────▼───┐  ┌──▼─────┐     ┌──────────┐
      │Worker 1│  │Worker 2│ ... │Worker N  │
      │(Thread)│  │(Thread)│     │(Thread)  │
      └────┬───┘  └──┬─────┘     └────┬─────┘
           │         │                 │
           └─────────┴─────────────────┘
                     │
              Resultados agregados
```

## 🚀 Uso Básico

### Modo Multi-Threading (Padrão)

Por padrão, o multi-threading está **habilitado**:

```javascript
const { registerAllUsersInAllRatchets } = require('./src/index');

// Usa multi-threading com 10 workers simultâneos (padrão)
await registerAllUsersInAllRatchets();
```

### Modo Sequencial

Para desabilitar o multi-threading e usar processamento sequencial:

```javascript
await registerAllUsersInAllRatchets({
    useMultiThreading: false
});
```

### Configuração de Concorrência

Você pode ajustar o número de workers simultâneos:

```javascript
// 5 workers simultâneos (menor carga no sistema)
await registerAllUsersInAllRatchets({
    maxConcurrency: 5
});

// 20 workers simultâneos (maior throughput)
await registerAllUsersInAllRatchets({
    maxConcurrency: 20
});
```

## ⚙️ Opções de Configuração

| Opção | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `useMultiThreading` | boolean | `true` | Habilita/desabilita multi-threading |
| `maxConcurrency` | number | `10` | Número máximo de workers simultâneos |
| `skipCache` | boolean | `false` | Ignora verificação de cache |

### Exemplo Completo

```javascript
const options = {
    useMultiThreading: true,   // Habilita multi-threading
    maxConcurrency: 15,        // 15 workers simultâneos
    skipCache: false           // Usa cache Redis
};

const result = await registerAllUsersInAllRatchets(options);

console.log(`Sucessos: ${result.successCount}`);
console.log(`Erros: ${result.errorCount}`);
console.log(`Pulados (cache): ${result.skippedCount}`);
```

## 📊 Performance

### Comparação de Performance

Exemplo com **100 usuários** e **5 catracas** (500 operações totais):

| Modo | Tempo Aproximado | Workers |
|------|------------------|---------|
| Sequencial | ~4 minutos | 1 (single-thread) |
| Multi-threading (5 workers) | ~50 segundos | 5 |
| Multi-threading (10 workers) | ~25 segundos | 10 |
| Multi-threading (20 workers) | ~13 segundos | 20 |

> **Nota**: Os tempos variam dependendo da latência de rede e desempenho das catracas.

### Quando Usar Multi-Threading?

✅ **Recomendado para:**
- Grande volume de usuários (50+)
- Múltiplas catracas (3+)
- Necessidade de processamento rápido
- Servidor com múltiplos núcleos de CPU

⚠️ **Considere modo sequencial para:**
- Poucos usuários (<20)
- Sistema com CPU limitada (1-2 núcleos)
- Testes e desenvolvimento
- Catracas com limitação de requisições simultâneas

## 🔍 Logs e Monitoramento

O sistema fornece logs detalhados durante o processamento:

```
🔌 Conectando ao Redis...
🚀 Iniciando registro de 100 usuários em 5 catracas...
⚡ Multi-threading habilitado com 10 workers simultâneos
📦 Total de 500 tarefas criadas
📊 Progresso: 50/500 (10.0%)
📊 Progresso: 100/500 (20.0%)
...
✅ Registrado: João Silva (ABC123) na catraca 192.168.1.10
⏭️  SKIP: Maria Santos (DEF456) já registrado na catraca 192.168.1.11 (cache)
...
📊 RELATÓRIO FINAL:
👥 Participantes: 100
🏢 Catracas: 5
🔄 Total de operações: 500
✅ Sucessos: 495
⏭️  Pulados (cache): 300
❌ Erros: 5
🔌 Pool de workers fechado
```

## 🛠️ Troubleshooting

### Erro: "Cannot find module 'worker-register-user.js'"

**Solução**: Certifique-se de que o arquivo `src/worker-register-user.js` existe no projeto.

### Alto uso de CPU

**Solução**: Reduza o `maxConcurrency`:

```javascript
await registerAllUsersInAllRatchets({
    maxConcurrency: 5  // Menor carga na CPU
});
```

### Erros de conexão com catracas

**Solução**: Algumas catracas podem não suportar muitas conexões simultâneas. Reduza o número de workers:

```javascript
await registerAllUsersInAllRatchets({
    maxConcurrency: 3  // Menos conexões simultâneas
});
```

### Worker threads não fechando

**Solução**: O código inclui um `finally` block que garante que o pool seja destruído. Se persistir, verifique se há processos pendentes:

```bash
ps aux | grep node
```

## 📝 Requisitos do Sistema

- Node.js >= 12.x (suporte nativo a worker threads)
- 2+ núcleos de CPU (recomendado 4+)
- 512MB+ de RAM livre

## 🔐 Segurança

- Cada worker thread possui seu próprio contexto isolado
- Credenciais de autenticação são carregadas via variáveis de ambiente em cada worker
- Conexões Redis são gerenciadas independentemente em cada worker

## 🚀 Próximos Passos

- [ ] Adicionar métricas de performance em tempo real
- [ ] Implementar retry automático para erros transientes
- [ ] Adicionar rate limiting configurável por catraca
- [ ] Dashboard web para monitoramento em tempo real

