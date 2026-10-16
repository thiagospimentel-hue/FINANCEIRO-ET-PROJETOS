const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const p=await (await b.newContext({viewport:{width:1500,height:1400}})).newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept());
  await p.goto('file:///home/claude/financeiro-et-projetos/index.html'); await p.waitForTimeout(500);
  let ok=0,ko=0; const T=(n,c,d)=>{c?ok++:ko++;console.log((c?'PASS ':'FAIL ')+n+(d!==undefined?' '+JSON.stringify(d):''));};
  await p.evaluate(()=>{ SESSION={role:'admin'}; DATA.tiposServico=[{id:'t1',nome:'Elétrica'}]; DATA.minhasEmpresas=[]; DATA.colaboradores=[{id:'u1',nome:'Renner',cargo:'C'}]; DATA.caixa=[];
    const mk=(id,v)=>({id,nomeObra:'Obra '+id,codigo:id,status:'andamento',empresaId:'',cliente:{nome:'c'},servicos:[{id:'s'+id,tipoId:'t1',valorTotal:v,imposto:0,despesas:[],aditivos:[]}],etapasPagamento:[],despesasObra:[],
      equipe:[{id:'q'+id,colaboradorId:'u1',papel:'Coord',pct:10,baseIds:[],etapas:etapasCoordPadrao()}]});
    DATA.obras=[mk('o1',100000),mk('o2',25000)]; SEL_COLAB='u1'; TAB='colaboradores';
    aplicarModeloPagamento('u1','media',{inicio:'2026-11',meses:2,ret:0,dia:5,fim:'2026-12',grupoId:'g',grupo:'G'},['o1']); render(); });
  T('sem formulário de avulso', await p.locator('.avAdd').count()===0);
  T('opção pagamento único existe', await p.locator('.mcModo[value="unico"]').count()===1);
  await p.click('.mcModo[value="unico"]'); await p.waitForTimeout(250);
  await p.check('.mcOb[data-o="o2"]'); await p.waitForTimeout(250);
  T('obra do grupo travada não selecionável', await p.locator('.mcOb[data-o="o1"]').isDisabled());
  await p.fill('.mcCfg[data-f="unicoMes"]','2026-11'); await p.waitForTimeout(250);
  await p.click('.mcAplicar[data-m="unico"]'); await p.waitForTimeout(300);
  const c=await p.evaluate(()=>confMensalColab('u1').map(r=>r.ym+':'+r.dev+':'+(r.avu||0)));
  T('nov = parcela 5.000 + único 2.500; dez 5.000', JSON.stringify(c)==='["2026-11:7500:2500","2026-12:5000:0"]', c);
  T('grupo intacto (média na o1)', await p.evaluate(()=>DATA.obras[0].equipe[0].modelo==='media'&&DATA.obras[1].equipe[0].modelo==='unico'&&DATA.obras[1].equipe[0].etapas.length===1));
  await p.fill('.pagoMes[data-m="2026-11"]','7.500,00'); await p.press('.pagoMes[data-m="2026-11"]','Tab'); await p.waitForTimeout(200);
  await p.click('.pmReg[data-m="2026-11"]'); await p.waitForTimeout(300);
  const pg=await p.evaluate(()=>Math.round(baixaTotal(DATA.obras[1].equipe[0].etapas[0])));
  T('pagamento do mês quita o único', pg===2500, pg);
  T('obra paga não pode mudar de forma', await p.evaluate(()=>{ const r=aplicarModeloPagamento('u1','entrega',{},['o2']); return r.bloq===1&&r.ok===0; }));
  T('sem erros', errs.length===0, errs); console.log(ok+' ok, '+ko+' falhas'); await b.close(); process.exit(ko?1:0);
})();
