# Upstash Redis - Console do Jeff

## Configuração

Siga os passos para configurar o banco de dados Redis:

### 1. Criar banco Upstash Redis
1. Acesse https://upstash.com
2. Faça login (pode usar conta GitHub)
3. Clique em "Create Database"
4. Escolha **Redis** (não Kafka)
5. Nome: `console-do-jeff-views`
6. Região: Escolha a mais próxima (US ou EU)
7. Clique em **Create**

### 2. Copiar variáveis de ambiente
Após criar, você verá estas informações:

```
UPSTASH_REDIS_REST_URL=https://xxxxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=Axxxxxxxxx
```

### 3. Configurar no Vercel
1. Acesse https://vercel.com
2. Selecione seu projeto (console-do-jeff)
3. Vá em **Settings** → **Environment Variables**
4. Adicione as variáveis:
   - `UPSTASH_REDIS_REST_URL` = URL do Upstash
   - `UPSTASH_REDIS_REST_TOKEN` = Token do Upstash
5. Clique em **Save**

### 4. Fazer deploy
```bash
git add -A
git commit -m "feat: add Upstash Redis persistence for view counter"
git push
```

## Custo
- **Plano Hobby:** 10,000 comandos/dia GRÁTIS
- Suficiente para blogs de tráfego baixo-médio

## Verificar
Após configurar, visite seus posts.
O contador deve começar em `0` e incrementar corretamente.

O banco de dados Upstash vai armazenar as visualizações permanentemente!