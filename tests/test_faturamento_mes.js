const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const p=await (await b.newContext({viewport:{width:1500,height:1000}})).newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept());
  await p.goto('file:///home/claude/financeiro-et-projetos/index.html'); await p.waitForTimeout(500);
  let ok=0,ko=0; const T=(n,c,d)=>{c?ok++:ko++;console.log((c?'PASS ':'FAIL ')+n+(d!==undefined?' '+JSON.stringify(d):''));};
  await p.evaluate(()=>{ SESSION={role:'admin'}; DATA.tiposServico=[{id:'t1',nome:'E'}]; DATA.colaboradores=[];
    DATA.minhasEmpresas=[{id:'e1',nome:'ET'},{id:'e2',nome:'Pimentel'}];
    const mk=(id,emp,cli,nf)=>({id,nomeObra:'Obra '+id,codigo:id,status:'andamento',empresaId:emp,cliente:{nome:cli},servicos:[{id:'s'+id,tipoId:'t1',valorTotal:100000,imposto:0,despesas:[],aditivos:[]}],etapasPagamento:nf,despesasObra:[],equipe:[]});
    DATA.obras=[mk('o1','e1','Cliente A',[{id:'a',nome:'Básico',pct:50,baixas:[{id:'b1',data:'2026-10-20',valor:50000}],nfNumero:'10',nfData:'2026-10-05'},{id:'a2',nome:'Exec',pct:50,baixas:[],nfNumero:'11',nfData:'2026-11-05'}]),
                mk('o2','e2','Cliente B',[{id:'c',nome:'Básico',pct:20,baixas:[],nfNumero:'7',nfData:'2026-10-12'}])];
    FAT_MES='2026-10'; TAB='caixa'; render(); });
  let t=await p.innerText('#app, body');
  T('lista clientes do mês (total)', /Cliente A/.test(t)&&/Cliente B/.test(t)&&!/Cliente A[\s\S]*11\/2026/.test('') );
  T('total bruto 70.000 e líquido 65.695', /70\.000,00/.test(t)&&/65\.695,00/.test(t));
  T('emissão e pagamento', /05\/10\/2026/.test(t)&&/20\/10\/2026/.test(t));
  await p.selectOption('#fatEmp','e2'); await p.waitForTimeout(150);
  t=await p.innerText('body');
  const card=await p.locator('#fatMes').locator('xpath=ancestor::div[contains(@class,"card")]').innerText();
  T('filtro por empresa mostra só Cliente B (20.000)', /Cliente B/.test(card)&&!/Cliente A/.test(card)&&/20\.000,00/.test(card), card.slice(0,300));
  await p.fill('#fatMes','2026-11'); await p.press('#fatMes','Tab'); await p.selectOption('#fatEmp',''); await p.waitForTimeout(150);
  const c2=await p.locator('#fatMes').locator('xpath=ancestor::div[contains(@class,"card")]').innerText();
  T('mês seguinte: só a NF 11', /Cliente A/.test(c2)&&!/Cliente B/.test(c2)&&/50\.000,00/.test(c2), c2.slice(0,300));
  T('sem erros', errs.length===0, errs); console.log(ok+' ok, '+ko+' falhas'); await b.close(); process.exit(ko?1:0);
})();
