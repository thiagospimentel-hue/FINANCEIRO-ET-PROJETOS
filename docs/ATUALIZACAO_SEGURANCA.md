# Atualização de segurança e integridade — guia de aplicação

## Ordem de aplicação (importante)

| # | Onde | O que fazer | Observação |
|---|------|-------------|------------|
| 1 | Supabase → SQL Editor | Rodar `supabase/002_integridade_auditoria.sql` | Aditivo: não apaga nada. Cria versão por documento, auditoria, fichas, `gravar_lote`, backups. O app antigo continua funcionando. |
| 2 | GitHub → Vercel | Publicar o novo `index.html` + `vercel.json` (já estão no repositório; o Vercel publica sozinho) | Cabeçalhos de segurança e CSP entram junto. |
| 3 | Navegador (admin) | Entrar no app novo **uma vez** e esperar o chip mostrar "☁ Salvo" | Gera as "fichas" dos colaboradores. Todos os admins devem recarregar a página. |
| 4 | Supabase → SQL Editor | Rodar `supabase/003_privacidade_cutover.sql` | **Só depois do passo 3.** Daqui em diante o colaborador não lê mais nenhuma tabela e ninguém grava em `docs` sem passar por `gravar_lote`. Versões antigas do HTML deixam de conseguir gravar (de propósito). |
| 5 | Supabase → Edge Functions | Publicar `supabase/functions/gerenciar-acesso/index.ts` e definir o segredo `ALLOWED_ORIGINS` (ex.: `https://SEU-APP.vercel.app`) | Sem o segredo, só *.vercel.app e localhost são aceitos. |
| 6 | Supabase → Authentication → URL Configuration | Site URL e Redirect URLs = endereço do Vercel | Necessário para o link do convite funcionar. |
| 7 | Supabase → Authentication → SMTP | Configurar SMTP próprio (ex.: Gmail com senha de app) | O envio padrão do Supabase só entrega para a equipe do projeto. |
| 8 | Opcional | `supabase/004_agendar_backup.sql` (precisa ativar pg_cron) | Backup diário automático. |

Depois de cada alteração no `index.html`: `node tools/atualizar-csp.js` (recalcula o hash do CSP em `vercel.json`). Sem isso o navegador bloqueia o script.

## Backup e restauração

* O plano gratuito do Supabase **não** faz backup automático. O que existe agora: `public.backups` (uma cópia por dia, guarda 30 dias) + o botão "Backup" do app (arquivo JSON).
* Gerar um backup agora: `select public.fazer_backup();`
* Ver backups: `select dia, criado_em, jsonb_array_length(docs) from public.backups order by dia desc;`
* **Restaurar** (somente SQL Editor, como dono do projeto): `select public.restaurar_backup('AAAA-MM-DD');` — antes de restaurar, o estado atual é salvo como backup do dia. Depois, recarregue o app (os admins devem recarregar a página; as fichas dos colaboradores são restauradas junto).
* Teste de restauração feito em Postgres local (ver "O que foi testado"). **Faça um ensaio no seu projeto** antes de precisar dele.

## Regra atual do INCC (para você decidir — NADA foi alterado)

1. O valor de cada etapa a cobrar = (soma dos serviços × fator acumulado dos reajustes **aplicados**) × % da etapa.
2. Quando a etapa recebe **NF ou qualquer baixa (mesmo parcial)**, o valor é **congelado** (`valorFixo`). Reajustes aplicados depois **não** alteram essa etapa.
3. Consequência: numa etapa parcialmente recebida, o INCC posterior **não** incide sobre o saldo restante; a etapa continua valendo o que valia no 1º recebimento/NF. Só etapas sem NF e sem recebimento acompanham o INCC.
4. A parcela da equipe congela quando a entrega é aprovada.

Pergunta: para etapa parcialmente recebida, o INCC deve (a) continuar sem incidir (regra atual), (b) incidir só sobre o saldo, ou (c) incidir sobre a etapa inteira, gerando uma cobrança complementar? Enquanto não houver resposta, o comportamento fica como está.

## O que foi implementado (resumo)

* **Privacidade:** colaborador só chama `colab_dados()`; a função monta a resposta campo a campo (lista fechada) a partir de uma ficha própria dele; não existe mais leitura de `docs`/`profiles` de terceiros. O valor a receber é calculado pelo app do administrador e gravado na ficha; o banco só devolve a ficha.
* **Textos:** escape em todas as interpolações de texto livre (nomes, observações, descrições, recibos, relatórios), CSP sem `unsafe-inline` para scripts, cabeçalhos de segurança.
* **Sessão:** por padrão a sessão vive só na aba (sessionStorage); "Manter conectado" usa localStorage; logout por inatividade (30 min; 12 h se mantido).
* **Pagamentos:** baixa + lançamento no caixa + ficha vão no mesmo lote (uma transação no banco); identificador de operação único (reenvio não duplica); "Salvo" só aparece após a confirmação do servidor.
* **Sincronização:** versão por documento; conflito de edição bloqueia a gravação e oferece baixar suas alterações / carregar a versão do servidor; consulta antiga não sobrescreve o que acabou de ser salvo; pendências são guardadas no navegador e reenviadas; aviso ao fechar com alterações não salvas; estados Salvando / Salvo / Falhou / Conflito.
* **Regras financeiras:** somas em centavos, arredondamento comercial em 2 casas, recusa de pagamento ≤ 0 ou acima do saldo, conferência de percentuais (etapas = 100 %, equipe ≤ 100 %), conferência aditivo ↔ cobrança, contratado / faturado / recebido / saldo continuam separados.
* **Histórico:** auditoria no banco (quem, quando, operação, antes/depois); estorno identificado (motivo, quem, quando) com lançamento inverso no caixa, no lugar de apagar a baixa.
* **Acessos:** convite com validade de 7 dias; Edge Function valida o colaborador, restringe CORS e `redirectTo`, desfaz usuário órfão e grava auditoria; o convite por e-mail (a pessoa define a própria senha) é o caminho recomendado.

## Não implementado nesta rodada

Item 7 (aprovado e não faturado, previsão 30/60/90 dias, conciliação automática, controle de NF/recibo, resultado por obra/empresa, fechamento mensal com trava) fica para a próxima etapa, como combinado ("após as correções"). Também fica pendente a sua decisão sobre o INCC.
