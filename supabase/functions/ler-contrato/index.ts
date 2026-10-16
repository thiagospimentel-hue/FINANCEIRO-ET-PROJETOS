// Edge Function "ler-contrato" — lê um contrato em PDF (guardado no bucket privado "contratos")
// e devolve os dados estruturados para o administrador conferir. Não grava nada no banco.
// Segredos: ANTHROPIC_API_KEY (obrigatório) e, opcional, ALLOWED_ORIGINS, MODELO_CONTRATOS.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { encodeBase64 } from "jsr:@std/encoding@1/base64";

const permitidas = (Deno.env.get("ALLOWED_ORIGINS") || "").split(",").map((s) => s.trim().replace(/\/$/, "")).filter(Boolean);
function origemOk(o: string | null): boolean {
  if (!o) return false;
  const x = o.replace(/\/$/, "");
  if (permitidas.length) return permitidas.includes(x);
  return /^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)*\.vercel\.app$/.test(x) || /^http:\/\/localhost(:\d+)?$/.test(x);
}
const corsDe = (req: Request) => {
  const o = req.headers.get("Origin");
  const h: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
  if (o && origemOk(o)) h["Access-Control-Allow-Origin"] = o;
  return h;
};

const texto = (descricao: string) => ({ type: ["string", "null"], description: descricao });
const numero = (descricao: string) => ({ type: ["number", "null"], description: descricao });
const SCHEMA = {
  type: "object",
  properties: {
    numeroContrato: texto("Número do contrato, como escrito (ex.: 671-06)"),
    nomeObra: texto("Nome da obra/empreendimento (ex.: Rota Panorama)"),
    numeroObra: texto("Número da obra, se houver"),
    enderecoObra: texto("Endereço da obra"),
    contratante: {
      type: "object",
      properties: {
        razaoSocial: texto("Razão social do CONTRATANTE (quem paga)"),
        cnpj: texto("CNPJ do contratante, com pontuação"),
        endereco: texto("Endereço da sede do contratante"),
        email: texto("E-mail do contratante, só se constar no contrato"),
        telefone: texto("Telefone do contratante, só se constar"),
      },
      required: ["razaoSocial", "cnpj", "endereco", "email", "telefone"],
    },
    construtora: texto("Construtora/incorporadora do grupo, se citada (ex.: EBM)"),
    contratada: {
      type: "object",
      properties: { razaoSocial: texto("Razão social da CONTRATADA (quem presta o serviço)"), cnpj: texto("CNPJ da contratada") },
      required: ["razaoSocial", "cnpj"],
    },
    objeto: texto("Resumo do objeto/escopo em uma frase"),
    valorContrato: numero("Valor total do contrato em reais, número puro (224100.00)"),
    dataAssinatura: texto("Data de assinatura, AAAA-MM-DD"),
    dataInicio: texto("Data de início, AAAA-MM-DD"),
    dataTermino: texto("Data de término/previsão, AAAA-MM-DD"),
    parcelas: {
      type: "array",
      description: "Parcelas de pagamento na ordem do contrato (Quadro Geral / Anexo de forma de pagamento)",
      items: {
        type: "object",
        properties: {
          nome: { type: "string", description: "Nome curto. Use exatamente 'Assinatura de contrato', 'Projeto Básico', 'Projeto Pré-Executivo', 'Projeto Executivo' ou 'Projeto Legal' (entrega p/ aprovação em órgãos) quando for o caso; senão, descreva em poucas palavras" },
          valor: { type: "number", description: "Valor da parcela em reais" },
          gatilho: texto("Evento que gera o pagamento, como no contrato"),
          prazoPagamento: texto("Prazo de pagamento da parcela, se específico"),
        },
        required: ["nome", "valor", "gatilho", "prazoPagamento"],
      },
    },
    prazoPagamentoNF: texto("Prazo geral para pagamento da nota fiscal"),
    impostosRetidos: texto("Quais impostos o contratante retém na fonte"),
    reajuste: texto("Regra de reajuste/INCC do contrato"),
    multas: texto("Resumo das multas por atraso/descumprimento"),
    observacoes: { type: "array", items: { type: "string" }, description: "Divergências internas, pontos de atenção ou cláusulas relevantes para o financeiro" },
    camposIncertos: { type: "array", items: { type: "string" }, description: "Campos que não constam ou não puderam ser lidos com segurança" },
  },
  required: ["numeroContrato", "nomeObra", "enderecoObra", "contratante", "construtora", "contratada", "objeto", "valorContrato", "dataAssinatura", "dataInicio", "dataTermino", "parcelas", "prazoPagamentoNF", "impostosRetidos", "reajuste", "multas", "observacoes", "camposIncertos"],
};

