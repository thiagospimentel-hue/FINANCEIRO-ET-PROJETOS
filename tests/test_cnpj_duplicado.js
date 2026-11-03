const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const p=await (await b.newContext({viewport:{width:1500,height:1400}})).newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); let msgs=[],resp=true; p.on('dialog',d=>{msgs.push(d.message());resp?d.accept():d.dismiss();});
  await p.goto('file:///home/claude/financeiro-et-projetos/index.html'); await p.waitForTimeout(500);
  let ok=0,ko=0; const T=(n,c,d)=>{c?ok++:ko++;console.log((c?'PASS ':'FAIL ')+n+(d!==undefined?' '+JSON.stringify(d):''));};
  await p.evaluate(()=>{ SESSION={role:'admin'}; DATA.colaboradores=[]; DATA.caixa=[]; const mk=(id,doc)=>({id,nomeObra:'Obra '+id,codigo:id,status:'andamento',empresaId:'',cliente:{nome:'c',documento:doc},servicos:[],etapasPagamento:[],despesasObra:[],equipe:[]}); DATA.obras=[mk('o1','11.222.333/0001-81'),mk('o2','')]; OPEN_OBRA='o2'; TAB='obras'; render(); });
  const r=await p.evaluate(()=>({igual:obrasComDocumento('11222333000181').length, fmt:obrasComDocumento('11.222.333/0001-81','o1').length, outro:obrasComDocumento('99.999.999/0001-99').length, curto:obrasComDocumento('123').length}));
  T('acha obra com mesmo CNPJ (formatado ou não)', r.igual===1&&r.fmt===0&&r.outro===0&&r.curto===0, r);
  resp=false; await p.fill('.cliCampo[data-o="o2"][data-f="documento"]','11.222.333/0001-81'); await p.dispatchEvent('.cliCampo[data-o="o2"][data-f="documento"]','change'); await p.waitForTimeout(150);
  let v=await p.evaluate(()=>DATA.obras[1].cliente.documento); T('avisa e cancelar mantém o campo vazio', msgs.length===1&&v==='', {msgs:msgs.length,v});
  resp=true; await p.fill('.cliCampo[data-o="o2"][data-f="documento"]','11.222.333/0001-81'); await p.dispatchEvent('.cliCampo[data-o="o2"][data-f="documento"]','change'); await p.waitForTimeout(150);
  v=await p.evaluate(()=>DATA.obras[1].cliente.documento); T('continuar mesmo assim grava', v==='11.222.333/0001-81', v);
  await b.close(); console.log(ok+' ok / '+ko+' falhas', errs.filter(e=>!/innerHTML/.test(e))); process.exit(ko?1:0);
})();
