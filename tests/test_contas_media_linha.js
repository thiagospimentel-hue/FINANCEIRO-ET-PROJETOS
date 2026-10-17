const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const p=await (await b.newContext({viewport:{width:1500,height:1400}})).newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>{ d.type()==='prompt'?d.accept('erro de lançamento'):d.accept(); });
  await p.goto('file:///home/claude/financeiro-et-projetos/index.html'); await p.waitForTimeout(500);
  let ok=0,ko=0; const T=(n,c,d)=>{c?ok++:ko++;console.log((c?'PASS ':'FAIL ')+n+(d!==undefined?' '+JSON.stringify(d):''));};
  await p.evaluate(()=>{ SESSION={role:'admin'}; DATA.tiposServico=[{id:'t1',nome:'E'}]; DATA.minhasEmpresas=[]; DATA.caixa=[];
    DATA.colaboradores=[{id:'u1',nome:'Renner',cargo:'C'},{id:'u2',nome:'Jordanna',cargo:'C'}];
    const q=(id,c,pct)=>({id,colaboradorId:c,papel:'C',pct,baseIds:[],etapas:etapasCoordPadrao()});
    DATA.obras=['a','b','c'].map((k,i)=>({id:'o'+k,nomeObra:'Obra '+k,codigo:k,status:'andamento',empresaId:'',cliente:{nome:'c'},servicos:[{id:'s'+k,tipoId:'t1',valorTotal:100000*(i+1),imposto:0,despesas:[],aditivos:[]}],etapasPagamento:[],despesasObra:[],equipe:[q('q1'+k,'u1',10),q('q2'+k,'u2',10)]}));
    ['u1','u2'].forEach(u=>aplicarModeloPagamento(u,'media',{inicio:'2026-11',meses:2,ret:0,dia:5,fim:'2026-12',grupoId:'g',grupo:'G'},['oa','ob','oc']));
    FILTER_CONTAS_MES='2026-11'; TAB='contas'; render(); });
  const esperado=await p.evaluate(()=>[etapasMesMedia('u1','2026-11').reduce((a,x)=>a+x.v,0),etapasMesMedia('u2','2026-11').reduce((a,x)=>a+x.v,0)]);
  T('uma linha por colaborador (2) em vez de 6 parcelas', await p.locator('input.mmPago').count()===2, await p.locator('input.mmPago').count());
  T('linha do Renner = soma das obras (R$ 30.000)', esperado[0]===30000 && /Renner/.test(await p.innerText('tbody tr:has(input.mmPago[data-u="u1"])')) && (await p.innerText('tbody tr:has(input.mmPago[data-u="u1"])')).includes('30.000,00'), esperado);
  T('detalhe por obra dentro da linha', (await p.innerHTML('tbody tr:has(input.mmPago[data-u="u1"])')).includes('Obra a'));
  await p.click('input.mmPago[data-u="u1"]'); await p.waitForTimeout(400);
  const r=await p.evaluate(()=>({reg:!!DATA.colaboradores[0].pagoRegistro?.['2026-11'], cx:DATA.caixa.filter(m=>m.tipo==='saida').reduce((a,m)=>a+m.valor,0), conf:confMensalColab('u1').find(x=>x.ym==='2026-11')}));
  T('marcar pago registra o mês e lança no caixa (30.000)', r.reg && Math.round(r.cx)===30000 && r.conf.dif===0, r);
  T('linha fica paga', /Paga/.test(await p.innerText('tbody tr:has(input.mmPago[data-u="u1"])')));
  await p.click('input.mmPago[data-u="u1"]'); await p.waitForTimeout(400);
  T('desmarcar desfaz o pagamento', await p.evaluate(()=>!DATA.colaboradores[0].pagoRegistro&&DATA.caixa.filter(m=>m.tipo==='saida'&&!m.estornoDe).length>=0 && baixaTotal(DATA.obras[0].equipe[0].etapas[0])===0));
  // pagamento parcial com outra data
  await p.click('tbody tr:has(input.mmPago[data-u="u2"]) summary:has-text("pagar parcial")'); await p.fill('tbody tr:has(input.mmPago[data-u="u2"]) .mmVal','20.000,00'); await p.click('tbody tr:has(input.mmPago[data-u="u2"]) .mmReg'); await p.waitForTimeout(400);
  const c2=await p.evaluate(()=>confMensalColab('u2').find(x=>x.ym==='2026-11'));
  T('pagamento parcial 20.000 deixa 10.000 de diferença', c2.pago===20000&&Math.round(c2.dif)===10000, c2);
  T('sem erros', errs.length===0, errs); console.log(ok+' ok, '+ko+' falhas'); await b.close(); process.exit(ko?1:0);
})();
