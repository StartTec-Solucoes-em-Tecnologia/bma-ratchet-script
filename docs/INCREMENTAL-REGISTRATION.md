# 📋 Cadastro Facial Incremental

## 🎯 O que é?

Script otimizado que **cadastra apenas novos usuários** ou usuários sem face cadastrada nas catracas.

Diferente do script completo (`register-faces-v2`), este script:
- ✅ **Verifica** quais usuários já têm face cadastrada
- ✅ **Pula** usuários que já estão cadastrados
- ✅ **Cadastra** apenas os novos
- ✅ **Mais rápido** para atualizações incrementais

---

## 🚀 Como usar

### 1️⃣ Configurar `.env`

```bash
EVENT_ID=srp9ny5qzw7ubawtmc4n8zfp
FACE_READER_IPS=10.224.0.32,10.224.0.33
FACE_READER_USERNAME=admin
FACE_READER_PASSWORD=acesso1234
```

### 2️⃣ Executar o script

```bash
npm run register-faces-incremental
```

---

## 📊 Fluxo de Execução

```
1. Busca todos os usuários do evento (com facial_image)
   ↓
2. Processa as imagens (download + resize + base64)
   ↓
3. Para cada catraca:
   ├─ Busca faces já cadastradas
   ├─ Compara com os usuários do evento
   ├─ Identifica apenas os NOVOS
   └─ Cadastra somente os novos
   ↓
4. Salva no cache JSON
```

---

## 🔄 Comparação com outros scripts

| Script | Descrição | Quando usar |
|--------|-----------|-------------|
| `register-faces-v2` | Cadastro completo em paralelo | Primeira vez ou recadastro total |
| `register-faces-individual` | Cadastro completo sequencial | Debug ou problemas com paralelo |
| `register-faces-incremental` | **Apenas novos usuários** | Atualizações diárias/incrementais |

---

## 💡 Vantagens

### ⚡ Velocidade
- Não perde tempo recadastrando quem já existe
- Ideal para rodar várias vezes ao dia

### 🎯 Eficiência
- Evita sobrecarga nas catracas
- Menos requisições = menos erros

### 🔒 Segurança
- Não deleta usuários já cadastrados
- Preserva dados existentes

---

## 📝 Exemplo de Output

```
╔════════════════════════════════════════════════════╗
║   CADASTRO FACIAL INCREMENTAL (APENAS NOVOS)      ║
╚════════════════════════════════════════════════════╝

📅 Evento: srp9ny5qzw7ubawtmc4n8zfp
🖥️  Dispositivos: 10.224.0.32, 10.224.0.33

🔍 Buscando usuários com facial do evento...
✅ 150 usuários encontrados

🖼️  Processando imagens...
✅ 148 imagens processadas

🔍 Verificando faces existentes em 10.224.0.32...
📊 120 faces já cadastradas
📝 28 novos usuários precisam de cadastro
⏭️  120 usuários já cadastrados (pulando)

🖥️  Processando 10.224.0.32...
   👥 28 usuários para cadastrar

   ═══════════════════════════════════════════
   📋 FASE 1: CADASTRO DE USUÁRIOS
   📦 28 usuários em 3 lote(s)
   ═══════════════════════════════════════════

   📦 Lote 1/3 (10 usuários)
   ✅ 10 usuários cadastrados

   📦 Lote 2/3 (10 usuários)
   ✅ 10 usuários cadastrados

   📦 Lote 3/3 (8 usuários)
   ✅ 8 usuários cadastrados

   ✅ FASE 1 CONCLUÍDA: 28 usuários

   ⏸️  Aguardando 3s antes das faces...

   ═══════════════════════════════════════════
   📋 FASE 2: CADASTRO DE FACES
   🎭 28 faces em 3 lote(s)
   ═══════════════════════════════════════════

   📦 Lote 1/3 (10 faces)
   ✅ 10 faces cadastradas

   📦 Lote 2/3 (10 faces)
   ✅ 10 faces cadastradas

   📦 Lote 3/3 (8 faces)
   ✅ 8 faces cadastradas

   ✅ FASE 2 CONCLUÍDA: 28 faces

   💾 Salvando no cache...
   ✅ Cache atualizado

╔════════════════════════════════════════════════════╗
║                  RELATÓRIO FINAL                   ║
╚════════════════════════════════════════════════════╝
⏱️  Tempo total: 45.32s
👥 Usuários cadastrados: 28
🎭 Faces cadastradas: 28
❌ Erros: 0

🎉 Cadastro incremental concluído com sucesso!
```

---

## 🛠️ Como funciona por dentro

### 1. Busca de faces existentes

```javascript
// Chama a API da catraca para buscar faces
const existingFaces = await apiClient.fetchExistingFaces(deviceIp);
// Retorna um Set com UserIDs (inviteIds) que já têm face
```

### 2. Filtragem de usuários

```javascript
// Filtra apenas usuários sem face
const usersToRegister = allUsers.filter(user => {
    const userIdForDevice = String(user.inviteId || user.userId);
    return !existingFaces.has(userIdForDevice);
});
```

### 3. Cadastro incremental

- Cadastra SOMENTE os usuários filtrados
- Usa batches de 10 (igual aos outros scripts)
- Aguarda 3s entre usuários e faces

---

## ⚙️ Configurações Avançadas

### Mudar tamanho do batch

Edite `BATCH_SIZE` em `facial-registration-incremental.js`:

```javascript
const BATCH_SIZE = 10; // Altere para 5, 15, etc.
```

### Mudar tempo de espera

Edite o delay entre fases:

```javascript
await new Promise(resolve => setTimeout(resolve, 3000)); // 3s
```

---

## 🐛 Troubleshooting

### Problema: "Nenhum novo cadastro necessário!"

**Causa**: Todos os usuários já estão cadastrados.

**Solução**: Isso é esperado! Use o `register-faces-v2` se quiser forçar recadastro.

### Problema: Alguns usuários não aparecem

**Causa**: Podem já estar cadastrados com o mesmo `inviteId`.

**Solução**: 
1. Verifique o cache: `npm run cache:device 10.224.0.32`
2. Se necessário, delete e recadastre com `register-faces-v2`

---

## 📌 Casos de Uso

### ✅ Ideal para:
- Cadastros diários de novos participantes
- Eventos com inscrições contínuas
- Atualizações incrementais
- Minimizar carga nas catracas

### ❌ Não use para:
- Primeiro cadastro completo (use `register-faces-v2`)
- Recadastro forçado de todos
- Atualização de fotos existentes

---

## 🔐 Segurança

- ✅ Não deleta usuários existentes
- ✅ Não sobrescreve faces já cadastradas
- ✅ Preserva dados do cache
- ✅ Apenas adiciona novos registros

---

## 📚 Documentos Relacionados

- [USER-REGISTRATION.md](USER-REGISTRATION.md) - Como funciona o cadastro completo
- [TEST-README.md](TEST-README.md) - Testes e validações

---

**Criado em:** 2025-10-30  
**Versão:** 1.0.0

