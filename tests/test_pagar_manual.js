const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const p=await (await b.newContext({viewport:{width:1500,height:1400}})).newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>{ d.type()==='prompt'?d.accept('erro'):d.accept(); });
  await p.goto('file:///home/claude/financeiro-et-projetos/index.html'); await p.waitForTimeout(500);
  let ok=0,ko=0; const T=(n,c,d)=>{c?ok++:ko++;console.log((c?'PASS ':'FAIL ')+n+(d!==undefined?' '+JSON.stringify(d):''));};
  await p.evaluate(()=>{ SESSION={role:'admin'}; DATA.tiposServico=[{id:'t1',nome:'E'}]; DATA.minhasEmpresas=[]; DATA.caixa=[];
    DATA.colaboradores=[{id:'u2',nome:'Jordanna',cargo:'C'}];
    const q=(id,c,pct)=>({id,colaboradorId:c,papel:'C',pct,baseIds:[],etapas:etapasCoordPadrao()});
    DATA.obras=['a','b'].map((k,i)=>({id:'o'+k,nomeObra:'Obra '+k,codigo:k,status:'andamento',empresaId:'',cliente:{nome:'c'},servicos:[{id:'s'+k,tipoId:'t1',valorTotal:100000*(i+1),imposto:0,despesas:[],aditivos:[]}],etapasPagamento:[],despesasObra:[],equipe:[q('q2'+k,'u2',10)]}));
    aplicarModeloPagamento('u2','media',{inicio:'2026-11',meses:2,ret:0,dia:5,fim:'2026-12',grupoId:'g',grupo:'G'},['oa','ob']);
    FILTER_CONTAS_MES='2026-11'; TAB='contas'; render(); });
  const inp='tr:has(.mmReg[data-u="u2"]) .mmVal';
  // digitou e a tela atualizou: valor digitado continua
  await p.fill(inp,'5.000,00'); await p.evaluate(()=>render());
  T('valor digitado sobrevive a re-render', await p.inputValue(inp)==='5.000,00', await p.inputValue(inp));
  await p.click('.mmReg[data-u="u2"]'); await p.waitForTimeout(400);
  let c=await p.evaluate(()=>confMensalColab('u2').find(x=>x.ym==='2026-11'));
  T('pago 5.000 (não o devido)', c.pago===5000&&Math.round(c.dif)===10000, c);
  await p.click('.mmDesf[data-u="u2"]'); await p.waitForTimeout(400);
  c=await p.evaluate(()=>({c:confMensalColab('u2').find(x=>x.ym==='2026-11'),pm:DATA.colaboradores[0].pagoMes}));
  T('desfazer limpa o valor manual (volta a 0 pago, 15.000 a pagar)', c.c.pago===0&&!c.pm, c);
  T('campo volta ao devido e segue editável', await p.inputValue(inp)==='15.000,00', await p.inputValue(inp));
  await p.fill(inp,'7.500,00'); await p.click('.mmReg[data-u="u2"]'); await p.waitForTimeout(400);
  c=await p.evaluate(()=>confMensalColab('u2').find(x=>x.ym==='2026-11'));
  T('segundo pagamento de 7.500 respeitado', c.pago===7500&&Math.round(c.dif)===7500, c);
  T('sem erros', errs.length===0, errs); console.log(ok+' ok, '+ko+' falhas'); await b.close(); process.exit(ko?1:0);
})();
