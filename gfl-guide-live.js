/* Shared live-data adapter for the original, individually designed GFL guides. */
(() => {
  'use strict';
  const id = document.body?.dataset.managerId;
  if (!id) return;
  const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const num = v => Number(v || 0);
  const ordinal = n => n===1?'1st':n===2?'2nd':n===3?'3rd':`${n}th`;
  const record = s => `${num(s.wins)}-${num(s.losses)}${num(s.ties)?'-'+num(s.ties):''}`;
  const finalText = s => String(s.playoffFinish || '').trim();
  const isChampion = s => finalText(s).toLowerCase()==='champion';
  const isRunner = s => finalText(s).toLowerCase().includes('runner');
  const historyCandidates = ['gfl-history.json','../gfl-history.json','/gfl-history.json'];

  async function load() {
    let last;
    for (const url of historyCandidates) {
      try { const r=await fetch(url,{cache:'no-store'}); if(!r.ok) throw new Error(`${r.status}`); return await r.json(); }
      catch(e){ last=e; }
    }
    throw last || new Error('gfl-history.json unavailable');
  }
  function closestValue(label) {
    const root=label.closest('.stat-card,.stat-pill,.hstat,.card,.glow-card,.gfl-card,article,div') || label.parentElement;
    if(!root) return null;
    const candidates=[...root.querySelectorAll('p,div,span,strong,b')].filter(x=>x!==label && x.children.length===0);
    return candidates.find(x=>/[0-9]/.test(x.textContent) && !/season|record|champ|win|finish|points|games/i.test(x.textContent)) || candidates[0];
  }
  function patchLabel(labelRegex,value,detail) {
    [...document.querySelectorAll('p,div,span,strong,b')].filter(x=>x.children.length===0 && labelRegex.test(x.textContent.trim())).forEach(label=>{
      const v=closestValue(label); if(v) v.textContent=value;
      if(detail){ const box=label.closest('.stat-card,.hstat,.card,.glow-card,.gfl-card,article,div'); const small=box?.querySelector('p.text-xs,p.text-sm,.muted'); if(small&&small!==label) small.textContent=detail; }
    });
  }
  function replaceTextNodes(manager,seasons,stats){
    const rec=`${stats.wins}-${stats.losses}${stats.ties?'-'+stats.ties:''}`;
    patchLabel(/^(career|overall) record$/i,rec);
    patchLabel(/^seasons$|^total seasons$|^active seasons$/i,String(stats.seasons),`${stats.firstYear}–${stats.lastYear}`);
    patchLabel(/^championships$|^titles$/i,String(stats.championships),stats.championshipYears.join(', ')||'—');
    patchLabel(/^runner-?ups?$|^championship appearances$/i,String(stats.runnerUps),stats.runnerUpYears.join(', ')||'—');
    patchLabel(/^win (rate|%)$/i,(stats.winPercentage*100).toFixed(1)+'%');
    patchLabel(/^best (regular-season )?record$/i,stats.bestRecord, String(stats.bestRecordYear));
    patchLabel(/^best finish$/i,ordinal(stats.bestFinish),stats.bestFinishYears.join(', '));
    patchLabel(/^avg\.? finish$/i,stats.averageFinish.toFixed(1));
    patchLabel(/^best regular-season pf$|^highest points for$/i,stats.highestPointsFor.toLocaleString(undefined,{maximumFractionDigits:2}),String(stats.highestPointsForYear));
    document.querySelectorAll('[data-gfl]').forEach(el=>{const key=el.dataset.gfl;if(key in stats)el.textContent=stats[key];});
    document.querySelectorAll('p,span,div').forEach(el=>{
      if(el.children.length) return;
      let t=el.textContent;
      if(/\d+\s+Seasons? of/i.test(t)) t=t.replace(/\d+\s+Seasons?/i,`${stats.seasons} Seasons`);
      if(/\d{4}[–-]\d{4}/.test(t) && /season|franchise|est\./i.test(t)) t=t.replace(/\d{4}[–-]\d{4}/,`${stats.firstYear}–${stats.lastYear}`);
      el.textContent=t;
    });
  }
  function rebuildSeasonTables(seasons){
    document.querySelectorAll('table').forEach(table=>{
      const headers=[...table.querySelectorAll('thead th')].map(x=>x.textContent.trim().toLowerCase());
      const yearIndex=headers.findIndex(h=>/year|season/.test(h));
      if(yearIndex<0 || !headers.some(h=>/record|wins|pf|points|finish/.test(h))) return;
      const tbody=table.tBodies[0] || table.createTBody(); tbody.innerHTML='';
      seasons.forEach((s,i)=>{
        const tr=document.createElement('tr');
        tr.className=(isChampion(s)?'champion-row season-row-champion champ-row table-row-champ ':'')+(isRunner(s)?'season-row-heartbreak ':'')+(i%2?'':'');
        headers.forEach(h=>{
          const td=document.createElement('td'); td.className='px-4 py-3';
          if(/year|season/.test(h)) td.textContent=s.year;
          else if(/team|franchise/.test(h)) td.textContent=s.team;
          else if(/abbr/.test(h)) td.textContent='';
          else if(/record/.test(h)) td.textContent=record(s);
          else if(/^w$|wins/.test(h)) td.textContent=num(s.wins);
          else if(/^l$|loss/.test(h)) td.textContent=num(s.losses);
          else if(/pf|points for/.test(h)) td.textContent=num(s.pointsFor).toLocaleString(undefined,{maximumFractionDigits:2});
          else if(/pa|points against/.test(h)) td.textContent='—';
          else if(/diff/.test(h)) td.textContent='—';
          else if(/finish/.test(h)) td.textContent=isChampion(s)?'🏆 Champion':isRunner(s)?'Runner-Up':ordinal(num(s.regularSeasonFinish));
          else if(/playoff/.test(h)) td.textContent=finalText(s);
          else if(/division/.test(h)) td.textContent=s.division||'';
          else if(/notes/.test(h)) td.textContent=s.notes||'';
          tbody.appendChild(tr); tr.appendChild(td);
        });
      });
    });
  }
  function refreshCharts(seasons){
    if(typeof Chart==='undefined') return;
    document.querySelectorAll('canvas').forEach(canvas=>{
      const chart=Chart.getChart(canvas); if(!chart) return;
      chart.data.labels=seasons.map(s=>String(s.year));
      chart.data.datasets.forEach(ds=>{
        const label=String(ds.label||'').toLowerCase();
        if(/wins?/.test(label)) ds.data=seasons.map(s=>num(s.wins));
        else if(/loss/.test(label)) ds.data=seasons.map(s=>num(s.losses));
        else if(/ties?/.test(label)) ds.data=seasons.map(s=>num(s.ties));
        else if(/points for|pf|scored|offense/.test(label)) ds.data=seasons.map(s=>num(s.pointsFor));
        else if(/finish/.test(label) && !/playoff line/.test(label)) ds.data=seasons.map(s=>num(s.regularSeasonFinish));
        else if(/against|differential|diff/.test(label)) ds.data=seasons.map(()=>null);
      });
      chart.update();
    });
  }
  function addStatus(ok,msg){
    let el=document.getElementById('gfl-live-status');
    if(!el){el=document.createElement('div');el.id='gfl-live-status';Object.assign(el.style,{position:'fixed',right:'12px',bottom:'12px',zIndex:9999,padding:'7px 10px',borderRadius:'8px',font:'11px system-ui',background:'#111',color:ok?'#4ade80':'#fca5a5',border:`1px solid ${ok?'#4ade8055':'#ef444466'}`});document.body.appendChild(el);}
    el.textContent=msg; if(ok)setTimeout(()=>el.remove(),1800);
  }
  load().then(history=>{
    const manager=(history.managers||[]).find(m=>m.id===id); if(!manager) throw new Error(`Manager ${id} not found`);
    const seasons=(history.seasonResults||[]).filter(s=>s.managerId===id).sort((a,b)=>num(a.year)-num(b.year));
    if(!seasons.length) throw new Error(`No seasons for ${id}`);
    const finishes=seasons.map(s=>num(s.regularSeasonFinish)).filter(n=>n>0);
    const best=Math.min(...finishes), worst=Math.max(...finishes);
    const maxWins=Math.max(...seasons.map(s=>num(s.wins)));
    const bestRows=seasons.filter(s=>num(s.wins)===maxWins).sort((a,b)=>num(a.losses)-num(b.losses));
    const maxPF=Math.max(...seasons.map(s=>num(s.pointsFor)));
    const champs=seasons.filter(isChampion), runners=seasons.filter(isRunner);
    const wins=seasons.reduce((a,s)=>a+num(s.wins),0), losses=seasons.reduce((a,s)=>a+num(s.losses),0), ties=seasons.reduce((a,s)=>a+num(s.ties),0);
    const stats={wins,losses,ties,seasons:seasons.length,firstYear:num(seasons[0].year),lastYear:num(seasons.at(-1).year),gamesPlayed:wins+losses+ties,winPercentage:(wins+losses+ties)?wins/(wins+losses+ties):0,championships:champs.length,championshipYears:champs.map(s=>s.year),runnerUps:runners.length,runnerUpYears:runners.map(s=>s.year),bestFinish:best,worstFinish:worst,bestFinishYears:seasons.filter(s=>num(s.regularSeasonFinish)===best).map(s=>s.year),averageFinish:finishes.reduce((a,b)=>a+b,0)/finishes.length,bestRecord:record(bestRows[0]),bestRecordYear:bestRows[0].year,highestPointsFor:maxPF,highestPointsForYear:seasons.find(s=>num(s.pointsFor)===maxPF)?.year};
    window.GFL_GUIDE_DATA={history,manager,seasons,stats};
    replaceTextNodes(manager,seasons,stats); rebuildSeasonTables(seasons);
    setTimeout(()=>refreshCharts(seasons),100);
    document.dispatchEvent(new CustomEvent('gfl-guide-data-ready',{detail:window.GFL_GUIDE_DATA}));
    addStatus(true,'Live from gfl-history.json');
  }).catch(e=>{console.error(e);addStatus(false,`Guide data error: ${e.message}`);});
})();
