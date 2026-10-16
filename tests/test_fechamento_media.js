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
  // padrão: NF (empresa predominante; ambas 50/50 -> uma só), um único documento por mês
  const fm=await p.evaluate(()=>{ const m=mediaMesEmp('u1'); return Object.keys(m).map(k=>k+'='+Math.round(m[k].total)); });
  T('um único documento por mês (sem separar NF/recibo)', fm.length===1&&/=6000$/.test(fm[0]), fm);
  T('padrão emite NF', await p.evaluate(()=>[...document.querySelectorAll('.gerarnf')].length===1 && document.querySelectorAll('.gerarrecibo').length===0));
  await p.selectOption('.colabDoc[data-u="u1"]','recibo'); await p.waitForTimeout(200);
  await p.evaluate(()=>{ TAB='colaboradores'; OPEN_COLAB='u1'; render(); });
  const fm2=await p.evaluate(()=>{ const m=mediaMesEmp('u1'); return Object.keys(m); });
  T('associado: recibo pela Pimentel (e2) mesmo com obra em nome da ET', JSON.stringify(fm2)==='["jul/2026|e2"]', fm2);
  T('associado: botão Gerar recibo e nenhum Solicitar NF', await p.evaluate(()=>document.querySelectorAll('.gerarrecibo').length===1 && document.querySelectorAll('.gerarnf').length===0));
  const d=await p.evaluate(()=>{ const x=dadosDocColab('u1','jul/2026','e2'); return {t:Math.round(x.total),n:x.itens.length,emp:x.emp.nome}; });
  T('recibo com o valor digitado (6.000) em nome da Pimentel', d.t===6000&&/Pimentel/.test(d.emp), d);
  // registrar pagamento do mês
  await p.evaluate(()=>{ DATA.minhasEmpresas[0].contas=[{id:'c1',banco:'Itaú',apelido:'Itaú ET',agencia:'1',conta:'2'}]; DATA.caixa=[]; TAB='colaboradores'; OPEN_COLAB='u1'; render(); });
  T('botão registrar aparece após digitar o valor', await p.locator('.pmReg[data-m="2026-07"]').count()===1 && await p.locator('.pmReg[data-m="2026-08"]').count()===0);
  await p.selectOption('.pmConta','c1'); await p.fill('.pmData','10/07/2026'); await p.click('.pmReg[data-m="2026-07"]'); await p.waitForTimeout(300);
  const rg=await p.evaluate(()=>({cx:DATA.caixa.filter(m=>m.tipo==='saida').map(m=>m.valor+'@'+m.contaId+'@'+m.data),bx:DATA.obras.map(o=>o.equipe[0].etapas[0].baixas.reduce((a,b)=>a+b.valor,0)),pg:pagamentosDoColaborador('u1').pago}));
  T('registrar lança saída no caixa (com conta) e baixa nas parcelas, rateado', rg.cx.length===2 && rg.cx.every(x=>/^3000@c1@2026-07-10$/.test(x)) && rg.bx[0]===3000 && rg.bx[1]===3000 && rg.pg===6000, rg);
  T('mês fica marcado como pago e campo travado', await p.locator('.pmDesf[data-m="2026-07"]').count()===1 && await p.locator('.pagoMes[data-m="2026-07"]').isDisabled());
  T('não duplica ao registrar de novo', await p.evaluate(()=>registrarPagoMes('u1','2026-07','2026-07-10','c1'))===false && await p.evaluate(()=>DATA.caixa.filter(m=>m.tipo==='saida'&&!m.estornoDe).length)===2);
  await p.evaluate(()=>{ window.prompt=()=>'teste'; }); await p.click('.pmDesf[data-m="2026-07"]'); await p.waitForTimeout(300);
  const dz=await p.evaluate(()=>({pg:pagamentosDoColaborador('u1').pago,reg:!!DATA.colaboradores[0].pagoRegistro,man:DATA.colaboradores[0].pagoMes['2026-07']}));
  T('desfazer estorna as baixas e libera o mês (valor manual mantido)', dz.pg===0&&!dz.reg&&dz.man===6000, dz);
  T('sem erros', errs.length===0, errs); console.log(ok+' ok, '+ko+' falhas'); await b.close(); process.exit(ko?1:0);
})();
