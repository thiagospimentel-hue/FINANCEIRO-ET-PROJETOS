const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const p=await (await b.newContext({viewport:{width:1400,height:1000}})).newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept());
  await p.goto('file:///home/claude/financeiro-et-projetos/index.html'); await p.waitForTimeout(500);
  let ok=0,ko=0; const T=(n,c,d)=>{c?ok++:ko++;console.log((c?'PASS ':'FAIL ')+n+(d!==undefined?' '+JSON.stringify(d):''));};
  await p.evaluate(()=>{ SESSION={role:'admin'}; DATA.tiposServico=[{id:'t1',nome:'Elétrica'},{id:'t5',nome:'Subestação'}]; DATA.colaboradores=[{id:'u1',nome:'Renner',cargo:'C'}];
    DATA.obras=[{id:'o1',nomeObra:'M',codigo:'C',status:'andamento',empresaId:'',cliente:{nome:'c'},servicos:[{id:'s1',tipoId:'t1',valorTotal:100000,imposto:0,despesas:[],aditivos:[]},{id:'s5',tipoId:'t5',valorTotal:40000,imposto:0,despesas:[],aditivos:[]}],etapasPagamento:[],despesasObra:[],equipe:[]},
              {id:'o2',nomeObra:'SemSub',codigo:'D',status:'andamento',empresaId:'',cliente:{nome:'c'},servicos:[{id:'s9',tipoId:'t1',valorTotal:10000,imposto:0,despesas:[],aditivos:[]}],etapasPagamento:[],despesasObra:[],equipe:[]}];
    TAB='obras'; OPEN_OBRA='o1'; render(); });
  await p.click('.dobraAdd[data-n="Estudo de proteção"]'); await p.waitForTimeout(100);
  const d=await p.evaluate(()=>DATA.obras[0].despesasObra[0]);
  T('estudo de proteção nasce vinculado à Subestação', d.servicoId==='s5', d);
  await p.evaluate(()=>{ const d=DATA.obras[0].despesasObra[0]; d.pct=10; d.modo='pct'; d.colaboradorId='u1'; render(); });
  T('% é sobre o líquido da subestação (10% de 40.000 = 4.000)', await p.evaluate(()=>despObraValor(DATA.obras[0],DATA.obras[0].despesasObra[0]))===4000);
  const r=await p.evaluate(()=>{ const x=resumoGridObra(DATA.obras[0]); return [x.totCusto, calcObra(DATA.obras[0]).despTotal]; });
  T('resumo continua batendo com o cálculo', Math.abs(r[0]-r[1])<0.01, r);
  T('despesa aparece na coluna Subestação do resumo', await p.evaluate(()=>{ const h=resumoGridObra(DATA.obras[0]).html; const i=h.indexOf('Estudo de proteção'); return i>0 && /R\$\s*4\.000,00/.test(h.slice(i,i+400)); }));
  // lista de materiais e ART = geral
  await p.click('.dobraAdd[data-n="Lista de materiais"]'); await p.waitForTimeout(100);
  const l=await p.evaluate(()=>DATA.obras[0].despesasObra[1]);
  T('lista de materiais é despesa geral (sem disciplina)', !l.servicoId);
  await p.evaluate(()=>{ const d=DATA.obras[0].despesasObra[1]; d.modo='valor'; d.valor=750; d.colaboradorId='u1'; d.vencimento='2026-11-10'; });
  const linhas=await p.evaluate(()=>pagamentosDoColaborador('u1').linhas.map(x=>[x.tipo,x.papel,x.val]));
  T('Renner vê as duas despesas a receber', linhas.length===2 && linhas.some(x=>/Lista de materiais/.test(x[1])&&x[2]===750) && linhas.some(x=>/Estudo de proteção/.test(x[1])&&x[2]===4000), linhas);
  const f=await p.evaluate(()=>fichaDe('u1').linhas.map(x=>x.tipo+':'+x.val));
  T('ficha do colaborador inclui as despesas', f.length===2, f);
  // obra sem subestação: alerta e geral
  await p.evaluate(()=>{ OPEN_OBRA='o2'; render(); });
  await p.click('.dobraAdd[data-n="Estudo de proteção"]'); await p.waitForTimeout(100);
  T('sem Subestação fica como Geral', await p.evaluate(()=>!DATA.obras[1].despesasObra[0].servicoId));
  T('sem erros', errs.length===0, errs); console.log(ok+' ok, '+ko+' falhas'); await b.close(); process.exit(ko?1:0);
})();
