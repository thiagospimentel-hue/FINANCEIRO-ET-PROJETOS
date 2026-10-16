const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const p=await (await b.newContext({viewport:{width:1500,height:1400}})).newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept());
  await p.goto('file:///home/claude/financeiro-et-projetos/index.html'); await p.waitForTimeout(500);
  let ok=0,ko=0; const T=(n,c,d)=>{c?ok++:ko++;console.log((c?'PASS ':'FAIL ')+n+(d!==undefined?' '+JSON.stringify(d):''));};
  await p.evaluate(()=>{ SESSION={role:'admin'}; DATA.tiposServico=[{id:'t1',nome:'Elétrica'}]; DATA.minhasEmpresas=[]; DATA.colaboradores=[{id:'u1',nome:'Renner',cargo:'C'}]; DATA.caixa=[];
    const mk=(id)=>({id,nomeObra:'Obra '+id,codigo:id,status:'andamento',empresaId:'',cliente:{nome:'c'},servicos:[{id:'s'+id,tipoId:'t1',valorTotal:100000,imposto:0,despesas:[],aditivos:[]}],etapasPagamento:[],despesasObra:[],
      equipe:[{id:'q'+id,colaboradorId:'u1',papel:'Coord',pct:10,baseIds:[],etapas:etapasCoordPadrao()}]});
    DATA.obras=[mk('o1')]; SEL_COLAB='u1'; TAB='colaboradores';
    aplicarModeloPagamento('u1','media',{inicio:'2026-11',meses:2,ret:0,dia:5,fim:'2026-12',grupoId:'g',grupo:'G'},['o1']); render(); });
  T('formulário de avulso aparece', await p.locator('.avAdd').count()===1);
  await p.fill('.avMes','2026-11'); await p.fill('.avDesc','Ajuste extra'); await p.fill('.avVal','1.500,00'); await p.click('.avAdd'); await p.waitForTimeout(250);
  const c=await p.evaluate(()=>confMensalColab('u1').map(r=>r.ym+':'+r.dev+':'+(r.avu||0)));
  T('avulso entra no devido do mês, sem dividir (nov 5.000+1.500, dez 5.000)', JSON.stringify(c)==='["2026-11:6500:1500","2026-12:5000:0"]', c);
  T('lista mostra o avulso e o aviso "inclui avulso"', /inclui avulso/.test(await p.innerText('body')) && /Ajuste extra/.test(await p.innerText('body')));
  T('aparece nos pagamentos do colaborador (contratado/aprovado)', await p.evaluate(()=>{ const q=pagamentosDoColaborador('u1'); return Math.round(q.total)===11500&&Math.round(q.aprovado)===11500; }));
  // pagar nov: 6.500 -> baixas rateadas (parcela + avulso)
  await p.fill('.pagoMes[data-m="2026-11"]','6.500,00'); await p.press('.pagoMes[data-m="2026-11"]','Tab'); await p.waitForTimeout(200);
  await p.click('.pmReg[data-m="2026-11"]'); await p.waitForTimeout(300);
  const pg=await p.evaluate(()=>{ const m=DATA.obras[0].equipe[0]; return m.etapas.map(e=>e.nome.slice(0,10)+':'+Math.round(baixaTotal(e))).filter(x=>!/:0$/.test(x)); });
  T('pagamento do mês quita parcela e avulso', pg.length===2 && pg.some(x=>/^Avulso/.test(x)&&/:1500$/.test(x)) && pg.some(x=>/:5000$/.test(x)), pg);
  // reaplicar média preserva o avulso
  await p.evaluate(()=>{ DATA.obras[0].equipe[0].media.travado=false; delete DATA.obras[0].equipe[0].media.travado; aplicarModeloPagamento('u1','media',{inicio:'2026-11',meses:3,ret:0,dia:5,fim:'2027-01'},['o1']); });
  T('remarcar a média preserva o avulso', await p.evaluate(()=>DATA.obras[0].equipe[0].etapas.filter(e=>e.avulso).length===1));
  T('avulso pago não pode ser removido', await p.evaluate(()=>removerAvulso('u1','o1',DATA.obras[0].equipe[0].etapas.find(e=>e.avulso).nome))===false);
  T('sem erros', errs.length===0, errs); console.log(ok+' ok, '+ko+' falhas'); await b.close(); process.exit(ko?1:0);
})();
