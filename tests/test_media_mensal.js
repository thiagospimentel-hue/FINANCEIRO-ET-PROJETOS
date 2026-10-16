const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const p=await (await b.newContext({viewport:{width:1400,height:1000}})).newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept());
  await p.goto('file:///home/claude/financeiro-et-projetos/index.html'); await p.waitForTimeout(500);
  let ok=0,ko=0; const T=(n,c,d)=>{c?ok++:ko++;console.log((c?'PASS ':'FAIL ')+n+(d!==undefined?' '+JSON.stringify(d):''));};
  await p.evaluate(()=>{ SESSION={role:'admin'}; DATA.colaboradores=[{id:'u1',nome:'Renner',cargo:'C'}];
    const mk=(id,nome)=>({id,nomeObra:nome,codigo:id,status:'andamento',empresaId:'',cliente:{nome:'c'},servicos:[{id:'s'+id,tipoId:'t1',valorTotal:100000,imposto:0,despesas:[],aditivos:[]}],etapasPagamento:[],despesasObra:[],
      equipe:[{id:'q'+id,colaboradorId:'u1',papel:'Coord',pct:10,baseIds:[],etapas:etapasCoordPadrao()}]});
    DATA.obras=[mk('o1','A'),mk('o2','B')]; TAB='obras'; OPEN_OBRA='o1'; render(); });
  await p.click('.gdet[data-c="u1"]');
  T('painel de forma de pagamento visível', await p.locator('.gm-modo').count()===1);
  await p.selectOption('.gm-modo','media'); await p.fill('.gm-ini','2026-05'); await p.fill('.gm-meses','6'); await p.fill('.gm-ret','10'); await p.fill('.gm-dia','5');
  await p.click('.gmaplicar[data-esc="todas"]'); await p.waitForTimeout(200);
  const r=await p.evaluate(()=>DATA.obras.map(o=>{const m=o.equipe[0];return {n:m.etapas.length,soma:Math.round(m.etapas.reduce((a,e)=>a+e.pct,0)*1e4)/1e4,md:m.modelo,primeira:m.etapas[0].nome,pag:m.etapas[0].pagarEm,ult:m.etapas[6].nome};}));
  T('2 obras com 6 parcelas + retenção, soma 100%', r.every(x=>x.n===7&&x.soma===100&&x.md==='media'), r);
  T('datas e nomes das parcelas', r[0].primeira==='Parcela 1/6 — mai/2026' && r[0].pag==='2026-05-05' && r[0].ult.startsWith('Retenção'));
  const v=await p.evaluate(()=>{ const o=DATA.obras[0],m=o.equipe[0]; return [valorEquipeEtapa(o,m,m.etapas[0]), valorEquipeEtapa(o,m,m.etapas[6])]; });
  T('parcela = 10.000*0,9/6 = 1.500; retenção = 1.000', v[0]===1500 && v[1]===1000, v);
  const pend=await p.evaluate(()=>aprovacoesPendentes().map(x=>x.e.nome+'@'+x.o.id));
  const hoje=await p.evaluate(()=>hojeISO());
  const esperado=await p.evaluate(()=>DATA.obras[0].equipe[0].etapas.filter(e=>e.mensal&&e.pagarEm<=hojeISO()).length*2);
  T('aprovações pendentes só das parcelas já vencidas', pend.length===esperado && !pend.some(x=>x.startsWith('Retenção')), {hoje,pend:pend.length,esperado});
  // aprovar uma parcela e tentar reaplicar -> bloqueia
  await p.evaluate(()=>{ const o=DATA.obras[0],m=o.equipe[0]; aprovarEntrega(o,m,m.etapas[0]); render(); });
  T('aprovar parcela define data de pagamento', await p.evaluate(()=>DATA.obras[0].equipe[0].etapas[0].data)==='2026-05-05');
  await p.selectOption('.gm-modo','entrega'); await p.click('.gmaplicar[data-esc="todas"]'); await p.waitForTimeout(200);
  const r2=await p.evaluate(()=>DATA.obras.map(o=>[o.equipe[0].etapas.length,o.equipe[0].modelo||'']));
  T('obra com aprovação não é alterada; a outra volta a 4 etapas', JSON.stringify(r2)==='[[7,"media"],[4,""]]', r2);
  // liberar retenção
  await p.evaluate(()=>{ OPEN_OBRA='o1'; render(); });
  if(await p.locator('.gdet[data-c="u1"]').count()) { const t=await p.locator('.gm-modo').count(); if(!t) await p.click('.gdet[data-c="u1"]'); }
  await p.click('.gmliberar'); await p.waitForTimeout(150);
  T('retenção liberada vira a pagar', await p.evaluate(()=>{const e=DATA.obras[0].equipe[0].etapas[6]; return e.aprovado&&e.concluido&&!!e.data;}));
  // novo vínculo herda média
  await p.evaluate(()=>{ equipeGridSet('o2','u1','',0); equipeGridSet('o2','u1','so2',10); });
  T('sem erros', errs.length===0, errs); console.log(ok+' ok, '+ko+' falhas'); await b.close(); process.exit(ko?1:0);
})();
