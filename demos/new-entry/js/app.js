(function () {
  const els = {
    entriesList: document.getElementById('entriesList'),
    btnNewEntry: document.getElementById('btnNewEntry'),
    btnDeleteEntry: document.getElementById('btnDeleteEntry'),
    btnDuplicateEntry: document.getElementById('btnDuplicateEntry'),
    fieldoffice: document.getElementById('fieldoffice'),
    suboffice: document.getElementById('suboffice'),
    subofficeWrapper: document.getElementById('suboffice-field'),
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
    autosave: document.getElementById('autosave'),
    btnShowAll: document.getElementById('btnShowAll'),
    reviewCard: document.getElementById('reviewCard'),
    newEntry: document.querySelector('.new-entry')
  };

  const STORAGE_KEY = 'threecol:entries:summary-status:demo:v1';

  let isLoadingEntry = false;
  let reviewVisible = false;
  let entries = [];
  let selectedId = null;
  let reviewTerms = [];

  let classifications = [];
  let fieldOfficeRules = [];

  function debounce(fn, wait = 600) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  }

  function uid() {
    return 'id_' + Math.random().toString(36).slice(2, 9);
  }

  function nowISO() {
    return new Date().toISOString();
  }

  function formatDate(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleString();
  }

  function showAutosave() {
    if (!els.autosave) return;
    els.autosave.classList.add('autosave--active');
    clearTimeout(showAutosave._t);
    showAutosave._t = setTimeout(() => {
      els.autosave.classList.remove('autosave--active');
    }, 1200);
  }

  function loadEntries() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      entries = raw ? JSON.parse(raw) || [] : [];
    } catch (e) {
      entries = [];
      console.warn('loadEntries error', e);
    }
  }

  function saveEntries() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
      showAutosave();
    } catch (e) {
      console.warn('saveEntries error', e);
    }
  }

  function makeEmptyEntry() {
    return {
      id: uid(),
      updatedAt: nowISO(),
      title: 'New Entry',
      data: {
        title: '',
        titleClassification: '',
        fieldoffice: '',
        ccn: '',
        suboffice: '',
        summary: '',
        status: ''
      }
    };
  }

  function enableTextarea(el) {
    if (!el) return;
    el.removeAttribute('disabled');
    el.classList.remove('is-disabled');
  }

  function disableTextarea(el) {
    if (!el) return;
    el.setAttribute('disabled', 'true');
    el.classList.add('is-disabled');
  }

  function updateHelperText(type, uiSelectEl) {
    if (!uiSelectEl) return;
    const helper = uiSelectEl.parentElement?.querySelector('.class-helper');
    if (!helper) return;

    helper.textContent =
      type === 'title'
        ? 'Update Classification'
        : 'Add as many Classifications';
  }

  function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function escapeHTML(s = '') {
    return (s + '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function enableNativeSpellcheck() {
    if (els.title) els.title.spellcheck = true;
    if (els.summary) els.summary.spellcheck = true;
    if (els.status) els.status.spellcheck = true;
  }

  function ensureReviewWarningEl(inputEl, id) {
    let msg = document.getElementById(id);
    if (msg) return msg;

    msg = document.createElement('div');
    msg.id = id;
    msg.className = 'review-warning';
    msg.setAttribute('aria-live', 'polite');
    inputEl.insertAdjacentElement('afterend', msg);
    return msg;
  }

  function findReviewMatches(text) {
    const value = (text || '').trim();
    if (!value) return [];

    const lower = value.toLowerCase();
    const matches = [];

    reviewTerms.forEach(rule => {
      const term = rule.term.toLowerCase();
      if (!term) return;

      if (rule.matchType === 'exact') {
        const rx = new RegExp(`\\b${escapeRegExp(term)}\\b`, 'i');
        if (rx.test(value)) matches.push(rule);
        return;
      }

      if (lower.includes(term)) matches.push(rule);
    });

    return matches;
  }

  function validateReviewTerms(inputEl, outputEl, label) {
    if (!inputEl || !outputEl) return;

    const matches = findReviewMatches(inputEl.value);
    if (!matches.length) {
      outputEl.textContent = '';
      outputEl.classList.remove('has-warning');
      return;
    }

    outputEl.innerHTML = matches
      .map(m => `<div><strong>${label}:</strong> "${escapeHTML(m.term)}" — ${escapeHTML(m.message)}</div>`)
      .join('');

    outputEl.classList.add('has-warning');
  }

  function validateAllReviewTerms() {
    validateReviewTerms(
      els.title,
      ensureReviewWarningEl(els.title, 'titleReviewWarnings'),
      'Title'
    );

    validateReviewTerms(
      els.summary,
      ensureReviewWarningEl(els.summary, 'summaryReviewWarnings'),
      'Summary'
    );

    validateReviewTerms(
      els.status,
      ensureReviewWarningEl(els.status, 'statusReviewWarnings'),
      'Status'
    );
  }

  async function loadClassifications() {
    return ['U', 'FOUO', 'LES', 'SBU', 'SECRET', 'CONFIDENTIAL'];
  }

  async function loadFieldOfficeRules() {
    return [
      { office: 'Washington', sub: 'Heading1' },
      { office: 'Washington', sub: 'Heading2' },
      { office: 'Norfolk', sub: 'Heading3' },
      { office: 'San Diego', sub: 'Heading4' },
      { office: 'Pearl Harbor', sub: 'Heading5' },
      { office: 'Norfolk', sub: 'Special Projects' }
    ];
  }

  async function loadReviewTerms() {
    reviewTerms = [
      { term: 'ongoing investigation', matchType: 'contains', message: 'Confirm this wording is approved for release.' },
      { term: 'sources and methods', matchType: 'contains', message: 'Sensitive phrase detected; review classification carefully.' },
      { term: 'classified', matchType: 'contains', message: 'Verify classification guidance before submission.' }
    ];
  }

  async function loadClassificationsDropdown() {
    const dropdowns = [
      document.querySelector('#titleClassDropdown'),
      document.querySelector('#summaryClassDropdown'),
      document.querySelector('#statusClassDropdown')
    ];

    dropdowns.forEach(dd => {
      if (!dd) return;
      dd.innerHTML = '<option value="" selected></option>';
      classifications.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = c;
        dd.appendChild(opt);
      });
    });
  }

  async function populateFieldDropdown(selectId, items, placeholder = 'Select an option') {
    const dd = document.getElementById(selectId);
    if (!dd) return;

    dd.innerHTML = `<option value="">${placeholder}</option>`;
    items.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v;
      opt.textContent = v;
      dd.appendChild(opt);
    });

    const wrapper = dd.closest('.ui-select');
    if (wrapper) rebuildUiSelect(wrapper, dd);
  }

  function rebuildUiSelect(wrapper, selectEl) {
    const btn = wrapper.querySelector('.ui-select__btn');
    const list = wrapper.querySelector('.ui-select__list');
    if (!btn || !list || !selectEl) return;

    list.innerHTML = '';

    const selectedOpt = selectEl.options[selectEl.selectedIndex];
    btn.textContent = selectedOpt && selectedOpt.value
      ? selectedOpt.textContent
      : btn.dataset.placeholder || 'Select';

    btn.onclick = () => {
      const isOpen = wrapper.classList.toggle('is-open');
      btn.setAttribute('aria-expanded', String(isOpen));
    };

    [...selectEl.options].forEach(opt => {
      if (!opt.value) return;
      const div = document.createElement('div');
      div.className = 'ui-select__item';
      div.setAttribute('role', 'option');
      div.dataset.value = opt.value;
      div.textContent = opt.textContent;

      div.onclick = () => {
        selectEl.value = opt.value;
        btn.textContent = opt.textContent;
        wrapper.classList.remove('is-open');
        btn.setAttribute('aria-expanded', 'false');
        selectEl.dispatchEvent(new Event('change', { bubbles: true }));
      };

      list.appendChild(div);
    });

    wrapper.classList.toggle('is-selected', !!selectEl.value);
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

  function hasClassification(text) {
    if (!text) return false;
    return /^\([A-Za-z/ -]+\)/.test(text.trim());
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

  function wireClassificationUI(uiSelectEl, textareaEl, type) {
    const btn = uiSelectEl.querySelector('.ui-class__btn');
    const list = uiSelectEl.querySelector('.ui-select__list');
    const select = uiSelectEl.querySelector('select');

    list.innerHTML = '';
    [...select.options].forEach(opt => {
      if (!opt.value) return;
      const div = document.createElement('div');
      div.className = 'ui-option';
      div.textContent = opt.textContent;
      div.dataset.value = opt.value;
      list.appendChild(div);
    });

    btn.addEventListener('click', () => {
      uiSelectEl.classList.toggle('is-open');
      btn.setAttribute('aria-expanded', uiSelectEl.classList.contains('is-open'));
    });

    list.addEventListener('click', e => {
      const option = e.target.closest('.ui-option');
      if (!option) return;

      const prefix = option.dataset.value;
      if (!prefix) return;

      const alreadyClassified = hasClassification(textareaEl.value);
      if (!alreadyClassified) {
        insertPrefixAtCursor(textareaEl, prefix);
        enableTextarea(textareaEl);
      }

      select.value = prefix;
      btn.textContent = prefix;
      uiSelectEl.classList.add('is-selected');

      updateHelperText(type, uiSelectEl);
      updateAllReviews();
      doAutosave();

      uiSelectEl.classList.remove('is-open');
      btn.setAttribute('aria-expanded', 'false');
    });
  }

  function renderEntriesList() {
    document.body.classList.toggle('has-entries', entries.length > 0);
    els.entriesList.innerHTML = '';

    if (entries.length === 0) {
      const p = document.createElement('div');
      p.className = 'entry-meta';
      p.textContent = 'No entries yet — click New';
      els.entriesList.appendChild(p);
      return;
    }

    entries.forEach(en => {
      const item = document.createElement('div');
      item.className = 'entry-item' + (en.id === selectedId ? ' active' : '');
      item.dataset.id = en.id;

      const left = document.createElement('div');
      left.style.flex = '1';

      const title = document.createElement('div');
      title.className = 'entry-title';
      title.textContent = (en.data?.title && en.data.title.trim()) || 'New Entry';

      const meta = document.createElement('div');
      meta.className = 'entry-meta';
      meta.textContent = formatDate(en.updatedAt);

      left.appendChild(title);
      left.appendChild(meta);
      item.appendChild(left);
      item.addEventListener('click', () => selectEntry(en.id));
      els.entriesList.appendChild(item);
    });
  }

  function selectEntry(id) {
    isLoadingEntry = true;

    if (selectedId === id) {
      reviewVisible = !reviewVisible;
    } else {
      selectedId = id;
      reviewVisible = true;
    }

    if (els.newEntry) {
      els.newEntry.classList.toggle('is-hidden', !reviewVisible);
    }

    els.reviewCard.classList.toggle('is-active', reviewVisible);
    els.reviewCard.style.display = reviewVisible ? 'block' : 'none';
    els.reviewCard.classList.toggle('hidden', !reviewVisible);

    if (!reviewVisible) {
      selectedId = null;
      renderEntriesList();
      isLoadingEntry = false;
      return;
    }

    const entry = entries.find(e => e.id === selectedId);
    if (!entry) {
      isLoadingEntry = false;
      return;
    }

    const d = entry.data || {};
    els.ccn.value = d.ccn || '';
    els.title.value = d.title || '';
    els.summary.value = d.summary || '';
    els.status.value = d.status || '';

    initializeClassificationState(entry);

    els.fieldoffice.value = d.fieldoffice || '';
    const foWrapper = els.fieldoffice.closest('.ui-select');
    rebuildUiSelect(foWrapper, els.fieldoffice);

    const soWrapper = els.suboffice.closest('.ui-select');
    els.suboffice.innerHTML = '<option value="">Select SubOffice</option>';

    if (d.fieldoffice) {
      els.subofficeWrapper.classList.remove('is-hidden');
      const subs = fieldOfficeRules
        .filter(r => r.office === d.fieldoffice)
        .map(r => r.sub);

      subs.forEach(sub => {
        const opt = document.createElement('option');
        opt.value = sub;
        opt.textContent = sub;
        els.suboffice.appendChild(opt);
      });

      els.suboffice.value = d.suboffice || '';
    } else {
      els.subofficeWrapper.classList.add('is-hidden');
      els.suboffice.value = '';
    }

    rebuildUiSelect(soWrapper, els.suboffice);
    updateAllReviews();
    renderEntriesList();
    validateAllReviewTerms();
    isLoadingEntry = false;
  }

  function createNewEntry() {
    const e = makeEmptyEntry();
    entries.unshift(e);
    saveEntries();
    renderEntriesList();
    selectEntry(e.id);
    updateAllReviews();
    updateShowAllButtonState();
  }

  function duplicateEntry() {
    if (!selectedId) {
      alert('Select an entry to duplicate');
      return;
    }

    const src = entries.find(e => e.id === selectedId);
    if (!src) return;

    const copy = {
      id: uid(),
      title: (src.title || 'New Entry') + ' (copy)',
      updatedAt: nowISO(),
      data: JSON.parse(JSON.stringify(src.data))
    };

    copy.data.title = (src.data.title || '') + ' (copy)';

    entries.unshift(copy);
    saveEntries();
    selectEntry(copy.id);
    renderEntriesList();
    isLoadingEntry = false;
    updateShowAllButtonState();
  }

  function deleteSelectedEntry(id, opts = {}) {
    const { fromModal = false, quiet = false } = opts;
    const targetId = id || selectedId;
    if (!targetId) {
      alert('No entry selected');
      return;
    }

    const idx = entries.findIndex(e => e.id === targetId);
    if (idx === -1) return;

    if (!quiet) {
      const entryTitle = entries[idx]?.data?.title || 'Untitled';
      const ok = confirm(`Delete "${entryTitle}"?\n\nThis cannot be undone.`);
      if (!ok) return;
    }

    entries.splice(idx, 1);
    saveEntries();

    const deletedWasSelected = selectedId === targetId;
    if (deletedWasSelected) selectedId = null;

    if (entries.length && !fromModal) {
      selectEntry(entries[0].id);
      renderEntriesList();
      return;
    }

    if (!entries.length) {
      reviewVisible = false;
      els.reviewCard.classList.add('hidden');
      els.reviewCard.style.display = 'none';
      els.newEntry.classList.add('is-hidden');

      els.title.value = '';
      els.ccn.value = '';
      els.suboffice.value = '';
      els.fieldoffice.value = '';
      els.summary.value = '';
      els.status.value = '';
    }

    updateAllReviews();
    renderEntriesList();
    updateShowAllButtonState();
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

    const prevTitle = entry.data?.title;
    entry.data = getCurrentFormData();

    if (els.title.disabled) {
      entry.data.title = prevTitle;
    }

    entry.updatedAt = nowISO();
    saveEntries();
    renderEntriesList();
    updateShowAllButtonState();
  }

  const doAutosave = debounce(() => {
    if (!selectedId || isLoadingEntry) return;
    persistCurrentEntry();
  }, 700);

  function updateReview(field, value) {
    const map = {
      title: { node: els.rTitle, row: document.getElementById('r-row-title') },
      ccn: { node: els.rCCN, row: document.getElementById('r-row-ccn') },
      fieldoffice: { node: els.rFieldoffice, row: document.getElementById('r-row-fieldoffice') },
      suboffice: { node: els.rSuboffice, row: document.getElementById('r-row-suboffice') },
      summary: { node: els.rSummary, row: document.getElementById('r-row-summary') },
      status: { node: els.rStatus, row: document.getElementById('r-row-status') }
    };

    const target = map[field];
    if (!target) return;

    target.node.textContent = value ? value : '— not set —';
    if (target.row) {
      target.row.classList.remove('pulse');
      void target.row.offsetWidth;
      target.row.classList.add('pulse');
    }
  }

  function updateAllReviews() {
    const d = getCurrentFormData();
    updateReview('title', d.title);
    updateReview('ccn', d.ccn);
    updateReview('fieldoffice', d.fieldoffice);
    updateReview('suboffice', d.suboffice);
    updateReview('summary', d.summary.trim());
    updateReview('status', d.status.trim());
  }

  function isEntryDataComplete(d) {
    if (!d) return false;
    return (
      (d.title || '').trim().length > 0 &&
      (d.fieldoffice || '').trim().length > 0 &&
      (d.ccn || '').trim().length > 0 &&
      (d.suboffice || '').trim().length > 0 &&
      (d.summary || '').trim().length > 0 &&
      (d.status || '').trim().length > 0
    );
  }

  function areAllEntriesComplete() {
    if (!entries.length) return false;
    return entries.every(entry => isEntryDataComplete(entry.data));
  }

  function updateShowAllButtonState() {
    const complete = areAllEntriesComplete();
    els.btnShowAll.disabled = !complete;
    els.btnShowAll.classList.toggle('is-disabled', !complete);
  }

  function wireInputs() {
    const mapping = [
      ['fieldoffice', 'fieldoffice'],
      ['ccn', 'ccn'],
      ['suboffice', 'suboffice'],
      ['title', 'title'],
      ['summary', 'summary'],
      ['status', 'status']
    ];

    mapping.forEach(([id, field]) => {
      const el = document.getElementById(id);
      if (!el) return;

      el.addEventListener('change', e => {
        updateReview(field, e.target.value);
        updateAllReviews();
        validateAllReviewTerms();
        if (!isLoadingEntry) doAutosave();
        updateShowAllButtonState();
      });

      el.addEventListener('input', e => {
        updateReview(field, e.target.value);
        updateAllReviews();
        validateAllReviewTerms();

        if (field === 'title') {
          const entry = entries.find(en => en.id === selectedId);
          if (entry) entry.data.title = e.target.value;
        }

        renderEntriesList();

        if (!isLoadingEntry) doAutosave();
        updateShowAllButtonState();
      });
    });

    els.fieldoffice.addEventListener('change', () => {
      const fo = els.fieldoffice.value.trim();
      const wrapper = els.suboffice.closest('.ui-select');
      const btn = wrapper.querySelector('.ui-select__btn');

      els.suboffice.innerHTML = '<option value="">Select SubOffice</option>';
      btn.textContent = 'Select Sub Office';
      wrapper.classList.remove('is-selected', 'is-open');
      els.suboffice.value = '';

      if (!fo) {
        els.subofficeWrapper.classList.add('is-hidden');
        updateAllReviews();
        return;
      }

      els.subofficeWrapper.classList.remove('is-hidden');

      const subs = fieldOfficeRules
        .filter(r => r.office === fo)
        .map(r => r.sub);

      subs.forEach(sub => {
        const opt = document.createElement('option');
        opt.value = sub;
        opt.textContent = sub;
        els.suboffice.appendChild(opt);
      });

      rebuildUiSelect(wrapper, els.suboffice);
      updateAllReviews();
      doAutosave();
    });
  }

  async function submitAllEntriesToSharePoint(localEntries) {
    await new Promise(r => setTimeout(r, 600));
    const payload = {
      submittedAt: new Date().toISOString(),
      entries: localEntries
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'nsd-weekly-demo-submission.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    return localEntries;
  }

  function showGlassConfirmEntries(message) {
    return new Promise(resolve => {
      const modal = document.getElementById('glassConfirm');
      const listEl = document.getElementById('glassConfirmList');
      const countEl = document.getElementById('gcCount');
      const pluralEl = document.getElementById('gcCountPlural');
      const okBtn = document.getElementById('confirmOK');
      const cancelBtn = document.getElementById('confirmCancel');
      const box = modal.querySelector('.glass-confirm-box');
      const closeBtn = document.getElementById('gcClose');

      if (message) modal.querySelector('h3').textContent = message;

      const grouped = {};
      (entries || []).forEach(en => {
        const cat = (en.data?.suboffice || 'Uncategorized').trim();
        (grouped[cat] ||= []).push(en);
      });

      listEl.innerHTML = '';
      const categories = Object.keys(grouped).sort((a, b) => a.localeCompare(b));

      categories.forEach(cat => {
        const section = document.createElement('section');
        section.className = 'gc-section';

        const head = document.createElement('div');
        const tintMap = {
          Heading1: 'Heading1',
          Heading2: 'Heading2',
          Heading3: 'Heading3',
          Heading4: 'Heading4',
          Heading5: 'Heading5'
        };
        head.className = `gc-section__head ${tintMap[cat] || 'default'}`;

        const title = document.createElement('div');
        title.className = 'gc-section__title';
        title.textContent = cat;

        const meta = document.createElement('div');
        meta.className = 'gc-section__meta';
        meta.textContent = `${grouped[cat].length} item${grouped[cat].length === 1 ? '' : 's'}`;

        head.appendChild(title);
        head.appendChild(meta);
        section.appendChild(head);

        const grid = document.createElement('div');
        grid.className = 'gc-grid';

        grouped[cat].forEach(en => {
          const d = en.data || {};
          const card = document.createElement('div');
          card.className = 'entry-card';
          card.innerHTML = `
            <div class="entry-card__heading">
              <div class="entry-card__title">${escapeHTML(d.title || en.title || 'Untitled')}</div>
              <div class="entry-card__meta">${escapeHTML(formatDate(en.updatedAt) || '')}</div>
              <button class="gc-edit" data-id="${en.id}" type="button">✎ Edit</button>
              <button class="gc-delete" data-id="${en.id}" type="button">🗑 Delete</button>
            </div>
            <div class="entry-grid">
              <div class="label">Category</div>
              <div class="value">${escapeHTML(d.ccn || '—')}</div>

              <div class="label">Field Office</div>
              <div class="value">${escapeHTML(d.fieldoffice || '—')}</div>

              <div class="label">Sub Office</div>
              <div class="value">${escapeHTML(d.suboffice || '—')}</div>

              <div class="label">Summary</div>
              <div class="value">${escapeHTML(d.summary || '—')}</div>

              <div class="label">Status</div>
              <div class="value">${escapeHTML(d.status || '—')}</div>
            </div>
          `;
          grid.appendChild(card);
        });

        section.appendChild(grid);
        listEl.appendChild(section);
      });

      const n = (entries || []).length;
      countEl.textContent = n;
      pluralEl.textContent = n === 1 ? 'y' : 'ies';

      modal.classList.remove('hidden');
      requestAnimationFrame(() => modal.classList.add('show'));

      const cleanup = result => {
        modal.classList.remove('show');
        setTimeout(() => modal.classList.add('hidden'), 350);
        okBtn.removeEventListener('click', onOK);
        cancelBtn.removeEventListener('click', onCancel);
        closeBtn.removeEventListener('click', onCancel);
        modal.removeEventListener('click', onBackdrop);
        document.removeEventListener('keydown', onKey);
        listEl.removeEventListener('click', onListClick);
        resolve(result);
      };

      const onOK = async () => {
        try {
          okBtn.disabled = true;
          cancelBtn.disabled = true;
          closeBtn.disabled = true;

          persistCurrentEntry();
          const created = await submitAllEntriesToSharePoint(entries || []);

          alert(`${created.length} entr${created.length === 1 ? 'y was' : 'ies were'} submitted.\nA JSON file was downloaded locally.`);
          cleanup(true);
        } catch (err) {
          console.error(err);
          alert('Submit failed:\n\n' + (err && err.message ? err.message : err));
          okBtn.disabled = false;
          cancelBtn.disabled = false;
          closeBtn.disabled = false;
        }
      };

      const onCancel = () => cleanup(false);
      const onBackdrop = e => { if (!box.contains(e.target)) cleanup(false); };
      const onKey = e => {
        if (e.key === 'Escape') cleanup(false);
      };

      const onListClick = ev => {
        const editBtn = ev.target.closest('.gc-edit');
        if (editBtn) {
          const id = editBtn.dataset.id;
          onCancel();
          setTimeout(() => {
            selectEntry(id);
            renderEntriesList();
            document.getElementById('title')?.focus();
          }, 0);
          return;
        }

        const delBtn = ev.target.closest('.gc-delete');
        if (delBtn) {
          ev.preventDefault();
          ev.stopPropagation();
          const id = delBtn.dataset.id;
          selectEntry(id);
          renderEntriesList();
          cleanup(true);
          setTimeout(() => {
            deleteSelectedEntry(id, { quiet: true, fromModal: false });
          }, 0);
        }
      };

      okBtn.addEventListener('click', onOK);
      cancelBtn.addEventListener('click', onCancel);
      closeBtn.addEventListener('click', onCancel);
      modal.addEventListener('click', onBackdrop);
      document.addEventListener('keydown', onKey);
      listEl.addEventListener('click', onListClick);

      okBtn.focus();
    });
  }

  function closeOpenSelectsOnOutsideClick(selector) {
    document.addEventListener('click', e => {
      document.querySelectorAll(selector).forEach(select => {
        if (!select.contains(e.target)) {
          select.classList.remove('is-open');
        }
      });
    });
  }

  async function init() {
    selectedId = null;
    reviewVisible = false;

    updateShowAllButtonState();
    els.subofficeWrapper.classList.add('is-hidden');

    if (els.btnShowAll) {
      els.btnShowAll.addEventListener('click', async () => {
        await showGlassConfirmEntries('All entries');
      });
    }

    loadEntries();
    classifications = await loadClassifications();
    fieldOfficeRules = await loadFieldOfficeRules();
    await loadReviewTerms();
    enableNativeSpellcheck();

    await populateFieldDropdown(
      'fieldoffice',
      [...new Set(fieldOfficeRules.map(r => r.office))],
      ''
    );

    await loadClassificationsDropdown();

    wireClassificationUI(
      document.querySelector('#titleClassDropdown').closest('.class-select'),
      els.title,
      'title'
    );

    wireClassificationUI(
      document.querySelector('#summaryClassDropdown').closest('.class-select'),
      els.summary,
      'summary'
    );

    wireClassificationUI(
      document.querySelector('#statusClassDropdown').closest('.class-select'),
      els.status,
      'status'
    );

    if (entries.length === 0) {
      entries.push(makeEmptyEntry());
      saveEntries();
    }

    renderEntriesList();
    selectEntry(entries[0].id);

    els.btnNewEntry.addEventListener('click', createNewEntry);
    els.btnDuplicateEntry.addEventListener('click', duplicateEntry);
    els.btnDeleteEntry.addEventListener('click', () => {
      if (!selectedId) {
        alert('Select an entry to delete');
        return;
      }
      deleteSelectedEntry(selectedId);
    });

    wireInputs();
    closeOpenSelectsOnOutsideClick('.class-select.is-open');
    closeOpenSelectsOnOutsideClick('.ui-select.is-open');

    window.addEventListener('beforeunload', () => {
      persistCurrentEntry();
      saveEntries();
    });
  }

  init();
})();
