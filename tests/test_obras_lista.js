const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const p=await (await b.newContext({viewport:{width:1500,height:1400}})).newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept());
  await p.goto('file:///home/claude/financeiro-et-projetos/index.html'); await p.waitForTimeout(500);
  let ok=0,ko=0; const T=(n,c,d)=>{c?ok++:ko++;console.log((c?'PASS ':'FAIL ')+n+(d!==undefined?' '+JSON.stringify(d):''));};
  await p.evaluate(()=>{ SESSION={role:'admin'}; DATA.tiposServico=[{id:'t1',nome:'Elétrica'}]; DATA.minhasEmpresas=[{id:'e1',nome:'ET'}]; DATA.colaboradores=[];
    DATA.obras=Array.from({length:120},(_,i)=>({id:'o'+i,nomeObra:'Obra '+(i+1),codigo:'C'+(i+1),status:i<5?'concluida':'andamento',empresaId:'e1',cliente:{nome:'Cliente '+(i%7)},
      servicos:[{id:'s'+i,tipoId:'t1',valorTotal:10000,imposto:0,despesas:[],aditivos:[]}],etapasPagamento:[],despesasObra:[],equipe:[]}));
    OPEN_OBRA=null; FILTER_COLAB=''; FILTER_STATUS=''; TAB='obras'; render(); });
  T('lista compacta com 120 obras, nenhuma aberta', await p.locator('.obraLinha').count()===120 && await p.locator('.toggleobra').count()===0);
  await p.fill('#obraBusca','cliente 3'); await p.waitForTimeout(100);
  T('busca por cliente filtra', await p.evaluate(()=>[...document.querySelectorAll('.obraLinha')].filter(r=>r.style.display!=='none').length)>0);
  await p.fill('#obraBusca',''); await p.click('.obraLinha[data-o="o7"]'); await p.waitForTimeout(200);
  T('abre só a obra clicada', await p.locator('.toggleobra').count()===1 && /Obra 8/.test(await p.innerText('.card h2')) && await p.locator('.obraLinha').count()===0);
  await p.click('text=Próximo ›'); await p.waitForTimeout(200);
  T('próximo abre a seguinte', /Obra 9/.test(await p.innerText('.card h2')));
  await p.click('.obraVoltar'); await p.waitForTimeout(200);
  T('voltar retorna à lista', await p.locator('.obraLinha').count()===120);
  await p.selectOption('#filterStatus','concluida'); await p.waitForTimeout(200);
  T('filtro de status continua funcionando na lista (5)', await p.locator('.obraLinha').count()===5);
  await p.evaluate(()=>{ FILTER_STATUS=''; const o=DATA.obras[10]; o.etapasPagamento=[{id:'e1',nome:'Entrada',pct:50,baixas:[{id:'b',tipo:'entrada',valor:5000,data:'2026-01-01'}]},{id:'e2',nome:'Final',pct:50,vencimento:'2020-01-01',baixas:[]}]; OPEN_OBRA=null; render(); });
  const ar=await p.evaluate(()=>{ const tr=document.querySelector('.obraLinha[data-o="o10"]'); return tr.innerText.replace(/\s+/g,' '); });
  T('coluna A receber mostra saldo e vencido da obra', /A receber/i.test(await p.innerText('body')) && /5\.000,00/.test(ar) && /vencido/.test(ar), ar);
  T('sem erros', errs.length===0, errs); console.log(ok+' ok, '+ko+' falhas'); await b.close(); process.exit(ko?1:0);
})();
