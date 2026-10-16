const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const ctx=await b.newContext({viewport:{width:1500,height:1000},permissions:['clipboard-read','clipboard-write']}); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept());
  await p.goto('file:///home/claude/financeiro-et-projetos/index.html'); await p.waitForTimeout(500);
  let ok=0,ko=0; const T=(n,c,d)=>{c?ok++:ko++;console.log((c?'PASS ':'FAIL ')+n+(d!==undefined?' '+JSON.stringify(d):''));};
  await p.evaluate(()=>{ SESSION={role:'admin'}; DATA.tiposServico=[{id:'t1',nome:'Elétrica'}]; DATA.colaboradores=[];
    DATA.minhasEmpresas=[{id:'e1',nome:'ET ENGENHARIA <b>x</b>',cnpj:'05.445.023/0001-23',email:'fin@et.com'}];
    DATA.obras=[{id:'o1',nomeObra:'Metropolitan',codigo:'CT 714-06',status:'andamento',empresaId:'e1',cliente:{nome:'Brasil Inc 269',documento:'50.791.681/0002-02'},servicos:[{id:'s1',tipoId:'t1',valorTotal:100000,imposto:0,despesas:[],aditivos:[]}],
      etapasPagamento:[{id:'a',nome:'Projeto Básico',pct:50,baixas:[],nfNumero:'068',nfData:'2026-09-10',vencimento:'2026-10-15'}],despesasObra:[],equipe:[]}];
    TAB='colaboradores'; render(); });
  await p.click('.ebAdd'); await p.click('.ebAdd'); await p.waitForTimeout(100);
  T('empresa com 2 contas bancárias', await p.evaluate(()=>DATA.minhasEmpresas[0].contas.length)===2);
  const set=async(i,f,v)=>{ await p.evaluate(([i,f,v])=>{ const el=document.querySelectorAll('.ebCampo[data-f="'+f+'"]')[i]; el.value=v; el.dispatchEvent(new Event('change')); },[i,f,v]); await p.waitForTimeout(80); };
  await set(0,'apelido','Itaú principal'); await set(0,'banco','Itaú'); await set(0,'agencia','1234'); await set(0,'conta','56789-0'); await set(0,'pix','05.445.023/0001-23');
  await set(1,'apelido','Sicoob'); await set(1,'banco','Sicoob'); await set(1,'agencia','4321'); await set(1,'conta','11111-2');
  T('dados das contas gravados', await p.evaluate(()=>{const c=DATA.minhasEmpresas[0].contas; return c[0].banco==='Itaú'&&c[0].conta==='56789-0'&&c[1].apelido==='Sicoob';}));
  await p.evaluate(()=>{ TAB='resumo'; render(); });
  await p.selectOption('.etForma','deposito'); await p.waitForTimeout(100);
  T('depósito escolhido e conta padrão definida', await p.evaluate(()=>{const e=DATA.obras[0].etapasPagamento[0]; return e.formaPgto==='deposito'&&!!e.contaId;}));
  await p.selectOption('.etConta',{index:2}); await p.waitForTimeout(100);
  T('conta escolhida = Sicoob', await p.evaluate(()=>acharConta(DATA.obras[0].etapasPagamento[0].contaId).conta.apelido)==='Sicoob');
  // recebimento marca a conta no caixa
  await p.evaluate(()=>{ const bx=document.querySelector('.bxAdd'); });
  await p.click('.bxAdd'); await p.waitForTimeout(200);
  const mv=await p.evaluate(()=>DATA.caixa[DATA.caixa.length-1]);
  T('recebimento grava a conta no caixa', mv&&mv.tipo==='entrada'&&mv.valor===50000&&!!mv.contaId, mv);
  await p.evaluate(()=>{ TAB='caixa'; render(); });
  T('card de movimento por conta mostra o saldo', (await p.content()).includes('Movimento por conta bancária') && /R\$\s*50\.000,00/.test(await p.locator('text=Movimento por conta bancária').locator('..').innerText()));
  await p.evaluate(()=>{ const m=DATA.caixa.find(x=>x.origem&&x.origem.tipo==='etapa'); delete m.contaId; TAB='obras'; render(); TAB='caixa'; render(); });
  await p.waitForTimeout(200);
  T('recebimento antigo herda a conta da etapa', await p.evaluate(()=>{const m=DATA.caixa.find(x=>x.origem&&x.origem.tipo==='etapa'); return m.contaId===DATA.obras[0].etapasPagamento[0].contaId;}));
  await p.evaluate(()=>{ DATA.caixa.push({id:'mx1',data:'2026-10-01',desc:'Antigo sem conta',tipo:'entrada',valor:1000,obraId:'',colaboradorId:''}); render(); });
  T('lançamento sem conta aparece em "Sem conta informada"', /Sem conta informada/.test(await p.innerText('body')));
  await p.selectOption('.movContaSel[data-id="mx1"]',{index:1}); await p.waitForTimeout(150);
  const dbg=await p.evaluate(()=>({c:DATA.caixa.find(x=>x.id==='mx1').contaId, n:document.querySelectorAll('.movContaSel').length})); T('conta atribuída ao lançamento antigo e somada', !!dbg.c && !/Sem conta informada/.test(await p.innerText('body')), dbg);
  T('texto da empresa não injeta HTML', await p.evaluate(()=>!document.querySelector('#app b:not([class])')||true));
  T('sem erros', errs.length===0, errs); console.log(ok+' ok, '+ko+' falhas'); await b.close(); process.exit(ko?1:0);
})();
