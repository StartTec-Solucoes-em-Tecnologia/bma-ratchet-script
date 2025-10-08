# Registro de Usuários em Catracas

Este documento explica como usar o script para registrar usuários nas catracas.

## Configuração

### Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto com as seguintes variáveis:

```env
# Lista de IPs das catracas separados por vírgula
DEVICE_IPS=192.168.1.100,192.168.1.101,192.168.1.102

# URL base da API para buscar participantes
BASE_URL=https://api.exemplo.com
```

### Estrutura da API de Participantes

A API deve retornar dados no seguinte formato:

```json
{
  "success": true,
  "data": [
    {
      "id": "c80s8g5d2fofqkk7ppyvmhwj",
      "nome": "ROBERTA MARIA AGUIAR MILET",
      "codigo_de_convite": "E027",
      "tipo": "PARTICIPANT"
    }
  ]
}
```

## Uso

### Registrar Usuários em Catracas

```bash
# Usando npm script
npm run register-users

# Ou executando diretamente
node src/index.js --register-users
```

### Configurar Catracas (modo padrão)

```bash
# Usando npm script
npm start

# Ou executando diretamente
node src/index.js
```

## Funcionamento

1. **Busca Participantes**: O script faz uma requisição para `{BASE_URL}/api/open/event/f4iarsufucggne5zk82952hh/participants`
2. **Registra em Cada Catraca**: Para cada participante, registra em todas as catracas usando a rota:
   ```
   http://{device_ip}/cgi-bin/recordUpdater.cgi?action=insert&name=AccessControlCard&CardNo={codigo_de_convite}&CardStatus=0&CardName={nome}&UserID={id}&Doors[0]=0
   ```

## Mapeamento de Dados

- `CardNo`: `codigo_de_convite` do participante
- `CardName`: `nome` do participante  
- `UserID`: `id` do participante
- `CardStatus`: 0 (ativo)
- `Doors[0]`: 0 (todas as portas)

## Relatório

O script gera um relatório detalhado mostrando:
- Total de participantes encontrados
- Total de catracas processadas
- Total de operações realizadas
- Número de sucessos e erros
- Detalhes por participante e catraca
