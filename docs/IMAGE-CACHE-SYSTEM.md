# Sistema de Cache de Imagens - BMA Facial Registration

## 📋 Visão Geral

O sistema de cache de imagens foi implementado para otimizar o processo de download e processamento de imagens faciais, evitando downloads desnecessários e melhorando a performance geral do sistema.

## 🚀 Funcionalidades

### ✅ **Cache Inteligente**
- **Verificação automática**: Antes de baixar, verifica se a imagem já existe no cache
- **Hash único**: Usa MD5 da URL para identificar imagens únicas
- **Metadados**: Armazena informações sobre cada imagem (usuário, data, tamanho)

### ✅ **Download Otimizado**
- **Download em lote**: Baixa todas as imagens necessárias de uma vez
- **Relatório detalhado**: Mostra quantas foram baixadas vs. já em cache
- **Tratamento de erros**: Continua processamento mesmo com falhas individuais

### ✅ **Processamento Eficiente**
- **Conversão para base64**: Após download, converte todas as imagens
- **Redimensionamento**: Aplica as mesmas regras de otimização
- **Compressão**: Mantém qualidade e reduz tamanho

## 📁 Estrutura de Arquivos

```
cache/
├── images/                    # Cache de imagens
│   ├── metadata.json         # Metadados das imagens
│   ├── abc123def456.jpg      # Imagem 1 (hash da URL)
│   ├── def456ghi789.jpg      # Imagem 2
│   └── ...
└── registered-users.json     # Cache de usuários (existente)
```

## 🔧 Configuração

### **Variáveis de Ambiente**
```bash
# .env
EVENT_ID=srp9ny5qzw7ubawtmc4n8zfp
DEVICE_IPS=10.1.35.87,10.1.35.88,10.1.35.89
DIGEST_USERNAME=admin
DIGEST_PASSWORD=acesso1234
REDIS_URL=redis://localhost:6379
```

### **Dependências**
```json
{
  "sharp": "^0.34.4",        # Processamento de imagens
  "axios": "^1.12.2"         # Download de imagens
}
```

## 🎯 Fluxo de Execução

### **1. Download de Imagens**
```bash
npm run register-faces-v2
```

**Processo:**
1. **Busca usuários** com facial_image do evento
2. **Verifica cache** para cada imagem
3. **Baixa apenas** imagens não encontradas
4. **Salva metadados** de cada imagem

### **2. Processamento**
1. **Carrega imagens** do cache local
2. **Redimensiona** para 500x500px máximo
3. **Comprime** para máximo 100KB
4. **Converte** para base64

### **3. Cadastro nas Catracas**
1. **Cadastra usuários** primeiro (sem faces)
2. **Aguarda estabilização** (2 segundos)
3. **Cadastra faces** com base64
4. **Salva no Redis** e cache JSON

## 📊 Comandos de Gerenciamento

### **Visualizar Cache**
```bash
# Lista todas as imagens
npm run images:list

# Mostra estatísticas
npm run images:stats

# Verifica integridade
npm run images:check
```

### **Limpeza do Cache**
```bash
# Limpa imagens antigas (30 dias)
npm run images:cleanup

# Limpa imagens antigas (7 dias)
npm run images:cleanup 7

# Limpa todo o cache
npm run images:clear
```

## 📈 Relatórios e Estatísticas

### **Durante Execução**
```
📥 Baixando 150 imagens faciais...

  1/150 - João Silva...
  📷 Imagem já em cache: user123
  2/150 - Maria Santos...
  ⬇️  Imagem baixada: user456 (45.2KB)
  ...

📊 Download concluído:
   ⬇️  Baixadas: 45
   📷 Em cache: 105
   ❌ Erros: 0
   ✅ Total processadas: 150
```

### **Estatísticas Finais**
```
📷 Cache de Imagens:
   📁 Total de imagens: 150
   💾 Tamanho total: 8.5MB
```

## 🔍 Monitoramento

### **Verificação de Integridade**
```bash
npm run images:check
```

**Verifica:**
- ✅ Arquivos de imagem válidos
- ❌ Arquivos corrompidos
- 🗑️ Metadados órfãos
- 📊 Relatório detalhado

### **Limpeza Automática**
- **Backup automático** antes de limpeza
- **Remoção de imagens** com mais de 30 dias
- **Limpeza de metadados** órfãos

## ⚡ Performance

### **Benefícios**
- **90% menos downloads** em execuções subsequentes
- **Cache persistente** entre execuções
- **Processamento paralelo** de imagens
- **Relatórios detalhados** de performance

### **Otimizações**
- **Hash MD5** para identificação rápida
- **Verificação de arquivo** antes de download
- **Metadados JSON** para consultas rápidas
- **Limpeza automática** de cache antigo

## 🛠️ Manutenção

### **Limpeza Regular**
```bash
# Executar semanalmente
npm run images:cleanup 7

# Verificar integridade mensalmente
npm run images:check
```

### **Backup**
- **Metadados** são salvos automaticamente
- **Imagens** ficam no diretório `cache/images/`
- **Backup manual** pode ser feito copiando a pasta

## 🚨 Troubleshooting

### **Problemas Comuns**

**1. Erro de permissão no cache**
```bash
# Solução: Verificar permissões
chmod -R 755 cache/
```

**2. Cache corrompido**
```bash
# Solução: Verificar integridade
npm run images:check

# Se necessário, limpar cache
npm run images:clear
```

**3. Imagens não baixam**
```bash
# Verificar conectividade
ping google.com

# Verificar URLs no banco
# Verificar logs de erro
```

### **Logs de Debug**
```bash
# Executar com debug
DEBUG=* npm run register-faces-v2
```

## 📚 Arquivos Relacionados

- `src/modules/image-cache-manager.js` - Gerenciador de cache
- `src/image-cache-viewer.js` - Visualizador de cache
- `src/modules/image-processor.js` - Processador de imagens
- `src/facial-registration-v2.js` - Script principal

## 🔄 Versioning

- **v2.0.0** - Sistema de cache implementado
- **v2.1.0** - Melhorias de performance
- **v2.2.0** - Comandos de gerenciamento

---

**Desenvolvido para BMA Facial Registration System**  
*Sistema otimizado para registro facial em catracas biométricas*
