const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const p=await (await b.newContext({viewport:{width:1400,height:1200}})).newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept());
  await p.goto('file:///home/claude/financeiro-et-projetos/index.html'); await p.waitForTimeout(500);
  let ok=0,ko=0; const T=(n,c,d)=>{c?ok++:ko++;console.log((c?'PASS ':'FAIL ')+n+(d!==undefined?' '+JSON.stringify(d):''));};
  await p.evaluate(()=>{ SESSION={role:'admin'}; DATA.tiposServico=[{id:'t1',nome:'E'}]; DATA.colaboradores=[]; DATA.minhasEmpresas=[{id:'e1',nome:'ET'},{id:'e2',nome:'Pimentel'}];
    const mk=(id,emp,st,et)=>({id,nomeObra:'Obra '+id,codigo:id,status:st,empresaId:emp,cliente:{nome:'c'},servicos:[{id:'s'+id,tipoId:'t1',valorTotal:100000,imposto:0,despesas:[],aditivos:[]}],etapasPagamento:et,despesasObra:[],equipe:[]});
    DATA.obras=[mk('o1','e1','andamento',[{id:'a',nome:'A',pct:40,baixas:[],nfNumero:'1',nfData:'2026-10-01'},{id:'b',nome:'B',pct:60,baixas:[]}]),
                mk('o2','e2','concluida',[{id:'c',nome:'C',pct:100,baixas:[],nfNumero:'2',nfData:'2026-10-02'}]),
                mk('o3','e1','cancelada',[{id:'d',nome:'D',pct:100,baixas:[]}])];
    TAB='dashboard'; render(); });
  const card=()=>p.locator('#dashVal').locator('xpath=ancestor::div[contains(@class,"card")]').innerText();
  let t=await card();
  T('total 200.000, faturado 140.000, a faturar 60.000 (cancelada fora)', /200\.000,00/.test(t)&&/140\.000,00/.test(t)&&/60\.000,00/.test(t), t);
  await p.selectOption('#dashEmp','e1'); await p.waitForTimeout(100); t=await card();
  T('filtro por empresa: 100.000 / 40.000 / 60.000', /100\.000,00/.test(t)&&/40\.000,00/.test(t)&&/60\.000,00/.test(t), t);
  await p.selectOption('#dashEmp',''); await p.selectOption('#dashVal','liquido'); await p.waitForTimeout(100); t=await card();
  T('líquido: 187.700 / 131.390 / 56.310', /187\.700,00/.test(t)&&/131\.390,00/.test(t)&&/56\.310,00/.test(t), t);
  T('sem erros', errs.length===0, errs); console.log(ok+' ok, '+ko+' falhas'); await b.close(); process.exit(ko?1:0);
})();
