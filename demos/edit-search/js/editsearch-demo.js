document.addEventListener('DOMContentLoaded', () => {
  const searchBox = document.getElementById('searchBox');
  const filterClearBtn = document.getElementById('filterClearBtn');
  const gridEl = document.getElementById('weeklySection');

  let pageSize = 10;
  let currentPage = 1;
  let tableSort = { key: "createdAt", dir: "desc" };
  let CURRENT_OPEN_ID = null;

  const caches = {
    initialItems: [],
    currentResults: []
  };

  const DOC_CLASS_CHOICES = [
    "UNCLASSIFIED",
    "CONFIDENTIAL",
    "SECRET",
    "TOP SECRET"
  ];

  function seedHistory(texts, editor, baseDate) {
    return texts.map((text, i) => ({
      text,
      editor,
      date: new Date(baseDate.getTime() - i * 86400000).toISOString()
    }));
  }

  function makeMockData() {
    const now = new Date();
    return [
      {
        id: "1",
        title: "Suspicious login cluster",
        ccn: "1001",
        casecategory: "Cyber",
        summary: "Multiple suspicious login attempts were detected across externally facing accounts.",
        status: "Initial review complete. Awaiting follow-up from operations.",
        createdAt: "2026-05-18",
        createdIso: "2026-05-18T10:20:00Z",
        modifiedIso: "2026-05-20T15:45:00Z",
        createdBy: "Alex Carter",
        editedBy: "Jordan Lee",
        DocClass: "",
        summaryUpdated: "2026-05-20T15:45:00Z",
        statusUpdated: "2026-05-20T15:45:00Z",
        summaryHistory: seedHistory([
          "Original intake noted suspicious foreign-source sign-in activity.",
          "Expanded summary to include scope and affected systems."
        ], "Jordan Lee", now),
        statusHistory: seedHistory([
          "Status opened and routed to analyst queue.",
          "Status updated after triage."
        ], "Jordan Lee", now)
      },
      {
        id: "2",
        title: "Facility badge audit gap",
        ccn: "1002",
        casecategory: "Physical Security",
        summary: "Badge audit identified several inactive accounts that retained facility access.",
        status: "Facilities team notified; remediation in progress.",
        createdAt: "2026-05-17",
        createdIso: "2026-05-17T08:00:00Z",
        modifiedIso: "2026-05-19T12:00:00Z",
        createdBy: "Taylor Morgan",
        editedBy: "Taylor Morgan",
        DocClass: "",
        summaryUpdated: "2026-05-19T12:00:00Z",
        statusUpdated: "2026-05-19T12:00:00Z",
        summaryHistory: seedHistory(["Initial draft summary entered."], "Taylor Morgan", now),
        statusHistory: seedHistory(["Opened pending badge reconciliation."], "Taylor Morgan", now)
      },
      {
        id: "3",
        title: "Data handling deviation",
        ccn: "1003",
        casecategory: "Compliance",
        summary: "Improper handling of restricted reporting material was identified during internal review.",
        status: "Compliance counsel engaged for disposition guidance.",
        createdAt: "2026-05-15",
        createdIso: "2026-05-15T14:30:00Z",
        modifiedIso: "2026-05-21T09:15:00Z",
        createdBy: "Jordan Lee",
        editedBy: "Alex Carter",
        DocClass: "",
        summaryUpdated: "2026-05-21T09:15:00Z",
        statusUpdated: "2026-05-21T09:15:00Z",
        summaryHistory: seedHistory([
          "Original review flagged a possible handling issue.",
          "Updated summary with document chain details."
        ], "Alex Carter", now),
        statusHistory: seedHistory([
          "Initial status logged.",
          "Escalated to compliance review."
        ], "Alex Carter", now)
      },
      {
        id: "4",
        title: "Network monitoring exception",
        ccn: "1004",
        casecategory: "System/Network",
        summary: "Temporary gap in network telemetry affected visibility for one monitored enclave.",
        status: "Visibility restored. Final corrective action pending.",
        createdAt: "2026-05-14",
        createdIso: "2026-05-14T11:00:00Z",
        modifiedIso: "2026-05-16T17:10:00Z",
        createdBy: "Chris Bennett",
        editedBy: "Chris Bennett",
        DocClass: "",
        summaryUpdated: "2026-05-16T17:10:00Z",
        statusUpdated: "2026-05-16T17:10:00Z",
        summaryHistory: [],
        statusHistory: []
      }
    ];
  }

  caches.initialItems = makeMockData();
  caches.currentResults = [];

  function norm(v){ return String(v ?? '').trim().toLowerCase(); }
  function dateLabelFromKey(k){
    if (!k) return '';
    const [y,m,d] = k.split('-').map(Number);
    return new Date(y, m-1, d).toLocaleDateString();
  }
  function dateKey(v){
    if (!v) return '';
    if (/^\\d{4}-\\d{2}-\\d{2}$/.test(v)) return v;
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const day = String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  }

  function localKeywordMatch(item, termRaw) {
    const t = String(termRaw || "").trim().toLowerCase();
    if (!t) return true;
    const fields = [
      item.title, item.ccn, item.casecategory, item.summary, item.status, item.createdBy
    ];
    return fields.some(v => String(v || "").toLowerCase().includes(t));
  }

  function getSelections(){
    return {
      createdAt: document.getElementById('filterCreatedDate')?.value || '',
      casecategory: document.getElementById('filterCaseCategory')?.value || '',
      createdBy: document.getElementById('filterCreatedBy')?.value || '',
      title: document.getElementById('filterTitle')?.value || '',
      ccn: document.getElementById('filterCCN')?.value || '',
    };
  }

  function applyFiltersToItems(items) {
    const sel = getSelections();
    return items.filter(it => {
      if (sel.createdAt && it.createdAt !== sel.createdAt) return false;
      if (sel.casecategory && norm(it.casecategory) !== norm(sel.casecategory)) return false;
      if (sel.createdBy && norm(it.createdBy) !== norm(sel.createdBy)) return false;
      if (sel.title && norm(it.title) !== norm(sel.title)) return false;
      if (sel.ccn && String(it.ccn) !== String(sel.ccn)) return false;
      return true;
    });
  }

  function createToastContainer() {
    let t = document.getElementById('toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'toast';
      t.className = 'toast';
      document.body.appendChild(t);
    }
    return t;
  }
  const toastEl = createToastContainer();
  function toast(msg, type='ok', ms=2500) {
    toastEl.textContent = msg;
    toastEl.className = 'toast' + (type==='error' ? ' error' : '') + ' show';
    setTimeout(()=> {
      toastEl.className = 'toast' + (type==='error' ? ' error' : '');
    }, ms);
  }

  function refillSelect($sel, values, {labelize=(v)=>v}={}) {
    if (!$sel) return;
    const firstText = $sel.options[0]?.text || "All";
    $sel.innerHTML = "";
    const defaultOpt = document.createElement("option");
    defaultOpt.value = "";
    defaultOpt.textContent = firstText;
    $sel.appendChild(defaultOpt);

    values.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v;
      opt.textContent = labelize(v);
      $sel.appendChild(opt);
    });
  }

  function populateFilters(items = caches.initialItems) {
    const $createdDate = document.getElementById('filterCreatedDate');
    const $casecategory = document.getElementById('filterCaseCategory');
    const $createdBy = document.getElementById('filterCreatedBy');
    const $title = document.getElementById('filterTitle');
    const $ccn = document.getElementById('filterCCN');

    const dates = [...new Set(items.map(i => i.createdAt).filter(Boolean))].sort().reverse();
    const cats = [...new Set(items.map(i => i.casecategory).filter(Boolean))].sort();
    const bys = [...new Set(items.map(i => i.createdBy).filter(Boolean))].sort();
    const titles = [...new Set(items.map(i => i.title).filter(Boolean))].sort();
    const ccns = [...new Set(items.map(i => String(i.ccn)).filter(Boolean))].sort((a,b)=>Number(a)-Number(b));

    refillSelect($createdDate, dates, { labelize: dateLabelFromKey });
    refillSelect($casecategory, cats);
    refillSelect($createdBy, bys);
    refillSelect($title, titles);
    refillSelect($ccn, ccns);
  }

  function showInitialEmptyState() {
    const host = document.getElementById("resultsTableHost");
    const actionsBar = document.getElementById("resultsActions");
    if (actionsBar) actionsBar.textContent = "0 results";
    host.innerHTML = `
      <table class="results-table">
        <thead>
          <tr>
            <th>Title</th><th>CCN</th><th>Category</th><th>Summary</th>
            <th>Status</th><th>Created</th><th>By</th><th></th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colspan="8" style="text-align:center;color:#555;padding:24px 0;">
              Start typing or select a filter to view results.
            </td>
          </tr>
        </tbody>
      </table>
    `;
  }

  function getSortValue(item, key) {
    switch (key) {
      case "createdAt": return item.createdAt ? new Date(item.createdAt).getTime() : 0;
      case "title": return (item.title || "").toLowerCase();
      case "ccn": return (item.ccn || "").toLowerCase();
      case "casecategory": return (item.casecategory || "").toLowerCase();
      case "summary": return (item.summary || "").toLowerCase();
      case "status": return (item.status || "").toLowerCase();
      case "createdBy": return (item.createdBy || "").toLowerCase();
      default: return "";
    }
  }

  function compareValues(a, b) {
    if (typeof a === "number" && typeof b === "number") return a - b;
    return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
  }

  function getSortedResults(results) {
    const { key, dir } = tableSort;
    const mult = dir === "asc" ? 1 : -1;
    return [...results].sort((x, y) => mult * compareValues(getSortValue(x, key), getSortValue(y, key)));
  }

  function getSelectedRows() {
    const selected = [];
    document.querySelectorAll("input.row-select:checked").forEach(cb => {
      const id = cb.dataset.id;
      const item = caches.currentResults.find(x => x.id == id);
      if (item) selected.push(item);
    });
    return selected;
  }

  function updateExportButtonState() {
    const btn = document.getElementById("exportSelectedBtn");
    if (btn) btn.disabled = getSelectedRows().length === 0;
  }

  function renderResults(list) {
    caches.currentResults = Array.isArray(list) ? list : [];
    renderCurrentPage();
  }

  function renderCurrentPage() {
    const host = document.getElementById("resultsTableHost");
    const actionsTop = document.getElementById("resultsActions");
    const actionsBottom = document.getElementById("resultsActionsBottom");
    if (!host) return;

    host.innerHTML = "";
    const results = caches.currentResults || [];
    const total = results.length;

    if (total === 0) {
      actionsTop.textContent = "0 results";
      actionsBottom.textContent = "";
      host.innerHTML = `
        <table class="results-table">
          <thead>
            <tr>
              <th>Title</th><th>CCN</th><th>Category</th><th>Summary</th>
              <th>Status</th><th>Created</th><th>By</th><th></th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      `;
      return;
    }

    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    currentPage = Math.min(currentPage, totalPages);

    const sorted = getSortedResults(results);
    const start = (currentPage - 1) * pageSize;
    const end = Math.min(start + pageSize, total);
    const pageRows = sorted.slice(start, end);

    actionsTop.innerHTML = `
      <div class="results-actions-row">
        <button type="button" id="exportSelectedBtn" class="btn export-btn" disabled>Export</button>
        <div class="results-pager">
          <span class="results-count">Showing ${start + 1}-${end} of ${total}</span>
          <div class="pager-controls">
            <button type="button" id="pagerPrev" ${currentPage === 1 ? "disabled" : ""}>Prev</button>
            <span class="pager-page">Page ${currentPage} / ${totalPages}</span>
            <button type="button" id="pagerNext" ${currentPage === totalPages ? "disabled" : ""}>Next</button>
          </div>
          <label>
            Per page
            <select id="pagerSize">
              ${[10,25,50,100].map(n => `<option value="${n}" ${n===pageSize?'selected':''}>${n}</option>`).join("")}
            </select>
          </label>
        </div>
      </div>
    `;

    actionsBottom.innerHTML = `
      <div class="results-pager">
        <span class="results-count">Showing ${start + 1}-${end} of ${total}</span>
        <div class="pager-controls">
          <button type="button" id="pagerPrevBottom" ${currentPage === 1 ? "disabled" : ""}>Prev</button>
          <span class="pager-page">Page ${currentPage} / ${totalPages}</span>
          <button type="button" id="pagerNextBottom" ${currentPage === totalPages ? "disabled" : ""}>Next</button>
        </div>
      </div>
    `;

    const tbl = document.createElement("table");
    tbl.className = "results-table";
    tbl.innerHTML = `
      <thead>
        <tr>
          <th><input type="checkbox" id="selectAllRows"></th>
          <th><button type="button" class="th-sort" data-sort="title">Title <span class="th-icon"></span></button></th>
          <th><button type="button" class="th-sort" data-sort="ccn">CCN <span class="th-icon"></span></button></th>
          <th><button type="button" class="th-sort" data-sort="casecategory">Category <span class="th-icon"></span></button></th>
          <th><button type="button" class="th-sort" data-sort="summary">Summary <span class="th-icon"></span></button></th>
          <th><button type="button" class="th-sort" data-sort="status">Status <span class="th-icon"></span></button></th>
          <th><button type="button" class="th-sort" data-sort="createdAt">Created <span class="th-icon"></span></button></th>
          <th><button type="button" class="th-sort" data-sort="createdBy">By <span class="th-icon"></span></button></th>
          <th></th>
        </tr>
      </thead>
      <tbody></tbody>
    `;

    tbl.querySelectorAll("button.th-sort").forEach(btn => {
      const key = btn.dataset.sort;
      const iconEl = btn.querySelector(".th-icon");
      iconEl.textContent = tableSort.key === key ? (tableSort.dir === "asc" ? "▲" : "▼") : "↕";
      btn.addEventListener("click", () => {
        if (tableSort.key === key) tableSort.dir = tableSort.dir === "asc" ? "desc" : "asc";
        else {
          tableSort.key = key;
          tableSort.dir = key === "createdAt" ? "desc" : "asc";
        }
        currentPage = 1;
        renderCurrentPage();
      });
    });

    const tbody = tbl.querySelector("tbody");
    const td = (text, cls) => {
      const el = document.createElement("td");
      if (cls) el.className = cls;
      el.textContent = text ?? "—";
      return el;
    };

    pageRows.forEach(item => {
      const tr = document.createElement("tr");
      tr.dataset.id = item.id;

      const selectTd = document.createElement("td");
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.className = "row-select";
      cb.dataset.id = item.id;
      cb.addEventListener("change", updateExportButtonState);
      selectTd.appendChild(cb);
      tr.appendChild(selectTd);

      tr.appendChild(td(item.title));
      tr.appendChild(td(item.ccn));
      tr.appendChild(td(item.casecategory));
      tr.appendChild(td(item.summary, "cell-summary"));
      tr.appendChild(td(item.status, "cell-status"));
      tr.appendChild(td(dateLabelFromKey(item.createdAt)));
      tr.appendChild(td(item.createdBy));

      const actionsTd = document.createElement("td");
      actionsTd.className = "col-actions";
      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "btn row-edit-btn";
      editBtn.textContent = "Edit";
      editBtn.addEventListener("click", () => openEntry(item));
      actionsTd.appendChild(editBtn);
      tr.appendChild(actionsTd);

      tbody.appendChild(tr);
    });

    host.appendChild(tbl);

    document.getElementById("selectAllRows")?.addEventListener("change", function () {
      tbl.querySelectorAll("input.row-select").forEach(cb => cb.checked = this.checked);
      updateExportButtonState();
    });

    document.getElementById("pagerPrev")?.addEventListener("click", () => {
      if (currentPage > 1) { currentPage--; renderCurrentPage(); }
    });
    document.getElementById("pagerNext")?.addEventListener("click", () => {
      if (currentPage < totalPages) { currentPage++; renderCurrentPage(); }
    });
    document.getElementById("pagerPrevBottom")?.addEventListener("click", () => {
      if (currentPage > 1) { currentPage--; renderCurrentPage(); }
    });
    document.getElementById("pagerNextBottom")?.addEventListener("click", () => {
      if (currentPage < totalPages) { currentPage++; renderCurrentPage(); }
    });
    document.getElementById("pagerSize")?.addEventListener("change", (e) => {
      pageSize = Number(e.target.value) || 10;
      currentPage = 1;
      renderCurrentPage();
    });

    document.getElementById("exportSelectedBtn")?.addEventListener("click", () => {
      const selected = getSelectedRows();
      if (!selected.length) return alert("Please select at least one entry to export.");
      window.__pendingExport = selected;
      document.getElementById("exportOverlay").classList.remove("hidden");
    });

    updateExportButtonState();
  }

  function runLocalSearch() {
    const term = (searchBox?.value || '').trim();
    let items = [...caches.initialItems];
    if (term) items = items.filter(it => localKeywordMatch(it, term));
    items = applyFiltersToItems(items);
    currentPage = 1;
    renderResults(items);
  }

  function renderHistoryGroup(groupEl, entries) {
    if (!groupEl) return;
    const historyColumn = groupEl.closest('.history-column');
    const detailEl = historyColumn?.querySelector('.history-detail');
    const detailBodyEl = detailEl?.querySelector('.history-detail__body');
    const template = groupEl.querySelector('.histItem[data-template]');

    groupEl.querySelectorAll('.histItem:not([data-template])').forEach(n => n.remove());

    const normalized = (entries || []).slice().sort((a,b) => new Date(b.date) - new Date(a.date));
    if (!normalized.length) {
      const empty = template.cloneNode(true);
      empty.removeAttribute('data-template');
      empty.style.display = '';
      empty.disabled = true;
      empty.querySelector('.histHeader').textContent = 'No history yet.';
      groupEl.appendChild(empty);
      if (detailEl) detailEl.style.display = 'none';
      return;
    }

    normalized.forEach(e => {
      const node = template.cloneNode(true);
      node.removeAttribute('data-template');
      node.style.display = '';
      const dateLabel = dateLabelFromKey(dateKey(e.date));
      node.querySelector('.histHeader').textContent = `Last edit ${dateLabel} • ${e.editor || 'Unknown'}`;
      node.addEventListener('click', () => {
        groupEl.querySelectorAll('.histItem.is-active').forEach(n => n.classList.remove('is-active'));
        node.classList.add('is-active');
        if (detailEl && detailBodyEl) {
          detailEl.style.display = '';
          detailBodyEl.textContent = e.text || '';
        }
      });
      groupEl.appendChild(node);
    });

    if (detailEl) detailEl.style.display = 'none';
  }

  function insertPrefixAtCursor(textarea, prefix) {
    if (!textarea || !prefix) return;
    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? start;
    const before = textarea.value.slice(0, start);
    const after = textarea.value.slice(end);
    const insert = `(${prefix}) `;
    textarea.value = before + insert + after;
    const newPos = before.length + insert.length;
    textarea.focus();
    textarea.setSelectionRange(newPos, newPos);
  }

  function renderEntryFromTemplate(item) {
    const tpl = document.getElementById('entryTemplate');
    const entry = tpl.content.firstElementChild.cloneNode(true);
    entry.dataset.id = item.id;
    entry.dataset.originalSummary = item.summary || '';
    entry.dataset.originalStatus = item.status || '';
    entry.dataset.dirty = "0";

    entry.querySelector('.entry-title__text').textContent = item.title || 'Untitled';
    entry.querySelector('.entry-title__info').textContent = `Created ${dateLabelFromKey(item.createdAt)} • ${item.createdBy}`;
    entry.querySelector('.entry-meta').textContent = item.ccn || 'Unknown';

    const tSummary = entry.querySelector('.edit-summary');
    const tStatus = entry.querySelector('.edit-status');
    tSummary.value = item.summary || '';
    tStatus.value = item.status || '';

    const markDirty = () => entry.dataset.dirty = "1";
    tSummary.addEventListener('input', markDirty);
    tStatus.addEventListener('input', markDirty);

    entry.querySelectorAll('[data-edit-section="summary"] .prefix-btn').forEach(btn => {
      btn.addEventListener('click', () => insertPrefixAtCursor(tSummary, btn.dataset.prefix));
    });
    entry.querySelectorAll('[data-edit-section="status"] .prefix-btn').forEach(btn => {
      btn.addEventListener('click', () => insertPrefixAtCursor(tStatus, btn.dataset.prefix));
    });

    renderHistoryGroup(entry.querySelector('.histGroup[data-group="summary-inline"]'), item.summaryHistory);
    renderHistoryGroup(entry.querySelector('.histGroup[data-group="status-inline"]'), item.statusHistory);

    return entry;
  }

  function openEntry(listItem) {
    const overlay = document.getElementById('entryOverlay');
    const slot = document.getElementById('entryCardSlot');
    const blocker = document.getElementById('pageBlocker');
    if (!overlay || !slot) return;

    const item = caches.initialItems.find(x => x.id === listItem.id);
    if (!item) return;

    CURRENT_OPEN_ID = item.id;
    slot.innerHTML = '';
    const entry = renderEntryFromTemplate(item);
    slot.appendChild(entry);

    overlay.classList.remove('entry-overlay--hidden');
    blocker.classList.remove('hidden');

    const close = () => {
      overlay.classList.add('entry-overlay--hidden');
      blocker.classList.add('hidden');
      slot.innerHTML = '';
      CURRENT_OPEN_ID = null;
    };

    overlay.querySelector('.panel-close').onclick = close;
    entry.querySelector('#btn-cancel').onclick = close;
    entry.querySelector('#btn-save').onclick = () => {
      const newSummary = entry.querySelector('.edit-summary').value.trim();
      const newStatus = entry.querySelector('.edit-status').value.trim();
      const changedSummary = newSummary !== (item.summary || '').trim();
      const changedStatus = newStatus !== (item.status || '').trim();

      if (!changedSummary && !changedStatus) {
        toast("No changes to save");
        return;
      }

      const nowIso = new Date().toISOString();

      if (changedSummary) {
        if (item.summary) {
          item.summaryHistory.unshift({
            text: item.summary,
            editor: item.editedBy || item.createdBy,
            date: item.summaryUpdated || item.createdIso
          });
        }
        item.summary = newSummary;
        item.summaryUpdated = nowIso;
      }

      if (changedStatus) {
        if (item.status) {
          item.statusHistory.unshift({
            text: item.status,
            editor: item.editedBy || item.createdBy,
            date: item.statusUpdated || item.createdIso
          });
        }
        item.status = newStatus;
        item.statusUpdated = nowIso;
      }

      item.editedBy = "Demo User";
      toast("Demo changes saved locally");
      runLocalSearch();
      close();
    };
  }

  function initDocClassDropdown() {
    const sel = document.getElementById("overlayDocClass");
    sel.innerHTML = `<option value="">-- Select Classification --</option>`;
    DOC_CLASS_CHOICES.forEach(choice => {
      const opt = document.createElement("option");
      opt.value = choice;
      opt.textContent = choice;
      sel.appendChild(opt);
    });
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function buildDemoExport(items) {
    const lines = [];
    items.forEach((item, i) => {
      lines.push(`CLASSIFICATION: ${item.DocClass || "UNCLASSIFIED"}`);
      lines.push(`TITLE: ${item.title || ""}`);
      lines.push(`CCN: ${item.ccn || ""}`);
      lines.push(`CATEGORY: ${item.casecategory || ""}`);
      lines.push(`CREATED: ${item.createdAt || ""}`);
      lines.push(`BY: ${item.createdBy || ""}`);
      lines.push("");
      lines.push("SUMMARY");
      lines.push(item.summary || "");
      lines.push("");
      lines.push("STATUS");
      lines.push(item.status || "");
      lines.push("");
      lines.push(`CLASSIFICATION: ${item.DocClass || "UNCLASSIFIED"}`);
      if (i < items.length - 1) lines.push("\\n----------------------------------------\\n");
    });
    return new Blob([lines.join("\\n")], { type: "text/plain;charset=utf-8" });
  }

  document.getElementById("overlayCancel").addEventListener("click", () => {
    document.getElementById("exportOverlay").classList.add("hidden");
    window.__pendingExport = null;
  });

  document.getElementById("overlayExport").addEventListener("click", () => {
    const docClass = document.getElementById("overlayDocClass").value;
    if (!docClass) return alert("Please select a classification.");

    const items = (window.__pendingExport || []).map(item => ({ ...item, DocClass: docClass }));
    const blob = buildDemoExport(items);
    downloadBlob(blob, "NSD_Submissions_DEMO.txt");

    document.getElementById("exportOverlay").classList.add("hidden");
    window.__pendingExport = null;
    toast("Demo export downloaded");
  });

  function wireEvents() {
    filterClearBtn?.addEventListener('click', () => {
      document.querySelectorAll('#filters select').forEach(sel => sel.value = '');
      if (searchBox) searchBox.value = '';
      currentPage = 1;
      showInitialEmptyState();
      populateFilters(caches.initialItems);
    });

    document.getElementById("searchAllBtn")?.addEventListener("click", () => {
      searchBox.value = "";
      document.querySelectorAll('#filters select').forEach(sel => sel.value = '');
      runLocalSearch();
    });

    document.querySelectorAll('#filters select').forEach(sel => {
      sel.addEventListener('change', runLocalSearch);
    });

    searchBox?.addEventListener('input', runLocalSearch);

    document.getElementById('entryOverlay').addEventListener('click', (e) => {
      if (e.target.id === 'entryOverlay') {
        document.getElementById('entryOverlay').classList.add('entry-overlay--hidden');
        document.getElementById('pageBlocker').classList.add('hidden');
        document.getElementById('entryCardSlot').innerHTML = '';
      }
    });
  }

  function boot() {
    showInitialEmptyState();
    populateFilters(caches.initialItems);
    initDocClassDropdown();
    wireEvents();
  }

  boot();
});
