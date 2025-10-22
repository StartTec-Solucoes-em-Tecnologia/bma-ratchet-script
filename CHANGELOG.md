# Changelog

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

## [2.0.0] - 2025-10-22

### 🎉 Principais Mudanças

Sistema de registro facial completamente reescrito com fluxo completo de cadastro.

### ✨ Novas Funcionalidades

#### Verificação de Usuários Existentes
- Busca todos os usuários cadastrados na leitora antes de processar
- API: `GET /recordFinder.cgi?action=doSeekFind&name=AccessControlCard`
- Parser customizado para resposta text/plain

#### Remoção Inteligente de Duplicatas
- Detecta usuários já existentes por UserID
- Remove automaticamente antes de recriar
- API: `GET /recordUpdater.cgi?action=remove&name=AccessControlCard&RecNo={recno}`
- Evita erros de duplicata

#### Cadastro Completo de Usuário
- Cadastra dados do usuário ANTES da face biométrica
- API: `POST /AccessUser.cgi?action=insertMulti`
- Campos: UserID, UserName, UserType, Authority, Doors, TimeSections, ValidFrom, ValidTo
- Dados buscados do banco de dados (Prisma)
- Batches de até 10 usuários

#### Cache Redis
- Salva UserIDs cadastrados por dispositivo
- Estrutura: `device:{ip}:users` (Set)
- Operação: `SADD` após cadastro bem-sucedido
- Facilita rastreamento e sincronização futura

#### Query de Banco Expandida
- Busca campos adicionais via Prisma:
  - `document` (participant)
  - `email` (participant e guest)
  - `cellphone` (participant e guest)
- Suporta dados para APIs futuras

#### Relatórios Expandidos
- **Novas métricas**:
  - 👀 Usuários verificados
  - 🗑️ Usuários deletados
  - 👤 Usuários cadastrados
  - 🎭 Faces cadastradas
  - 💾 Saves no Redis
- Estatísticas separadas por lote e dispositivo
- Relatório detalhado de sucessos/falhas

### 🔧 Melhorias

- Tratamento de erros individual por operação
- Logs mais detalhados com emojis contextuais
- Pausas estratégicas entre operações (evita timeout)
- Desconexão limpa do Redis ao final
- Código completamente modularizado

### 📦 Dependências

**Adicionadas:**
- `redis ^4.x.x` - Cliente Redis para cache

**Mantidas:**
- `sharp` - Processamento de imagens
- `axios` - Requisições HTTP
- `@mhoc/axios-digest-auth` - Autenticação Digest
- `@prisma/client` - ORM do banco
- `dotenv` - Variáveis de ambiente

### 📝 Variáveis de Ambiente

**Adicionadas:**
- `REDIS_URL` - URL de conexão ao Redis (padrão: redis://localhost:6379)

**Mantidas:**
- `DATABASE_URL` - String de conexão PostgreSQL
- `EVENT_ID` - ID do evento a processar
- `FACE_READER_IPS` - IPs das leitoras (separados por vírgula)
- `DIGEST_USERNAME` - Username para autenticação
- `DIGEST_PASSWORD` - Password para autenticação

### 🔄 Fluxo de Execução Atualizado

**Antes (v1.0):**
```
1. Buscar dados do banco
2. Processar imagens
3. Cadastrar faces
4. Relatório
```

**Agora (v2.0):**
```
1. Inicializar Redis
2. Buscar dados do banco (com campos adicionais)
3. Processar imagens
4. Para cada leitora:
   a. Buscar usuários existentes
   b. Deletar se existir
   c. Cadastrar usuário
   d. Cadastrar face
   e. Salvar no Redis
5. Relatório expandido
6. Fechar conexões
```

### 📄 Documentação

**Adicionada:**
- `docs/FACIAL-REGISTRATION-V2.md` - Documentação completa da v2.0
- `CHANGELOG.md` - Este arquivo

**Atualizada:**
- `README.md` - Informações sobre v2.0
- `IMPLEMENTATION-SUMMARY.md` - Resumo atualizado

### 🧪 APIs Utilizadas

**Novas APIs:**
1. `GET /recordFinder.cgi?action=doSeekFind` - Lista usuários
2. `GET /recordUpdater.cgi?action=remove` - Remove usuário
3. `POST /AccessUser.cgi?action=insertMulti` - Cadastra usuários

**APIs Existentes:**
1. `POST /AccessFace.cgi?action=insertMulti` - Cadastra faces (mantida)

### ⚡ Performance

- **Tempo adicional**: ~20-40s para 50 usuários (verificação + cadastro)
- **Tempo total**: ~3-5 minutos para 50 usuários em 3 leitoras
- **Otimizações**: Batching, pausas estratégicas, cache Redis assíncrono

### 🔒 Segurança

- Credenciais nunca expostas em logs
- Autenticação Digest em todas as APIs
- Validação de dados antes do envio
- Redis local (sem exposição externa recomendada)

### 🐛 Correções

- Gerador Prisma corrigido de `prisma-client` para `prisma-client-js`
- Import Prisma atualizado para `@prisma/client`
- Tratamento de erro mais robusto

### 🔀 Breaking Changes

**Nenhuma mudança incompatível!** A v2.0 é totalmente retrocompatível:
- Mesmas variáveis de ambiente (exceto REDIS_URL que é opcional)
- Mesmo comando de execução: `npm run register-faces`
- Redis é opcional (script continua sem cache se indisponível)

### 📊 Estatísticas

- **Linhas de código**: ~700 linhas (vs ~450 na v1.0)
- **Funções adicionadas**: 5 novas funções
- **APIs integradas**: 4 APIs (vs 1 na v1.0)
- **Cobertura**: Cadastro completo de usuário + face

---

## [1.0.0] - 2025-10-22

### ✨ Release Inicial

#### Funcionalidades

- Busca de invites com facial_image via Prisma
- Download de imagens faciais
- Processamento de imagens (resize + compress):
  - Resolução alvo: 500x500 pixels
  - Tamanho máximo: 100KB
  - Formato: JPEG
- Conversão para base64
- Cadastro de faces em leitoras via API
- Suporte a múltiplas leitoras
- Batching de até 10 usuários
- Autenticação Digest HTTP
- Relatórios com estatísticas

#### Dependências Iniciais

- `sharp` - Processamento de imagens
- `axios` - Requisições HTTP
- `@mhoc/axios-digest-auth` - Autenticação
- `@prisma/client` - Banco de dados
- `dotenv` - Variáveis de ambiente

#### Documentação

- `docs/FACIAL-REGISTRATION.md`
- `docs/QUICK-START-FACIAL.md`
- `test/test-facial-registration.js`

---

## Formato

Este changelog segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere a [Semantic Versioning](https://semver.org/lang/pt-BR/).

## Tipos de Mudanças

- **Adicionado** para novas funcionalidades
- **Modificado** para mudanças em funcionalidades existentes
- **Descontinuado** para funcionalidades que serão removidas
- **Removido** para funcionalidades removidas
- **Corrigido** para correções de bugs
- **Segurança** para vulnerabilidades

