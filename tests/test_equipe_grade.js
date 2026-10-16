const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const p=await (await b.newContext({viewport:{width:1400,height:1000}})).newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept());
  await p.goto('file:///home/claude/financeiro-et-projetos/index.html'); await p.waitForTimeout(500);
  let ok=0,ko=0; const T=(n,c,d)=>{c?ok++:ko++;console.log((c?'PASS ':'FAIL ')+n+(d!==undefined?' '+JSON.stringify(d):''));};
  await p.evaluate(()=>{ SESSION={role:'admin'}; DATA.colaboradores=[{id:'u1',nome:'Renner',cargo:'Coordenador'},{id:'u2',nome:'Bruno',cargo:'Aux'},{id:'u3',nome:'Ana',cargo:'Det'}];
    DATA.obras=[{id:'o1',nomeObra:'X',codigo:'C',status:'andamento',empresaId:'',cliente:{nome:'c'},
     servicos:[{id:'s1',tipoId:'t1',valorTotal:1000,imposto:10,despesas:[],aditivos:[]},{id:'s2',tipoId:'t2',valorTotal:500,imposto:0,despesas:[],aditivos:[]}],
     etapasPagamento:[],despesasObra:[],
     equipe:[{id:'q1',colaboradorId:'u1',papel:'Coordenador',pct:5,baseIds:['s1'],etapas:etapasCoordPadrao()},
             {id:'q2',colaboradorId:'u2',papel:'Aux',pct:10,baseIds:['s1','s2'],etapas:etapasCoordPadrao()}]}];
    TAB='obras'; OPEN_OBRA='o1'; render(); });
  T('grade aparece', await p.locator('.gcell').count()>0, await p.locator('.gcell').count());
  T('Renner/Elétrica = 5 (valor 45)', await p.evaluate(()=>equipeMembroValor(DATA.obras[0],DATA.obras[0].equipe[0]))===45);
  T('vínculo combinado (Bruno) cai em especiais', (await p.content()).includes('Vínculos especiais (1)'));
  // digitar 8% de Renner em Sistemas
  await p.fill('.gcell[data-c="u1"][data-b="s2"]','8'); await p.dispatchEvent('.gcell[data-c="u1"][data-b="s2"]','change'); await p.waitForTimeout(100); await p.waitForTimeout(100);
  const e1=await p.evaluate(()=>DATA.obras[0].equipe.filter(m=>m.colaboradorId==='u1').map(m=>[m.baseIds.join(),m.pct]));
  T('novo vínculo Renner/Sistemas 8%', JSON.stringify(e1)==='[["s1",5],["s2",8]]', e1);
  T('total equipe correto (45+40)', Math.round(await p.evaluate(()=>equipeTotalObra(DATA.obras[0])))===45+40+ (10/100)*(900+500) );
  // limpar célula sem histórico remove
  await p.fill('.gcell[data-c="u1"][data-b="s2"]',''); await p.dispatchEvent('.gcell[data-c="u1"][data-b="s2"]','change'); await p.waitForTimeout(100);
  T('célula vazia remove vínculo', await p.evaluate(()=>DATA.obras[0].equipe.filter(m=>m.colaboradorId==='u1').length)===1);
  // aplicar a todas
  await p.fill('.gall[data-c="u1"]','3'); await p.click('.gallbtn[data-c="u1"]');
  T('aplicar a todas disciplinas', await p.evaluate(()=>DATA.obras[0].equipe.filter(m=>m.colaboradorId==='u1').map(m=>m.pct).join())==='3,3');
  // adicionar colaborador
  await p.selectOption('.gaddsel','u3'); await p.click('.gadd');
  T('linha da Ana aparece', (await p.content()).includes('data-c="u3"'));
  await p.fill('.gcell[data-c="u3"][data-b=""]','2'); await p.dispatchEvent('.gcell[data-c="u3"][data-b=""]','change'); await p.waitForTimeout(100);
  T('Ana Geral 2% cria vínculo sem base', await p.evaluate(()=>{const m=DATA.obras[0].equipe.find(x=>x.colaboradorId==='u3');return m&&m.pct===2&&m.baseIds.length===0;}));
  // histórico preservado: marca pagamento e zera
  await p.evaluate(()=>{ const m=DATA.obras[0].equipe.find(x=>x.colaboradorId==='u3'); m.etapas[0].aprovado=true; render(); });
  await p.fill('.gcell[data-c="u3"][data-b=""]',''); await p.dispatchEvent('.gcell[data-c="u3"][data-b=""]','change'); await p.waitForTimeout(100);
  T('com histórico não apaga (pct 0)', await p.evaluate(()=>{const m=DATA.obras[0].equipe.find(x=>x.colaboradorId==='u3');return !!m&&m.pct===0;}));
  await p.click('.eqmodo[data-m="lista"]'); T('visão detalhada mostra lista antiga', await p.locator('.equipepct').count()>=3);
  T('sem erros', errs.length===0, errs); console.log(ok+' ok, '+ko+' falhas'); await b.close(); process.exit(ko?1:0);
})();
