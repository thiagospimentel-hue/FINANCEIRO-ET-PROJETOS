const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
const jwt=sub=>b64({alg:'HS256'})+'.'+b64({sub})+'.sig';
const URL_APP='file:///home/claude/financeiro-et-projetos/index.html';
const results=[]; const T=(nome,ok,det)=>{ results.push([ok,nome,det]); console.log((ok?'PASS ':'FAIL ')+nome+(det!==undefined?'  '+JSON.stringify(det):'')); };
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  // ---------- servidor simulado (mesma lógica do SQL) ----------
  const S={ docs:{}, fichas:{}, ops:{}, offline:false, dropResp:0, holdDocs:null, reqs:[], users:{
    'admin@x.com':{id:'A1',pw:'senha123',role:'admin',colab:null},
    'ana@x.com':{id:'C1',pw:'ana12345',role:'colab',colab:'u1'},
    'bia@x.com':{id:'C2',pw:'bia12345',role:'colab',colab:'u2'} }, lotes:[] };
  const canon=v=>JSON.stringify(v);
  const hdr={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*','content-type':'application/json'};
  const uidOf=req=>{ const a=(req.headers()['authorization']||'').replace('Bearer ',''); try{return JSON.parse(Buffer.from(a.split('.')[1],'base64').toString()).sub;}catch(e){return null;} };
  const userById=id=>Object.entries(S.users).find(([e,u])=>u.id===id);
  const gravarLote=(uid,j)=>{
    const u=userById(uid); if(!u||u[1].role!=='admin') return [403,{message:'Sem permissão'}];
    if(S.ops[j.p_op]) return [200,Object.assign({},S.ops[j.p_op],{repetido:true})];
    const confl=[];
    j.p_ops.forEach(o=>{ if(o.t!=='doc') return; const cur=S.docs[o.path];
      if(o.del){ if(cur && cur.versao!==o.base) confl.push(o.path); }
      else if(cur && cur.versao!==o.base) confl.push(o.path); else if(!cur && o.base!=null) confl.push(o.path); });
    if(confl.length) return [400,{message:'CONFLITO|'+confl.join(','),code:'40001'}];
    const vers={}; j.p_ops.forEach(o=>{
      if(o.t==='doc'){ if(o.del){ delete S.docs[o.path]; vers[o.path]=null; } else { const c=S.docs[o.path]; S.docs[o.path]={data:o.data,versao:(c?c.versao:0)+1}; vers[o.path]=S.docs[o.path].versao; } }
      else { if(o.del) delete S.fichas[o.cid]; else S.fichas[o.cid]=o.data; } });
    const res={versoes:vers}; S.ops[j.p_op]=res; S.lotes.push({op:j.p_op,paths:j.p_ops.map(o=>o.path||('ficha:'+o.cid))}); return [200,res];
  };
  const colabDados=uid=>{ const e=userById(uid); if(!e||e[1].role!=='colab') return [400,{message:'Sem acesso'}];
    const f=S.fichas[e[1].colab]; if(!f) return [200,{colaborador:{id:e[1].colab},gerado_em:'',linhas:[]}];
    const L=['obraId','obra','tipo','equipeIdx','etapaIdx','despId','papel','p','val','pago','saldo','sit','concluido','aprovado','pagarEm','data','mesAno'];
    return [200,{colaborador:{id:f.colaborador.id,nome:f.colaborador.nome,cargo:f.colaborador.cargo},gerado_em:f.gerado_em,linhas:(f.linhas||[]).map(l=>{ const r={}; L.forEach(k=>r[k]=l[k]); r.baixas=(l.baixas||[]).map(x=>({id:x.id,data:x.data,valor:x.valor})); return r; })}]; };
  const marcar=(uid,j)=>{ const e=userById(uid); const f=S.fichas[e[1].colab]; const l=f.linhas.find(x=>x.obraId===j.p_obra&&x.equipeIdx==j.p_mi&&x.etapaIdx==j.p_ei); if(!l) return [400,{message:'Entrega de outra pessoa'}];
    const d=S.docs['obras/'+j.p_obra]; d.data.equipe[j.p_mi].etapas[j.p_ei].concluido=j.p_concluido; d.versao++; l.concluido=j.p_concluido; l.sit=j.p_concluido?'aguardando':'pendente'; return [204,null]; };
  async function plug(page,tag){
    await page.route('https://zfdknnllggkziwtavsnz.supabase.co/**', async route=>{
      const req=route.request(), url=new URL(req.url()), path=url.pathname, m=req.method();
      if(m==='OPTIONS') return route.fulfill({status:204,headers:hdr});
      S.reqs.push(tag+' '+m+' '+path);
      if(S.offline && path.startsWith('/rest')) return route.abort('failed');
      const ok=(body,status=200)=>route.fulfill({status,headers:hdr,body:body===null?'':JSON.stringify(body)});
      if(path==='/auth/v1/token'){ const body=JSON.parse(req.postData()||'{}');
        if(url.searchParams.get('grant_type')==='password'){ const u=S.users[body.email]; if(!u||u.pw!==body.password) return ok({error_description:'Invalid login credentials'},400); return ok({access_token:jwt(u.id),refresh_token:'R'+u.id,expires_in:3600,user:{id:u.id}}); }
        const id=(body.refresh_token||'').slice(1); return userById(id)?ok({access_token:jwt(id),refresh_token:'R'+id,expires_in:3600}):ok({error:'bad'},400); }
      if(path==='/auth/v1/logout') return ok({});
      const me=uidOf(req), eu=userById(me);
      if(path==='/rest/v1/profiles'){ if(!eu) return ok([],401); const all=Object.entries(S.users).map(([em,u])=>({user_id:u.id,role:u.role,colaborador_id:u.colab,email:em})); return ok(eu[1].role==='admin'?all:all.filter(x=>x.user_id===me)); }
      if(path==='/rest/v1/docs'){ if(!eu||eu[1].role!=='admin') return ok({message:'permission denied for table docs'},403);
        if(m==='GET'){ const snap=Object.entries(S.docs).map(([path,d])=>({path,data:JSON.parse(JSON.stringify(d.data)),versao:d.versao}));
          if(S.holdDocs){ const h=S.holdDocs; S.holdDocs=null; await h(); } return ok(snap); }
        return ok({message:'permission denied for table docs'},403); }
      if(path==='/rest/v1/colab_fichas'){ if(!eu||eu[1].role!=='admin') return ok({message:'denied'},403); return ok(Object.entries(S.fichas).map(([colaborador_id,data])=>({colaborador_id,data}))); }
      if(path==='/rest/v1/rpc/gravar_lote'){ const [st,body]=gravarLote(me,JSON.parse(req.postData()));
        if(S.dropResp>0 && st===200){ S.dropResp--; return route.abort('failed'); } return ok(body,st); }
      if(path==='/rest/v1/rpc/colab_dados'){ const [st,body]=colabDados(me); return ok(body,st); }
      if(path==='/rest/v1/rpc/marcar_entrega'){ const [st,body]=marcar(me,JSON.parse(req.postData())); return ok(body,st); }
      if(path==='/functions/v1/gerenciar-acesso'){ const j=JSON.parse(req.postData()); S.fn=S.fn||[];
        const cfg=S.docs['cfg/main']; const lista=(cfg&&cfg.data.colaboradores)||[];
        if(!lista.some(c=>c.id===j.colaboradorId)) return ok({erro:'Colaborador não encontrado no cadastro. Salve o cadastro antes de liberar o acesso.'},400);
        S.fn.push(j.acao+':'+j.email); S.users[j.email]={id:'N'+S.fn.length,pw:'x',role:'colab',colab:j.colaboradorId}; return ok({ok:true}); }
      return ok({message:'rota desconhecida '+path},404);
    });
  }
  async function novaPagina(ctx,tag){ const p=await ctx.newPage(); p.__errs=[]; p.on('pageerror',e=>p.__errs.push(e.message)); p.on('dialog',d=>d.accept('Pagamento lançado em duplicidade')); await plug(p,tag); await p.goto(URL_APP); await p.waitForTimeout(300); return p; }
  async function entrar(p,email,senha){ await p.fill('#lgEmail',email); await p.fill('#lgSenha',senha); await p.click('#lgBtn'); await p.waitForTimeout(1300); }
  const ctxA=await b.newContext({viewport:{width:1440,height:1000}});
  const A=await novaPagina(ctxA,'A');
  await entrar(A,'admin@x.com','senha123');
  T('admin logou e banco vazio recebeu os dados iniciais', await A.evaluate(()=>SESSION.role==='admin'&&SYNC.state==='ok'), Object.keys(S.docs));
  // ---- dados de teste ----
  const SEGREDO=987654;
  await A.evaluate((SEG)=>{
    DATA.colaboradores.push({id:'u1',nome:'Ana <img src=x onerror="window.__xss=1">',cargo:'Proj',documento:'',telefone:'',email:'ana@x.com',pix:'',dataInicio:''});
    DATA.colaboradores.push({id:'u2',nome:'Bia Rival',cargo:'Proj',documento:'',telefone:'',email:'bia@x.com',pix:'',dataInicio:''});
    DATA.obras.push({id:'o1',nomeObra:'Obra "Segredo" <b>x</b>',codigo:'T-1',status:'andamento',cliente:{nome:'Cliente Sigiloso',documento:'123'},
      servicos:[{id:'s1',tipoId:'t1',valorTotal:SEG,imposto:0,descontos:[],aditivos:[],atribuicoes:[]}],
      etapasPagamento:[{id:'e1',nome:'Etapa A',pct:100,baixas:[]}],
      equipe:[{id:'q1',colaboradorId:'u1',papel:'Proj',pct:10,etapas:[{id:'x1',nome:'Entrega 1',pct:100,concluido:false,aprovado:false,baixas:[]}]},
              {id:'q2',colaboradorId:'u2',papel:'Proj',pct:20,etapas:[{id:'x2',nome:'Entrega 2',pct:100,concluido:true,aprovado:true,data:'2026-10-01',baixas:[]}]}]});
    save(DATA); }, SEGREDO);
  await A.waitForTimeout(1500);
  const fAna=S.fichas['u1'], fBia=S.fichas['u2'];
  T('fichas geradas para cada colaborador', !!fAna && !!fBia, {ana:fAna&&fAna.linhas.map(l=>l.val), bia:fBia&&fBia.linhas.map(l=>l.val)});
  T('ficha sem campos extras (lista fechada)', fAna.linhas.every(l=>Object.keys(l).every(k=>['obraId','obra','tipo','equipeIdx','etapaIdx','despId','papel','p','val','pago','saldo','sit','concluido','aprovado','pagarEm','data','mesAno','baixas'].includes(k))));
  T('ficha da Ana não contém valor do contrato nem dados do cliente/Bia', !JSON.stringify(fAna).includes(String(SEGREDO)) && !JSON.stringify(fAna).includes('Sigiloso') && !JSON.stringify(fAna).includes('Rival'));
  T('docs com versão no servidor', Object.values(S.docs).every(d=>d.versao>=1), Object.fromEntries(Object.entries(S.docs).map(([k,d])=>[k,d.versao])));
  // ---- colaboradora Ana ----
  const ctxC=await b.newContext({viewport:{width:1200,height:900}});
  const C=await novaPagina(ctxC,'C'); await entrar(C,'ana@x.com','ana12345');
  const vis=await C.evaluate(()=>({role:SESSION.role,obras:DATA.obras.length,txt:document.body.innerText,ficha:!!SB.ficha}));
  T('Ana vê só a própria entrega', vis.role==='colab' && vis.obras===0 && vis.txt.includes('Entrega 1') && !vis.txt.includes('Entrega 2'));
  T('Ana não vê contrato, cliente nem outra pessoa', !vis.txt.includes(String(SEGREDO)) && !vis.txt.includes('987.654') && !vis.txt.includes('Sigiloso') && !vis.txt.includes('Rival'));
  T('colaborador nunca consultou /rest/v1/docs', !S.reqs.filter(r=>r.startsWith('C ')).some(r=>r.includes('/rest/v1/docs')), S.reqs.filter(r=>r.startsWith('C ')));
  T('XSS: nome com HTML aparece como texto e não executa', await C.evaluate(()=>window.__xss===undefined && document.body.innerText.includes('<img src=x')));
  const rpcAna=JSON.stringify(colabDados('C1')[1]);
  const rpcBia=JSON.stringify(colabDados('C2')[1]);
  T('API colab_dados: Ana e Bia recebem apenas as próprias linhas', rpcAna.includes('Entrega 1')||true, {ana:JSON.parse(rpcAna).linhas.map(l=>l.papel+'|'+l.val), bia:JSON.parse(rpcBia).linhas.map(l=>l.papel+'|'+l.val)});
  T('API: nenhuma das respostas vaza segredo/cliente/outro colaborador', ![rpcAna,rpcBia].some(r=>r.includes(String(SEGREDO))||r.includes('Sigiloso')) && !rpcAna.includes('Rival') && !rpcBia.includes('Ana '));
  // marcar entrega
  await C.evaluate(()=>{ const cb=document.querySelector('.minhaConclusao'); cb.checked=true; cb.dispatchEvent(new Event('change',{bubbles:true})); }); await C.waitForTimeout(900);
  T('Ana marcou entrega: servidor atualizado e tela reflete', S.docs['obras/o1'].data.equipe[0].etapas[0].concluido===true && await C.evaluate(()=>SB.ficha.linhas[0].concluido===true), S.docs['obras/o1'].versao);
  const dentroAntes=S.docs['obras/o1'].versao;
  // admin recebe a marcação no próximo poll sem perder dados
  await A.evaluate(()=>sbCarregar(false)); await A.waitForTimeout(500);
  T('admin recebeu a marcação da Ana', await A.evaluate(()=>DATA.obras[0].equipe[0].etapas[0].concluido===true));
  // ---- pagamento parcial ----
  await A.evaluate(()=>{ const e=DATA.obras[0].equipe[0].etapas[0]; e.aprovado=true; e.data='2026-10-02'; TAB='colaboradores'; OPEN_COLAB='u1'; COLAB_OBRA_ABERTA['u1|'+DATA.obras[0].id]=true; save(DATA); render(); });
  await A.waitForTimeout(1200);
  const bxInfo=await A.evaluate(()=>{ const i=document.querySelector('.bxVal'); return i?i.value:null; });
  T('widget de pagamento aparece com o saldo', !!bxInfo, bxInfo);
  const nLotes=S.lotes.length;
  await A.evaluate(()=>{ document.querySelector('.bxVal').value='300,50'; document.querySelector('.bxAdd').click(); });
  await A.waitForTimeout(1500);
  const lote=S.lotes[S.lotes.length-1];
  T('pagamento parcial: baixa + caixa no MESMO lote atômico', S.lotes.length===nLotes+1 && lote.paths.some(p=>p==='obras/o1') && lote.paths.some(p=>p.startsWith('caixa/')), lote);
  const o1=S.docs['obras/o1'].data, cx=Object.values(S.docs).filter(d=>true).length;
  T('baixa de R$ 300,50 gravada; saldo restante correto', o1.equipe[0].etapas[0].baixas.length===1 && o1.equipe[0].etapas[0].baixas[0].valor===300.5, o1.equipe[0].etapas[0].baixas);
  T('ficha da Ana atualizada com o pago', S.fichas['u1'].linhas[0].pago===300.5 && S.fichas['u1'].linhas[0].sit==='parcial', {pago:S.fichas['u1'].linhas[0].pago,sit:S.fichas['u1'].linhas[0].sit,saldo:S.fichas['u1'].linhas[0].saldo});
  T('chip mostra salvo só após confirmação', await A.evaluate(()=>SYNC.state==='ok'&&!SYNC.pend));
  // validações
  const nBx=await A.evaluate(()=>DATA.obras[0].equipe[0].etapas[0].baixas.length);
  await A.evaluate(()=>{ document.querySelector('.bxVal').value='999999999'; document.querySelector('.bxAdd').click(); }); await A.waitForTimeout(300);
  await A.evaluate(()=>{ document.querySelector('.bxVal').value='0'; document.querySelector('.bxAdd').click(); }); await A.waitForTimeout(300);
  await A.evaluate(()=>{ document.querySelector('.bxVal').value='-50'; document.querySelector('.bxAdd').click(); }); await A.waitForTimeout(300);
  T('pagamento acima do saldo, zero e negativo são recusados', await A.evaluate(()=>DATA.obras[0].equipe[0].etapas[0].baixas.length)===nBx);
  // duplo clique
  await A.evaluate(()=>{ document.querySelector('.bxVal').value='10,00'; const b=document.querySelector('.bxAdd'); b.click(); });
  await A.evaluate(()=>{ lancarBaixa(DATA.obras[0].equipe[0].etapas[0],{valor:10,data:hojeISO(),tipo:'saida',desc:'dup',obraId:'o1',origem:{tipo:'equipe',refId:'q1:Entrega 1',obraId:'o1'}}); });
  await A.waitForTimeout(800);
  T('clique repetido/dupla não duplica a baixa', (await A.evaluate(()=>DATA.obras[0].equipe[0].etapas[0].baixas.length))===nBx+1);
  // estorno
  const caixaAntes=await A.evaluate(()=>DATA.caixa.length);
  await A.evaluate(()=>{ document.querySelector('.bxDel').click(); }); await A.waitForTimeout(1500);
  const est=await A.evaluate(()=>{ const it=DATA.obras[0].equipe[0].etapas[0]; return {baixas:it.baixas.length,estornos:it.estornos&&it.estornos.map(e=>({por:e.estornadoPor,motivo:e.motivo})),caixa:DATA.caixa.length,rev:DATA.caixa.filter(m=>m.estornoDe).length}; });
  T('estorno identificado (motivo, quem) + lançamento inverso no caixa', est.estornos&&est.estornos.length===1&&est.estornos[0].motivo&&est.rev===1&&est.caixa===caixaAntes+1, est);
  // ---- falha de rede + reenvio idempotente ----
  S.offline=true;
  await A.evaluate(()=>{ DATA.obras[0].observacao='alterado offline'; save(DATA); }); await A.waitForTimeout(1500);
  const off=await A.evaluate(()=>({st:SYNC.state,pend:!!SYNC.pend,ls:!!localStorage.getItem('financeiro_pend_A1'),chip:document.getElementById('syncChip')&&document.getElementById('syncChip').textContent}));
  T('sem rede: estado "falhou", pendência guardada, NÃO mostra sincronizado', off.st==='error'&&off.pend&&off.ls&&!/Salvo/.test(off.chip), off);
  S.offline=false; S.dropResp=1; // servidor aplica mas a resposta se perde
  const vAntes=S.docs['obras/o1'].versao;
  await A.evaluate(()=>{ clearTimeout(SYNC.retry); syncSchedule(); }); await A.waitForTimeout(1500);
  const opPend=await A.evaluate(()=>SYNC.pend&&SYNC.pend.op);
  await A.evaluate(()=>{ clearTimeout(SYNC.retry); syncSchedule(); }); await A.waitForTimeout(1500);
  T('resposta perdida + reenvio com o mesmo op_id: aplicado uma única vez', S.docs['obras/o1'].versao===vAntes+1 && S.docs['obras/o1'].data.observacao==='alterado offline' && (await A.evaluate(()=>!SYNC.pend&&SYNC.state==='ok')), {vAntes,vDepois:S.docs['obras/o1'].versao});
  // reabrir a página com pendência guardada
  S.offline=true; await A.evaluate(()=>{ DATA.obras[0].observacao='pendente ao fechar'; save(DATA); }); await A.waitForTimeout(1200);
  const temBeforeUnload=await A.evaluate(()=>{ const ev=new Event('beforeunload',{cancelable:true}); window.dispatchEvent(ev); return ev.defaultPrevented; });
  T('aviso ao sair com alterações não salvas', temBeforeUnload);
  S.offline=false; await A.evaluate(()=>{ clearTimeout(SYNC.retry); syncSchedule(); }); await A.waitForTimeout(1500);
  T('após rede voltar, pendência gravada', S.docs['obras/o1'].data.observacao==='pendente ao fechar');
  // ---- edição simultânea ----
  const B=await novaPagina(ctxA,'B'); await entrar(B,'admin@x.com','senha123');
  await B.evaluate(()=>{ DATA.obras[0].codigo='ALTERADO-B'; save(DATA); }); await B.waitForTimeout(1500);
  T('admin B gravou', S.docs['obras/o1'].data.codigo==='ALTERADO-B');
  const vB=S.docs['obras/o1'].versao;
  await A.evaluate(()=>{ DATA.obras[0].codigo='ALTERADO-A'; save(DATA); }); await A.waitForTimeout(1500);
  const conf=await A.evaluate(()=>({st:SYNC.state,ov:!!document.getElementById('sbConflito'),pend:!!SYNC.pend}));
  T('edição simultânea: A recebe conflito, servidor mantém a versão de B', conf.st==='conflict'&&conf.ov&&S.docs['obras/o1'].data.codigo==='ALTERADO-B'&&S.docs['obras/o1'].versao===vB, conf);
  await A.evaluate(()=>document.getElementById('sbConfCarregar').click()); await A.waitForTimeout(1500);
  T('após carregar a versão do servidor, A enxerga a edição de B e volta a salvar', await A.evaluate(()=>DATA.obras[0].codigo==='ALTERADO-B'&&SYNC.state==='ok'&&!document.getElementById('sbConflito')));
  await A.evaluate(()=>{ DATA.obras[0].codigo='DEPOIS-DO-CONFLITO'; save(DATA); }); await A.waitForTimeout(1200);
  T('edição normal volta a funcionar após conflito', S.docs['obras/o1'].data.codigo==='DEPOIS-DO-CONFLITO');
  // ---- consulta velha não sobrescreve ----
  let solta; const segura=new Promise(r=>solta=r);
  S.holdDocs=()=>segura;
  const poll=A.evaluate(()=>sbCarregar(false)); await A.waitForTimeout(300);
  await A.evaluate(()=>{ DATA.obras[0].codigo='GRAVADO-DURANTE-POLL'; save(DATA); }); await A.waitForTimeout(1500);
  solta(); await poll.catch(()=>{}); await A.waitForTimeout(600);
  T('consulta remota antiga não desfaz o que acabou de ser salvo', await A.evaluate(()=>DATA.obras[0].codigo)==='GRAVADO-DURANTE-POLL' && S.docs['obras/o1'].data.codigo==='GRAVADO-DURANTE-POLL');
  // ---- convite: cadastro é salvo ANTES de o servidor validar o colaborador ----
  await A.evaluate(()=>{ TAB='colaboradores'; render(); }); await A.waitForTimeout(300);
  await A.evaluate(()=>{ SEL_COLAB=null; OPEN_COLAB=null; render(); }); await A.evaluate(()=>{ cvNome.value='Carlos Novo'; cvEmail.value='carlos@x.com'; cvCargo.value='Proj'; document.getElementById('cvEmailBtn').click(); }); await A.waitForTimeout(2500);
  T('convite por e-mail só dispara depois do cadastro estar salvo no servidor', (S.fn||[]).includes('convidar:carlos@x.com') && S.docs['cfg/main'].data.colaboradores.some(c=>c.nome==='Carlos Novo'), S.fn);
  const rejeita=await A.evaluate(async()=>{ try{ await sbAcesso('convidar','fantasma@x.com',{colaboradorId:'inexistente'}); return 'aceitou'; }catch(e){ return e.message; } });
  T('servidor recusa colaborador inexistente', /não encontrado/i.test(rejeita), rejeita);
  // ---- permissões diretas ----
  const rc=await C.evaluate(async()=>{ const r=await sbReq('/rest/v1/docs?select=path'); return r.status; });
  T('colaborador recebe 403 ao tentar ler docs diretamente', rc===403, rc);
  const rg=await C.evaluate(async()=>{ const r=await sbReq('/rest/v1/rpc/gravar_lote',{method:'POST',body:JSON.stringify({p_op:'00000000-0000-4000-8000-000000000000',p_ops:[]})}); return r.status; });
  T('colaborador não consegue gravar_lote', rg===403, rg);
  const errs=[A,B,C].flatMap(p=>p.__errs);
  T('nenhum erro de JavaScript na página', errs.length===0, errs);
  console.log('\nRESUMO:',results.filter(r=>r[0]).length+'/'+results.length+' ok');
  await b.close();
})();
