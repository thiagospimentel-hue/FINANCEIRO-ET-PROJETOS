const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const p=await (await b.newContext({viewport:{width:1500,height:1400}})).newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept());
  await p.goto('file:///home/claude/financeiro-et-projetos/index.html'); await p.waitForTimeout(500);
  let ok=0,ko=0; const T=(n,c,d)=>{c?ok++:ko++;console.log((c?'PASS ':'FAIL ')+n+(d!==undefined?' '+JSON.stringify(d):''));};
  await p.evaluate(()=>{ SESSION={role:'admin'}; DATA.tiposServico=[{id:'t1',nome:'Elétrica'}];
    DATA.minhasEmpresas=[{id:'e1',nome:'ET ENGENHARIA e PROJETOS S/S LTDA',cnpj:'1'},{id:'e2',nome:'Pimentel Consultoria',cnpj:'2'}];
    DATA.colaboradores=[{id:'u1',nome:'Renner',cargo:'C',documento:'123'}];
    const mk=(id,emp)=>({id,nomeObra:'Obra '+id,codigo:id,status:'andamento',empresaId:emp,cliente:{nome:'c'},servicos:[{id:'s'+id,tipoId:'t1',valorTotal:100000,imposto:0,despesas:[],aditivos:[]}],etapasPagamento:[],despesasObra:[],
      equipe:[{id:'q'+id,colaboradorId:'u1',papel:'Coord',pct:10,baseIds:[],etapas:etapasCoordPadrao()}]});
    DATA.obras=[mk('o1','e1'),mk('o2','e2')]; TAB='colaboradores'; OPEN_COLAB='u1'; render();
    aplicarModeloPagamento('u1','media',{inicio:'2026-07',meses:2,ret:0,dia:5,fim:'2026-08',grupoId:'g',grupo:'G'},['o1','o2']); render(); });
  T('parcelas da média já nascem aprovadas (sem pendência)', await p.evaluate(()=>aprovacoesPendentes().length===0 && DATA.obras[0].equipe[0].etapas.every(e=>e.aprovado)));
  T('sem pagamento digitado não há fechamento', (await p.innerText('body')).indexOf('Solicitar NF')<0 && (await p.innerText('body')).indexOf('Gerar recibo')<0);
  // devido jul = 5000 por obra (10% de 100k / 2 meses) => 10.000/mês; paga 6.000 em jul
  await p.fill('.pagoMes[data-m="2026-07"]','6.000,00'); await p.press('.pagoMes[data-m="2026-07"]','Tab'); await p.waitForTimeout(200);
  const fm=await p.evaluate(()=>{ const m=mediaMesEmp('u1'); return Object.keys(m).map(k=>k+'='+Math.round(m[k].total)).sort(); });
  T('pago 6.000 é rateado entre as empresas pelo devido (3.000 + 3.000)', JSON.stringify(fm)==='["jul/2026|e1=3000","jul/2026|e2=3000"]', fm);
  const bt=await p.evaluate(()=>[...document.querySelectorAll('.gerarnf,.gerarrecibo')].map(b=>b.className.replace('btn secondary ','')+':'+b.dataset.e));
  T('ET => solicitar NF; Pimentel => recibo (associado, sem NF)', bt.includes('gerarnf:e1')&&bt.includes('gerarrecibo:e2')&&!bt.includes('gerarnf:e2'), bt);
  const d=await p.evaluate(()=>{ const x=dadosDocColab('u1','jul/2026','e2'); return {t:Math.round(x.total),n:x.itens.length}; });
  T('recibo da Pimentel usa o valor digitado', d.t===3000&&d.n===1, d);
  T('sem erros', errs.length===0, errs); console.log(ok+' ok, '+ko+' falhas'); await b.close(); process.exit(ko?1:0);
})();
