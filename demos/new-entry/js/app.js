(function () {
  const els = {
    entriesList: document.getElementById('entriesList'),
    btnNewEntry: document.getElementById('btnNewEntry'),
    btnDeleteEntry: document.getElementById('btnDeleteEntry'),
    btnDuplicateEntry: document.getElementById('btnDuplicateEntry'),
    btnShowAll: document.getElementById('btnShowAll'),

    fieldoffice: document.getElementById('fieldoffice'),
    suboffice: document.getElementById('suboffice'),
    ccn: document.getElementById('ccn'),

    title: document.getElementById('title'),
    summary: document.getElementById('summary'),
    status: document.getElementById('status'),

    rCCN: document.getElementById('r-ccn'),
    rTitle: document.getElementById('r-title'),
    rFieldoffice: document.getElementById('r-fieldoffice'),
    rSuboffice: document.getElementById('r-suboffice'),
    rSummary: document.getElementById('r-summary'),
    rStatus: document.getElementById('r-status'),

    reviewCard: document.getElementById('reviewCard')
  };

  const STORAGE_KEY = 'desktop-demo-entries-v1';

  const classifications = ['U', 'C', 'S', 'TS'];
  const fieldOfficeRules = [
    { office: 'East', sub: 'Alpha' },
    { office: 'East', sub: 'Bravo' },
    { office: 'West', sub: 'Charlie' },
    { office: 'West', sub: 'Delta' }
  ];

  let entries = [];
  let selectedId = null;
  let isLoadingEntry = false;

  function uid() {
    return 'id_' + Math.random().toString(36).slice(2, 9);
  }

  function nowISO() {
    return new Date().toISOString();
  }

  function formatDate(iso) {
    return iso ? new Date(iso).toLocaleString() : '';
  }

  function debounce(fn, wait = 400) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  }

  function saveEntries() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }

  function loadEntries() {
    try {
      entries = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch {
      entries = [];
    }
  }

  function makeEmptyEntry() {
    return {
      id: uid(),
      updatedAt: nowISO(),
      data: {
        title: '',
        ccn: '',
        fieldoffice: '',
        suboffice: '',
        summary: '',
        status: ''
      }
    };
  }

  function enableTextarea(el) {
    if (!el) return;
    el.disabled = false;
    el.classList.remove('is-disabled');
  }

  function disableTextarea(el) {
    if (!el) return;
    el.disabled = true;
    el.classList.add('is-disabled');
  }

  function hasClassification(text) {
    if (!text) return false;
    return /^\([A-Za-z/]+\)/.test(text.trim());
  }

  function insertPrefix(textarea, prefix) {
    if (!textarea || !prefix) return;
    if (hasClassification(textarea.value)) return;
    textarea.value = `(${prefix}) ${textarea.value}`.trim();
  }

  function updateHelperText(type, uiSelectEl) {
    if (!uiSelectEl) return;
    const helper = uiSelectEl.querySelector('.class-helper');
    if (!helper) return;

    if (type === 'title') {
      helper.textContent = 'Update Classification';
    } else {
      helper.textContent = 'Add as many Classifications';
    }
  }

  function initializeClassificationState(entry) {
    const d = entry.data || {};

    if (hasClassification(d.title)) {
      enableTextarea(els.title);
      updateHelperText('title', document.querySelector('#titleClassDropdown').closest('.class-select'));
    } else {
      disableTextarea(els.title);
    }

    if (hasClassification(d.summary)) {
      enableTextarea(els.summary);
      updateHelperText('summary', document.querySelector('#summaryClassDropdown').closest('.class-select'));
    } else {
      disableTextarea(els.summary);
    }

    if (hasClassification(d.status)) {
      enableTextarea(els.status);
      updateHelperText('status', document.querySelector('#statusClassDropdown').closest('.class-select'));
    } else {
      disableTextarea(els.status);
    }
  }

  function updateReview(field, value) {
    const map = {
      title: els.rTitle,
      ccn: els.rCCN,
      fieldoffice: els.rFieldoffice,
      suboffice: els.rSuboffice,
      summary: els.rSummary,
      status: els.rStatus
    };
    if (map[field]) map[field].textContent = value || '— not set —';
  }

  function updateAllReviews() {
    const d = getCurrentFormData();
    Object.keys(d).forEach(key => updateReview(key, d[key]));
  }

  function renderEntriesList() {
    els.entriesList.innerHTML = '';

    if (!entries.length) {
      els.entriesList.innerHTML = '<div class="entry-meta">No entries yet</div>';
      return;
    }

    entries.forEach(en => {
      const item = document.createElement('div');
      item.className = 'entry-item' + (en.id === selectedId ? ' active' : '');
      item.dataset.id = en.id;
      item.innerHTML = `
        <div class="entry-title">${(en.data.title || 'New Entry')}</div>
        <div class="entry-meta">${formatDate(en.updatedAt)}</div>
      `;
      item.addEventListener('click', () => selectEntry(en.id));
      els.entriesList.appendChild(item);
    });
  }

  function getCurrentFormData() {
    return {
      title: els.title.value.trim(),
      ccn: els.ccn.value.trim(),
      fieldoffice: els.fieldoffice.value,
      suboffice: els.suboffice.value,
      summary: els.summary.value.trim(),
      status: els.status.value.trim()
    };
  }

  function persistCurrentEntry() {
    if (!selectedId) return;
    const entry = entries.find(e => e.id === selectedId);
    if (!entry) return;

    entry.data = getCurrentFormData();
    entry.updatedAt = nowISO();
    saveEntries();
    renderEntriesList();
    updateShowAllButtonState();
  }

  const doAutosave = debounce(() => {
    if (!isLoadingEntry) persistCurrentEntry();
  }, 300);

  function populateFieldOffices() {
    const offices = [...new Set(fieldOfficeRules.map(r => r.office))];
    els.fieldoffice.innerHTML = '<option value="">Select Field Office</option>';
    offices.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v;
      opt.textContent = v;
      els.fieldoffice.appendChild(opt);
    });
  }

  function populateSuboffices(fieldoffice, selected = '') {
    els.suboffice.innerHTML = '<option value="">Select SubOffice</option>';

    if (!fieldoffice) {
      document.getElementById('suboffice-field').classList.add('is-hidden');
      return;
    }

    document.getElementById('suboffice-field').classList.remove('is-hidden');

    fieldOfficeRules
      .filter(r => r.office === fieldoffice)
      .forEach(r => {
        const opt = document.createElement('option');
        opt.value = r.sub;
        opt.textContent = r.sub;
        els.suboffice.appendChild(opt);
      });

    els.suboffice.value = selected;
  }

  function populateClassificationDropdown(id) {
    const dd = document.getElementById(id);
    dd.innerHTML = '<option value="">Select classification</option>';
    classifications.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      dd.appendChild(opt);
    });
  }

  function wireClassificationSelect(selectId, textareaEl, type) {
    const selectEl = document.getElementById(selectId);
    const wrapper = selectEl.closest('.class-select');

    selectEl.addEventListener('change', () => {
      const prefix = selectEl.value;
      if (!prefix) return;

      const alreadyClassified = hasClassification(textareaEl.value);

      if (!alreadyClassified) {
        insertPrefix(textareaEl, prefix);
        enableTextarea(textareaEl);
      }

      updateHelperText(type, wrapper);
      updateAllReviews();
      doAutosave();
    });
  }

  function selectEntry(id) {
    selectedId = id;
    const entry = entries.find(e => e.id === id);
    if (!entry) return;

    isLoadingEntry = true;

    const d = entry.data || {};

    els.title.value = d.title || '';
    els.ccn.value = d.ccn || '';
    els.fieldoffice.value = d.fieldoffice || '';
    populateSuboffices(d.fieldoffice || '', d.suboffice || '');
    els.summary.value = d.summary || '';
    els.status.value = d.status || '';

    initializeClassificationState(entry);
    updateAllReviews();
    renderEntriesList();

    isLoadingEntry = false;
  }

  function createNewEntry() {
    const e = makeEmptyEntry();
    entries.unshift(e);
    saveEntries();
    renderEntriesList();
    selectEntry(e.id);
    updateShowAllButtonState();
  }

  function duplicateEntry() {
    if (!selectedId) return;
    const src = entries.find(e => e.id === selectedId);
    if (!src) return;

    const copy = {
      id: uid(),
      updatedAt: nowISO(),
      data: JSON.parse(JSON.stringify(src.data))
    };

    entries.unshift(copy);
    saveEntries();
    renderEntriesList();
    selectEntry(copy.id);
    updateShowAllButtonState();
  }

  function deleteSelectedEntry() {
    if (!selectedId) return;
    entries = entries.filter(e => e.id !== selectedId);
    saveEntries();

    if (!entries.length) {
      const starter = makeEmptyEntry();
      entries.push(starter);
      saveEntries();
    }

    renderEntriesList();
    selectEntry(entries[0].id);
    updateShowAllButtonState();
  }

  function isEntryDataComplete(d) {
    if (!d) return false;
    return (
      (d.title || '').trim() &&
      (d.fieldoffice || '').trim() &&
      (d.ccn || '').trim() &&
      (d.suboffice || '').trim() &&
      (d.summary || '').trim() &&
      (d.status || '').trim()
    );
  }

  function areAllEntriesComplete() {
    return entries.length > 0 && entries.every(e => isEntryDataComplete(e.data));
  }

  function updateShowAllButtonState() {
    const complete = areAllEntriesComplete();
    els.btnShowAll.disabled = !complete;
    els.btnShowAll.classList.toggle('is-disabled', !complete);
  }

  function wireInputs() {
    ['title', 'ccn', 'summary', 'status'].forEach(id => {
      const el = els[id];
      el.addEventListener('input', () => {
        updateReview(id, el.value);
        doAutosave();
        updateShowAllButtonState();
        renderEntriesList();
      });
    });

    els.fieldoffice.addEventListener('change', () => {
      populateSuboffices(els.fieldoffice.value, '');
      updateReview('fieldoffice', els.fieldoffice.value);
      updateReview('suboffice', '');
      doAutosave();
      updateShowAllButtonState();
    });

    els.suboffice.addEventListener('change', () => {
      updateReview('suboffice', els.suboffice.value);
      doAutosave();
      updateShowAllButtonState();
    });
  }

  function showAllEntries() {
    alert(JSON.stringify(entries, null, 2));
  }

  function init() {
    loadEntries();

    populateFieldOffices();
    populateClassificationDropdown('titleClassDropdown');
    populateClassificationDropdown('summaryClassDropdown');
    populateClassificationDropdown('statusClassDropdown');

    wireClassificationSelect('titleClassDropdown', els.title, 'title');
    wireClassificationSelect('summaryClassDropdown', els.summary, 'summary');
    wireClassificationSelect('statusClassDropdown', els.status, 'status');

    wireInputs();

    els.btnNewEntry.addEventListener('click', createNewEntry);
    els.btnDuplicateEntry.addEventListener('click', duplicateEntry);
    els.btnDeleteEntry.addEventListener('click', deleteSelectedEntry);
    els.btnShowAll.addEventListener('click', showAllEntries);

    if (!entries.length) {
      entries.push(makeEmptyEntry());
      saveEntries();
    }

    renderEntriesList();
    selectEntry(entries[0].id);
    updateShowAllButtonState();

    window.addEventListener('beforeunload', () => {
      persistCurrentEntry();
      saveEntries();
    });
  }

  init();
})();
