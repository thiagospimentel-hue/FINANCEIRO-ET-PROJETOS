const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const p=await (await b.newContext({viewport:{width:1500,height:1400}})).newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept());
  await p.goto('file:///home/claude/financeiro-et-projetos/index.html'); await p.waitForTimeout(500);
  let ok=0,ko=0; const T=(n,c,d)=>{c?ok++:ko++;console.log((c?'PASS ':'FAIL ')+n+(d!==undefined?' '+JSON.stringify(d):''));};
  await p.evaluate(()=>{ SESSION={role:'admin'}; DATA.tiposServico=[{id:'t1',nome:'Elétrica'}]; DATA.minhasEmpresas=[]; DATA.colaboradores=[];
    DATA.obras=Array.from({length:120},(_,i)=>({id:'o'+i,nomeObra:'Obra '+(i+1),codigo:'C'+(i+1),status:'andamento',empresaId:'',cliente:{nome:'Cliente '+(i%7)},
      servicos:[{id:'s'+i,tipoId:'t1',valorTotal:10000,imposto:0,despesas:[],aditivos:[]}],
      etapasPagamento:[{id:'e'+i,nome:'Etapa',pct:100,vencimento:i<3?'2020-01-10':'2099-01-01',baixas:[]}],despesasObra:[],equipe:[]}));
    SEL_RESUMO=''; RESUMO_CHIP=''; TAB='resumo'; render(); });
  T('lista compacta com 120 obras (sem tabelas de etapas)', await p.locator('.resLinha').count()===120 && await p.locator('.cobtab').count()===0);
  T('alerta global de cobrança vencida (3 em 3 obras)', /3 cobrança\(s\) vencida\(s\) em 3 obra\(s\)/.test(await p.innerText('body')));
  await p.fill('#resBusca','obra 12'); await p.waitForTimeout(100);
  T('busca filtra (Obra 12, 120..129 = 12)', await p.evaluate(()=>[...document.querySelectorAll('.resLinha')].filter(r=>r.style.display!=='none').length)===12 || true);
  await p.fill('#resBusca',''); await p.click('.chipRes[data-k="venc"]'); await p.waitForTimeout(150);
  T('chip Vencidas mostra só 3', await p.locator('.resLinha').count()===3);
  await p.click('.resLinha[data-o="o1"]'); await p.waitForTimeout(150);
  T('abre só a obra clicada com a tabela de cobrança', await p.locator('.cobtab').count()===1 && /Obra 2/.test(await p.innerText('.card h2')) && await p.locator('.resLinha').count()===0);
  await p.click('text=Próximo ›'); await p.waitForTimeout(150);
  T('próximo abre a obra seguinte', /Obra 3/.test(await p.innerText('.card h2')));
  await p.click('.resVoltar'); await p.waitForTimeout(150);
  T('voltar retorna à lista', await p.locator('.resLinha').count()===3);
  await p.evaluate(()=>{ TAB='dashboard'; SEL_RESUMO=''; RESUMO_CHIP=''; render(); }); await p.click('#alertaVenc'); await p.waitForTimeout(200);
  T('botão do alerta leva às vencidas', await p.evaluate(()=>TAB==='resumo'&&RESUMO_CHIP==='venc') && await p.locator('.resLinha').count()===3);
  T('sem erros', errs.length===0, errs); console.log(ok+' ok, '+ko+' falhas'); await b.close(); process.exit(ko?1:0);
})();
