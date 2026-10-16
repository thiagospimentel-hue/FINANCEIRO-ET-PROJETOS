const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const p=await (await b.newContext({viewport:{width:1500,height:1400}})).newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept());
  await p.goto('file:///home/claude/financeiro-et-projetos/index.html'); await p.waitForTimeout(500);
  let ok=0,ko=0; const T=(n,c,d)=>{c?ok++:ko++;console.log((c?'PASS ':'FAIL ')+n+(d!==undefined?' '+JSON.stringify(d):''));};
  await p.evaluate(()=>{ SESSION={role:'admin'}; DATA.tiposServico=[{id:'t1',nome:'Elétrica'}]; DATA.minhasEmpresas=[]; DATA.colaboradores=[{id:'u1',nome:'Renner',cargo:'C'}]; DATA.caixa=[];
    const mk=(id)=>({id,nomeObra:'Obra '+id,codigo:id,status:'andamento',empresaId:'',cliente:{nome:'c'},servicos:[{id:'s'+id,tipoId:'t1',valorTotal:100000,imposto:0,despesas:[],aditivos:[]}],etapasPagamento:[],despesasObra:[],
      equipe:[{id:'q'+id,colaboradorId:'u1',papel:'Coord',pct:10,baseIds:[],etapas:etapasCoordPadrao()}]});
    DATA.obras=[mk('o1'),mk('o2')]; SEL_COLAB='u1'; TAB='colaboradores';
    aplicarModeloPagamento('u1','media',{inicio:'2026-07',meses:4,ret:0,dia:5,fim:'2026-10',grupoId:'g1',grupo:'G1'},['o1','o2']);
    DATA.colaboradores[0].pagoMes={'2026-07':10000}; registrarPagoMes('u1','2026-07','2026-07-10',''); render(); });
  T('com pagamento registrado e grupo travado: obra bloqueada', await p.locator('.mcOb[disabled]').count()===2);
  await p.evaluate(()=>{ DATA.obras.forEach(o=>delete o.equipe[0].media.travado); render(); });
  T('destravado: obras liberadas para remarcar mesmo com pagamento', await p.locator('.mcOb[disabled]').count()===0);
  await p.check('.mcOb[data-o="o1"]'); await p.waitForTimeout(100); await p.check('.mcOb[data-o="o2"]'); await p.waitForTimeout(100);
  await p.fill('.mcCfg[data-f="inicio"]','2026-07'); await p.press('.mcCfg[data-f="inicio"]','Tab'); await p.waitForTimeout(100);
  await p.fill('.mcCfg[data-f="fim"]','2026-12'); await p.press('.mcCfg[data-f="fim"]','Tab'); await p.waitForTimeout(100);
  await p.fill('.mcCfg[data-f="grupo"]','Novo'); await p.press('.mcCfg[data-f="grupo"]','Tab'); await p.waitForTimeout(100);
  await p.click('.mcAplicar[data-m="media"]'); await p.waitForTimeout(250);
  const r=await p.evaluate(()=>DATA.obras.map(o=>{ const m=o.equipe[0]; const mens=m.etapas.filter(e=>e.mensal); return {n:mens.length,pagas:mens.filter(e=>(e.baixas||[]).length).length,soma:Math.round(mens.reduce((a,e)=>a+valorEquipeEtapa(o,m,e),0)),g:m.media.grupo,fim:m.media.fim,pg:Math.round(m.etapas.reduce((a,e)=>a+baixaTotal(e),0))}; }));
  T('remarcou para 6 meses preservando a parcela paga e redistribuindo o resto (total 10.000 por obra)', r.every(x=>x.n===6&&x.pagas===1&&x.soma===10000&&x.g==='Novo'&&x.fim==='2026-12'&&x.pg===5000), r);
  T('conferência: jul continua pago, devido muda', await p.evaluate(()=>{ const c=confMensalColab('u1'); return c.length===6&&c[0].ym==='2026-07'; }));
  T('sem erros', errs.length===0, errs); console.log(ok+' ok, '+ko+' falhas'); await b.close(); process.exit(ko?1:0);
})();