const PROMPT = `Você é assistente financeiro de uma empresa de engenharia (a CONTRATADA). Leia o contrato anexo e registre os dados chamando a ferramenta.
Regras: (1) Só use o que está escrito no contrato; nunca invente. Se algo não consta, use null e liste em camposIncertos. (2) Valores em reais como número puro. Datas em AAAA-MM-DD. (3) Confira se a soma das parcelas é igual ao valor do contrato e, se não for, registre em observacoes. (4) Registre em observacoes divergências entre cláusulas (por exemplo, prazos de pagamento diferentes) e retenções de impostos. (5) Os anexos podem ser imagens; considere-os.`;

Deno.serve(async (req) => {
  const cors = corsDe(req);
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const origem = req.headers.get("Origin");
  if (origem && !origemOk(origem)) return json({ erro: "Origem não autorizada" }, 403);
  try {
    const chave = Deno.env.get("ANTHROPIC_API_KEY");
    if (!chave) return json({ erro: "A leitura automática ainda não foi ativada (falta a chave ANTHROPIC_API_KEY no Supabase)." }, 503);
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer /i, "");
    const { data: u } = await admin.auth.getUser(token);
    if (!u?.user) return json({ erro: "Não autenticado" }, 401);
    const { data: me } = await admin.from("profiles").select("role,email").eq("user_id", u.user.id).maybeSingle();
    if (me?.role !== "admin") return json({ erro: "Somente o administrador pode ler contratos" }, 403);

    const { path } = await req.json();
    if (typeof path !== "string" || !/^obras\/[A-Za-z0-9_.~:@+-]{1,120}\/[A-Za-z0-9_.~:@+\- ]{1,200}$/.test(path) || path.includes("..")) {
      return json({ erro: "Arquivo inválido" }, 400);
    }
    const { data: blob, error: eDown } = await admin.storage.from("contratos").download(path);
    if (eDown || !blob) return json({ erro: "Arquivo não encontrado no armazenamento: " + (eDown?.message || "") }, 404);
    if (blob.size > 30 * 1024 * 1024) return json({ erro: "O arquivo passa de 30 MB." }, 413);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    if (String.fromCharCode(...bytes.slice(0, 4)) !== "%PDF") return json({ erro: "O arquivo não é um PDF." }, 400);

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": chave, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: Deno.env.get("MODELO_CONTRATOS") || "claude-sonnet-5-5",
        max_tokens: 6000,
        tools: [{ name: "registrar_contrato", description: "Registra os dados extraídos do contrato", input_schema: SCHEMA }],
        tool_choice: { type: "tool", name: "registrar_contrato" },
        messages: [{ role: "user", content: [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: encodeBase64(bytes) } },
          { type: "text", text: PROMPT },
        ] }],
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return json({ erro: "Falha na leitura: " + (j?.error?.message || ("HTTP " + r.status)) }, 502);
    const uso = j.usage || {};
    const dados = (j.content || []).find((c: { type: string }) => c.type === "tool_use")?.input;
    if (!dados) return json({ erro: "A leitura não retornou dados." }, 502);
    await admin.from("auditoria").insert({ user_id: u.user.id, user_email: me.email, tabela: "contrato", chave: path, operacao: "LEITURA_CONTRATO", depois: { tokens_entrada: uso.input_tokens, tokens_saida: uso.output_tokens } });
    return json({ ok: true, dados, uso });
  } catch (e) {
    return json({ erro: String((e as Error).message || e) }, 500);
  }
});
