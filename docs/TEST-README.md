# Script de Teste para Sistema de Catracas

Este diretório contém scripts de teste para o sistema de registro de catracas.

## Arquivos de Teste

### `test-simple.js`
Script de teste simples que não requer dependências externas. Testa:
- ✅ Validação de entrada (variável DEVICE_IPS)
- ✅ Parsing de IPs (com e sem espaços)
- ✅ Erro de conexão com IPs inválidos
- ✅ Timeout de requisição
- ✅ Estrutura de retorno das funções

### `test.js`
Script de teste completo com servidor mock. Testa:
- ✅ Registro bem-sucedido
- ✅ Erro de conexão
- ✅ Múltiplas catracas com cenários mistos
- ✅ Validação de entrada
- ✅ Timeout de requisição

## Como Executar os Testes

### Instalação das Dependências
```bash
npm install
```

### Testes Simples (Recomendado)
```bash
# Executa testes simples sem dependências externas
npm test
# ou
npm run test:simple
```

### Testes com Servidor Mock
```bash
# Executa testes completos com servidor mock
npm run test:mock
```

### Testes em Modo Watch
```bash
# Executa testes automaticamente quando arquivos mudam
npm run test:watch
```

### Testes Verbosos
```bash
# Executa testes com saída detalhada
npm run test:verbose
```

## Configuração de Teste

### Arquivo `env.test`
Contém configurações de teste com IPs de exemplo:
```
DEVICE_IPS=192.168.1.100,192.168.1.101,192.168.1.102,192.168.1.103,192.168.1.104
```

## Cenários de Teste

### 1. Validação de Entrada
- Testa se o sistema detecta quando `DEVICE_IPS` não está definido
- Verifica se retorna erro apropriado

### 2. Parsing de IPs
- Testa parsing de lista de IPs separados por vírgula
- Testa remoção de espaços extras
- Verifica se array de IPs é criado corretamente

### 3. Erro de Conexão
- Testa comportamento com IPs inválidos
- Verifica se erros são capturados corretamente
- Testa timeout de requisição

### 4. Estrutura de Retorno
- Verifica se funções retornam estrutura esperada
- Testa campos obrigatórios (`deviceIp`, `success`, `status`/`error`)

### 5. Múltiplas Catracas
- Testa processamento de múltiplos IPs
- Verifica contadores de sucesso/erro
- Testa relatório final

## Saída dos Testes

### Exemplo de Saída de Sucesso
```
🚀 INICIANDO TESTES SIMPLES
============================================================

🧪 TESTE 1: Validação de entrada
==================================================
✅ Teste passou: Validação de entrada funcionando

🧪 TESTE 2: Parsing de IPs
==================================================
✅ Teste passou: Parsing de IPs funcionando

📊 RELATÓRIO FINAL DOS TESTES
============================================================
✅ Testes aprovados: 6/6
❌ Testes falharam: 0/6
📈 Taxa de sucesso: 100.0%

🎉 Todos os testes passaram! Sistema funcionando corretamente.
```

### Exemplo de Saída com Falhas
```
📊 RELATÓRIO FINAL DOS TESTES
============================================================
✅ Testes aprovados: 4/6
❌ Testes falharam: 2/6
📈 Taxa de sucesso: 66.7%

💥 Alguns testes falharam. Verifique os logs acima.
```

## Troubleshooting

### Erro: "Cannot find module 'express'"
```bash
npm install express
```

### Erro: "Cannot find module 'nodemon'"
```bash
npm install --save-dev nodemon
```

### Testes falhando com IPs específicos
- Verifique se os IPs de teste estão acessíveis
- Para testes offline, use `test-simple.js`
- Para testes completos, use `test.js` com servidor mock

## Integração Contínua

Para usar em CI/CD, execute:
```bash
npm test
```

O script retorna código de saída 0 para sucesso e 1 para falha, permitindo integração com sistemas de CI/CD.
