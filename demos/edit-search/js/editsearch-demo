document.addEventListener('DOMContentLoaded', () => {
  const STORAGE_KEY = 'searchEditDemo:weeklyItems:v1';
  const MAX = 700;
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => Array.from(root.querySelectorAll(s));
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm = v => String(v ?? '').trim().toLowerCase();
  const dateKey = v => { const d = new Date(v); return isNaN(d) ? String(v||'').slice(0,10) : `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
  const dateLabel = k => { if(!k) return ''; const [y,m,d]=k.split('-').map(Number); return new Date(y,m-1,d).toLocaleDateString(); };
  const daysAgo = n => new Date(Date.now() - n*86400000).toISOString();


  const CUSTOM_DICT = new Set([
  'summary','status','review','case','network','system','update','pending','complete',
  'finding','significant','demo','user','data','entry','field','office'
]);

function checkSpelling(text) {
  return text.split(/\s+/).filter(word => {
    const clean = word.toLowerCase().replace(/[^a-z]/g, '');
    return clean && !CUSTOM_DICT.has(clean);
  });
}
  let pageSize = 10, currentPage = 1, sort = { key:'createdAt', dir:'desc' }, results = [], openId = null;
  const searchBox = $('#searchBox'), host = $('#resultsTableHost'), actions = $('#resultsActions'), overlay = $('#entryOverlay'), slot = $('#entryCardSlot');

  function demoItems(){ return [
    item('101','Weekly Operations Update','CCN-1001','Heading1','Demo User',1,'(S) Demo summary for weekly operations. This is stored only in your browser localStorage.','(SF) Status was updated during the demo build.'),
    item('102','Case Review Notes','CCN-1002','Heading2','Demo Reviewer',3,'(S/N) Network-related case notes for demo searching and filtering.','(S) Pending review. This can be edited and saved locally.'),
    item('103','Training Item','CCN-1003','Heading3','Demo User',7,'(SF) Significant finding example text.','(S) Complete.')
  ];}
  function item(id,title,ccn,cat,by,ago,summary,status){
    const iso = daysAgo(ago);
    return { id,title,ccn,casecategory:cat,createdBy:by,createdAt:dateKey(iso),createdIso:iso,modifiedIso:iso,summary,status,summaryUpdated:iso,statusUpdated:iso,
      summaryHistory: ago < 4 ? [{date:daysAgo(ago+4),author:by,text:'(S) Older summary text for history preview.'}] : [],
      statusHistory: ago < 4 ? [{date:daysAgo(ago+3),author:by,text:'(S/N) Older status text for history preview.'}] : [] };
  }
  function load(){ try{ return JSON.parse(localStorage.getItem(STORAGE_KEY)) || seed(); }catch{ return seed(); } }
  function seed(){ const x = demoItems(); save(x); return x; }
  function save(items){ localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); }
  function update(updated){ const items=load(); const i=items.findIndex(x=>String(x.id)===String(updated.id)); if(i>-1) items[i]=updated; save(items); }

  function enhanceSelects(){
    $$('#filters select').forEach(sel => {
      sel.style.cssText = 'position:absolute;opacity:0;pointer-events:none;width:0;height:0';
      const wrap = document.createElement('div'); wrap.className='ui-select';
      wrap.innerHTML = `<button type="button" class="ui-select__btn"></button><div class="ui-select__list"></div>`;
      sel.parentElement.insertBefore(wrap, sel);
      $('.ui-select__btn',wrap).onclick = () => wrap.classList.toggle('is-open');
      document.addEventListener('click', e => { if(!wrap.contains(e.target)) wrap.classList.remove('is-open'); });
    });
  }
  function syncSelect(sel){
    const wrap = sel.previousElementSibling; if(!wrap?.classList.contains('ui-select')) return;
    const btn = $('.ui-select__btn',wrap), list = $('.ui-select__list',wrap); list.innerHTML='';
    Array.from(sel.options).forEach(o => { const d=document.createElement('div'); d.className='ui-option'; d.dataset.value=o.value; d.textContent=o.text; if(o.value===sel.value)d.setAttribute('aria-selected','true'); d.onclick=()=>{ sel.value=o.value; sel.dispatchEvent(new Event('change',{bubbles:true})); syncSelect(sel); wrap.classList.remove('is-open'); }; list.appendChild(d); });
    btn.textContent = sel.options[sel.selectedIndex]?.text || sel.options[0]?.text || 'Select';
  }
  function refill(id, values, label=v=>v){ const sel=$('#'+id); const first=sel.options[0]?.textContent || 'All'; const prev=sel.value; sel.innerHTML=`<option value="">${esc(first)}</option>`; values.forEach(v=>sel.add(new Option(label(v),v))); sel.value = values.includes(prev) ? prev : ''; syncSelect(sel); }
  function populateFilters(){ const items=load(); const vals = key => [...new Set(items.map(i=>i[key]).filter(Boolean))].sort(); refill('filterCreatedDate', vals('createdAt').reverse(), dateLabel); refill('filterCaseCategory', vals('casecategory')); refill('filterCreatedBy', vals('createdBy')); refill('filterTitle', vals('title')); refill('filterCCN', vals('ccn')); }
  function selections(){ return {createdAt:$('#filterCreatedDate').value,casecategory:$('#filterCaseCategory').value,createdBy:$('#filterCreatedBy').value,title:$('#filterTitle').value,ccn:$('#filterCCN').value}; }
  function matches(item){ const s=selections(), term=norm(searchBox?.value); if(s.createdAt&&item.createdAt!==s.createdAt)return false; if(s.casecategory&&norm(item.casecategory)!==norm(s.casecategory))return false; if(s.createdBy&&norm(item.createdBy)!==norm(s.createdBy))return false; if(s.title&&norm(item.title)!==norm(s.title))return false; if(s.ccn&&String(item.ccn)!==String(s.ccn))return false; if(!term)return true; return [item.title,item.ccn,item.casecategory,item.summary,item.status,item.createdBy].some(v=>norm(v).includes(term)); }
  function runSearch(){ results=load().filter(matches); currentPage=1; render(); }
  function sorted(){ const m=sort.dir==='asc'?1:-1; return [...results].sort((a,b)=>String(a[sort.key]||'').localeCompare(String(b[sort.key]||''),undefined,{numeric:true})*m); }
  function render(){
    host.innerHTML=''; const total=results.length, pages=Math.max(1,Math.ceil(total/pageSize)); currentPage=Math.min(currentPage,pages); const start=(currentPage-1)*pageSize, rows=sorted().slice(start,start+pageSize), end=Math.min(start+pageSize,total);
    actions.innerHTML = total ? `<div class="results-pager"><span>Showing ${start+1}-${end} of ${total}</span><div class="pager-controls"><button id="pagerPrev" ${currentPage===1?'disabled':''}>Prev</button><span>Page ${currentPage} / ${pages}</span><button id="pagerNext" ${currentPage===pages?'disabled':''}>Next</button></div><label>Per page <select id="pagerSize">${[10,25,50,100].map(n=>`<option value="${n}" ${n===pageSize?'selected':''}>${n}</option>`).join('')}</select></label></div>` : '0 results';
    $('#pagerPrev')?.addEventListener('click',()=>{currentPage--;render();}); $('#pagerNext')?.addEventListener('click',()=>{currentPage++;render();}); $('#pagerSize')?.addEventListener('change',e=>{pageSize=+e.target.value;currentPage=1;render();});
    const tbl=document.createElement('table'); tbl.className='results-table'; const heads=[['title','Title'],['ccn','CCN'],['casecategory','Category'],['summary','Summary'],['status','Status'],['createdAt','Created'],['createdBy','By']];
    tbl.innerHTML = `<thead><tr>${heads.map(([k,l])=>`<th><button type="button" class="th-sort" data-sort="${k}"><span>${l}</span><span class="th-icon">${sort.key===k?(sort.dir==='asc'?'▲':'▼'):'↕'}</span></button></th>`).join('')}<th></th></tr></thead><tbody></tbody>`;
    $$('.th-sort',tbl).forEach(b=>b.onclick=()=>{ const k=b.dataset.sort; sort = sort.key===k ? {key:k,dir:sort.dir==='asc'?'desc':'asc'} : {key:k,dir:k==='createdAt'?'desc':'asc'}; currentPage=1; render(); });
    const tb=$('tbody',tbl); if(!rows.length) tb.innerHTML='<tr><td colspan="8" style="text-align:center;color:#555;padding:24px 0;">Start typing or select a filter to view results.</td></tr>';
    rows.forEach(it=>{ const tr=document.createElement('tr'); tr.dataset.id=it.id; tr.onclick=()=>openEntry(it.id); [it.title,it.ccn,it.casecategory,it.summary,it.status,dateLabel(it.createdAt),it.createdBy].forEach((v,i)=>{ const td=document.createElement('td'); if(i===3)td.className='cell-summary'; if(i===4)td.className='cell-status'; td.innerHTML=(i===3||i===4)?`<div>${esc(v||'—')}</div>`:esc(v||'—'); tr.appendChild(td); }); const td=document.createElement('td'); td.className='col-actions'; td.innerHTML='<button type="button" class="btn row-edit-btn">Edit</button>'; $('button',td).onclick=e=>{e.stopPropagation();openEntry(it.id);}; tr.appendChild(td); tb.appendChild(tr); });
    host.appendChild(tbl);
  }

  function renderHistory(group, entries){
    if(!group) return; const col=group.closest('.history-column'), detail=$('.history-detail',col), body=$('.history-detail__body',col), template=$('.histItem[data-template]',group); $$('.histItem:not([data-template])',group).forEach(n=>n.remove());
    const list=[...(entries||[])].sort((a,b)=>new Date(b.date)-new Date(a.date));
    if(!list.length){ const n=template.cloneNode(true); n.removeAttribute('data-template'); n.style.display=''; n.disabled=true; $('.histPreview',n).textContent='No history yet.'; group.appendChild(n); if(detail)detail.style.display='none'; return; }
    list.forEach(h=>{ const n=template.cloneNode(true); n.removeAttribute('data-template'); n.style.display=''; $('.histDate',n).textContent=dateLabel(dateKey(h.date)); $('.histAuthor',n).textContent=h.author||'Demo User'; $('.histPreview',n).textContent='View entry'; n.onclick=()=>{ $$('.histItem.is-active',group).forEach(x=>x.classList.remove('is-active')); n.classList.add('is-active'); n.insertAdjacentElement('afterend',detail); detail.style.display=''; body.textContent=h.text||''; }; group.appendChild(n); }); if(detail)detail.style.display='none';
  }
  function runSpellcheck(textarea){
  const words = checkSpelling(textarea.value);

  textarea.classList.remove('spell-error');

  if (words.length > 0) {
    textarea.classList.add('spell-error');
    console.log('Misspelled:', words);
  }
}
  function counter(ta,c,saveBtn){ const over=ta.value.length>MAX; c.textContent=`${ta.value.length} / ${MAX} characters${over?' — too long. Max 700':''}`; c.classList.toggle('is-overlimit',over); ta.closest('.edit-wrapper')?.classList.toggle('is-overlimit',over); saveBtn.disabled=over; }
  function insertPrefix(ta,p){ const s=ta.selectionStart??ta.value.length,e=ta.selectionEnd??s,ins=`(${p}) `; ta.value=ta.value.slice(0,s)+ins+ta.value.slice(e); ta.focus(); ta.setSelectionRange(s+ins.length,s+ins.length); ta.dispatchEvent(new Event('input',{bubbles:true})); }
  function openEntry(id){ if(openId===id){close();return;} const item=load().find(x=>String(x.id)===String(id)); if(!item)return; openId=id; slot.innerHTML=''; overlay.classList.remove('entry-overlay--hidden','entry-overlay--closing'); $('#pageBlocker')?.classList.remove('hidden'); const entry=$('#entryTemplate').content.firstElementChild.cloneNode(true); entry.dataset.id=id; entry.dataset.dirty='0'; $('.entry-title__text',entry).textContent=item.title||'Untitled'; $('.entry-title__info',entry).textContent=`${item.createdBy||'Demo User'} — ${dateLabel(item.createdAt)}`; $('.entry-meta',entry).textContent=item.ccn||'—'; const sum=$('.edit-summary',entry), stat=$('.edit-status',entry), saveBtn=$('#btn-save',entry); sum.value=item.summary||''; stat.value=item.status||''; entry.dataset.originalSummary=sum.value; entry.dataset.originalStatus=stat.value; const updateCount=()=>{entry.dataset.dirty='1'; counter(sum,$('.sm-count-summary',entry),saveBtn); counter(stat,$('.sm-count-status',entry),saveBtn);}; sum.oninput=updateCount; stat.oninput=updateCount; sum.addEventListener('input', () => runSpellcheck(sum));
stat.addEventListener('input', () => runSpellcheck(stat)); updateCount(); entry.dataset.dirty='0'; $$('.prefix-bar',entry).forEach(bar=>$$('.prefix-btn',bar).forEach(b=>b.onclick=()=>insertPrefix(bar.closest('[data-edit-section="summary"]')?sum:stat,b.dataset.prefix))); $$('.edit-wrapper',entry).forEach(w=>{ const box=$('.edit-restore-confirm',w); $('.edit-restore-btn',w).onclick=()=>box.hidden=false; $('.edit-restore-confirm-no',w).onclick=()=>box.hidden=true; $('.edit-restore-confirm-yes',w).onclick=e=>{ if(e.target.dataset.target==='summary')sum.value=entry.dataset.originalSummary; if(e.target.dataset.target==='status')stat.value=entry.dataset.originalStatus; box.hidden=true; updateCount(); }; }); renderHistory($('.histGroup[data-group="summary-inline"]',entry),item.summaryHistory); renderHistory($('.histGroup[data-group="status-inline"]',entry),item.statusHistory); $('#btn-cancel',entry).onclick=close; saveBtn.onclick=()=>saveEdit(entry,item); slot.appendChild(entry); }
  function close(){ overlay.classList.add('entry-overlay--closing'); setTimeout(()=>{overlay.classList.add('entry-overlay--hidden'); overlay.classList.remove('entry-overlay--closing'); slot.innerHTML=''; openId=null; $('#pageBlocker')?.classList.add('hidden');},180); }
  function saveEdit(entry,item){ const sum=$('.edit-summary',entry).value.trim(), stat=$('.edit-status',entry).value.trim(), now=new Date().toISOString(); let changed=false; const updated={...item, modifiedIso:now}; if(sum!==(item.summary||'').trim()){ updated.summaryHistory=[{date:item.summaryUpdated||item.createdIso||now,author:item.createdBy||'Demo User',text:item.summary||''},...(item.summaryHistory||[])].filter(x=>x.text); updated.summary=sum; updated.summaryUpdated=now; changed=true; } if(stat!==(item.status||'').trim()){ updated.statusHistory=[{date:item.statusUpdated||item.createdIso||now,author:item.createdBy||'Demo User',text:item.status||''},...(item.statusHistory||[])].filter(x=>x.text); updated.status=stat; updated.statusUpdated=now; changed=true; } if(!changed){alert('No changes to save.');return;} update(updated); runSearch(); alert('Your changes were saved locally.'); close(); }
  overlay.querySelector('.panel-close')?.addEventListener('click', close); overlay.addEventListener('click',e=>{if(e.target===overlay)close();}); document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!overlay.classList.contains('entry-overlay--hidden'))close();});

  enhanceSelects(); populateFilters(); $$('#filters select').forEach(s=>{syncSelect(s); s.onchange=runSearch;}); searchBox?.addEventListener('input',runSearch); $('#searchBtn')?.addEventListener('click',runSearch); $('#filterClearBtn')?.addEventListener('click',()=>{ $$('#filters select').forEach(s=>{s.value='';syncSelect(s);}); if(searchBox)searchBox.value=''; populateFilters(); results=[]; render(); }); render();
});
