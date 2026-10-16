const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
const jwt=sub=>b64({alg:'HS256'})+'.'+b64({sub})+'.sig';
const hdr={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*','content-type':'application/json'};
const fs=require('fs');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const p=await (await b.newContext({viewport:{width:1300,height:1000}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept());
  const S={docs:{},storage:{},lote:[]}; let ok=0,ko=0; const T=(n,c,d)=>{c?ok++:ko++;console.log((c?'PASS ':'FAIL ')+n+(d!==undefined?' '+JSON.stringify(d):''));};
  const DADOS={numeroContrato:'714-06',nomeObra:'Metropolitan Marista',enderecoObra:'Av 85',contratante:{razaoSocial:'<b>SPE</b> LTDA',cnpj:'50.791.681/0002-02',endereco:'x',email:null,telefone:null},construtora:'EBM',contratada:{razaoSocial:'P',cnpj:'44.274.575/0001-78'},objeto:'Projeto elétrico e SPDA',valorContrato:1000,dataInicio:'2026-06-16',dataTermino:'2027-06-10',parcelas:[{nome:'Assinatura de contrato',valor:100},{nome:'Projeto Básico',valor:300},{nome:'Projeto Executivo',valor:600}],prazoPagamentoNF:'15 dias úteis',impostosRetidos:'ISS',reajuste:'Sem reajuste',multas:'5%',observacoes:['obs <i>1</i>'],camposIncertos:['telefone']};
  await p.route('https://zfdknnllggkziwtavsnz.supabase.co/**',async route=>{
    const req=route.request(),u=new URL(req.url()),path=u.pathname,m=req.method();
    if(m==='OPTIONS') return route.fulfill({status:204,headers:hdr});
    const ok_=(body,s=200)=>route.fulfill({status:s,headers:hdr,body:body===null?'':JSON.stringify(body)});
    if(path==='/auth/v1/token'){ if(u.searchParams.get('grant_type')==='password') return ok_({access_token:jwt('A1'),refresh_token:'RA1',expires_in:3600,user:{id:'A1'}}); return ok_({access_token:jwt('A1'),refresh_token:'RA1',expires_in:3600}); }
    if(path==='/rest/v1/profiles') return ok_([{user_id:'A1',role:'admin',colaborador_id:null,email:'a@x.com'}]);
    if(path==='/rest/v1/docs'&&m==='GET') return ok_(Object.entries(S.docs).map(([path,d])=>({path,data:d.data,versao:d.versao})));
    if(path==='/rest/v1/colab_fichas') return ok_([]);
    if(path==='/rest/v1/rpc/gravar_lote'){ const j=JSON.parse(req.postData()); const v={}; j.p_ops.forEach(o=>{ if(o.t==='doc'){ const c=S.docs[o.path]; if(o.del) delete S.docs[o.path]; else { S.docs[o.path]={data:o.data,versao:(c?c.versao:0)+1}; v[o.path]=S.docs[o.path].versao; } } }); return ok_({versoes:v}); }
    if(path.startsWith('/storage/v1/object/contratos/')){ const k=decodeURIComponent(path.replace('/storage/v1/object/contratos/','')); if(m==='POST'){ S.storage[k]=1; return ok_({Key:k}); } if(m==='DELETE'){ delete S.storage[k]; return ok_({}); } }
    if(path.startsWith('/storage/v1/object/sign/contratos/')) return ok_({signedURL:'/object/sign/contratos/x?token=t'});
    if(path==='/functions/v1/ler-contrato') return ok_({ok:true,dados:DADOS});
    return ok_({message:'rota '+path},404);
  });
  await p.goto('file:///home/claude/financeiro-et-projetos/index.html'); await p.waitForTimeout(300);
  await p.fill('#lgEmail','a@x.com'); await p.fill('#lgSenha','senha123'); await p.click('#lgBtn'); await p.waitForTimeout(1500);
  await p.evaluate(()=>{ TAB='obras'; render(); });
  fs.writeFileSync('/tmp/ct.pdf','%PDF-1.4\n%fake');
  T('botão de importar aparece para admin', await p.locator('#importCt').count()===1);
  await p.setInputFiles('#importCt','/tmp/ct.pdf'); await p.waitForSelector('#ci_criar',{timeout:5000});
  T('PDF enviado ao armazenamento', Object.keys(S.storage).length===1, Object.keys(S.storage));
  T('formulário preenchido', (await p.inputValue('#ci_nome'))==='Metropolitan Marista' && (await p.inputValue('#ci_cod'))==='CT 714-06' && (await p.inputValue('#ci_val'))==='1000');
  T('tipo sugerido = Elétrica', (await p.$eval('#ci_tipo',s=>s.selectedOptions[0].textContent))==='Elétrica');
  T('texto do contrato escapado (sem HTML injetado)', await p.evaluate(()=>!document.querySelector('#ciModal li i')&&document.querySelector('#ci_cli').value.includes('<b>SPE</b>')&&document.querySelector('#ciModal details li').textContent.includes('<i>1</i>')));
  await p.click('#ci_criar'); await p.waitForTimeout(2500);
  const o=await p.evaluate(()=>DATA.obras[DATA.obras.length-1]);
  T('obra criada com 3 etapas 10/30/60%', o.etapasPagamento.map(e=>e.pct).join()==='10,30,60', o.etapasPagamento.map(e=>e.pct));
  T('cliente e documento do contrato', o.cliente.documento==='50.791.681/0002-02' && o.cliente.construtora==='EBM');
  T('serviço com valor 1000', o.servicos[0].valorTotal===1000);
  T('contrato anexado', o.documentos.length===1 && o.documentos[0].tipo==='Contrato' && S.storage[o.documentos[0].path]);
  T('obra gravada no servidor', Object.keys(S.docs).some(k=>k==='obras/'+o.id));
  T('seção Documentos visível', (await p.content()).includes('Documentos (contrato, proposta, aditivos)'));
  await p.setInputFiles('.docArq','/tmp/ct.pdf'); await p.waitForTimeout(1500);
  T('segundo documento anexado', (await p.evaluate(id=>DATA.obras.find(x=>x.id===id).documentos.length,o.id))===2);
  await p.click('.docdel >> nth=0'); await p.waitForTimeout(800);
  T('documento removido e arquivo apagado', (await p.evaluate(id=>DATA.obras.find(x=>x.id===id).documentos.length,o.id))===1 && Object.keys(S.storage).length===1);
  await p.evaluate(()=>{ TAB='resumo'; render(); });
  await p.setInputFiles('.etDocArq >> nth=0','/tmp/ct.pdf'); await p.waitForTimeout(1200);
  const dc=await p.evaluate(()=>{ const o=DATA.obras[DATA.obras.length-1]; return o.documentos.filter(d=>d.etapaId); });
  T('boleto anexado à etapa (somente admin) e arquivo no armazenamento', dc.length===1 && dc[0].tipo==='Boleto' && !!S.storage[dc[0].path], dc.length);
  T('sem erros de JS', errs.length===0, errs);
  console.log(ok+' ok, '+ko+' falhas'); await b.close(); process.exit(ko?1:0);
})();
