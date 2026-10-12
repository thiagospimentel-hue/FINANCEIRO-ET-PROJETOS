import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const msgEmail = (m: string) => {
  if (/rate limit/i.test(m)) return "Limite de envio de e-mails atingido. Aguarde um pouco ou configure um servidor de e-mail próprio (SMTP) no Supabase.";
  if (/not authorized|not allowed|only.*team/i.test(m)) return "O Supabase só envia e-mails de teste para a equipe do projeto. Configure um servidor de e-mail próprio (SMTP) em Authentication → Emails.";
  return m;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false },
    });
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer /i, "");
    const { data: u } = await admin.auth.getUser(token);
    if (!u?.user) return json({ erro: "Não autenticado" }, 401);
    const { data: me } = await admin.from("profiles").select("role").eq("user_id", u.user.id).maybeSingle();
    if (me?.role !== "admin") return json({ erro: "Somente o administrador pode gerenciar acessos" }, 403);

    const b = await req.json();
    const email = String(b.email || "").trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ erro: "E-mail inválido" }, 400);
    const senha = String(b.senha || "");
    const redirectTo = String(b.redirectTo || "") || undefined;

    if (b.acao === "criar" || b.acao === "convidar") {
      if (b.acao === "criar" && senha.length < 8) return json({ erro: "A senha precisa ter ao menos 8 caracteres" }, 400);
      const colab = String(b.colaboradorId || "");
      if (!colab) return json({ erro: "Colaborador não informado" }, 400);
      const { data: ja } = await admin.from("profiles").select("user_id").eq("colaborador_id", colab).maybeSingle();
      if (ja) return json({ erro: "Este colaborador já tem acesso. Use redefinir senha." }, 409);
      const { data: mesmo } = await admin.from("profiles").select("user_id").eq("email", email).maybeSingle();
      if (mesmo) return json({ erro: "Este e-mail já está em uso por outro acesso." }, 409);
      await admin.from("convites").upsert({ email, role: "colab", colaborador_id: colab });
      const { error } = b.acao === "criar"
        ? await admin.auth.admin.createUser({ email, password: senha, email_confirm: true })
        : await admin.auth.admin.inviteUserByEmail(email, { redirectTo });
      if (error) {
        await admin.from("convites").delete().eq("email", email);
        return json({ erro: msgEmail(error.message) }, 400);
      }
      return json({ ok: true });
    }

    const { data: alvo } = await admin.from("profiles").select("user_id,role").eq("email", email).maybeSingle();
    if (!alvo) return json({ erro: "Usuário não encontrado" }, 404);

    if (b.acao === "senha") {
      if (senha.length < 8) return json({ erro: "A senha precisa ter ao menos 8 caracteres" }, 400);
      const { error } = await admin.auth.admin.updateUserById(alvo.user_id, { password: senha });
      if (error) return json({ erro: error.message }, 400);
      return json({ ok: true });
    }
    if (b.acao === "recuperar") {
      const { error } = await admin.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) return json({ erro: msgEmail(error.message) }, 400);
      return json({ ok: true });
    }
    if (b.acao === "remover") {
      if (alvo.role === "admin") return json({ erro: "Não é possível remover um administrador por aqui" }, 403);
      const { error } = await admin.auth.admin.deleteUser(alvo.user_id);
      if (error) return json({ erro: error.message }, 400);
      return json({ ok: true });
    }
    return json({ erro: "Ação inválida" }, 400);
  } catch (e) {
    return json({ erro: String((e as Error).message || e) }, 500);
  }
});
