const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
const jwt=sub=>b64({alg:'HS256'})+'.'+b64({sub})+'.sig';
const hdr={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*','content-type':'application/json'};
const fs=require('fs');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const p=await (await b.newContext({viewport:{width:1300,height:1000}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept());
  const S={docs:{},storage:{},lote:[],lotes:[]}; let ok=0,ko=0; const T=(n,c,d)=>{c?ok++:ko++;console.log((c?'PASS ':'FAIL ')+n+(d!==undefined?' '+JSON.stringify(d):''));};
  const DADOS={numeroContrato:'714-06',nomeObra:'Metropolitan Marista',enderecoObra:'Av 85',contratante:{razaoSocial:'<b>SPE</b> LTDA',cnpj:'50.791.681/0002-02',endereco:'x',email:null,telefone:null},construtora:'EBM',contratada:{razaoSocial:'P',cnpj:'44.274.575/0001-78'},objeto:'Projeto elétrico e SPDA',valorContrato:1000,dataInicio:'2026-06-16',dataTermino:'2027-06-10',parcelas:[{nome:'Assinatura de contrato',valor:100},{nome:'Projeto Básico',valor:300},{nome:'Projeto Executivo',valor:600}],prazoPagamentoNF:'15 dias úteis',impostosRetidos:'ISS',reajuste:'Sem reajuste',multas:'5%',observacoes:['obs <i>1</i>'],camposIncertos:['telefone']};
  await p.route('https://zfdknnllggkziwtavsnz.supabase.co/**',async route=>{
    const req=route.request(),u=new URL(req.url()),path=u.pathname,m=req.method();
    if(m==='OPTIONS') return route.fulfill({status:204,headers:hdr});
    const ok_=(body,s=200)=>route.fulfill({status:s,headers:hdr,body:body===null?'':JSON.stringify(body)});
    if(path==='/auth/v1/token'){ if(u.searchParams.get('grant_type')==='password') return ok_({access_token:jwt('A1'),refresh_token:'RA1',expires_in:3600,user:{id:'A1'}}); return ok_({access_token:jwt('A1'),refresh_token:'RA1',expires_in:3600}); }
    if(path==='/rest/v1/profiles') return ok_([{user_id:'A1',role:'admin',colaborador_id:null,email:'a@x.com'}]);
    if(path==='/rest/v1/docs'&&m==='GET') return ok_(Object.entries(S.docs).map(([path,d])=>({path,data:d.data,versao:d.versao})));
    if(path==='/rest/v1/colab_fichas') return ok_([]);
    if(path==='/rest/v1/rpc/gravar_lote'){ const j=JSON.parse(req.postData()); S.lotes.push(j); const v={}; j.p_ops.forEach(o=>{ if(o.t==='doc'){ const c=S.docs[o.path]; if(o.del) delete S.docs[o.path]; else { S.docs[o.path]={data:o.data,versao:(c?c.versao:0)+1}; v[o.path]=S.docs[o.path].versao; } } }); return ok_({versoes:v}); }
    if(path.startsWith('/storage/v1/object/contratos/')){ const k=decodeURIComponent(path.replace('/storage/v1/object/contratos/','')); if(m==='POST'){ S.storage[k]=1; return ok_({Key:k}); } if(m==='DELETE'){ delete S.storage[k]; return ok_({}); } }
    if(path.startsWith('/storage/v1/object/sign/contratos/')) return ok_({signedURL:'/object/sign/contratos/x?token=t'});
    if(path==='/functions/v1/ler-contrato'){ S.ler=JSON.parse(req.postData()); return ok_({ok:true,dados:DADOS}); }
    return ok_({message:'rota '+path},404);
  });
  const etapas=[0,1,2].map(i=>({nome:'Parcela '+(i+1)+'/3',pct:30,mensal:true,aprovado:true,auto:true,concluido:true,pagarEm:'2026-0'+(7+i)+'-05',data:'2026-0'+(7+i)+'-05',valorFixo:3000,baixas:[{id:'b'+i,tipo:'saida',valor:3000,data:'2026-10-16'}]}));
  S.docs['obras/o1']={versao:1,data:{id:'o1',nomeObra:'Obra 1',codigo:'1',status:'andamento',empresaId:'',cliente:{nome:'c'},servicos:[{id:'s',tipoId:'t1',valorTotal:100000,imposto:0,despesas:[],aditivos:[]}],etapasPagamento:[],despesasObra:[],equipe:[{id:'q',colaboradorId:'u1',papel:'C',pct:15,baseIds:[],modelo:'media',media:{inicio:'2026-07',meses:3,ret:10,dia:5},etapas}]}};
  S.docs['cfg/main']={versao:1,data:{tiposServico:[{id:'t1',nome:'E'}],colaboradores:[{id:'u1',nome:'Bruno',cargo:'C'}],minhasEmpresas:[]}};
  await p.goto('file:///home/claude/financeiro-et-projetos/index.html'); await p.waitForTimeout(300);
  await p.fill('#lgEmail','a@x.com'); await p.fill('#lgSenha','senha123'); await p.click('#lgBtn'); await p.waitForTimeout(4000);
  const o=S.docs['obras/o1'];
  T('servidor recebeu a obra sem valor congelado nas parcelas de média', S.lotes.length>0 && o.data.equipe[0].etapas.every(e=>e.valorFixo===undefined), {lotes:S.lotes.length, fixos:o.data.equipe[0].etapas.map(e=>e.valorFixo)});
  T('ficha enviada com novo valor (30% de 15% de 100.000 = 4.500)', S.lotes.some(l=>l.p_ops.some(x=>x.t==='ficha'&&JSON.stringify(x.data).includes('4500'))), S.lotes.map(l=>l.p_ops.map(x=>x.t)));
  T('sem erros de JS', errs.length===0, errs); console.log(ok+' ok, '+ko+' falhas'); await b.close(); process.exit(ko?1:0);
})();
