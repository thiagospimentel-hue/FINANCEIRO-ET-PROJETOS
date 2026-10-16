const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const p=await (await b.newContext({viewport:{width:1400,height:1000}})).newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept());
  await p.goto('file:///home/claude/financeiro-et-projetos/index.html'); await p.waitForTimeout(500);
  let ok=0,ko=0; const T=(n,c,d)=>{ if(errs.length) console.log('  [erros até aqui: '+errs.length+']'); c?ok++:ko++;console.log((c?'PASS ':'FAIL ')+n+(d!==undefined?' '+JSON.stringify(d):''));};
  await p.evaluate(()=>{ SESSION={role:'admin'}; DATA.tiposServico=[{id:'t1',nome:'Elétrica'},{id:'t2',nome:'Sistemas'}]; DATA.colaboradores=[{id:'u1',nome:'Renner',cargo:'C'},{id:'u2',nome:'Ana',cargo:'D'}];
    DATA.obras=[{id:'o1',nomeObra:'M',codigo:'C',status:'andamento',empresaId:'',cliente:{nome:'c'},
      servicos:[{id:'s1',tipoId:'t1',valorTotal:160000,imposto:17,despesas:[{nome:'Compatibilização',pct:15},{nome:'Coordenação Mitech',pct:7.5}],aditivos:[]},{id:'s2',tipoId:'t2',valorTotal:120000,imposto:17,despesas:[{nome:'Compatibilização',pct:15}],aditivos:[]}],
      etapasPagamento:[],despesasObra:[{id:'d1',nome:'ART',modo:'valor',valor:118,pct:0}],
      equipe:[{id:'q1',colaboradorId:'u1',papel:'Coord',pct:5,baseIds:['s1'],etapas:etapasCoordPadrao()},{id:'q2',colaboradorId:'u1',papel:'Coord',pct:4,baseIds:['s1','s2'],etapas:etapasCoordPadrao()},{id:'q3',colaboradorId:'u2',papel:'Det',pct:3,baseIds:[],etapas:etapasCoordPadrao()}]}];
    TAB='obras'; OPEN_OBRA='o1'; render(); });
  T('grade de serviços e despesas aparece', await p.locator('.sgdesp').count()===4, await p.locator('.sgdesp').count());
  const chk=await p.evaluate(()=>{ const r=resumoGridObra(DATA.obras[0]); return [r.totCusto, calcObra(DATA.obras[0]).despTotal, r.lucroTot, calcObra(DATA.obras[0]).lucro]; });
  T('resumo bate com o cálculo oficial (custo e lucro)', Math.abs(chk[0]-chk[1])<0.01 && Math.abs(chk[2]-chk[3])<0.01, chk);
  T('resumo lista colaborador e despesas', (await p.content()).includes('Equipe (por colaborador)') && (await p.content()).includes('Coordenação Mitech'));
  // editar % de despesa
  await p.fill('.sgdesp[data-s="s2"][data-n="Coordenação Mitech"]','7.5'); await p.dispatchEvent('.sgdesp[data-s="s2"][data-n="Coordenação Mitech"]','change'); await p.waitForTimeout(100);
  T('nova despesa em Sistemas', await p.evaluate(()=>DATA.obras[0].servicos[1].despesas.some(d=>d.nome==='Coordenação Mitech'&&d.pct===7.5)));
  await p.fill('.sgdesp[data-s="s2"][data-n="Coordenação Mitech"]',''); await p.dispatchEvent('.sgdesp[data-s="s2"][data-n="Coordenação Mitech"]','change'); await p.waitForTimeout(100);
  T('vazio remove', await p.evaluate(()=>!DATA.obras[0].servicos[1].despesas.some(d=>d.nome==='Coordenação Mitech')));
  // adicionar despesa nova
  await p.fill('.sgdnovo','Documentação'); await p.click('.sgdadd'); await p.waitForTimeout(100);
  await p.fill('.sgdesp[data-s="s1"][data-n="Documentação"]','5'); await p.dispatchEvent('.sgdesp[data-s="s1"][data-n="Documentação"]','change'); await p.waitForTimeout(100);
  T('despesa nova criada e preenchida', await p.evaluate(()=>DATA.obras[0].servicos[0].despesas.some(d=>d.nome==='Documentação'&&d.pct===5)));
  // renomear
  await p.fill('.sgdnome[data-n="Compatibilização"]','Compat.'); await p.dispatchEvent('.sgdnome[data-n="Compatibilização"]','change'); await p.waitForTimeout(100);
  T('renomear vale para todas as disciplinas', await p.evaluate(()=>DATA.obras[0].servicos.every(s=>s.despesas.some(d=>d.nome==='Compat.'))));
  // valor da disciplina
  await p.evaluate(()=>{ const i=document.querySelector('.vtinp[data-s="s2"]'); i.value='150.000,00'; i.dispatchEvent(new Event('change')); }); await p.waitForTimeout(100);
  T('valor da disciplina editado na grade', await p.evaluate(()=>DATA.obras[0].servicos[1].valorTotal)===150000);
  const chk2=await p.evaluate(()=>{ const r=resumoGridObra(DATA.obras[0]); return [r.totCusto, calcObra(DATA.obras[0]).despTotal]; });
  T('resumo continua batendo após edições', Math.abs(chk2[0]-chk2[1])<0.01, chk2);
  const rt=await p.evaluate(()=>{ const sv=DATA.obras[0].servicos; RESUMO_RATEIO=true; const a=resumoGridObra(DATA.obras[0]); RESUMO_RATEIO=false; const b=resumoGridObra(DATA.obras[0]); RESUMO_RATEIO=true; return [a.html.includes('>Geral<'), b.html.includes('>Geral<'), a.totCusto, b.totCusto, a.lucroTot, b.lucroTot, a.html.includes('Quanto cobrar')]; });
  T('com rateio some a coluna Geral e os totais não mudam', rt[0]===false && rt[1]===true && Math.abs(rt[2]-rt[3])<0.01 && Math.abs(rt[4]-rt[5])<0.01 && rt[6], rt);
  await p.evaluate(()=>{ render(); });
  await p.click('.servmodo[data-m="lista"]'); T('visão detalhada preservada', await p.locator('.dpct').count()>0);
  T('bloco margem-alvo removido', await p.locator('.resAlvo').count()===0 && !/margem-alvo/.test(await p.innerText('body')));
  T('sem erros', errs.length===0, errs); console.log(ok+' ok, '+ko+' falhas'); await b.close(); process.exit(ko?1:0);
})();
