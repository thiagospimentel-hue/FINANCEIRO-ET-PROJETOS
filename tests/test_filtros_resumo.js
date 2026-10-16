const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const p=await (await b.newContext({viewport:{width:1300,height:1000}})).newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file:///home/claude/financeiro-et-projetos/index.html'); await p.waitForTimeout(500);
  let ok=0,ko=0; const T=(n,c,d)=>{c?ok++:ko++;console.log((c?'PASS ':'FAIL ')+n+(d!==undefined?' '+JSON.stringify(d):''));};
  const r=await p.evaluate(()=>{ SESSION={role:'admin'}; DATA.obras=[
   {id:'o1',nomeObra:'ROTA PANORAMA',codigo:'CT 671-06',status:'andamento',empresaId:'',cliente:{nome:'Brasil Incorporação 215'},servicos:[],etapasPagamento:[{id:'a',nome:'Básico',pct:100,baixas:[]}],equipe:[],despesasObra:[]},
   {id:'o2',nomeObra:'METROPOLITAN MARISTA',codigo:'CT 714-06',status:'concluida',empresaId:'',cliente:{nome:'Brasil Incorporação 269'},servicos:[],etapasPagamento:[],equipe:[],despesasObra:[]}];
   TAB='dashboard'; render(); return obrasDash().length; });
  T('sem filtro: 2 obras', r===2);
  await p.type('#dashBusca','metrópol'); await p.waitForTimeout(200);
  T('busca sem acento/parcial acha Metropolitan', await p.evaluate(()=>obrasDash().map(o=>o.id).join())==='o2');
  T('campo manteve foco e texto', await p.evaluate(()=>document.activeElement.id==='dashBusca'&&document.activeElement.value==='metrópol'));
  T('ranking mostra só a obra filtrada', (await p.locator('.rankcard').count())===1);
  await p.click('#dashLimpar'); T('limpar volta a 2', await p.evaluate(()=>obrasDash().length)===2);
  await p.fill('#dashBusca','671'); await p.waitForTimeout(100);
  T('busca por código', await p.evaluate(()=>obrasDash().map(o=>o.id).join())==='o1');
  await p.click('#dashLimpar'); await p.selectOption('#dashStatus','concluida');
  T('filtro de status', await p.evaluate(()=>obrasDash().map(o=>o.id).join())==='o2');
  T('sem erros', errs.length===0, errs); console.log(ok+' ok, '+ko+' falhas'); await b.close(); process.exit(ko?1:0);
})();
