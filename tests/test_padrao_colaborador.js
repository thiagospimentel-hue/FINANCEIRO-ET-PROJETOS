const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const p=await (await b.newContext({viewport:{width:1500,height:1400}})).newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept());
  await p.goto('file:///home/claude/financeiro-et-projetos/index.html'); await p.waitForTimeout(500);
  let ok=0,ko=0; const T=(n,c,d)=>{c?ok++:ko++;console.log((c?'PASS ':'FAIL ')+n+(d!==undefined?' '+JSON.stringify(d):''));};
  await p.evaluate(()=>{ SESSION={role:'admin'}; DATA.tiposServico=[{id:'t1',nome:'Elétrica'},{id:'t5',nome:'Subestação'}]; DATA.minhasEmpresas=[];
    DATA.colaboradores=[{id:'u1',nome:'Guilherme',cargo:'Coordenação'},{id:'u2',nome:'Outro',cargo:'Equipe'}];
    const mk=(id)=>({id,nomeObra:'Obra '+id,codigo:id,status:'andamento',empresaId:'',cliente:{nome:'c'},servicos:[{id:'s'+id+'a',tipoId:'t1',valorTotal:100000,imposto:0,despesas:[],aditivos:[]},{id:'s'+id+'b',tipoId:'t5',valorTotal:40000,imposto:0,despesas:[],aditivos:[]}],etapasPagamento:[],despesasObra:[],equipe:[{id:'q'+id,colaboradorId:'u2',papel:'Equipe',pct:10,baseIds:[],etapas:etapasCoordPadrao()}]});
    DATA.obras=[mk('o1'),mk('o2')]; TAB='colaboradores'; OPEN_COLAB='u1'; render(); });
  T('campos de padrão no cadastro', await p.locator('.cpadrao[data-u="u1"]').count()===3);
  const set=async(t,v)=>{ await p.fill('.cpadrao[data-u="u1"][data-t="'+t+'"]',v); await p.press('.cpadrao[data-u="u1"][data-t="'+t+'"]','Tab'); await p.waitForTimeout(120); };
  await set('t5','7.5'); await set('t1','7.5');
  T('padrão gravado no colaborador', await p.evaluate(()=>{const q=DATA.colaboradores[0].padrao; return q.t1===7.5&&q.t5===7.5&&Object.keys(q).length===2;}));
  // adicionar na obra aplica
  await p.evaluate(()=>{ TAB='obras'; OPEN_OBRA='o1'; render(); });
  await p.selectOption('.gaddsel[data-o="o1"]','u1'); await p.click('.gadd[data-o="o1"]'); await p.waitForTimeout(150);
  const r=await p.evaluate(()=>DATA.obras[0].equipe.filter(m=>m.colaboradorId==='u1').map(m=>({b:m.baseIds.join(),pct:m.pct,papel:m.papel})));
  T('ao incluir na obra aplica 7,5% em Elétrica e Subestação', r.length===2&&r.every(x=>x.pct===7.5&&x.papel==='Coordenação'), r);
  // aplicar nas obras existentes (u1 não está na o2 → nada); incluir manualmente com valor diferente e reaplicar
  await p.evaluate(()=>{ equipeGridSet('o2','u1','so2a',3); render(); });
  await p.evaluate(()=>{ TAB='colaboradores'; OPEN_COLAB='u1'; render(); });
  await p.click('.cpadAplicar[data-u="u1"]'); await p.waitForTimeout(200);
  const r2=await p.evaluate(()=>DATA.obras[1].equipe.filter(m=>m.colaboradorId==='u1').map(m=>m.baseIds.join()+':'+m.pct).sort());
  T('botão aplica o padrão nas obras onde já está', JSON.stringify(r2)==='["so2a:7.5","so2b:7.5"]', r2);
  await set('t1','9'); await set('t5','9');
  const r3=await p.evaluate(()=>DATA.obras.map(o=>o.equipe.filter(m=>m.colaboradorId==='u1').map(m=>m.pct).join()).join('|'));
  T('mudar % no colaborador atualiza as obras vinculadas sozinho', r3==='9,9|9,9', r3);
  T('sem erros', errs.length===0, errs); console.log(ok+' ok, '+ko+' falhas'); await b.close(); process.exit(ko?1:0);
})();
