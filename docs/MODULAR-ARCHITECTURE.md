# 🏗️ Arquitetura Modular - v2.0

## 📋 **Visão Geral**

O sistema foi refatorado para uma arquitetura modular, separando responsabilidades e tornando o código mais organizado, testável e manutenível.

## 🗂️ **Estrutura de Arquivos**

```
src/
├── modules/                    # Módulos especializados
│   ├── cache-manager.js       # Gerenciamento de cache JSON
│   ├── image-processor.js     # Processamento de imagens
│   ├── api-client.js          # Cliente para APIs das catracas
│   └── user-manager.js        # Gerenciamento de usuários
├── facial-registration.js     # Versão original (v1.0)
├── facial-registration-v2.js  # Versão modular (v2.0)
└── cache-viewer.js           # Visualizador de cache
```

## 🔧 **Módulos**

### **1. CacheManager (`modules/cache-manager.js`)**

**Responsabilidades:**
- Gerenciar cache JSON de usuários registrados
- Criar e gerenciar backups automáticos
- Sincronizar com Redis
- Operações CRUD no cache

**Principais métodos:**
```javascript
await cacheManager.init()                    // Inicializa diretórios
await cacheManager.load()                    // Carrega cache do JSON
await cacheManager.save()                    // Salva cache no JSON
await cacheManager.addUser(deviceIp, userId, userData)
await cacheManager.removeUser(deviceIp, userId)
await cacheManager.syncWithRedis(redisClient)
```

### **2. ImageProcessor (`modules/image-processor.js`)**

**Responsabilidades:**
- Download de imagens de URLs
- Redimensionamento e compressão
- Conversão para base64
- Validação de especificações

**Principais métodos:**
```javascript
await imageProcessor.downloadImage(imageUrl)
await imageProcessor.processImage(imageBuffer)
imageProcessor.imageToBase64(imageBuffer)
await imageProcessor.processBatch(users)
```

### **3. ApiClient (`modules/api-client.js`)**

**Responsabilidades:**
- Comunicação com APIs das catracas
- Autenticação digest
- Operações de usuários e faces
- Parse de respostas text/plain

**Principais métodos:**
```javascript
await apiClient.fetchExistingUsers(deviceIp)
await apiClient.deleteUser(deviceIp, recNo)
await apiClient.registerUsers(deviceIp, userBatch)
await apiClient.registerFaces(deviceIp, userBatch)
await apiClient.processBatch(deviceIp, userBatch, stats)
```

### **4. UserManager (`modules/user-manager.js`)**

**Responsabilidades:**
- Operações de banco de dados
- Gerenciamento de Redis
- Utilitários de usuários
- Divisão em lotes

**Principais métodos:**
```javascript
await userManager.initRedis()
await userManager.fetchInvitesWithFacialImages()
userManager.splitName(fullName)
userManager.formatNameForDevice(fullName)
await userManager.saveUser(deviceIp, userId, userData, cacheManager)
```

## 🚀 **Arquivo Principal Simplificado**

### **`facial-registration-v2.js`**

**Características:**
- **Orquestração**: Coordena todos os módulos
- **Simplicidade**: Código limpo e focado
- **Manutenibilidade**: Fácil de entender e modificar
- **Testabilidade**: Cada módulo pode ser testado independentemente

**Fluxo principal:**
```javascript
1. Inicializa módulos
2. Busca usuários do banco
3. Processa imagens
4. Para cada lote e dispositivo:
   - Processa via ApiClient
   - Salva via UserManager + CacheManager
5. Gera relatório final
```

## 📊 **Cache Viewer**

### **`cache-viewer.js`**

**Funcionalidades:**
- Visualizar usuários registrados
- Filtrar por dispositivo
- Buscar usuários
- Estatísticas do cache
- Limpar dispositivos
- Exportar cache

**Comandos:**
```bash
npm run cache:list                    # Lista todos os usuários
npm run cache:device 10.1.35.87      # Lista usuários de um dispositivo
npm run cache:search "João"          # Busca usuários
npm run cache:stats                   # Mostra estatísticas
npm run cache:clear 10.1.35.87       # Limpa dispositivo
npm run cache:export                  # Exporta cache
```

## 🔄 **Scripts NPM**

```json
{
  "register-faces": "node src/facial-registration.js",      // v1.0 (original)
  "register-faces-v2": "node src/facial-registration-v2.js", // v2.0 (modular)
  "cache:list": "node src/cache-viewer.js list",
  "cache:device": "node src/cache-viewer.js device",
  "cache:search": "node src/cache-viewer.js search",
  "cache:stats": "node src/cache-viewer.js stats",
  "cache:clear": "node src/cache-viewer.js clear",
  "cache:export": "node src/cache-viewer.js export"
}
```

## 🎯 **Vantagens da Arquitetura Modular**

### **1. Separação de Responsabilidades**
- Cada módulo tem uma responsabilidade específica
- Código mais organizado e legível
- Facilita manutenção e debugging

### **2. Reutilização**
- Módulos podem ser reutilizados em outros projetos
- APIs claras e bem definidas
- Fácil integração com outros sistemas

### **3. Testabilidade**
- Cada módulo pode ser testado independentemente
- Mocks e stubs mais fáceis de implementar
- Testes unitários mais focados

### **4. Escalabilidade**
- Fácil adicionar novas funcionalidades
- Módulos podem ser substituídos sem afetar outros
- Paralelização de desenvolvimento

### **5. Manutenibilidade**
- Código mais fácil de entender
- Mudanças isoladas em módulos específicos
- Documentação mais clara

## 📁 **Estrutura de Cache**

```
cache/
├── registered-users.json           # Cache principal
└── backups/                        # Backups automáticos
    ├── registered-users-2024-01-15T10-30-00-000Z.json
    ├── registered-users-2024-01-15T11-00-00-000Z.json
    └── ...
```

**Formato do cache:**
```json
{
  "10.1.35.87": [
    {
      "userId": "123",
      "name": "João Silva",
      "email": "joao@email.com",
      "document": "12345678901",
      "cellphone": "11999999999",
      "type": "participant",
      "registeredAt": "2024-01-15T10:30:00.000Z",
      "lastUpdated": "2024-01-15T10:30:00.000Z"
    }
  ],
  "10.1.35.88": [...]
}
```

## 🔧 **Como Usar**

### **Execução Básica:**
```bash
# Versão modular (recomendada)
npm run register-faces-v2

# Versão original
npm run register-faces
```

### **Gerenciamento de Cache:**
```bash
# Ver todos os usuários
npm run cache:list

# Ver usuários de um dispositivo
npm run cache:device 10.1.35.87

# Buscar usuário
npm run cache:search "João"

# Ver estatísticas
npm run cache:stats
```

### **Desenvolvimento:**
```bash
# Testar módulos individualmente
node -e "const CacheManager = require('./src/modules/cache-manager'); const cm = new CacheManager(); cm.init().then(() => cm.load()).then(console.log);"

# Debug de módulo específico
node --inspect src/modules/api-client.js
```

## 🎉 **Conclusão**

A arquitetura modular v2.0 oferece:

- ✅ **Código mais limpo** e organizado
- ✅ **Fácil manutenção** e debugging
- ✅ **Reutilização** de componentes
- ✅ **Testabilidade** aprimorada
- ✅ **Escalabilidade** para futuras funcionalidades
- ✅ **Cache JSON** com backup automático
- ✅ **Visualizador de cache** integrado

**Recomendação:** Use `npm run register-faces-v2` para a versão modular com todas as melhorias! 🚀
