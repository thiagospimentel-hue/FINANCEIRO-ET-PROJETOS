// Edge Function "gerenciar-acesso" — criar/convidar/redefinir/remover acessos (somente administrador).
// Segredo opcional (recomendado): ALLOWED_ORIGINS = "https://seu-app.vercel.app,https://financeiro.suaempresa.com.br"
//   supabase secrets set ALLOWED_ORIGINS="https://seu-app.vercel.app"
// Sem esse segredo, só são aceitas origens *.vercel.app e localhost (modo de teste).
import { createClient } from "jsr:@supabase/supabase-js@2";

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
const msgEmail = (m: string) => {
  if (/rate limit/i.test(m)) return "Limite de envio de e-mails atingido. Aguarde um pouco ou configure um servidor de e-mail próprio (SMTP) no Supabase.";
  if (/not authorized|not allowed|only.*team/i.test(m)) return "O Supabase só envia e-mails de teste para a equipe do projeto. Configure um servidor de e-mail próprio (SMTP) em Authentication → Emails.";
  return m;
};

Deno.serve(async (req) => {
  const cors = corsDe(req);
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const origem = req.headers.get("Origin");
  if (origem && !origemOk(origem)) return json({ erro: "Origem não autorizada" }, 403);
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false },
    });
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer /i, "");
    const { data: u } = await admin.auth.getUser(token);
    if (!u?.user) return json({ erro: "Não autenticado" }, 401);
    const { data: me } = await admin.from("profiles").select("role,email").eq("user_id", u.user.id).maybeSingle();
    if (me?.role !== "admin") return json({ erro: "Somente o administrador pode gerenciar acessos" }, 403);

    const auditar = async (operacao: string, chave: string, depois: unknown) => {
      const { error } = await admin.from("auditoria").insert({
        user_id: u.user.id, user_email: me.email, tabela: "acesso", chave, operacao, depois,
      });
      if (error) console.error("auditoria:", error.message);
    };

    const b = await req.json();
    const email = String(b.email || "").trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 200) return json({ erro: "E-mail inválido" }, 400);
    const senha = String(b.senha || "");

    // redirectTo só pode apontar para um endereço autorizado do próprio aplicativo
    let redirectTo: string | undefined;
    if (b.redirectTo) {
      let r: URL;
      try { r = new URL(String(b.redirectTo)); } catch { return json({ erro: "Endereço de retorno inválido" }, 400); }
      if (!origemOk(r.origin)) return json({ erro: "Endereço de retorno não autorizado. Configure ALLOWED_ORIGINS." }, 400);
      redirectTo = r.origin + r.pathname;
    }

    if (b.acao === "criar" || b.acao === "convidar") {
      if (b.acao === "criar" && senha.length < 8) return json({ erro: "A senha precisa ter ao menos 8 caracteres" }, 400);
      const colab = String(b.colaboradorId || "");
      if (!colab) return json({ erro: "Colaborador não informado" }, 400);

      // o colaborador precisa existir no cadastro (cfg/main) — evita vincular acesso a um id inventado
      const { data: cfg, error: eCfg } = await admin.from("docs").select("data").eq("path", "cfg/main").maybeSingle();
      if (eCfg) return json({ erro: "Não foi possível validar o colaborador: " + eCfg.message }, 500);
      const lista = (cfg?.data?.colaboradores ?? []) as Array<{ id: string }>;
      if (!lista.some((c) => c.id === colab)) {
        return json({ erro: "Colaborador não encontrado no cadastro. Salve o cadastro antes de liberar o acesso." }, 400);
      }
      // e-mail já cadastrado: em vez de recusar, reenvia o link para definir/redefinir a senha
      if (b.acao === "convidar") {
        const { data: existente } = await admin.from("profiles").select("user_id,role").eq("email", email).maybeSingle();
        if (existente) {
          if (existente.role === "admin") return json({ erro: "Este e-mail pertence a um administrador." }, 409);
          const { error: eRe } = await admin.auth.resetPasswordForEmail(email, { redirectTo });
          if (eRe) return json({ erro: msgEmail(eRe.message) }, 400);
          await auditar("LINK_REENVIADO", email, null);
          return json({ ok: true, reenviado: true });
        }
      }
      const { data: ja } = await admin.from("profiles").select("user_id").eq("colaborador_id", colab).maybeSingle();
      if (ja) return json({ erro: "Este colaborador já tem acesso. Use redefinir senha." }, 409);
      const { data: mesmo } = await admin.from("profiles").select("user_id").eq("email", email).maybeSingle();
      if (mesmo) return json({ erro: "Este e-mail já está em uso por outro acesso." }, 409);

      const expira = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
      const { error: eConv } = await admin.from("convites").upsert({ email, role: "colab", colaborador_id: colab, expira_em: expira });
      if (eConv) return json({ erro: "Não foi possível registrar o convite: " + eConv.message }, 500);

      const { data: criado, error } = b.acao === "criar"
        ? await admin.auth.admin.createUser({ email, password: senha, email_confirm: true })
        : await admin.auth.admin.inviteUserByEmail(email, { redirectTo });
      if (error) {
        await admin.from("convites").delete().eq("email", email);
        return json({ erro: msgEmail(error.message) }, 400);
      }
      // confirma que o perfil foi criado; se não, desfaz o usuário órfão
      const { data: perfil } = await admin.from("profiles").select("user_id").eq("email", email).maybeSingle();
      if (!perfil) {
        if (criado?.user?.id) await admin.auth.admin.deleteUser(criado.user.id);
        await admin.from("convites").delete().eq("email", email);
        return json({ erro: "O acesso não pôde ser concluído (perfil não criado). Nada foi mantido; tente novamente." }, 500);
      }
      await auditar(b.acao === "criar" ? "ACESSO_CRIADO" : "CONVITE_ENVIADO", email, { colaborador_id: colab, expira_em: expira });
      return json({ ok: true });
    }

    const { data: alvo } = await admin.from("profiles").select("user_id,role").eq("email", email).maybeSingle();
    if (!alvo) return json({ erro: "Usuário não encontrado" }, 404);

    if (b.acao === "senha") {
      if (senha.length < 8) return json({ erro: "A senha precisa ter ao menos 8 caracteres" }, 400);
      const { error } = await admin.auth.admin.updateUserById(alvo.user_id, { password: senha });
      if (error) return json({ erro: error.message }, 400);
      await auditar("SENHA_REDEFINIDA", email, null);
      return json({ ok: true });
    }
    if (b.acao === "recuperar") {
      const { error } = await admin.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) return json({ erro: msgEmail(error.message) }, 400);
      await auditar("LINK_RECUPERACAO_ENVIADO", email, null);
      return json({ ok: true });
    }
    if (b.acao === "remover") {
      if (alvo.role === "admin") return json({ erro: "Não é possível remover um administrador por aqui" }, 403);
      const { error } = await admin.auth.admin.deleteUser(alvo.user_id);
      if (error) return json({ erro: error.message }, 400);
      await auditar("ACESSO_REMOVIDO", email, null);
      return json({ ok: true });
    }
    return json({ erro: "Ação inválida" }, 400);
  } catch (e) {
    return json({ erro: String((e as Error).message || e) }, 500);
  }
});
