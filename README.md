# Dashboard Financeiro

Início rápido para um dashboard financeiro pessoal em HTML/JS puro com integração Open Finance via Pluggy.

## Estrutura

- `backend/` - servidor Node.js/Express que gera tokens Pluggy e proxy para contas e transações.
- `frontend/` - dashboard estático com importação OFX/CSV, resumo financeiro e gráfico.

## Como rodar

1. Abra `backend/.env.example` e copie para `backend/.env`.
2. Preencha `PLUGGY_CLIENT_ID` e `PLUGGY_CLIENT_SECRET`.
3. Execute no terminal:
   ```powershell
   cd backend
   npm install
   npm start
   ```
4. Acesse `http://localhost:3000`.

## O que já está pronto

- importação de arquivos OFX/CSV
- conversão básica de transações para um modelo comum
- cards de receitas, despesas, saldo e contagem de transações
- gráfico de categoria com Chart.js
- layout responsivo simples
- backend Pluggy token / contas / transações

## Próximos passos possíveis

- adicionar filtros por data/banco/categoria
- melhorar parser OFX/CSV para formatos específicos
- incluir painel de investimentos com comparativo CDI/IBOVESPA
- implementar botão de lançamento manual de transações
- adicionar persistência local (IndexedDB ou backend)
