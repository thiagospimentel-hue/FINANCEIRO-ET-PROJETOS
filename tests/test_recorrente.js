const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const p=await (await b.newContext({viewport:{width:1500,height:1400}})).newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept());
  await p.goto('file:///home/claude/financeiro-et-projetos/index.html'); await p.waitForTimeout(500);
  let ok=0,ko=0; const T=(n,c,d)=>{c?ok++:ko++;console.log((c?'PASS ':'FAIL ')+n+(d!==undefined?' '+JSON.stringify(d):''));};
  const r=await p.evaluate(()=>{ SESSION={role:'admin'}; DATA.tiposServico=[{id:'t1',nome:'E'}]; DATA.minhasEmpresas=[]; DATA.colaboradores=[]; DATA.caixa=[];
    DATA.obras=[{id:'o1',nomeObra:'Rec',codigo:'1',status:'andamento',empresaId:'',cliente:{nome:'c'},servicos:[{id:'s',tipoId:'t1',valorTotal:2950,imposto:18.5,despesas:[],aditivos:[]}],
      etapasPagamento:[{id:'e1',pct:100,nome:'Mensalidade - 10/2026',mes:'2026-10',pago:false,baixas:[],data:'',nfData:'',nfNumero:'',vencimento:''}],despesasObra:[],equipe:[],recorrente:{valor:2950,inicio:'2026-10'}}];
    const hoje=hojeISO().slice(0,7); const ch1=aplicarRecorrentes(DATA); const o=DATA.obras[0]; const n1=o.etapasPagamento.length;
    const ch2=aplicarRecorrentes(DATA);
    return {hoje,n1,ch1,ch2,total:o.servicos[0].valorTotal,soma:o.etapasPagamento.reduce((a,e)=>a+e.pct,0),vals:o.etapasPagamento.map(e=>Math.round(e.pct*o.servicos[0].valorTotal)/100)}; });
  T('gera as mensalidades até o mês atual', r.n1>=2, r);
  T('idempotente (segunda chamada não muda)', r.ch2===false);
  T('cada parcela vale a mensalidade', r.vals.every(v=>Math.abs(v-2950)<0.01), r.vals);
  T('percentuais somam 100', Math.abs(r.soma-100)<1e-6, r.soma);
  await p.evaluate(()=>{ OPEN_OBRA='o1'; TAB='obras'; render(); });
  T('campo de recorrência aparece', !!(await p.$('.recCampo[data-f="valor"]')));
  await p.fill('.recCampo[data-f="valor"]','3000'); await p.dispatchEvent('.recCampo[data-f="valor"]','change'); await p.waitForTimeout(200);
  const v=await p.evaluate(()=>{const o=DATA.obras[0];return {t:o.servicos[0].valorTotal,n:o.etapasPagamento.length,rec:o.recorrente.valor}});
  T('alterar a mensalidade recalcula o total', v.rec===3000&&v.t===3000*v.n, v);
  await b.close(); console.log(ok+' ok / '+ko+' falhas', errs); process.exit(ko?1:0);
})();
