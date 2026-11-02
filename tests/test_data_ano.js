const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const p=await (await b.newContext({viewport:{width:1500,height:1400}})).newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept());
  await p.goto('file:///home/claude/financeiro-et-projetos/index.html'); await p.waitForTimeout(500);
  let ok=0,ko=0; const T=(n,c,d)=>{c?ok++:ko++;console.log((c?'PASS ':'FAIL ')+n+(d!==undefined?' '+JSON.stringify(d):''));};
  await p.evaluate(()=>{ SESSION={role:'admin'}; DATA.tiposServico=[{id:'t1',nome:'E'}]; DATA.minhasEmpresas=[]; DATA.colaboradores=[]; DATA.caixa=[];
    DATA.obras=[{id:'o1',nomeObra:'Obra 1',codigo:'1',status:'andamento',empresaId:'',cliente:{nome:'c'},servicos:[{id:'s',tipoId:'t1',valorTotal:1000,imposto:0,despesas:[],aditivos:[]}],etapasPagamento:[],despesasObra:[],equipe:[]}]; TAB='obras'; OPEN_OBRA='o1'; render(); });
  const sel=await p.$('.obraCampo[data-f="dataInicio"]');
  if(!sel){ console.log('campo nao encontrado'); process.exit(1); }
  await sel.click();
  await p.keyboard.type('01012026');
  await p.waitForTimeout(300);
  const v=await p.evaluate(()=>({campo:document.querySelector('.obraCampo[data-f="dataInicio"]').value,dado:DATA.obras[0].dataInicio}));
  T('digitar dia/mês/ano completo (2026) mantém o ano', v.campo==='2026-01-01'&&v.dado==='2026-01-01', v);
  await b.close(); console.log(ok+' ok / '+ko+' falhas', errs); process.exit(ko?1:0);
})();
