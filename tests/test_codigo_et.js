const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const p=await (await b.newContext()).newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file:///home/claude/financeiro-et-projetos/index.html'); await p.waitForTimeout(400);
  let ok=0,ko=0; const T=(n,c,d)=>{c?ok++:ko++;console.log((c?'PASS ':'FAIL ')+n+(d!==undefined?' '+JSON.stringify(d):''));};
  const ano=new Date().getFullYear();
  const r=await p.evaluate(()=>{ DATA.obras=[{id:'a',codigo:'ET-'+new Date().getFullYear()+'-007'},{id:'b',codigo:'CT 55-06'},{id:'c',codigo:'ET-2019-050'}];
    const x=proximoCodigoObra(); DATA.obras.push({id:'d',codigo:x}); const y=proximoCodigoObra(); const novo={obras:[{id:'e'},{id:'f',codigo:'ET-'+new Date().getFullYear()+'-003'}],tiposServico:[],minhasEmpresas:[]}; ensureTiposPadrao(novo); return {x,y,cod:novo.obras[0].codigo}; });
  T('próximo código = maior do ano + 1', r.x==='ET-'+ano+'-008', r);
  T('segundo código não repete', r.y==='ET-'+ano+'-009');
  T('obra sem código recebe ET-AAAA-NNN', r.cod==='ET-'+ano+'-004', r.cod);
  await b.close(); console.log(ok+' ok / '+ko+' falhas', errs); process.exit(ko?1:0);
})();
