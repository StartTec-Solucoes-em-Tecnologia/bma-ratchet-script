# BMA Ratchet Script

Script para cadastrar múltiplas catracas via API e registrar usuários nas catracas com sistema de testes automatizados.

## 📁 Estrutura do Projeto

```
bma-ratchet-script/
├── src/                    # Código fonte principal
│   └── index.js           # Script principal de registro de catracas
├── test/                  # Scripts de teste
│   ├── test-simple.js     # Testes simples (recomendado)
│   └── test.js            # Testes com servidor mock
├── docs/                  # Documentação
│   ├── README.md          # Documentação original
│   └── TEST-README.md     # Documentação dos testes
├── package.json           # Configurações do projeto
└── README.md              # Este arquivo
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

# Testes com servidor mock
npm run test:mock

# Testes em modo watch
npm run test:watch
```

## 📋 Configuração

### Para Configuração de Catracas
1. Crie um arquivo `.env` na raiz do projeto
2. Configure os IPs das catracas na variável `DEVICE_IPS`
3. Execute `npm start`

### Para Registro de Usuários
1. Crie um arquivo `.env` na raiz do projeto
2. Configure as variáveis:
   - `DEVICE_IPS`: IPs das catracas separados por vírgula
   - `BASE_URL`: URL base da API para buscar participantes
3. Execute `npm run register-users`

Para mais detalhes, consulte `docs/USER-REGISTRATION.md`.

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

## 🔧 Scripts Disponíveis

- `npm start` - Configuração de catracas (modo padrão)
- `npm run register-users` - Registro de usuários em catracas
- `npm test` - Executa testes simples
- `npm run test:users` - Testa registro de usuários
- `npm run test:mock` - Executa testes com servidor mock
- `npm run test:watch` - Executa testes em modo watch
- `npm run test:verbose` - Executa testes com saída detalhada
