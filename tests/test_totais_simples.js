const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const p=await (await b.newContext({viewport:{width:1400,height:1200}})).newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept());
  await p.goto('file:///home/claude/financeiro-et-projetos/index.html'); await p.waitForTimeout(500);
  let ok=0,ko=0; const T=(n,c,d)=>{c?ok++:ko++;console.log((c?'PASS ':'FAIL ')+n+(d!==undefined?' '+JSON.stringify(d):''));};
  await p.evaluate(()=>{ SESSION={role:'admin'}; DATA.tiposServico=[{id:'t1',nome:'E'},{id:'t2',nome:'S'}]; DATA.colaboradores=[]; DATA.minhasEmpresas=[{id:'e1',nome:'ET'},{id:'e2',nome:'Pimentel'}];
    const mk=(id,emp,st,sv,et)=>({id,nomeObra:'Obra '+id,codigo:id,status:st,empresaId:emp,cliente:{nome:'c'},servicos:sv,etapasPagamento:et,despesasObra:[],equipe:[]});
    DATA.obras=[mk('o1','e1','andamento',[{id:'s1',tipoId:'t1',valorTotal:60000,imposto:10,despesas:[{nome:'M',pct:10}],aditivos:[]},{id:'s2',tipoId:'t2',valorTotal:40000,imposto:10,despesas:[],aditivos:[]}],[{id:'a',nome:'A',pct:40,baixas:[],nfNumero:'1',nfData:'2026-10-01'},{id:'b',nome:'B',pct:60,baixas:[]}]),
                mk('o2','e2','concluida',[{id:'s3',tipoId:'t1',valorTotal:100000,imposto:0,despesas:[],aditivos:[]}],[{id:'c',nome:'C',pct:100,baixas:[],nfNumero:'2',nfData:'2026-10-02'}]),
                mk('o3','e1','cancelada',[{id:'s4',tipoId:'t1',valorTotal:5000,imposto:0,despesas:[],aditivos:[]}],[{id:'d',nome:'D',pct:100,baixas:[]}])];
    TAB='dashboard'; render(); });
  const card=()=>p.locator('h2:has-text("Valores por obra")').locator('xpath=ancestor::div[contains(@class,"card")]').innerText();
  let t=await card();
  T('linha da obra 1: 100.000 / 10.000 / 5.400 / 40.000 / 60.000', /Obra o1[\s\S]*100\.000,00[\s\S]*10\.000,00[\s\S]*5\.400,00[\s\S]*40\.000,00[\s\S]*60\.000,00/.test(t), t);
  T('total 2 obras: 200.000 / 140.000 / 60.000, cancelada fora', /Total \(2 obras\)\s*R\$\s*200\.000,00/.test(t)&&!/Obra o3/.test(t)&&/140\.000,00/.test(t), t);
  await p.selectOption('#dashEmp','e2'); await p.waitForTimeout(100); t=await card();
  T('filtro empresa: só a obra 2', /Obra o2/.test(t)&&!/Obra o1/.test(t), t);
  await p.selectOption('#dashEmp',''); await p.click('.dashChip[data-id="o1"]'); await p.waitForTimeout(100); t=await card();
  T('obra clicada: só a obra 1', /Obra o1/.test(t)&&!/Obra o2/.test(t), t);
  T('sem erros', errs.length===0, errs); console.log(ok+' ok, '+ko+' falhas'); await b.close(); process.exit(ko?1:0);
})();
