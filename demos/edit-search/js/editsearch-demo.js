document.addEventListener('DOMContentLoaded', () => {
  const STORAGE_KEY = 'searchEditDemo:weeklyItems:v2';
  const MAX = 700;
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => Array.from(root.querySelectorAll(s));
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm = v => String(v ?? '').trim().toLowerCase();
  const dateKey = v => { const d = new Date(v); return isNaN(d) ? String(v||'').slice(0,10) : `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
  const dateLabelFromKey = k => { if(!k) return ''; const [y,m,d]=k.split('-').map(Number); return new Date(y,m-1,d).toLocaleDateString(); };
  const daysAgo = n => new Date(Date.now() - n*86400000).toISOString();

  let pageSize = 10, currentPage = 1, tableSort = { key:'createdAt', dir:'desc' }, CURRENT_OPEN_ID = null;
  const caches = { initialItems: [], currentResults: [] };
  const searchBox = $('#searchBox'), host = $('#resultsTableHost'), actionsTop = $('#resultsActions'), actionsBottom = $('#resultsActionsBottom');

  function demoItems(){ return [
    item('101','Weekly Operations Update','CCN-1001','Heading1','Demo User',1,'(S) Demo summary for weekly operations. This is stored only in your browser localStorage.','(SF) Status was updated during the demo build.'),
    item('102','Case Review Notes','CCN-1002','Heading2','Demo Reviewer',3,'(S/N) Network-related case notes for demo searching and filtering.','(S) Pending review. This can be edited and saved locally.'),
    item('103','Training Item','CCN-1003','Heading3','Demo User',7,'(SF) Significant finding example text with a typo: operatonal.','(S) Complete with typo: recieve.'),
    item('104','Export Example','CCN-1004','Heading1','Demo Analyst',10,'(S) Select this row and use Export Selected to download a Word-friendly file.','(S) Waiting on final review.')
  ];}
  function item(id,title,ccn,cat,by,ago,summary,status){
    const iso = daysAgo(ago);
    return { id,title,ccn,casecategory:cat,createdBy:by,editedBy:by,createdAt:dateKey(iso),createdIso:iso,modifiedIso:iso,summary,status,summaryUpdated:iso,statusUpdated:iso,DocClass:'UNCLASSIFIED',
      summaryHistory: ago < 5 ? [{date:daysAgo(ago+4),editor:by,text:'(S) Older summary text for history preview.'}] : [],
      statusHistory: ago < 5 ? [{date:daysAgo(ago+3),editor:by,text:'(S/N) Older status text for history preview.'}] : [] };
  }
  function load(){ try{ const raw=localStorage.getItem(STORAGE_KEY); if(raw) return JSON.parse(raw)||[]; }catch{} const x=demoItems(); saveAll(x); return x; }
  function saveAll(items){ localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); }
  function updateItem(updated){ const items=load(); const i=items.findIndex(x=>String(x.id)===String(updated.id)); if(i>-1) items[i]=updated; saveAll(items); caches.initialItems=items; caches.currentResults = caches.currentResults.map(x=>String(x.id)===String(updated.id)?updated:x); }

  // ---------- Custom spellcheck ----------
  const COMMON_WORDS = new Set((`a able about above across action active add after again against all also an and any application are as at author based be because been before being below between both browser build by can case category change check choice click close code column complete content created current data date demo detail does download during edit edited entry every export field file filter final find finding for from function group has have heading history if in inline input into is item it its just keep label layout list local locally make max modified more network new no not notes of off on only open option or original other page pending prefix preview review row save saved search section select selected status still stored summary system table text the this title to typing update updated use user value view weekly when will with word work wrapper your`).split(/\s+/));
  const DOMAIN_WORDS = new Set(['ccn','fo','do','docclass','nsd','sharepoint','localstorage','s/n','sf','rest','odata','fieldoffice','casecategory','summhistory','statushistory']);
  const MISSPELLINGS = { recieve:'receive', seperate:'separate', occured:'occurred', teh:'the', adn:'and', wierd:'weird', definately:'definitely', operatonal:'operational', acheive:'achieve', adress:'address', accomodate:'accommodate', enviroment:'environment', goverment:'government', sucess:'success', neccessary:'necessary' };
  function cleanWord(word){ return String(word||'').toLowerCase().replace(/^\([^)]*\)\s*/, '').replace(/[^a-z0-9\/'-]/g,'').replace(/^['-]+|['-]+$/g,''); }
  function checkSpelling(text){
    const seen = new Set();
    return String(text||'').split(/\s+/).map(cleanWord).filter(w => {
      if(!w || w.length < 3 || seen.has(w)) return false; seen.add(w);
      if(/^ccn[-\d]*$/i.test(w) || /^\d+$/.test(w)) return false;
      return MISSPELLINGS[w] || (!COMMON_WORDS.has(w) && !DOMAIN_WORDS.has(w));
    }).map(w => ({ word:w, suggestion: MISSPELLINGS[w] || '' }));
  }
  function ensureSpellPanel(textarea){
    const wrap = textarea.closest('.edit-wrapper') || textarea.parentElement;
    let panel = wrap?.querySelector('.custom-spellcheck');
    if(!panel && wrap){ panel=document.createElement('div'); panel.className='custom-spellcheck'; wrap.appendChild(panel); }
    return panel;
  }
  function runSpellcheck(textarea){
    const panel = ensureSpellPanel(textarea); if(!panel) return;
    const problems = checkSpelling(textarea.value);
    textarea.classList.toggle('has-custom-spell-errors', problems.length>0);
    if(!problems.length){ panel.hidden=true; panel.innerHTML=''; return; }
    panel.hidden=false;
    panel.innerHTML = `<strong>Check spelling:</strong> ${problems.slice(0,8).map(p => `<button type="button" class="spell-pill" data-word="${esc(p.word)}" data-suggestion="${esc(p.suggestion)}">${esc(p.word)}${p.suggestion ? ` → ${esc(p.suggestion)}` : ''}</button>`).join(' ')}`;
    panel.querySelectorAll('.spell-pill').forEach(btn=>btn.addEventListener('click',()=>{
      const sug=btn.dataset.suggestion, word=btn.dataset.word; if(!sug) return;
      textarea.value = textarea.value.replace(new RegExp(`\\b${word}\\b`, 'gi'), sug);
      textarea.dispatchEvent(new Event('input',{bubbles:true}));
      runSpellcheck(textarea);
    }));
  }

  function enhanceSelects(){
    $$('#filters select').forEach(sel => {
      if(sel.previousElementSibling?.classList?.contains('ui-select')) return;
      sel.style.cssText = 'position:absolute;opacity:0;pointer-events:none;width:0;height:0';
      const wrap = document.createElement('div'); wrap.className='ui-select';
      wrap.innerHTML = `<button type="button" class="ui-select__btn" role="combobox" aria-expanded="false"></button><div class="ui-select__list" role="listbox"></div>`;
      sel.parentElement.insertBefore(wrap, sel);
      $('.ui-select__btn',wrap).onclick = () => { const open=wrap.classList.toggle('is-open'); $('.ui-select__btn',wrap).setAttribute('aria-expanded',String(open)); };
      document.addEventListener('click', e => { if(!wrap.contains(e.target)) wrap.classList.remove('is-open'); });
    });
  }
  function syncSelect(sel){
    const wrap = sel.previousElementSibling; if(!wrap?.classList.contains('ui-select')) return;
    const btn = $('.ui-select__btn',wrap), list = $('.ui-select__list',wrap); list.innerHTML='';
    Array.from(sel.options).forEach(o => { const d=document.createElement('div'); d.className='ui-option'; d.dataset.value=o.value; d.textContent=o.text; if(o.value===sel.value)d.setAttribute('aria-selected','true'); d.onclick=()=>{ sel.value=o.value; sel.dispatchEvent(new Event('change',{bubbles:true})); syncSelect(sel); wrap.classList.remove('is-open'); }; list.appendChild(d); });
    btn.textContent = sel.options[sel.selectedIndex]?.text || sel.options[0]?.text || 'Select';
  }
  function refill(id, values, label=v=>v){ const sel=$('#'+id); if(!sel) return; const first=sel.options[0]?.textContent || 'All'; const prev=sel.value; sel.innerHTML=`<option value="">${esc(first)}</option>`; values.forEach(v=>sel.add(new Option(label(v),v))); sel.value = values.includes(prev) ? prev : ''; syncSelect(sel); }
  function populateFilters(items=load()){ const vals = key => [...new Set(items.map(i=>i[key]).filter(Boolean))].sort(); refill('filterCreatedDate', vals('createdAt').reverse(), dateLabelFromKey); refill('filterCaseCategory', vals('casecategory')); refill('filterCreatedBy', vals('createdBy')); refill('filterTitle', vals('title')); refill('filterCCN', vals('ccn')); }
  function selections(){ return {createdAt:$('#filterCreatedDate')?.value||'',casecategory:$('#filterCaseCategory')?.value||'',createdBy:$('#filterCreatedBy')?.value||'',title:$('#filterTitle')?.value||'',ccn:$('#filterCCN')?.value||''}; }
  function localKeywordMatch(item){ const term=norm(searchBox?.value); if(!term) return true; return [item.title,item.ccn,item.casecategory,item.summary,item.status,item.createdBy].some(v=>norm(v).includes(term)); }
  function applyFilters(items){ const s=selections(); return items.filter(item => (!s.createdAt||item.createdAt===s.createdAt) && (!s.casecategory||norm(item.casecategory)===norm(s.casecategory)) && (!s.createdBy||norm(item.createdBy)===norm(s.createdBy)) && (!s.title||norm(item.title)===norm(s.title)) && (!s.ccn||String(item.ccn)===String(s.ccn)) && localKeywordMatch(item)); }
  function runSearch(){ currentPage=1; caches.currentResults=applyFilters(load()); renderCurrentPage(); }
  function getSortValue(item,key){ const v = key==='createdAt' ? new Date(item.createdAt).getTime() : (item[key]||''); return typeof v==='number'?v:String(v).toLowerCase(); }
  function sorted(results){ const m=tableSort.dir==='asc'?1:-1; return [...results].sort((a,b)=> String(getSortValue(a,tableSort.key)).localeCompare(String(getSortValue(b,tableSort.key)),undefined,{numeric:true})*m); }

  function renderCurrentPage(){
    const results=caches.currentResults||[], total=results.length, totalPages=Math.max(1,Math.ceil(total/pageSize)); currentPage=Math.min(currentPage,totalPages); const start=(currentPage-1)*pageSize, end=Math.min(start+pageSize,total), rows=sorted(results).slice(start,end);
    if(actionsTop) actionsTop.innerHTML = total ? `<div class="results-actions-row"><button type="button" id="exportSelectedBtn" class="btn export-btn" disabled>Export</button><div class="results-pager"><span>Showing ${start+1}-${end} of ${total}</span><div class="pager-controls"><button id="pagerPrev" ${currentPage===1?'disabled':''}>Prev</button><span>Page ${currentPage} / ${totalPages}</span><button id="pagerNext" ${currentPage===totalPages?'disabled':''}>Next</button></div><label>Per page <select id="pagerSize">${[10,25,50,100].map(n=>`<option value="${n}" ${n===pageSize?'selected':''}>${n}</option>`).join('')}</select></label></div></div>` : '0 results';
    if(actionsBottom) actionsBottom.innerHTML = total ? `<div class="results-pager"><span>Showing ${start+1}-${end} of ${total}</span><div class="pager-controls"><button id="pagerPrev" ${currentPage===1?'disabled':''}>Prev</button><span>Page ${currentPage} / ${totalPages}</span><button id="pagerNext" ${currentPage===totalPages?'disabled':''}>Next</button></div></div>` : '';
    [actionsTop, actionsBottom].forEach(bar=>{ if(!bar) return; $('#pagerPrev',bar)?.addEventListener('click',()=>{currentPage--;renderCurrentPage();}); $('#pagerNext',bar)?.addEventListener('click',()=>{currentPage++;renderCurrentPage();}); $('#pagerSize',bar)?.addEventListener('change',e=>{pageSize=+e.target.value; currentPage=1; renderCurrentPage();}); $('#exportSelectedBtn',bar)?.addEventListener('click',showExportOverlay); });
    const tbl=document.createElement('table'); tbl.className='results-table';
    const heads=[['title','Title'],['ccn','CCN'],['casecategory','Category'],['summary','Summary'],['status','Status'],['createdAt','Created'],['createdBy','By']];
    tbl.innerHTML = `<thead><tr><th><input type="checkbox" id="selectAllRows"></th>${heads.map(([k,l])=>`<th><button type="button" class="th-sort" data-sort="${k}"><span>${l}</span><span class="th-icon">${tableSort.key===k?(tableSort.dir==='asc'?'▲':'▼'):'↕'}</span></button></th>`).join('')}<th></th></tr></thead><tbody></tbody>`;
    $$('.th-sort',tbl).forEach(b=>b.onclick=()=>{ const k=b.dataset.sort; tableSort = tableSort.key===k ? {key:k,dir:tableSort.dir==='asc'?'desc':'asc'} : {key:k,dir:k==='createdAt'?'desc':'asc'}; currentPage=1; renderCurrentPage(); });
    const tb=$('tbody',tbl); if(!rows.length) tb.innerHTML='<tr><td colspan="9" style="text-align:center;color:#555;padding:24px 0;">Start typing, select a filter, or click Search All to view demo results.</td></tr>';
    rows.forEach(it=>{ const tr=document.createElement('tr'); tr.dataset.id=it.id; tr.onclick=()=>openEntry(it); const cbtd=document.createElement('td'); cbtd.innerHTML=`<input type="checkbox" class="row-select" data-id="${esc(it.id)}">`; $('input',cbtd).onclick=e=>e.stopPropagation(); $('input',cbtd).onchange=updateExportButtonState; tr.appendChild(cbtd); [it.title,it.ccn,it.casecategory,it.summary,it.status,dateLabelFromKey(it.createdAt),it.createdBy].forEach((v,i)=>{ const td=document.createElement('td'); if(i===3)td.className='cell-summary'; if(i===4)td.className='cell-status'; td.innerHTML=(i===3||i===4)?`<div>${esc(v||'—')}</div>`:esc(v||'—'); tr.appendChild(td); }); const td=document.createElement('td'); td.className='col-actions'; td.innerHTML='<button type="button" class="btn row-edit-btn">Edit</button>'; $('button',td).onclick=e=>{e.stopPropagation();openEntry(it);}; tr.appendChild(td); tb.appendChild(tr); });
    host.innerHTML=''; host.appendChild(tbl); $('#selectAllRows',tbl)?.addEventListener('change',e=>{$$('.row-select',tbl).forEach(cb=>cb.checked=e.target.checked); updateExportButtonState();}); updateExportButtonState();
  }
  function getSelectedRows(){ return $$('.row-select:checked').map(cb => (caches.currentResults||[]).find(x=>String(x.id)===String(cb.dataset.id))).filter(Boolean); }
  function updateExportButtonState(){ const disabled=getSelectedRows().length===0; $$('#exportSelectedBtn').forEach(b=>b.disabled=disabled); }

  function parseHistoryField(arr){ return Array.isArray(arr) ? arr : []; }
  function renderHistoryGroup(group, entries){
    if(!group) return; const col=group.closest('.history-column'), detail=$('.history-detail',col), body=$('.history-detail__body',col), template=$('.histItem[data-template]',group); $$('.histItem:not([data-template])',group).forEach(n=>n.remove());
    const list=[...(entries||[])].sort((a,b)=>new Date(b.date||b.ts)-new Date(a.date||a.ts));
    if(!list.length){ const n=template.cloneNode(true); n.removeAttribute('data-template'); n.style.display=''; n.disabled=true; $('.histPreview',n).textContent='No history yet.'; group.appendChild(n); if(detail)detail.style.display='none'; return; }
    list.forEach(h=>{ const n=template.cloneNode(true); n.removeAttribute('data-template'); n.style.display=''; const hd=$('.histHeader',n); if(hd) hd.textContent=`Last edit ${dateLabelFromKey(dateKey(h.date||h.ts))} • ${h.editor||h.author||'Demo User'}`; $('.histPreview',n) && ($('.histPreview',n).textContent='View entry'); n.onclick=()=>{ $$('.histItem.is-active',group).forEach(x=>x.classList.remove('is-active')); n.classList.add('is-active'); n.insertAdjacentElement('afterend',detail); detail.style.display=''; body.textContent=h.text||''; }; group.appendChild(n); }); if(detail)detail.style.display='none';
  }
  function counter(ta,c,saveBtn){ if(!ta||!c) return; const over=ta.value.length>MAX; c.textContent=`${ta.value.length} / ${MAX} characters${over?' — too long. Max 700':''}`; c.classList.toggle('is-overlimit',over); ta.closest('.edit-wrapper')?.classList.toggle('is-overlimit',over); if(saveBtn) saveBtn.disabled=over; }
  function insertPrefix(ta,p){ const s=ta.selectionStart??ta.value.length,e=ta.selectionEnd??s,ins=`(${p}) `; ta.value=ta.value.slice(0,s)+ins+ta.value.slice(e); ta.focus(); ta.setSelectionRange(s+ins.length,s+ins.length); ta.dispatchEvent(new Event('input',{bubbles:true})); }

  function renderEntryFromTemplate(item){
    const tpl=$('#entryTemplate'); const entry=tpl.content.firstElementChild.cloneNode(true); entry.dataset.id=item.id; entry.dataset.dirty='0';
    $('.entry-title__text',entry).textContent=item.title||'Untitled'; $('.entry-title__info',entry).textContent=`Created ${dateLabelFromKey(item.createdAt)} • ${item.createdBy||'Demo User'}`; $('.entry-meta',entry).textContent=item.ccn||'—';
    const tSummary=$('.edit-summary',entry), tStatus=$('.edit-status',entry), saveBtn=$('#btn-save',entry); tSummary.spellcheck=false; tStatus.spellcheck=false; tSummary.value=item.summary||''; tStatus.value=item.status||''; entry.dataset.originalSummary=tSummary.value; entry.dataset.originalStatus=tStatus.value;
    const mark=()=>{entry.dataset.dirty='1'; counter(tSummary,$('.sm-count-summary',entry),saveBtn); counter(tStatus,$('.sm-count-status',entry),saveBtn); runSpellcheck(tSummary); runSpellcheck(tStatus);};
    tSummary.addEventListener('input',mark); tStatus.addEventListener('input',mark); mark(); entry.dataset.dirty='0';
    $$('.prefix-bar',entry).forEach(bar=>$$('.prefix-btn',bar).forEach(b=>b.onclick=()=>insertPrefix(bar.closest('[data-edit-section="summary"]')?tSummary:tStatus,b.dataset.prefix)));
    $$('.edit-wrapper',entry).forEach(w=>{ const box=$('.edit-restore-confirm',w); $('.edit-restore-btn',w).onclick=()=>box.hidden=false; $('.edit-restore-confirm-no',w).onclick=()=>box.hidden=true; $('.edit-restore-confirm-yes',w).onclick=e=>{ if(e.target.dataset.target==='summary')tSummary.value=entry.dataset.originalSummary; if(e.target.dataset.target==='status')tStatus.value=entry.dataset.originalStatus; box.hidden=true; mark(); }; });
    renderHistoryGroup($('.histGroup[data-group="summary-inline"]',entry),item.summaryHistory); renderHistoryGroup($('.histGroup[data-group="status-inline"]',entry),item.statusHistory);
    $('#btn-cancel',entry).onclick=closeOverlay; saveBtn.onclick=e=>{e.preventDefault(); saveEdits(entry,item);}; return entry;
  }
  function openEntry(item){ const overlay=$('#entryOverlay'), slot=$('#entryCardSlot'); if(!overlay||!slot||!item) return; if(CURRENT_OPEN_ID===item.id){closeOverlay();return;} CURRENT_OPEN_ID=item.id; slot.innerHTML=''; overlay.classList.remove('entry-overlay--hidden','entry-overlay--closing'); $('#pageBlocker')?.classList.remove('hidden'); slot.appendChild(renderEntryFromTemplate(item)); }
  function closeOverlay(){ const overlay=$('#entryOverlay'), slot=$('#entryCardSlot'); overlay.classList.add('entry-overlay--closing'); setTimeout(()=>{overlay.classList.add('entry-overlay--hidden'); overlay.classList.remove('entry-overlay--closing'); slot.innerHTML=''; CURRENT_OPEN_ID=null; $('#pageBlocker')?.classList.add('hidden');},180); }
  function saveEdits(entry,item){ const sum=$('.edit-summary',entry).value.trim(), stat=$('.edit-status',entry).value.trim(), now=new Date().toISOString(); const oldSummary=(item.summary||'').trim(), oldStatus=(item.status||'').trim(); if(sum===oldSummary && stat===oldStatus){ alert('No changes to save.'); return false; } const updated={...item, modifiedIso:now}; if(sum!==oldSummary){ updated.summaryHistory=[{date:item.summaryUpdated||item.createdIso||now,editor:item.editedBy||item.createdBy||'Demo User',text:item.summary||''},...(item.summaryHistory||[])].filter(x=>x.text); updated.summary=sum; updated.summaryUpdated=now; } if(stat!==oldStatus){ updated.statusHistory=[{date:item.statusUpdated||item.createdIso||now,editor:item.editedBy||item.createdBy||'Demo User',text:item.status||''},...(item.statusHistory||[])].filter(x=>x.text); updated.status=stat; updated.statusUpdated=now; } updateItem(updated); runSearch(); alert('Your changes were saved locally.'); closeOverlay(); return true; }

  function showExportOverlay(){ const selected=getSelectedRows(); if(!selected.length){alert('Please select at least one entry to export.');return;} window.__pendingExport=selected; $('#exportOverlay')?.classList.remove('hidden'); }
  function initExport(){ const sel=$('#overlayDocClass'); if(sel) sel.innerHTML=['UNCLASSIFIED','CONTROLLED UNCLASSIFIED INFORMATION','CONFIDENTIAL','SECRET'].map((v,i)=>`<option value="${esc(v)}" ${i===0?'selected':''}>${esc(v)}</option>`).join(''); $('#overlayCancel')?.addEventListener('click',e=>{e.preventDefault(); $('#exportOverlay').classList.add('hidden'); window.__pendingExport=null;}); $('#overlayExport')?.addEventListener('click',e=>{e.preventDefault(); const docClass=$('#overlayDocClass')?.value||'UNCLASSIFIED'; const items=(window.__pendingExport||[]).map(x=>({...x,DocClass:docClass})); const html=`<html><head><meta charset="utf-8"><title>NSD Submissions</title><style>body{font-family:Arial,sans-serif;line-height:1.4}.banner{text-align:center;font-weight:bold;color:#bb0000;margin:12px 0}.item{page-break-after:always}h1{font-size:20pt}h2{font-size:14pt}</style></head><body>${items.map(it=>`<div class="item"><div class="banner">${esc(docClass)}</div><h1>${esc(it.title)}</h1><p><b>CCN:</b> ${esc(it.ccn)}<br><b>Category:</b> ${esc(it.casecategory)}<br><b>Created:</b> ${esc(dateLabelFromKey(it.createdAt))}<br><b>By:</b> ${esc(it.createdBy)}</p><h2>Summary</h2><p>${esc(it.summary)}</p><h2>Status</h2><p>${esc(it.status)}</p><div class="banner">${esc(docClass)}</div></div>`).join('')}</body></html>`; const blob=new Blob([html],{type:'application/msword'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='NSD_Submissions_Demo.doc'; a.click(); URL.revokeObjectURL(url); $('#exportOverlay').classList.add('hidden'); window.__pendingExport=null; }); }

  $('#entryOverlay .panel-close')?.addEventListener('click',closeOverlay); $('#entryOverlay')?.addEventListener('click',e=>{if(e.target.id==='entryOverlay')closeOverlay();}); document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#entryOverlay')?.classList.contains('entry-overlay--hidden'))closeOverlay();});
  function boot(){ caches.initialItems=load(); caches.currentResults=[]; enhanceSelects(); populateFilters(caches.initialItems); $$('#filters select').forEach(s=>{syncSelect(s); s.onchange=runSearch;}); searchBox?.addEventListener('input',runSearch); $('#searchAllBtn')?.addEventListener('click',()=>{ if(searchBox) searchBox.value=''; $$('#filters select').forEach(s=>{s.value=''; syncSelect(s);}); caches.currentResults=load(); currentPage=1; renderCurrentPage(); }); $('#filterClearBtn')?.addEventListener('click',()=>{ $$('#filters select').forEach(s=>{s.value='';syncSelect(s);}); if(searchBox)searchBox.value=''; caches.currentResults=[]; renderCurrentPage(); populateFilters(load()); }); initExport(); renderCurrentPage(); }
  boot();
});
