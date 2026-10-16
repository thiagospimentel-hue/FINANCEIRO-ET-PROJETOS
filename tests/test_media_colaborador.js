const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const p=await (await b.newContext({viewport:{width:1400,height:1200}})).newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept());
  await p.goto('file:///home/claude/financeiro-et-projetos/index.html'); await p.waitForTimeout(500);
  let ok=0,ko=0; const T=(n,c,d)=>{c?ok++:ko++;console.log((c?'PASS ':'FAIL ')+n+(d!==undefined?' '+JSON.stringify(d):''));};
  await p.evaluate(()=>{ SESSION={role:'admin'}; DATA.colaboradores=[{id:'u1',nome:'Renner',cargo:'C'}];
    const mk=(id,nome)=>({id,nomeObra:nome,codigo:id,status:'andamento',empresaId:'',cliente:{nome:'c'},servicos:[{id:'s'+id,tipoId:'t1',valorTotal:100000,imposto:0,despesas:[],aditivos:[]}],etapasPagamento:[],despesasObra:[],
      equipe:[{id:'q'+id,colaboradorId:'u1',papel:'Coord',pct:10,baseIds:[],etapas:etapasCoordPadrao()}]});
    DATA.obras=[mk('o1','A'),mk('o2','B'),mk('o3','C')]; TAB='colaboradores'; SEL_COLAB='u1'; render(); });
  T('painel de média no card do colaborador', await p.locator('.mcOb').count()===3);
  await p.check('.mcOb[data-o="o1"]'); await p.waitForTimeout(100); await p.check('.mcOb[data-o="o3"]'); await p.waitForTimeout(100);
  await p.fill('.mcCfg[data-f="inicio"]','2026-11'); await p.press('.mcCfg[data-f="inicio"]','Tab'); await p.waitForTimeout(100);
  await p.fill('.mcCfg[data-f="fim"]','2027-02'); await p.press('.mcCfg[data-f="fim"]','Tab'); await p.waitForTimeout(100);
  await p.fill('.mcCfg[data-f="grupo"]','Grupo teste'); await p.press('.mcCfg[data-f="grupo"]','Tab'); await p.waitForTimeout(100);
  T('resumo mostra total 20.000 e parcela 4.500', /20\.000,00/.test(await p.innerText('.servbox')) && /4\.500,00/.test(await p.innerText('.servbox')), await p.innerText('.servbox'));
  await p.click('.mcAplicar[data-m="media"]'); await p.waitForTimeout(200);
  const r=await p.evaluate(()=>DATA.obras.map(o=>({md:o.equipe[0].modelo||'',n:o.equipe[0].etapas.length,ini:o.equipe[0].media&&o.equipe[0].media.inicio,m:o.equipe[0].media&&o.equipe[0].media.meses})));
  T('grupo gravado com nome e fim', await p.evaluate(()=>{const md=DATA.obras[0].equipe[0].media; return md.grupo==='Grupo teste'&&md.fim==='2027-02'&&md.grupoId===DATA.obras[2].equipe[0].media.grupoId&&!!md.grupoId;}));
  T('painel lista o grupo aplicado com as 2 obras', (await p.locator('.servbox:has-text("Grupos aplicados")').count())>0 && /Grupo teste/.test(await p.innerText('.servbox:has-text("Grupos aplicados")')) && /A · C/.test(await p.innerText(".servbox:has-text(\"Grupos aplicados\")")));
  T('só as obras marcadas ficam em média (4 parcelas + retenção)', r[0].md==='media'&&r[0].n===5&&r[0].m===4&&r[0].ini==='2026-11'&&r[2].md==='media'&&r[1].md==='', r);
  // 2 obras x 10.000 x 90%/4 meses -> 4.500/mês por obra? total mensal do grupo = 4.500
  const mes=await p.evaluate(()=>confMensalColab('u1').map(r=>r.ym+':'+r.dev));
  T('conferência mensal lista os 4 meses com devido 4.500', mes.length===4&&mes[0]==='2026-11:4500', mes);
  await p.fill('.pagoMes[data-m="2026-11"]','4.000,00'); await p.press('.pagoMes[data-m="2026-11"]','Tab'); await p.waitForTimeout(200);
  await p.fill('.pagoMes[data-m="2026-12"]','5.000,00'); await p.press('.pagoMes[data-m="2026-12"]','Tab'); await p.waitForTimeout(200);
  const cm=await p.evaluate(()=>confMensalColab('u1').map(r=>r.dif+'/'+r.acum));
  T('diferença e acumulado (500, depois 0, depois -500...)', cm[0]==='500/500'&&cm[1]==='-500/0'&&cm[2]==='4500/4500', cm);
  T('pago manual gravado no colaborador', await p.evaluate(()=>DATA.colaboradores[0].pagoMes['2026-11']===4000&&DATA.colaboradores[0].pagoMes['2026-12']===5000));
  T('grupo nasce travado (checkbox da obra bloqueado) e protegido (sem botão de voltar até destravar)', await p.locator('.mcOb[disabled]').count()===2 && await p.locator('.mcDesfazer').count()===0 && await p.evaluate(()=>DATA.obras[0].equipe[0].media.travado===true));
  await p.evaluate(()=>{ aplicarModeloPagamento('u1','entrega',{},['o1']); }); // aplicar sem destravar não altera
  T('grupo travado não é alterado por aplicar comum', await p.evaluate(()=>DATA.obras[0].equipe[0].modelo==='media'));
  await p.click('.mcTrava'); await p.waitForTimeout(200);
  T('destravar libera o botão Voltar para por entrega', await p.locator('.mcDesfazer').count()===1);
  await p.click('.mcDesfazer'); await p.waitForTimeout(200);
  T('voltar por entrega nas marcadas', await p.evaluate(()=>DATA.obras.map(o=>o.equipe[0].modelo||'').join('|'))==='||');
  await p.evaluate(()=>{ aprovarEntrega(DATA.obras[1],DATA.obras[1].equipe[0],DATA.obras[1].equipe[0].etapas[0]); render(); });
  T('obra com aprovação fica desabilitada', await p.locator('.mcOb[data-o="o2"]').isDisabled());
  T('sem erros', errs.length===0, errs); console.log(ok+' ok, '+ko+' falhas'); await b.close(); process.exit(ko?1:0);
})();
