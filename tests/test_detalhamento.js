const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const p=await (await b.newContext({viewport:{width:1500,height:1400}})).newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept());
  await p.goto('file:///home/claude/financeiro-et-projetos/index.html'); await p.waitForTimeout(500);
  let ok=0,ko=0; const T=(n,c,d)=>{c?ok++:ko++;console.log((c?'PASS ':'FAIL ')+n+(d!==undefined?' '+JSON.stringify(d):''));};
  await p.evaluate(()=>{ SESSION={role:'admin'}; DATA.tiposServico=[{id:'t1',nome:'Elétrica'}]; DATA.minhasEmpresas=[];
    DATA.colaboradores=[{id:'w',nome:'Willian',cargo:'Equipe de Detalhamento'},{id:'c',nome:'Coord',cargo:'Coordenador'}];
    const mk=(id)=>({id,nomeObra:'Obra '+id,codigo:id,status:'andamento',empresaId:'',cliente:{nome:'c'},servicos:[{id:'s'+id,tipoId:'t1',valorTotal:100000,imposto:0,despesas:[],aditivos:[]}],etapasPagamento:[],despesasObra:[],equipe:[]});
    DATA.obras=[mk('o1'),mk('o2')]; });
  const r=await p.evaluate(()=>{ equipeGridSet('o1','w','so1',10); equipeGridSet('o1','c','so1',10); const o=DATA.obras[0].equipe; return o.map(m=>m.colaboradorId+':'+m.etapas.map(e=>e.nome+' '+e.pct).join(','));});
  T('detalhamento nasce com 90% entrega + 10% aprovação do projeto legal', r[0]==='w:Entrega 90,Aprovação do Projeto Legal 10', r);
  T('coordenador mantém as 4 etapas padrão', /Projeto Básico 30/.test(r[1])&&r[1].split(',').length===4, r);
  // migração de quem já existe com as 4 etapas padrão e sem movimento
  const mg=await p.evaluate(()=>{ DATA.obras[1].equipe=[{id:'x',colaboradorId:'w',papel:'Equipe de Detalhamento',pct:5,baseIds:['so2'],etapas:etapasCoordPadrao()},{id:'y',colaboradorId:'w',papel:'Equipe de Detalhamento',pct:5,baseIds:[],etapas:etapasCoordPadrao()}];
    DATA.obras[1].equipe[1].etapas[0].concluido=true; DATA.obras[1].equipe[1].etapas[0].aprovado=true; // com aprovação: não mexe
    DATA.obras.forEach(o=>o.equipe.forEach(ajustaEtapasPapel)); return DATA.obras[1].equipe.map(m=>m.etapas.length); });
  T('existente sem movimento é convertido; com aprovação não é alterado', JSON.stringify(mg)==='[2,4]', mg);
  const val=await p.evaluate(()=>{ const o=DATA.obras[0],m=o.equipe[0]; return [valorEquipeEtapa(o,m,m.etapas[0]),valorEquipeEtapa(o,m,m.etapas[1])]; });
  T('valores 90% / 10% do total do colaborador', Math.abs(val[0]/(val[0]+val[1])-0.9)<1e-9, val);
  await p.evaluate(()=>{ aplicarModeloPagamento('w','media',{inicio:'2026-11',meses:3,ret:0,dia:5},['o1']); delete DATA.obras[0].equipe[0].media.travado; aplicarModeloPagamento('w','entrega',{},['o1']); });
  T('voltar para por entrega devolve 90/10 ao detalhamento', await p.evaluate(()=>DATA.obras[0].equipe[0].etapas.map(e=>e.pct).join()==='90,10'));
  await p.evaluate(()=>{ DATA.obras[0].equipe[0].papel='Coordenador'; ajustaEtapasPapel(DATA.obras[0].equipe[0]); });
  T('mudar o papel para outro volta ao padrão', await p.evaluate(()=>DATA.obras[0].equipe[0].etapas.length===4));
  T('sem erros', errs.length===0, errs); console.log(ok+' ok, '+ko+' falhas'); await b.close(); process.exit(ko?1:0);
})();
