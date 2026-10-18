const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const p=await (await b.newContext()).newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file:///home/claude/financeiro-et-projetos/index.html'); await p.waitForTimeout(500);
  let ok=0,ko=0; const T=(n,c,d)=>{c?ok++:ko++;console.log((c?'PASS ':'FAIL ')+n+(d!==undefined?' '+JSON.stringify(d):''));};
  const r=await p.evaluate(()=>{ SESSION={role:'admin'}; DATA.tiposServico=[{id:'t1',nome:'E'}]; DATA.minhasEmpresas=[]; DATA.caixa=[];
    DATA.colaboradores=[{id:'u2',nome:'Val',cargo:'C'}];
    const q=(id,c,pct)=>({id,colaboradorId:c,papel:'C',pct,baseIds:[],etapas:etapasCoordPadrao()});
    DATA.obras=['a','b'].map((k,i)=>({id:'o'+k,nomeObra:'Obra '+k,codigo:k,status:'andamento',empresaId:'',cliente:{nome:'c'},servicos:[{id:'s'+k,tipoId:'t1',valorTotal:100000*(i+1),imposto:0,despesas:[],aditivos:[]}],etapasPagamento:[],despesasObra:[],equipe:[q('q2'+k,'u2',10)]}));
    aplicarModeloPagamento('u2','media',{inicio:'2026-11',meses:2,ret:0,dia:5,fim:'2026-12',grupoId:'g',grupo:'G'},['oa','ob']);
    // baixas pagaram o devido todo (15.000) mas o manual diz 10.000
    DATA.obras.forEach(o=>{ const e=o.equipe[0].etapas.find(x=>x.pagarEm&&x.pagarEm.startsWith('2026-11')); lancarBaixa(e,{tipo:'saida',valor:valorEquipeEtapa(o,o.equipe[0],e),data:'2026-11-05',desc:'x',obraId:o.id,colaboradorId:'u2',origem:{tipo:'equipe',obraId:o.id,refId:'x'}}); });
    DATA.colaboradores[0].pagoMes={'2026-11':10000};
    const f=fichaDe('u2'); const nov=f.linhas.filter(l=>l.pagarEm&&l.pagarEm.startsWith('2026-11'));
    return {pago:nov.reduce((a,l)=>a+l.pago,0), bx:nov.reduce((a,l)=>a+l.baixas.reduce((x,b)=>x+b.valor,0),0), conf:f.conferencia.find(x=>x.ym==='2026-11').pago}; });
  T('recebido da ficha = pago da conferência (10.000)', Math.abs(r.pago-10000)<0.02&&Math.abs(r.bx-10000)<0.02&&r.conf===10000, r);
  T('sem erros', errs.length===0, errs); console.log(ok+' ok, '+ko+' falhas'); await b.close(); process.exit(ko?1:0);
})();
