const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const p=await (await b.newContext({viewport:{width:1300,height:1200}})).newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept());
  await p.goto('file:///home/claude/financeiro-et-projetos/index.html'); await p.waitForTimeout(500);
  let ok=0,ko=0; const T=(n,c,d)=>{c?ok++:ko++;console.log((c?'PASS ':'FAIL ')+n+(d!==undefined?' '+JSON.stringify(d):''));};
  await p.evaluate(()=>{ SESSION={role:'admin'}; DATA.tiposServico=[{id:'t1',nome:'E'}]; DATA.minhasEmpresas=[]; DATA.colaboradores=[{id:'u1',nome:'Renner',cargo:'Coord'}];
    const mk=(id)=>({id,nomeObra:'Obra '+id,codigo:id,status:'andamento',empresaId:'',cliente:{nome:'c'},servicos:[{id:'s'+id,tipoId:'t1',valorTotal:100000,imposto:0,despesas:[],aditivos:[]}],etapasPagamento:[],despesasObra:[],equipe:[{id:'q'+id,colaboradorId:'u1',papel:'Coord',pct:10,baseIds:[],etapas:etapasCoordPadrao()}]});
    DATA.obras=[mk('o1'),mk('o2')]; aplicarModeloPagamento('u1','media',{inicio:'2026-06',meses:6,ret:10,dia:5},''); TAB='colaboradores'; SEL_COLAB='u1'; render(); });
  const n=await p.locator('.cobraEt').count();
  T('uma linha por obra (2), etapas recolhidas', n===2 && await p.locator('.aprovarEtapa').count()===0);
  const t=await p.innerText('.card:has(.cobraEt)');
  T('totais por obra: contratado 10.000', /Obra o1[\s\S]*10\.000,00/.test(t), t.slice(0,300));
  await p.click('.cobraEt[data-o="o1"]'); await p.waitForTimeout(100);
  T('ver etapas abre as 7 parcelas só da obra 1', await p.locator('tr:has(td:has-text("Parcela"))').count()===6 || await p.locator('text=Retenção para ajustes').count()===1);
  await p.click('.cobraEt[data-o="o1"]'); await p.waitForTimeout(100);
  T('ocultar recolhe', await p.locator('text=Retenção para ajustes').count()===0);
  T('sem erros', errs.length===0, errs); console.log(ok+' ok, '+ko+' falhas'); await b.close(); process.exit(ko?1:0);
})();
