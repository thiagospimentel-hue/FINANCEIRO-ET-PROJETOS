const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const p=await (await b.newContext({viewport:{width:1500,height:1400}})).newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept());
  await p.goto('file:///home/claude/financeiro-et-projetos/index.html'); await p.waitForTimeout(500);
  let ok=0,ko=0; const T=(n,c,d)=>{c?ok++:ko++;console.log((c?'PASS ':'FAIL ')+n+(d!==undefined?' '+JSON.stringify(d):''));};
  await p.evaluate(()=>{ SESSION={role:'admin'}; DATA.tiposServico=[{id:'t1',nome:'E'}]; DATA.minhasEmpresas=[]; DATA.colaboradores=[{id:'u1',nome:'R',cargo:'C',padrao:{'':10}}]; DATA.caixa=[];
    DATA.obras=[{id:'o1',nomeObra:'Obra 1',codigo:'1',status:'andamento',empresaId:'',cliente:{nome:'c'},servicos:[{id:'s',tipoId:'t1',valorTotal:100000,imposto:0,despesas:[],aditivos:[]}],etapasPagamento:[],despesasObra:[],equipe:[{id:'q',colaboradorId:'u1',papel:'C',pct:10,baseIds:[],etapas:etapasCoordPadrao()}]}];
    aplicarModeloPagamento('u1','media',{inicio:'2026-11',meses:2,ret:0,dia:5,fim:'2026-12',grupoId:'g',grupo:'G'},['o1']);
    const c=DATA.colaboradores[0]; c.pagoMes={'2026-11':5000}; registrarPagoMes('u1','2026-11','2026-11-05',''); });
  const antes=await p.evaluate(()=>fichaDe('u1').linhas.map(l=>Math.round(l.val)));
  T('parcela paga vale 5.000 antes', antes[0]===5000, antes);
  // muda o padrão do colaborador para 12% -> deve aplicar mesmo com pagamento da média e refletir na ficha
  await p.evaluate(()=>{ const u=DATA.colaboradores[0]; u.padrao={'':12}; aplicarPadraoColab('o1','u1',true); });
  const dep=await p.evaluate(()=>({pct:DATA.obras[0].equipe[0].pct,f:fichaDe('u1').linhas.map(l=>Math.round(l.val)),conf:confMensalColab('u1').map(r=>Math.round(r.dev))}));
  T('novo % aplicado mesmo com pagamento de média', dep.pct===12, dep);
  T('ficha do colaborador reflete 6.000 por parcela', dep.f[0]===6000&&dep.f[1]===6000, dep.f);
  T('conferência mostra devido novo (diferença a pagar)', dep.conf[0]===6000, dep.conf);
  // vínculo por entrega com aprovação manual continua travado
  const tr=await p.evaluate(()=>{ const m={etapas:[{aprovado:true,auto:false,baixas:[]}]}; const m2={etapas:[{aprovado:true,auto:true,baixas:[{id:'x'}]}]}; return [membroPctTravado(m),membroPctTravado(m2)]; });
  T('aprovação manual trava; automática não', tr[0]===true&&tr[1]===false, tr);
  // dados antigos (parcelas pagas congeladas) são descongelados ao carregar
  const mg=await p.evaluate(()=>{ const m=DATA.obras[0].equipe[0]; m.etapas.forEach(e=>{ if(e.mensal) e.valorFixo=5000; }); window.__migCong=false; ensureTiposPadrao(DATA); return {flag:window.__migCong, fixos:m.etapas.filter(e=>temValor(e.valorFixo)).length}; });
  T('migração descongela parcelas automáticas antigas', mg.flag===true&&mg.fixos===0, mg);
    // dados reais: parcelas aprovadas à mão (sem auto) e congeladas também são liberadas
  const mg2=await p.evaluate(()=>{ const m=DATA.obras[0].equipe[0]; m.etapas.forEach(e=>{ if(e.mensal){ delete e.auto; e.aprovado=true; e.valorFixo=4000; } }); window.__migCong=false; ensureTiposPadrao(DATA); return {flag:window.__migCong, fixos:m.etapas.filter(e=>temValor(e.valorFixo)).length, trav:membroPctTravado(m)}; });
  T('parcelas de média aprovadas à mão também descongelam', mg2.flag===true&&mg2.fixos===0&&mg2.trav===false, mg2);
  // pagamento registrado + baixa complementar (pagou a diferença): conferência fica zerada
  const zz=await p.evaluate(()=>{ const c=DATA.colaboradores[0]; const o=DATA.obras[0], m=o.equipe[0]; const e=m.etapas.find(x=>x.mensal&&baixaTotal(x)>0);
    const dif=valorEquipeEtapa(o,m,e)-baixaTotal(e); lancarBaixa(e,{tipo:'saida',valor:dif,data:'2026-11-06',desc:'diferença',obraId:o.id,colaboradorId:c.id,origem:{tipo:'equipe',obraId:o.id,refId:m.id+':'+e.nome}});
    const r=confMensalColab('u1').find(x=>x.ym==='2026-11'); return {dev:r.dev,pago:r.pago,dif:Math.round(r.dif*100)/100}; });
  T('diferença paga por baixa complementar zera a conferência do mês', zz.dif===0&&zz.pago===zz.dev, zz);
  T('sem erros', errs.length===0, errs); console.log(ok+' ok, '+ko+' falhas'); await b.close(); process.exit(ko?1:0);
})();
