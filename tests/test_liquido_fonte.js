const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const p=await (await b.newContext({viewport:{width:1500,height:1000}})).newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept());
  await p.goto('file:///home/claude/financeiro-et-projetos/index.html'); await p.waitForTimeout(500);
  let ok=0,ko=0; const T=(n,c,d)=>{c?ok++:ko++;console.log((c?'PASS ':'FAIL ')+n+(d!==undefined?' '+JSON.stringify(d):''));};
  await p.evaluate(()=>{ SESSION={role:'admin'}; DATA.tiposServico=[{id:'t1',nome:'E'}]; DATA.colaboradores=[];
    DATA.obras=[{id:'o1',nomeObra:'M',codigo:'x',status:'andamento',empresaId:'',cliente:{nome:'c'},servicos:[{id:'s1',tipoId:'t1',valorTotal:100000,imposto:17,despesas:[],aditivos:[]}],etapasPagamento:[{id:'a',nome:'Básico',pct:50,baixas:[]},{id:'b',nome:'Exec',pct:50,baixas:[]}],despesasObra:[],equipe:[]}]; TAB='resumo'; SEL_RESUMO='o1'; render(); });
  const t=await p.innerText('.cobtab');
  T('cabeçalhos Valor bruto e Líquido', /valor bruto/i.test(t)&&/líquido/i.test(t));
  T('50.000 → líquido 46.925', /46\.925,00/.test(t), t.slice(0,300));
  T('total líquido 93.850', /93\.850,00/.test(t));
  const v=await p.evaluate(()=>DATA.obras[0].etapasPagamento.map(e=>valorEtapaContrato(DATA.obras[0],e)));
  T('cálculo bruto intacto', v[0]===50000&&v[1]===50000, v);
  T('sem erros', errs.length===0, errs); console.log(ok+' ok, '+ko+' falhas'); await b.close(); process.exit(ko?1:0);
})();
