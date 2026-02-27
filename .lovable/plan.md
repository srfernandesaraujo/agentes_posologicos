
## Corrigir Product IDs no stripe-webhook

### Problema
O arquivo `supabase/functions/stripe-webhook/index.ts` usa Product IDs antigos para mapear assinaturas aos creditos mensais. Isso faz com que, quando um pagamento de assinatura chega via webhook, o sistema nao reconheca o produto e nao credite os creditos ao usuario.

### IDs atuais (errados) vs corretos

| Plano         | ID atual (errado)         | ID correto (novo)         | Creditos |
|---------------|---------------------------|---------------------------|----------|
| Basico        | prod_U1QUUwFaiMvahz       | prod_U3LR5lqvuJhqxF       | 30       |
| Pro           | prod_U1QUeqz6YtFUib       | prod_U3LQJwX1iyo4FH       | 100      |
| Institucional | prod_U1QUXJ141hfnYw       | prod_U3LRmBcPJe3JYb       | 300      |

### Alteracao

Atualizar as 3 linhas do mapa `SUBSCRIPTION_CREDITS` em `supabase/functions/stripe-webhook/index.ts` (linhas 12-14) com os Product IDs corretos e fazer o redeploy da funcao.

### Detalhes tecnicos

Arquivo: `supabase/functions/stripe-webhook/index.ts`

Substituir:
```typescript
const SUBSCRIPTION_CREDITS: Record<string, number> = {
  "prod_U1QUUwFaiMvahz": 30,   // Basico
  "prod_U1QUeqz6YtFUib": 100,  // Pro
  "prod_U1QUXJ141hfnYw": 300,  // Institucional
};
```

Por:
```typescript
const SUBSCRIPTION_CREDITS: Record<string, number> = {
  "prod_U3LR5lqvuJhqxF": 30,   // Basico
  "prod_U3LQJwX1iyo4FH": 100,  // Pro
  "prod_U3LRmBcPJe3JYb": 300,  // Institucional
};
```

Apos a edicao, a funcao sera redeployada automaticamente.
