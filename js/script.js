// ---------- theme toggle (runs immediately, independent of the rest of the app) ----------
(function () {
  const STORAGE_KEY = 'srm-theme';
  const root = document.documentElement;
  const btn = document.getElementById('themeToggleBtn');
  function apply(theme) {
    if (theme === 'light' || theme === 'dark') root.setAttribute('data-theme', theme);
    else root.removeAttribute('data-theme');
    btn.textContent = theme === 'dark' ? '☾' : theme === 'light' ? '☀' : '◑';
    btn.title = theme === 'dark' ? 'Dark theme (click for light)' : theme === 'light' ? 'Light theme (click for system)' : 'Following system theme (click to override)';
  }
  let saved = null;
  try { saved = localStorage.getItem(STORAGE_KEY); } catch (e) {}
  apply(saved);
  btn.addEventListener('click', () => {
    const current = root.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : current === 'light' ? null : 'dark';
    apply(next);
    try { if (next) localStorage.setItem(STORAGE_KEY, next); else localStorage.removeItem(STORAGE_KEY); } catch (e) {}
  });
})();

// ---------- accessibility bootstrap: aria-live regions, labels for icon-only / placeholder-only controls ----------
(function () {
  document.querySelectorAll('.demo-log, #historyHint, #kthResult, #searchResult, #saveHint, #tourBannerText').forEach(el => {
    el.setAttribute('aria-live', 'polite');
    el.setAttribute('role', 'status');
  });
  document.querySelectorAll('.stack-frames, .queue-row, .hash-buckets').forEach(el => el.setAttribute('aria-live', 'polite'));

  const labelMap = {
    themeToggleBtn: 'Toggle light or dark theme',
    searchInput: 'Search a student by name',
    kthInput: 'Rank number to look up',
    bsearchInput: 'Marks value to find with binary search',
    linearSearchInput: 'Name to find with linear search',
    twosumInput: 'Target sum for the pair-finding search',
    windowInput: 'Sliding window size',
    hashLabInput: 'Word to insert into the hash table',
    recurLabInput: 'Value of n for factorial',
    graphStartSelect: 'Starting node for the graph traversal',
    raceAlgoA: 'First algorithm in the race',
    raceAlgoB: 'Second algorithm in the race',
    searchLabTarget: 'Value to search for',
    sortSpeedSlider: 'Animation speed', searchSpeedSlider: 'Animation speed', structSpeedSlider: 'Animation speed',
    snakeSpeedSlider: 'Animation speed', snakeSizeSlider: 'Number of practice values',
  };
  Object.entries(labelMap).forEach(([id, label]) => {
    const el = document.getElementById(id);
    if (el && !el.getAttribute('aria-label')) el.setAttribute('aria-label', label);
  });
})();

(function () {
  let students = [];
  let lastAddedName = null;
  const history = []; // undo stack (LIFO) — each entry knows how to reverse itself

  // shared animation speed — one control, used by every sleep() call across the whole app
  let globalSpeedFactor = 1;
  const SPEED_FACTORS = { 1: 1.8, 2: 1.35, 3: 1, 4: 0.6, 5: 0.3 };
  const SPEED_LABELS = { 1: 'Slowest', 2: 'Slow', 3: 'Normal', 4: 'Fast', 5: 'Fastest' };
  function sleep(ms) { return new Promise(r => setTimeout(r, ms * globalSpeedFactor)); }

  function wireSpeedSlider(id, tagId) {
    const slider = document.getElementById(id), tag = document.getElementById(tagId);
    if (!slider) return null;
    slider.addEventListener('input', () => {
      globalSpeedFactor = SPEED_FACTORS[slider.value];
      tag.textContent = SPEED_LABELS[slider.value];
      syncSpeedSliders(slider.value);
    });
    return slider;
  }
  const speedSliderIds = [['sortSpeedSlider', 'sortSpeedTag'], ['searchSpeedSlider', 'searchSpeedTag'], ['structSpeedSlider', 'structSpeedTag']];
  function syncSpeedSliders(value) {
    speedSliderIds.forEach(([sId, tId]) => {
      const s = document.getElementById(sId), t = document.getElementById(tId);
      if (s) s.value = value;
      if (t) t.textContent = SPEED_LABELS[value];
    });
  }
  speedSliderIds.forEach(([sId, tId]) => wireSpeedSlider(sId, tId));

  // ---------- tabs ----------
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabPanels = document.querySelectorAll('.tab-panel');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => { b.classList.remove('active'); b.setAttribute('aria-selected', 'false'); });
      tabPanels.forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      document.querySelector('.tab-panel[data-tab-panel="' + btn.dataset.tab + '"]').classList.add('active');
      if (btn.dataset.tab === 'snake' && typeof snakeOnTabOpen === 'function') snakeOnTabOpen();
    });
  });

  // ---------- element refs ----------
  const rows = document.getElementById('rows');
  const nameInput = document.getElementById('name');
  const marksInput = document.getElementById('marks');
  const searchInput = document.getElementById('searchInput');
  const searchResult = document.getElementById('searchResult');
  const topperVal = document.getElementById('topperVal');
  const avgVal = document.getElementById('avgVal');
  const countVal = document.getElementById('countVal');
  const undoBtn = document.getElementById('undoBtn');
  const redoBtn = document.getElementById('redoBtn');
  const redoStack = [];
  const historyHint = document.getElementById('historyHint');
  const kthInput = document.getElementById('kthInput');
  const kthResult = document.getElementById('kthResult');
  const barray = document.getElementById('barray');
  const bsearchLog = document.getElementById('bsearchLog');
  const bsearchInput = document.getElementById('bsearchInput');
  const gradeBars = document.getElementById('gradeBars');
  const queueRow = document.getElementById('queueRow');

  // marks -> letter grade
  function getGrade(marks) {
    if (marks >= 90) return 'A';
    if (marks >= 75) return 'B';
    if (marks >= 60) return 'C';
    if (marks >= 40) return 'D';
    return 'F';
  }
  const GRADE_COLORS = { A: 'var(--accent)', B: 'var(--gold)', C: 'var(--text-muted)', D: 'var(--danger)', F: 'var(--danger)' };

  function cellHtml(s, cls, pointerText) {
    return '<div class="cell ' + (cls || '') + '">' +
      (pointerText ? '<span class="pointer">' + pointerText + '</span>' : '') +
      '<span class="nm">' + s.name + '</span>' + s.marks + '</div>';
  }

  // ---------- queue (FIFO) ----------
  const RECENT_LIMIT = 5;
  const recentQueue = [];
  function enqueueRecent(name) {
    recentQueue.push(name);
    if (recentQueue.length > RECENT_LIMIT) recentQueue.shift();
    renderQueue();
  }
  function renderQueue() {
    queueRow.innerHTML = '';
    if (recentQueue.length === 0) {
      queueRow.innerHTML = '<div class="empty-msg">No additions yet.</div>';
      return;
    }
    let html = '<span class="queue-end-label">front</span>';
    recentQueue.forEach((name, i) => {
      if (i > 0) html += '<span class="queue-arrow">&larr;</span>';
      html += '<span class="qcell' + (i === 0 ? ' front' : '') + '">' + name + '</span>';
    });
    html += '<span class="queue-end-label">back</span>';
    queueRow.innerHTML = html;
  }

  // ---------- grade distribution (HashMap) ----------
  function renderGradeDistribution() {
    const counts = { A: 0, B: 0, C: 0, D: 0, F: 0 };
    students.forEach(s => { counts[getGrade(s.marks)]++; });
    const max = Math.max(...Object.values(counts), 1);
    gradeBars.innerHTML = '';
    const fills = [];
    Object.entries(counts).forEach(([grade, count], i) => {
      const row = document.createElement('div');
      row.className = 'grade-bar-row';
      const pct = Math.round((count / max) * 100);
      row.innerHTML =
        '<span class="glabel" style="color:' + GRADE_COLORS[grade] + '">' + grade + '</span>' +
        '<span class="gtrack"><span class="gfill" style="width:0%; background:' + GRADE_COLORS[grade] + '; transition-delay:' + (i * 90) + 'ms"></span></span>' +
        '<span class="gcount">' + count + '</span>';
      gradeBars.appendChild(row);
      fills.push({ el: row.querySelector('.gfill'), pct });
    });
    void gradeBars.offsetWidth;
    fills.forEach(f => { f.el.style.width = f.pct + '%'; });
  }

  // ---------- main render ----------
  function render() {
    const sorted = [...students].sort((a, b) => b.marks - a.marks);
    rows.innerHTML = '';
    if (sorted.length === 0) {
      rows.innerHTML = '<div class="empty-msg">No students yet — add one above to get started.</div>';
    } else {
      const maxMarks = Math.max(...sorted.map(s => s.marks), 1);
      sorted.forEach((s, i) => {
        const row = document.createElement('div');
        row.className = 'row' + (i === 0 ? ' rank1' : '') + (s.name === lastAddedName ? ' new' : '');
        const pct = Math.max(4, Math.round((s.marks / maxMarks) * 100));
        const grade = getGrade(s.marks);
        row.innerHTML =
          '<span class="rank">' + (i + 1) + (i === 0 ? ' &#9733;' : '') + '</span>' +
          '<span class="mid"><span class="name">' + s.name + ' <span class="grade-badge g-' + grade + '">' + grade + '</span></span>' +
          '<span class="bar-track"><span class="bar-fill" style="width:' + pct + '%"></span></span></span>' +
          '<span class="marks">' + s.marks + '<button class="del-btn" data-name="' + s.name + '" title="Delete" aria-label="Delete ' + s.name + '">&times;</button></span>';
        rows.appendChild(row);
      });
      rows.querySelectorAll('.del-btn').forEach(btn => {
        btn.addEventListener('click', () => deleteStudent(btn.dataset.name));
      });
    }

    if (students.length > 0) {
      const topper = sorted[0];
      const avg = students.reduce((sum, s) => sum + s.marks, 0) / students.length;
      topperVal.textContent = topper.name + ' (' + topper.marks + ')';
      avgVal.textContent = avg.toFixed(1);
    } else {
      topperVal.textContent = '—';
      avgVal.textContent = '—';
    }
    countVal.textContent = students.length;
    lastAddedName = null;
    updateHistoryButtons();

    renderBinaryArray();
    renderGradeDistribution();
    renderStaticCell('twosumArray');
    renderStaticCell('reverseArray');
    renderStaticCell('dupArray');
    renderStaticCell('windowArray');
    renderStaticCell('bubbleArray');
    renderStaticCell('selectionArray');
    renderStaticCell('insertionArray');
    renderStaticCell('mergeArray');
    renderStaticCell('linearSearchArray');
    renderStaticCell('raceArrayA');
    renderStaticCell('raceArrayB');
  }

  function renderStaticCell(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = students.map(s => cellHtml(s)).join('');
  }

  // ---------- add / delete / undo / redo ----------
  function addStudent(name, marks, recordHistory = true) {
    students.push({ name, marks });
    lastAddedName = name;
    if (recordHistory) { history.push({ type: 'add', name, marks }); redoStack.length = 0; }
    enqueueRecent(name);
    render();
  }
  function deleteStudent(name, recordHistory = true) {
    const idx = students.findIndex(s => s.name === name);
    if (idx === -1) return;
    const [removed] = students.splice(idx, 1);
    if (recordHistory) { history.push({ type: 'delete', student: removed, index: idx }); redoStack.length = 0; }
    render();
  }
  function updateHistoryButtons() {
    undoBtn.disabled = history.length === 0;
    redoBtn.disabled = redoStack.length === 0;
    historyHint.textContent = history.length ? history.length + ' action(s) on the undo stack' : (redoStack.length ? redoStack.length + ' action(s) available to redo' : '');
  }
  undoBtn.addEventListener('click', () => {
    const action = history.pop();
    if (!action) return;
    if (action.type === 'add') deleteStudent(action.name, false);
    else if (action.type === 'delete') { students.splice(action.index, 0, action.student); lastAddedName = action.student.name; render(); }
    redoStack.push(action); // undo pushes onto the Redo stack — a second Stack (LIFO), mirroring Undo
    updateHistoryButtons();
  });
  redoBtn.addEventListener('click', () => {
    const action = redoStack.pop();
    if (!action) return;
    if (action.type === 'add') addStudent(action.name, action.marks, false);
    else if (action.type === 'delete') deleteStudent(action.student.name, false);
    history.push(action); // redoing restores it to the Undo stack, so it can be undone again
    updateHistoryButtons();
  });

  // ---------- save / load class list via localStorage ----------
  const SAVE_KEY = 'srm-saved-class';
  const saveHint = document.getElementById('saveHint');
  function refreshSaveHint() {
    let saved = null;
    try { saved = localStorage.getItem(SAVE_KEY); } catch (e) {}
    if (!saved) { saveHint.textContent = 'No saved class yet.'; return; }
    try {
      const parsed = JSON.parse(saved);
      saveHint.textContent = 'Saved: ' + parsed.length + ' student(s).';
    } catch (e) { saveHint.textContent = 'No saved class yet.'; }
  }
  document.getElementById('saveBtn').addEventListener('click', () => {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(students));
      saveHint.textContent = 'Saved ' + students.length + ' student(s) to this browser.';
    } catch (e) {
      saveHint.textContent = 'Could not save — browser storage unavailable.';
    }
  });
  document.getElementById('loadBtn').addEventListener('click', () => {
    let saved = null;
    try { saved = localStorage.getItem(SAVE_KEY); } catch (e) {}
    if (!saved) { saveHint.textContent = 'No saved class to load.'; return; }
    try {
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) throw new Error('bad data');
      students = parsed;
      history.length = 0; redoStack.length = 0;
      render();
      saveHint.textContent = 'Loaded ' + parsed.length + ' student(s) from this browser.';
    } catch (e) {
      saveHint.textContent = 'Saved data was invalid and could not be loaded.';
    }
  });
  document.getElementById('clearSavedBtn').addEventListener('click', () => {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
    refreshSaveHint();
  });
  refreshSaveHint();

  document.getElementById('kthBtn').addEventListener('click', () => {
    const k = parseInt(kthInput.value, 10);
    if (Number.isNaN(k) || k < 1 || k > students.length) {
      kthResult.textContent = 'Enter a valid rank between 1 and ' + students.length + '.';
      kthResult.style.color = 'var(--danger)';
      return;
    }
    const sorted = [...students].sort((a, b) => b.marks - a.marks);
    const s = sorted[k - 1];
    kthResult.textContent = '#' + k + ' highest → ' + s.name + ' (' + s.marks + ' marks)';
    kthResult.style.color = 'var(--accent)';
  });

  // ---------- binary search ----------
  function renderBinaryArray(highlight) {
    const sortedAsc = [...students].sort((a, b) => a.marks - b.marks);
    barray.innerHTML = sortedAsc.map((s, i) => {
      let cls = '', pointerText = '';
      if (highlight) {
        if (i < highlight.low || i > highlight.high) cls = 'cell-discarded';
        else if (i === highlight.mid) { cls = highlight.hit ? 'cell-hit' : 'cell-compare'; pointerText = highlight.hit ? 'FOUND' : 'MID'; }
        else cls = 'cell-range';
      }
      return cellHtml(s, cls, pointerText);
    }).join('');
  }

  async function binarySearch(targetMarks) {
    const sortedAsc = [...students].sort((a, b) => a.marks - b.marks);
    let low = 0, high = sortedAsc.length - 1, step = 0;
    bsearchLog.innerHTML = 'Sorted ascending — searching for ' + targetMarks + ' marks...';
    await sleep(300);
    while (low <= high) {
      step++;
      const mid = Math.floor((low + high) / 2);
      const midMarks = sortedAsc[mid].marks;
      renderBinaryArray({ low, high, mid });
      bsearchLog.innerHTML = 'Step ' + step + ': low=' + low + ', high=' + high + ', mid=' + mid + ' → checking ' + sortedAsc[mid].name + ' (' + midMarks + ' marks)';
      await sleep(600);
      if (midMarks === targetMarks) {
        renderBinaryArray({ low, high, mid, hit: true });
        bsearchLog.innerHTML = '<span class="ok">Found ' + sortedAsc[mid].name + ' with ' + targetMarks + ' marks in ' + step + ' step(s).</span>';
        return;
      } else if (midMarks < targetMarks) low = mid + 1;
      else high = mid - 1;
    }
    bsearchLog.innerHTML = '<span class="no">No student with exactly ' + targetMarks + ' marks (' + step + ' step(s) checked).</span>';
    renderBinaryArray();
  }
  document.getElementById('bsearchBtn').addEventListener('click', () => {
    const target = parseInt(bsearchInput.value, 10);
    if (Number.isNaN(target)) return;
    binarySearch(target);
  });
  bsearchInput.addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('bsearchBtn').click(); });

  // ---------- linear search (its own animated demo) ----------
  const linearSearchArray = document.getElementById('linearSearchArray');
  const linearSearchLog = document.getElementById('linearSearchLog');
  const linearSearchInput = document.getElementById('linearSearchInput');
  const linearSearchBtn = document.getElementById('linearSearchBtn');

  function renderLinearArray(highlight) {
    linearSearchArray.innerHTML = students.map((s, i) => {
      let cls = '', pointerText = '';
      if (highlight) {
        if (i === highlight.at) { cls = highlight.hit ? 'cell-hit' : 'cell-checking'; pointerText = highlight.hit ? 'FOUND' : 'CHECK'; }
        else if (i < highlight.at) cls = 'cell-seen';
      }
      return cellHtml(s, cls, pointerText);
    }).join('');
  }

  async function runLinearSearch(query) {
    if (students.length === 0) { linearSearchLog.textContent = 'Add at least 1 student first.'; return; }
    linearSearchBtn.disabled = true;
    for (let i = 0; i < students.length; i++) {
      linearSearchLog.textContent = 'Checking index ' + i + ': ' + students[i].name;
      renderLinearArray({ at: i });
      await sleep(450);
      if (students[i].name.toLowerCase() === query) {
        renderLinearArray({ at: i, hit: true });
        linearSearchLog.innerHTML = '<span class="ok">Found ' + students[i].name + ' (' + students[i].marks + ' marks) after ' + (i + 1) + ' check(s).</span>';
        linearSearchBtn.disabled = false;
        return;
      }
    }
    renderLinearArray();
    linearSearchLog.innerHTML = '<span class="no">Not found — checked all ' + students.length + ' student(s).</span>';
    linearSearchBtn.disabled = false;
  }
  linearSearchBtn.addEventListener('click', () => {
    const q = linearSearchInput.value.trim().toLowerCase();
    if (!q) return;
    runLinearSearch(q);
  });
  linearSearchInput.addEventListener('keydown', e => { if (e.key === 'Enter') linearSearchBtn.click(); });

  document.getElementById('searchBtn').addEventListener('click', () => {
    const query = searchInput.value.trim().toLowerCase();
    if (!query) return;
    let steps = 0, found = null;
    for (const s of students) {
      steps++;
      if (s.name.toLowerCase() === query) { found = s; break; }
    }
    if (found) {
      searchResult.textContent = 'Found: ' + found.name + ' scored ' + found.marks + ' marks (checked ' + steps + ' student(s)).';
      searchResult.className = 'found';
    } else {
      searchResult.textContent = '"' + searchInput.value.trim() + '" not found (checked all ' + steps + ' student(s)).';
      searchResult.className = 'notfound';
    }
  });
  searchInput.addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('searchBtn').click(); });

  // ---------- Trie-based autocomplete for the search box ----------
  (function () {
    const suggestBox = document.getElementById('trieSuggestions');
    let activeIndex = -1;

    class TrieNode {
      constructor() { this.children = {}; this.isEnd = false; }
    }
    function buildTrie(names) {
      const root = new TrieNode();
      names.forEach(name => {
        let node = root;
        for (const ch of name.toLowerCase()) {
          if (!node.children[ch]) node.children[ch] = new TrieNode();
          node = node.children[ch];
        }
        node.isEnd = true;
      });
      return root;
    }
    function namesWithPrefix(prefix) {
      const root = buildTrie(students.map(s => s.name));
      let node = root;
      for (const ch of prefix.toLowerCase()) {
        if (!node.children[ch]) return []; // prefix not present in the Trie at all
        node = node.children[ch];
      }
      // node now sits at the end of the prefix — collect every complete name reachable from here
      const results = [];
      (function collect(n, path) {
        if (n.isEnd) results.push(prefix.toLowerCase() + path);
        for (const ch of Object.keys(n.children)) collect(n.children[ch], path + ch);
      })(node, '');
      return results;
    }

    function closeSuggestions() {
      suggestBox.classList.remove('open'); suggestBox.innerHTML = ''; activeIndex = -1;
      searchInput.setAttribute('aria-expanded', 'false');
      searchInput.removeAttribute('aria-activedescendant');
    }

    function renderSuggestions(matches, prefix) {
      if (matches.length === 0) { closeSuggestions(); return; }
      suggestBox.innerHTML = matches.slice(0, 8).map((nameLower, i) => {
        const student = students.find(s => s.name.toLowerCase() === nameLower);
        const display = student ? student.name : nameLower;
        const bold = display.slice(0, prefix.length);
        const rest = display.slice(prefix.length);
        return '<div class="trie-suggestion-item' + (i === activeIndex ? ' active' : '') + '" data-name="' + display + '" ' +
          'id="trie-opt-' + i + '" role="option" aria-selected="' + (i === activeIndex) + '">' +
          '<span><span class="match">' + bold + '</span>' + rest + '</span>' +
          '<span class="marks-tag">' + (student ? student.marks : '') + '</span></div>';
      }).join('');
      suggestBox.classList.add('open');
      searchInput.setAttribute('aria-expanded', 'true');
      if (activeIndex >= 0) searchInput.setAttribute('aria-activedescendant', 'trie-opt-' + activeIndex);
      else searchInput.removeAttribute('aria-activedescendant');
      suggestBox.querySelectorAll('.trie-suggestion-item').forEach(item => {
        item.addEventListener('click', () => {
          searchInput.value = item.dataset.name;
          closeSuggestions();
          document.getElementById('searchBtn').click();
        });
      });
    }

    searchInput.addEventListener('input', () => {
      const prefix = searchInput.value.trim();
      activeIndex = -1;
      if (!prefix) { closeSuggestions(); return; }
      renderSuggestions(namesWithPrefix(prefix), prefix);
    });
    searchInput.addEventListener('keydown', e => {
      const items = suggestBox.querySelectorAll('.trie-suggestion-item');
      if (!items.length) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); activeIndex = Math.min(activeIndex + 1, items.length - 1); renderSuggestions(namesWithPrefix(searchInput.value.trim()), searchInput.value.trim()); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); activeIndex = Math.max(activeIndex - 1, 0); renderSuggestions(namesWithPrefix(searchInput.value.trim()), searchInput.value.trim()); }
      else if (e.key === 'Enter' && activeIndex >= 0 && items[activeIndex]) { e.preventDefault(); items[activeIndex].click(); }
      else if (e.key === 'Escape') closeSuggestions();
    });
    document.addEventListener('click', e => { if (!e.target.closest('.search-input-wrap')) closeSuggestions(); });
  })();

  // ---------- generic animated sort runner ----------
  async function runComparisonSort(opts) {
    const { btn, arrayId, logEl, algoName, compareFn } = opts;
    if (students.length < 2) { logEl.textContent = 'Add at least 2 students first.'; return; }
    btn.disabled = true;
    const arr = students.map(s => ({ ...s }));
    await compareFn(arr, arrayId, logEl);
    btn.disabled = false;
  }

  function paintCells(arrayId, arr, classForIndex) {
    document.getElementById(arrayId).innerHTML = arr.map((s, i) => {
      const c = classForIndex(i);
      return cellHtml(s, c.cls, c.pointer);
    }).join('');
  }

  // Named, reusable sorting-algorithm implementations — used by both the individual
  // "Run X sort" buttons below and the Algorithm Race feature.
  const ALGO_FNS = {
    bubble: async (arr, arrayId, logEl) => {
      const n = arr.length; let comparisons = 0, swaps = 0;
      paintCells(arrayId, arr, () => ({}));
      await sleep(250);
      for (let pass = 0; pass < n - 1; pass++) {
        let swapped = false;
        for (let i = 0; i < n - pass - 1; i++) {
          comparisons++;
          logEl.textContent = 'Pass ' + (pass + 1) + ': comparing ' + arr[i].name + ' and ' + arr[i + 1].name;
          paintCells(arrayId, arr, idx => idx === i || idx === i + 1 ? { cls: 'cell-compare' } : idx >= n - pass ? { cls: 'cell-settled' } : {});
          await sleep(400);
          if (arr[i].marks > arr[i + 1].marks) {
            [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]]; swaps++; swapped = true;
            paintCells(arrayId, arr, idx => idx === i || idx === i + 1 ? { cls: 'cell-swap' } : idx >= n - pass ? { cls: 'cell-settled' } : {});
            await sleep(350);
          }
        }
        if (!swapped) break;
      }
      paintCells(arrayId, arr, () => ({ cls: 'cell-settled' }));
      logEl.innerHTML = '<span class="done">Sorted in ' + comparisons + ' comparison(s), ' + swaps + ' swap(s).</span>';
      return { comparisons };
    },
    selection: async (arr, arrayId, logEl) => {
      const n = arr.length; let comparisons = 0, swaps = 0;
      paintCells(arrayId, arr, () => ({}));
      await sleep(250);
      for (let i = 0; i < n - 1; i++) {
        let minIdx = i;
        for (let j = i + 1; j < n; j++) {
          comparisons++;
          logEl.textContent = 'Pass ' + (i + 1) + ': current min is ' + arr[minIdx].name + ', checking ' + arr[j].name;
          paintCells(arrayId, arr, idx => idx === minIdx ? { cls: 'cell-active', pointer: 'MIN' } : idx === j ? { cls: 'cell-compare' } : idx < i ? { cls: 'cell-settled' } : {});
          await sleep(380);
          if (arr[j].marks < arr[minIdx].marks) minIdx = j;
        }
        if (minIdx !== i) {
          [arr[i], arr[minIdx]] = [arr[minIdx], arr[i]]; swaps++;
          paintCells(arrayId, arr, idx => idx === i ? { cls: 'cell-swap' } : idx <= i ? { cls: 'cell-settled' } : {});
          await sleep(350);
        }
      }
      paintCells(arrayId, arr, () => ({ cls: 'cell-settled' }));
      logEl.innerHTML = '<span class="done">Sorted in ' + comparisons + ' comparison(s), ' + swaps + ' swap(s).</span>';
      return { comparisons };
    },
    insertion: async (arr, arrayId, logEl) => {
      const n = arr.length; let comparisons = 0, shifts = 0;
      paintCells(arrayId, arr, idx => idx === 0 ? { cls: 'cell-settled' } : {});
      await sleep(250);
      for (let i = 1; i < n; i++) {
        const key = arr[i];
        let j = i - 1;
        logEl.textContent = 'Inserting ' + key.name + ' (' + key.marks + ') into the sorted portion';
        paintCells(arrayId, arr, idx => idx === i ? { cls: 'cell-active', pointer: 'KEY' } : idx < i ? { cls: 'cell-settled' } : {});
        await sleep(400);
        while (j >= 0) {
          comparisons++;
          if (arr[j].marks > key.marks) {
            arr[j + 1] = arr[j]; shifts++; j--;
            paintCells(arrayId, arr, idx => idx === j + 1 ? { cls: 'cell-swap' } : idx <= i ? { cls: 'cell-settled' } : {});
            await sleep(320);
          } else break;
        }
        arr[j + 1] = key;
        paintCells(arrayId, arr, idx => idx <= i ? { cls: 'cell-settled' } : {});
        await sleep(200);
      }
      logEl.innerHTML = '<span class="done">Sorted in ' + comparisons + ' comparison(s), ' + shifts + ' shift(s).</span>';
      return { comparisons };
    },
    merge: async (arr, arrayId, logEl) => {
      let comparisons = 0;
      const steps = [];
      function mergeSort(a, depth) {
        if (a.length <= 1) return a;
        const mid = Math.floor(a.length / 2);
        const left = mergeSort(a.slice(0, mid), depth + 1);
        const right = mergeSort(a.slice(mid), depth + 1);
        steps.push({ type: 'split', left: left.map(s => s.name), right: right.map(s => s.name) });
        const merged = [];
        let i = 0, j = 0;
        while (i < left.length && j < right.length) {
          comparisons++;
          if (left[i].marks <= right[j].marks) merged.push(left[i++]);
          else merged.push(right[j++]);
        }
        while (i < left.length) merged.push(left[i++]);
        while (j < right.length) merged.push(right[j++]);
        steps.push({ type: 'merge', result: merged.map(s => s.name) });
        return merged;
      }
      const sorted = mergeSort(arr, 0);
      for (const step of steps) {
        if (step.type === 'split') logEl.textContent = 'Merging [' + step.left.join(', ') + '] with [' + step.right.join(', ') + ']';
        else logEl.textContent = '→ merged into [' + step.result.join(', ') + ']';
        await sleep(450);
      }
      paintCells(arrayId, sorted, () => ({ cls: 'cell-settled' }));
      arr.length = 0; arr.push(...sorted);
      logEl.innerHTML = '<span class="done">Sorted via divide &amp; conquer, ' + comparisons + ' merge comparison(s).</span>';
      return { comparisons };
    }
  };

  document.getElementById('bubbleBtn').addEventListener('click', () => {
    const btn = document.getElementById('bubbleBtn');
    if (document.getElementById('quizModeToggle').checked) {
      runBubbleQuiz(btn, 'bubbleArray', document.getElementById('bubbleLog'));
    } else {
      runComparisonSort({ btn, arrayId: 'bubbleArray', logEl: document.getElementById('bubbleLog'), algoName: 'Bubble Sort', compareFn: ALGO_FNS.bubble });
    }
  });

  // ---------- Quiz Mode: predict each comparison's outcome before it's revealed ----------
  const quizPrompt = document.getElementById('quizPrompt');
  const quizQuestion = document.getElementById('quizQuestion');
  const quizFeedback = document.getElementById('quizFeedback');
  const quizSwapBtn = document.getElementById('quizSwapBtn');
  const quizNoSwapBtn = document.getElementById('quizNoSwapBtn');

  function askQuiz(question) {
    return new Promise(resolve => {
      quizQuestion.textContent = question;
      quizFeedback.textContent = '';
      quizFeedback.className = 'quiz-feedback';
      quizPrompt.classList.add('open');
      quizSwapBtn.disabled = false; quizNoSwapBtn.disabled = false;
      function onAnswer(guess) {
        quizSwapBtn.disabled = true; quizNoSwapBtn.disabled = true;
        quizSwapBtn.removeEventListener('click', swapHandler);
        quizNoSwapBtn.removeEventListener('click', noSwapHandler);
        resolve(guess);
      }
      function swapHandler() { onAnswer(true); }
      function noSwapHandler() { onAnswer(false); }
      quizSwapBtn.addEventListener('click', swapHandler);
      quizNoSwapBtn.addEventListener('click', noSwapHandler);
    });
  }

  async function runBubbleQuiz(btn, arrayId, logEl) {
    if (students.length < 2) { logEl.textContent = 'Add at least 2 students first.'; return; }
    btn.disabled = true;
    const arr = students.map(s => ({ ...s }));
    const n = arr.length;
    let correct = 0, total = 0;
    paintCells(arrayId, arr, () => ({}));
    await sleep(250);

    for (let pass = 0; pass < n - 1; pass++) {
      let swapped = false;
      for (let i = 0; i < n - pass - 1; i++) {
        paintCells(arrayId, arr, idx => idx === i || idx === i + 1 ? { cls: 'cell-compare' } : idx >= n - pass ? { cls: 'cell-settled' } : {});
        logEl.textContent = 'Pass ' + (pass + 1) + ': comparing ' + arr[i].name + ' (' + arr[i].marks + ') and ' + arr[i + 1].name + ' (' + arr[i + 1].marks + ')';

        const willSwap = arr[i].marks > arr[i + 1].marks;
        const guess = await askQuiz('Will ' + arr[i].name + ' (' + arr[i].marks + ') and ' + arr[i + 1].name + ' (' + arr[i + 1].marks + ') swap?');
        total++;
        const isCorrect = guess === willSwap;
        if (isCorrect) correct++;
        quizFeedback.textContent = (isCorrect ? '✓ Correct — ' : '✗ Not quite — ') + (willSwap ? 'they do swap (left is greater).' : 'no swap needed (already in order).') + ' Score: ' + correct + '/' + total;
        quizFeedback.className = 'quiz-feedback ' + (isCorrect ? 'correct' : 'incorrect');
        await sleep(900);
        quizPrompt.classList.remove('open');

        if (willSwap) {
          [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]]; swapped = true;
          paintCells(arrayId, arr, idx => idx === i || idx === i + 1 ? { cls: 'cell-swap' } : idx >= n - pass ? { cls: 'cell-settled' } : {});
          await sleep(350);
        }
      }
      if (!swapped) break;
    }
    paintCells(arrayId, arr, () => ({ cls: 'cell-settled' }));
    logEl.innerHTML = '<span class="done">Sorted! Final quiz score: ' + correct + '/' + total + ' correct predictions.</span>';
    btn.disabled = false;
  }
  document.getElementById('selectionBtn').addEventListener('click', () => runComparisonSort({
    btn: document.getElementById('selectionBtn'), arrayId: 'selectionArray', logEl: document.getElementById('selectionLog'),
    algoName: 'Selection Sort', compareFn: ALGO_FNS.selection
  }));
  document.getElementById('insertionBtn').addEventListener('click', () => runComparisonSort({
    btn: document.getElementById('insertionBtn'), arrayId: 'insertionArray', logEl: document.getElementById('insertionLog'),
    algoName: 'Insertion Sort', compareFn: ALGO_FNS.insertion
  }));
  document.getElementById('mergeBtn').addEventListener('click', () => runComparisonSort({
    btn: document.getElementById('mergeBtn'), arrayId: 'mergeArray', logEl: document.getElementById('mergeLog'),
    algoName: 'Merge Sort', compareFn: ALGO_FNS.merge
  }));

  // ---------- Algorithm Race: run two algorithms side by side on identical data ----------
  (function () {
    const startBtn = document.getElementById('raceStartBtn');
    const selA = document.getElementById('raceAlgoA'), selB = document.getElementById('raceAlgoB');
    const arrA = document.getElementById('raceArrayA'), arrB = document.getElementById('raceArrayB');
    const logA = document.getElementById('raceLogA'), logB = document.getElementById('raceLogB');
    const nameA = document.getElementById('raceNameA'), nameB = document.getElementById('raceNameB');
    const resultEl = document.getElementById('raceResult');
    if (!startBtn) return;

    const LABELS = { bubble: 'Bubble Sort', selection: 'Selection Sort', insertion: 'Insertion Sort', merge: 'Merge Sort' };

    async function runSide(algoKey, arr, arrayId, logEl) {
      const t0 = performance.now();
      const result = await ALGO_FNS[algoKey](arr, arrayId, logEl);
      return { ...result, ms: performance.now() - t0 };
    }

    startBtn.addEventListener('click', async () => {
      if (students.length < 2) { resultEl.textContent = 'Add at least 2 students first.'; return; }
      startBtn.disabled = true;
      resultEl.textContent = '';
      nameA.textContent = LABELS[selA.value];
      nameB.textContent = LABELS[selB.value];
      const baseArr = students.map(s => ({ ...s }));
      const arrCopyA = baseArr.map(s => ({ ...s }));
      const arrCopyB = baseArr.map(s => ({ ...s }));
      paintCells('raceArrayA', arrCopyA, () => ({}));
      paintCells('raceArrayB', arrCopyB, () => ({}));

      const [resA, resB] = await Promise.all([
        runSide(selA.value, arrCopyA, 'raceArrayA', logA),
        runSide(selB.value, arrCopyB, 'raceArrayB', logB)
      ]);

      const winner = resA.ms < resB.ms ? LABELS[selA.value] : resB.ms < resA.ms ? LABELS[selB.value] : null;
      resultEl.innerHTML = (winner ? '<span class="done">🏆 ' + winner + ' finished first</span> — ' : 'Dead heat — ') +
        LABELS[selA.value] + ': ' + resA.ms.toFixed(0) + 'ms (' + resA.comparisons + ' comparisons) vs ' +
        LABELS[selB.value] + ': ' + resB.ms.toFixed(0) + 'ms (' + resB.comparisons + ' comparisons)';
      startBtn.disabled = false;
    });
  })();

  // ---------- two sum ----------
  document.getElementById('twosumBtn').addEventListener('click', () => {
    const target = parseInt(document.getElementById('twosumInput').value, 10);
    if (Number.isNaN(target)) return;
    runTwoSum(target);
  });
  document.getElementById('twosumInput').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('twosumBtn').click(); });

  async function runTwoSum(target) {
    const btn = document.getElementById('twosumBtn'), logEl = document.getElementById('twosumLog'), arrayId = 'twosumArray';
    btn.disabled = true;
    const seen = {};
    paintCells(arrayId, students, () => ({}));
    await sleep(200);
    for (let i = 0; i < students.length; i++) {
      const complement = target - students[i].marks;
      logEl.textContent = 'Checking ' + students[i].name + ' (' + students[i].marks + ') — need ' + complement + ' to reach ' + target;
      paintCells(arrayId, students, idx => idx === i ? { cls: 'cell-checking', pointer: 'CHECK' } : idx < i ? { cls: 'cell-seen' } : {});
      await sleep(550);
      if (complement in seen) {
        const j = seen[complement];
        paintCells(arrayId, students, idx => idx === i || idx === j ? { cls: 'cell-hit', pointer: 'MATCH' } : {});
        logEl.innerHTML = '<span class="hit-gold">Found: ' + students[j].name + ' (' + students[j].marks + ') + ' + students[i].name + ' (' + students[i].marks + ') = ' + target + '</span>';
        btn.disabled = false;
        return;
      }
      seen[students[i].marks] = i;
    }
    paintCells(arrayId, students, () => ({}));
    logEl.innerHTML = '<span class="no">No pair of students adds up to ' + target + '.</span>';
    btn.disabled = false;
  }

  // ---------- reverse (two-pointer) ----------
  document.getElementById('reverseBtn').addEventListener('click', runReverse);
  async function runReverse() {
    const btn = document.getElementById('reverseBtn'), logEl = document.getElementById('reverseLog'), arrayId = 'reverseArray';
    if (students.length < 2) { logEl.textContent = 'Add at least 2 students first.'; return; }
    btn.disabled = true;
    let left = 0, right = students.length - 1;
    paintCells(arrayId, students, () => ({}));
    await sleep(200);
    while (left < right) {
      logEl.textContent = 'Swapping ' + students[left].name + ' (index ' + left + ') with ' + students[right].name + ' (index ' + right + ')';
      paintCells(arrayId, students, idx => idx === left ? { cls: 'cell-active', pointer: 'LEFT' } : idx === right ? { cls: 'cell-active', pointer: 'RIGHT' } : (idx < left || idx > right) ? { cls: 'cell-settled' } : {});
      await sleep(550);
      [students[left], students[right]] = [students[right], students[left]];
      paintCells(arrayId, students, idx => idx === left || idx === right ? { cls: 'cell-swap' } : (idx < left || idx > right) ? { cls: 'cell-settled' } : {});
      await sleep(350);
      left++; right--;
    }
    render();
    logEl.innerHTML = '<span class="done">List reversed.</span>';
    btn.disabled = false;
  }

  // ---------- sliding window ----------
  document.getElementById('windowBtn').addEventListener('click', () => {
    const k = parseInt(document.getElementById('windowInput').value, 10);
    if (Number.isNaN(k) || k < 1 || k > students.length) {
      document.getElementById('windowLog').textContent = 'Enter a window size between 1 and ' + students.length + '.';
      return;
    }
    runSlidingWindow(k);
  });

  async function runSlidingWindow(k) {
    const btn = document.getElementById('windowBtn'), logEl = document.getElementById('windowLog'), arrayId = 'windowArray';
    btn.disabled = true;
    let windowSum = 0;
    for (let i = 0; i < k; i++) windowSum += students[i].marks;
    let bestSum = windowSum, bestStart = 0;
    paintCells(arrayId, students, idx => idx < k ? { cls: 'cell-window' } : {});
    logEl.textContent = 'Initial window [0, ' + (k - 1) + '] sum = ' + windowSum;
    await sleep(600);

    for (let i = k; i < students.length; i++) {
      windowSum += students[i].marks - students[i - k].marks;
      const start = i - k + 1;
      paintCells(arrayId, students, idx => idx >= start && idx <= i ? { cls: 'cell-window' } : {});
      logEl.textContent = 'Slide to [' + start + ', ' + i + ']: drop ' + students[i - k].name + ', add ' + students[i].name + ' → sum = ' + windowSum;
      await sleep(600);
      if (windowSum > bestSum) { bestSum = windowSum; bestStart = start; }
    }
    paintCells(arrayId, students, idx => idx >= bestStart && idx < bestStart + k ? { cls: 'cell-best', pointer: 'BEST' } : {});
    logEl.innerHTML = '<span class="done">Best average: ' + (bestSum / k).toFixed(2) + ', starting at ' + students[bestStart].name + '.</span>';
    btn.disabled = false;
  }

  // ---------- prefix sum ----------
  let prefixData = [];
  document.getElementById('prefixBtn').addEventListener('click', () => {
    const logEl = document.getElementById('prefixLog');
    if (students.length === 0) { logEl.textContent = 'Add at least 1 student first.'; return; }
    let runningTotal = 0;
    prefixData = [];
    const lines = [];
    students.forEach((s, i) => {
      runningTotal += s.marks;
      const avg = runningTotal / (i + 1);
      prefixData.push(avg);
      lines.push('after ' + s.name + ': total=' + runningTotal + ', avg=' + avg.toFixed(2));
    });
    logEl.innerHTML = lines.map(l => '<div>' + l + '</div>').join('');
  });

  // ---------- recursion (call stack) ----------
  document.getElementById('recurBtn').addEventListener('click', runRecursiveSum);
  async function runRecursiveSum() {
    const btn = document.getElementById('recurBtn'), logEl = document.getElementById('recurLog'), framesEl = document.getElementById('stackFrames');
    if (students.length === 0) { logEl.textContent = 'Add at least 1 student first.'; return; }
    btn.disabled = true;
    framesEl.innerHTML = '';
    const frames = [];

    // push phase — simulate the recursive calls going down
    for (let i = 0; i < students.length; i++) {
      const div = document.createElement('div');
      div.className = 'stack-frame';
      div.textContent = 'sum(' + i + ') = ' + students[i].name + ' + sum(' + (i + 1) + ')';
      framesEl.appendChild(div);
      frames.push(div);
      logEl.textContent = 'Calling sum(' + i + ') — pushing onto the call stack';
      await sleep(350);
    }
    const baseDiv = document.createElement('div');
    baseDiv.className = 'stack-frame returning';
    baseDiv.textContent = 'sum(' + students.length + ') = 0  ← base case';
    framesEl.appendChild(baseDiv);
    await sleep(500);

    // unwind phase — pop back up, accumulating the total
    let total = 0;
    for (let i = students.length - 1; i >= 0; i--) {
      total += students[i].marks;
      frames[i].classList.add('returning');
      frames[i].textContent = 'sum(' + i + ') = ' + students[i].marks + ' + sum(' + (i + 1) + ') → returns ' + total;
      logEl.textContent = 'Returning from sum(' + i + ') with running total ' + total;
      await sleep(400);
    }
    logEl.innerHTML = '<span class="done">Recursive sum = ' + total + '</span>';
    btn.disabled = false;
  }

  // ---------- duplicate marks (HashSet) ----------
  document.getElementById('dupBtn').addEventListener('click', runDuplicateCheck);
  async function runDuplicateCheck() {
    const btn = document.getElementById('dupBtn'), logEl = document.getElementById('dupLog'), arrayId = 'dupArray';
    btn.disabled = true;
    const seen = new Set();
    const dupMarks = new Set();
    paintCells(arrayId, students, () => ({}));
    await sleep(200);
    for (let i = 0; i < students.length; i++) {
      const m = students[i].marks;
      logEl.textContent = 'Checking if ' + m + ' marks already seen...';
      paintCells(arrayId, students, idx => idx === i ? { cls: 'cell-checking', pointer: 'CHECK' } : dupMarks.has(students[idx].marks) ? { cls: 'cell-dup' } : {});
      await sleep(450);
      if (seen.has(m)) dupMarks.add(m);
      seen.add(m);
    }
    paintCells(arrayId, students, idx => dupMarks.has(students[idx].marks) ? { cls: 'cell-dup', pointer: 'DUP' } : {});
    logEl.innerHTML = dupMarks.size === 0
      ? '<span class="done">No two students share the same marks.</span>'
      : '<span class="no">Shared marks: ' + [...dupMarks].join(', ') + '</span>';
    btn.disabled = false;
  }

  // ---------- BST ----------
  document.getElementById('bstBtn').addEventListener('click', runBST);
  function bstInsert(node, s) {
    if (!node) return { student: s, left: null, right: null };
    if (s.marks < node.student.marks) node.left = bstInsert(node.left, s);
    else node.right = bstInsert(node.right, s);
    return node;
  }
  function bstDepth(node) {
    if (!node) return 0;
    return 1 + Math.max(bstDepth(node.left), bstDepth(node.right));
  }
  function bstLayout(node, depth, xMin, xMax, positions, rowGap) {
    if (!node) return;
    const x = (xMin + xMax) / 2;
    positions.push({ node, x, y: 34 + depth * rowGap });
    bstLayout(node.left, depth + 1, xMin, x, positions, rowGap);
    bstLayout(node.right, depth + 1, x, xMax, positions, rowGap);
  }
  async function runBST() {
    const btn = document.getElementById('bstBtn'), logEl = document.getElementById('bstLog'), svg = document.getElementById('bstSvg');
    if (students.length === 0) { logEl.textContent = 'Add at least 1 student first.'; return; }
    btn.disabled = true;
    let root = null;
    students.forEach(s => { root = bstInsert(root, s); });

    // scale everything down as the tree gets deeper/bigger, so the whole tree stays visible at once
    const depth = bstDepth(root);
    const zoomedOut = depth > 4;
    const rowGap = zoomedOut ? 46 : 60;

    const width = Math.max(svg.clientWidth || 600, 260);
    const positions = [];
    bstLayout(root, 0, 16, width - 16, positions, rowGap);
    const height = 34 + (depth - 1) * rowGap + 34;

    // shrink nodes further if any row is too crowded for the available width (narrow/mobile screens)
    const rows = {};
    positions.forEach(p => { (rows[p.y] = rows[p.y] || []).push(p.x); });
    let minGap = Infinity;
    Object.values(rows).forEach(xs => {
      xs.sort((a, b) => a - b);
      for (let i = 1; i < xs.length; i++) minGap = Math.min(minGap, xs[i] - xs[i - 1]);
    });
    if (!isFinite(minGap)) minGap = 999;
    const nodeR = Math.max(9, Math.min(zoomedOut ? 16 : 24, Math.floor(minGap / 2) - 3));
    const fontSize = nodeR <= 10 ? 8 : nodeR <= 13 ? 9 : 11;

    let svgContent = '';
    positions.forEach(p => {
      if (p.node.left) { const c = positions.find(q => q.node === p.node.left); svgContent += '<line class="bst-edge" x1="' + p.x + '" y1="' + p.y + '" x2="' + c.x + '" y2="' + c.y + '"/>'; }
      if (p.node.right) { const c = positions.find(q => q.node === p.node.right); svgContent += '<line class="bst-edge" x1="' + p.x + '" y1="' + p.y + '" x2="' + c.x + '" y2="' + c.y + '"/>'; }
    });
    positions.forEach(p => {
      const displayName = nodeR <= 11 ? p.node.student.name.slice(0, 4) : p.node.student.name;
      svgContent += '<circle class="bst-node-circle" id="bstnode-' + p.node.student.name + '" cx="' + p.x + '" cy="' + p.y + '" r="' + nodeR + '"/>';
      svgContent += '<text class="bst-node-text" style="font-size:' + fontSize + 'px" x="' + p.x + '" y="' + (p.y - 2) + '">' + displayName + '</text>';
      svgContent += '<text class="bst-node-text" style="font-size:' + fontSize + 'px" x="' + p.x + '" y="' + (p.y + fontSize) + '">' + p.node.student.marks + '</text>';
    });
    svg.innerHTML = svgContent;
    svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
    svg.style.height = Math.max(height, 160) + 'px';
    logEl.textContent = 'Tree built (' + positions.length + ' nodes, ' + depth + ' levels deep). Traversing inorder (left, node, right)...';
    await sleep(500);

    const order = [];
    async function inorder(node) {
      if (!node) return;
      await inorder(node.left);
      order.push(node.student.name + '(' + node.student.marks + ')');
      const circle = document.getElementById('bstnode-' + node.student.name);
      if (circle) circle.classList.add('visited');
      logEl.textContent = 'Visiting ' + node.student.name + ' → order so far: ' + order.join(', ');
      await sleep(450);
      await inorder(node.right);
    }
    await inorder(root);
    logEl.innerHTML = '<span class="done">Inorder traversal (sorted): ' + order.join(', ') + '</span>';
    btn.disabled = false;
  }

  // ---------- priority queue (min-heap by marks) ----------
  (function () {
    let heap = [];
    const buildBtn = document.getElementById('pqBuildBtn');
    const popBtn = document.getElementById('pqPopBtn');
    const logEl = document.getElementById('pqLog');

    function renderHeap(highlight) {
      paintCells('pqArray', heap, idx => {
        if (!highlight) return {};
        if (idx === highlight.a || idx === highlight.b) return { cls: 'cell-compare' };
        if (idx === highlight.root) return { cls: 'cell-hit', pointer: 'ROOT' };
        return {};
      });
    }

    function siftUp(i) {
      while (i > 0) {
        const parent = Math.floor((i - 1) / 2);
        if (heap[parent].marks <= heap[i].marks) break;
        [heap[parent], heap[i]] = [heap[i], heap[parent]];
        i = parent;
      }
    }
    async function siftDown(i) {
      const n = heap.length;
      while (true) {
        const l = 2 * i + 1, r = 2 * i + 2;
        let smallest = i;
        if (l < n && heap[l].marks < heap[smallest].marks) smallest = l;
        if (r < n && heap[r].marks < heap[smallest].marks) smallest = r;
        if (smallest === i) break;
        renderHeap({ a: i, b: smallest });
        await sleep(400);
        [heap[i], heap[smallest]] = [heap[smallest], heap[i]];
        i = smallest;
      }
    }

    buildBtn.addEventListener('click', () => {
      if (students.length === 0) { logEl.textContent = 'Add at least 1 student first.'; return; }
      heap = [];
      students.forEach(s => { heap.push({ ...s }); siftUp(heap.length - 1); });
      renderHeap();
      popBtn.disabled = false;
      logEl.innerHTML = 'Priority queue built (' + heap.length + ' students). Root = <b>' + heap[0].name + '</b> (' + heap[0].marks + ' marks) — needs review first.';
    });

    popBtn.addEventListener('click', async () => {
      if (heap.length === 0) { logEl.textContent = 'Queue is empty.'; return; }
      popBtn.disabled = true;
      const popped = heap[0];
      logEl.innerHTML = 'Popping root: <b>' + popped.name + '</b> (' + popped.marks + ' marks).';
      renderHeap({ root: 0 });
      await sleep(500);
      const last = heap.pop();
      if (heap.length > 0) {
        heap[0] = last;
        renderHeap({ root: 0 });
        await sleep(350);
        await siftDown(0);
      }
      renderHeap();
      logEl.innerHTML = '<span class="done">Reviewed: ' + popped.name + ' (' + popped.marks + ' marks).</span> ' +
        (heap.length ? 'Next up: <b>' + heap[0].name + '</b> (' + heap[0].marks + ' marks).' : 'Queue is now empty.');
      popBtn.disabled = heap.length === 0;
    });
  })();

  // ---------- wiring for add ----------
  document.getElementById('addBtn').addEventListener('click', () => {
    const name = nameInput.value.trim();
    const marks = parseInt(marksInput.value, 10);
    if (!name || Number.isNaN(marks)) return;
    addStudent(name, marks);
    nameInput.value = ''; marksInput.value = '';
    nameInput.focus();
  });
  [nameInput, marksInput].forEach(el => el.addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('addBtn').click();
  }));

  // ---------- Sort Snake module: all six sorts as one connected, sliding chain ----------
  (function () {
    const SNAKE_ALGOS = {
      bubble: { label: 'BUBBLE', desc: 'Repeatedly swaps neighboring values that are out of order until the row settles. (O(n&sup2;))' },
      selection: { label: 'SELECTION', desc: 'Each pass finds the smallest remaining value and swaps it into place. (O(n&sup2;))' },
      insertion: { label: 'INSERTION', desc: 'Grows a sorted section on the left, sliding each new value into its spot. (O(n&sup2;))' },
      merge: { label: 'MERGE', desc: 'Splits the chain in half recursively, then merges the halves back in order. (O(n log n))' },
      quick: { label: 'QUICK', desc: 'Picks a pivot, partitions smaller/larger values around it, and recurses. (O(n log n) avg)' },
      heap: { label: 'HEAP', desc: 'Builds a max-heap, then repeatedly moves the max to the end and shrinks the heap. (O(n log n))' }
    };

    let snakeAlgo = 'bubble';
    let snakeStudents = [];
    let snakeOrder = [];
    let snakeRunning = false, snakePaused = false, snakeStopped = false;
    let snakeComparisons = 0, snakeSwaps = 0, snakeSteps = 0;
    let snakeSpeedMs = 550;
    let snakeNodeEls = [];

    const snakeStage = document.getElementById('snakeStage');
    const snakeSpineSvg = document.getElementById('snakeSpineSvg');
    const snakeSpinePath = document.getElementById('snakeSpinePath');
    const snakeStatusLine = document.getElementById('snakeStatusLine');
    const snakeCompCount = document.getElementById('snakeCompCount');
    const snakeSwapCount = document.getElementById('snakeSwapCount');
    const snakeStepCount = document.getElementById('snakeStepCount');
    const snakePlayBtn = document.getElementById('snakePlayBtn');
    const snakePauseBtn = document.getElementById('snakePauseBtn');
    const snakeStopBtn = document.getElementById('snakeStopBtn');
    const snakeShuffleBtn = document.getElementById('snakeShuffleBtn');
    const snakeSpeedSlider = document.getElementById('snakeSpeedSlider');
    const snakeSpeedTag = document.getElementById('snakeSpeedTag');
    const snakeAlgoBadge = document.getElementById('snakeAlgoBadge');
    const snakeAlgoDesc = document.getElementById('snakeAlgoDesc');
    const snakeAlgoBtns = document.querySelectorAll('#snakeAlgoTabs .snake-algo-btn');
    const snakeSizeSlider = document.getElementById('snakeSizeSlider');
    const snakeSizeTag = document.getElementById('snakeSizeTag');

    function snakeSetStatus(text) { snakeStatusLine.textContent = text; }

    function snakeLayout(n) {
      const w = snakeStage.clientWidth || 600, h = snakeStage.clientHeight || 300;
      const marginX = 46, marginY = 40;
      const usableW = w - marginX * 2;
      const cols = Math.min(n, 6);
      const rows = Math.ceil(n / cols);
      const stepY = rows > 1 ? (h - marginY * 2) / (rows - 1) : 0;
      const pos = [];
      for (let i = 0; i < n; i++) {
        const row = Math.floor(i / cols);
        let colInRow = i % cols;
        const rowLen = Math.min(cols, n - row * cols);
        const rowStepX = rowLen > 1 ? usableW / (rowLen - 1) : 0;
        if (row % 2 === 1) colInRow = rowLen - 1 - colInRow; // zigzag so the chain flows continuously
        pos.push({ x: marginX + colInRow * rowStepX, y: marginY + row * stepY });
      }
      return pos;
    }

    function snakeBuildNodes() {
      snakeStage.querySelectorAll('.snake-node').forEach(n => n.remove());
      snakeNodeEls = snakeStudents.map(s => {
        const el = document.createElement('div');
        el.className = 'snake-node';
        el.innerHTML = '<span class="snake-mk">' + s.marks + '</span>';
        snakeStage.appendChild(el);
        return el;
      });
      snakePositionAll();
    }

    function snakePositionAll(highlightBySlot) {
      const n = snakeStudents.length;
      const pos = snakeLayout(n);
      snakeOrder.forEach((studentIdx, slot) => {
        const el = snakeNodeEls[studentIdx];
        el.style.left = pos[slot].x + 'px';
        el.style.top = pos[slot].y + 'px';
        el.className = 'snake-node' + (highlightBySlot && highlightBySlot[slot] ? ' snake-' + highlightBySlot[slot] : '');
      });
      snakeSpineSvg.setAttribute('viewBox', '0 0 ' + (snakeStage.clientWidth || 600) + ' ' + (snakeStage.clientHeight || 300));
      snakeSpinePath.setAttribute('points', pos.map(p => p.x + ',' + p.y).join(' '));
    }

    function snakeValAt(slot) { return snakeStudents[snakeOrder[slot]].marks; }
    function snakeAllSettled() { const hl = {}; for (let s = 0; s < snakeStudents.length; s++) hl[s] = 'settled'; return hl; }

    async function snakeTick() {
      snakeSteps++; snakeStepCount.textContent = snakeSteps;
      while (snakePaused && !snakeStopped) await sleep(80);
      if (snakeStopped) throw new Error('stopped');
      await sleep(snakeSpeedMs);
    }
    async function snakeSwapSlots(a, b) {
      snakeSwaps++; snakeSwapCount.textContent = snakeSwaps;
      [snakeOrder[a], snakeOrder[b]] = [snakeOrder[b], snakeOrder[a]];
    }
    async function snakeRender(hl) { snakePositionAll(hl); }

    async function snakeBubbleSort() {
      const n = snakeStudents.length;
      for (let p = 0; p < n - 1; p++) {
        let didSwap = false;
        for (let i = 0; i < n - p - 1; i++) {
          snakeComparisons++; snakeCompCount.textContent = snakeComparisons;
          snakeSetStatus('Comparing ' + snakeValAt(i) + ' and ' + snakeValAt(i + 1));
          const hl = { [i]: 'compare', [i + 1]: 'compare' };
          for (let s = n - p; s < n; s++) hl[s] = 'settled';
          await snakeRender(hl); await snakeTick();
          if (snakeValAt(i) > snakeValAt(i + 1)) {
            await snakeSwapSlots(i, i + 1); didSwap = true;
            const hl2 = { [i]: 'swap', [i + 1]: 'swap' };
            for (let s = n - p; s < n; s++) hl2[s] = 'settled';
            await snakeRender(hl2); await snakeTick();
          }
        }
        if (!didSwap) break;
      }
      await snakeRender(snakeAllSettled());
    }

    async function snakeSelectionSort() {
      const n = snakeStudents.length;
      for (let i = 0; i < n - 1; i++) {
        let minSlot = i;
        for (let j = i + 1; j < n; j++) {
          snakeComparisons++; snakeCompCount.textContent = snakeComparisons;
          snakeSetStatus('Scanning for minimum: ' + snakeValAt(minSlot) + ' vs ' + snakeValAt(j));
          const hl = { [minSlot]: 'compare', [j]: 'compare' };
          for (let s = 0; s < i; s++) hl[s] = 'settled';
          await snakeRender(hl); await snakeTick();
          if (snakeValAt(j) < snakeValAt(minSlot)) minSlot = j;
        }
        if (minSlot !== i) {
          await snakeSwapSlots(i, minSlot);
          const hl = { [i]: 'swap' };
          for (let s = 0; s <= i; s++) hl[s] = 'settled';
          await snakeRender(hl); await snakeTick();
        }
      }
      await snakeRender(snakeAllSettled());
    }

    async function snakeInsertionSort() {
      const n = snakeStudents.length;
      for (let i = 1; i < n; i++) {
        let j = i;
        snakeSetStatus('Inserting ' + snakeValAt(i) + ' into the sorted section');
        while (j > 0) {
          snakeComparisons++; snakeCompCount.textContent = snakeComparisons;
          const hl = { [j]: 'compare', [j - 1]: 'compare' };
          for (let s = 0; s < i; s++) if (!(s in hl)) hl[s] = 'settled';
          await snakeRender(hl); await snakeTick();
          if (snakeValAt(j - 1) > snakeValAt(j)) { await snakeSwapSlots(j - 1, j); j--; }
          else break;
        }
      }
      await snakeRender(snakeAllSettled());
    }

    async function snakeMergeSort() {
      async function sortRange(lo, hi) {
        if (hi - lo <= 1) return;
        const mid = Math.floor((lo + hi) / 2);
        await sortRange(lo, mid);
        await sortRange(mid, hi);
        const merged = [];
        let a = lo, b = mid;
        while (a < mid && b < hi) {
          snakeComparisons++; snakeCompCount.textContent = snakeComparisons;
          await snakeRender({ [a]: 'compare', [b]: 'compare' }); await snakeTick();
          if (snakeValAt(a) <= snakeValAt(b)) merged.push(snakeOrder[a++]);
          else merged.push(snakeOrder[b++]);
        }
        while (a < mid) merged.push(snakeOrder[a++]);
        while (b < hi) merged.push(snakeOrder[b++]);
        for (let k = 0; k < merged.length; k++) snakeOrder[lo + k] = merged[k];
        const hl = {}; for (let k = lo; k < hi; k++) hl[k] = 'swap';
        snakeSetStatus('Merged range [' + lo + ', ' + (hi - 1) + ']');
        await snakeRender(hl); await snakeTick();
      }
      await sortRange(0, snakeStudents.length);
      await snakeRender(snakeAllSettled());
    }

    async function snakeQuickSort() {
      async function sortRange(lo, hi) {
        if (lo >= hi) return;
        const pivotSlot = hi;
        const pivotVal = snakeValAt(pivotSlot);
        let i = lo - 1;
        for (let j = lo; j < hi; j++) {
          snakeComparisons++; snakeCompCount.textContent = snakeComparisons;
          snakeSetStatus('Comparing ' + snakeValAt(j) + ' against pivot ' + pivotVal);
          await snakeRender({ [pivotSlot]: 'pivot', [j]: 'compare' }); await snakeTick();
          if (snakeValAt(j) < pivotVal) { i++; if (i !== j) await snakeSwapSlots(i, j); }
        }
        await snakeSwapSlots(i + 1, hi);
        await snakeRender({ [i + 1]: 'settled' }); await snakeTick();
        await sortRange(lo, i);
        await sortRange(i + 2, hi);
      }
      await sortRange(0, snakeStudents.length - 1);
      await snakeRender(snakeAllSettled());
    }

    async function snakeHeapSort() {
      const n = snakeStudents.length;
      async function siftDown(root, size) {
        let largest = root;
        while (true) {
          const l = 2 * largest + 1, r = 2 * largest + 2;
          let candidate = largest;
          if (l < size) { snakeComparisons++; snakeCompCount.textContent = snakeComparisons; if (snakeValAt(l) > snakeValAt(candidate)) candidate = l; }
          if (r < size) { snakeComparisons++; snakeCompCount.textContent = snakeComparisons; if (snakeValAt(r) > snakeValAt(candidate)) candidate = r; }
          const hl = { [largest]: 'compare' }; if (l < size) hl[l] = 'compare'; if (r < size) hl[r] = 'compare';
          snakeSetStatus('Sifting down from slot ' + largest);
          await snakeRender(hl); await snakeTick();
          if (candidate === largest) break;
          await snakeSwapSlots(largest, candidate);
          largest = candidate;
        }
      }
      for (let i = Math.floor(n / 2) - 1; i >= 0; i--) await siftDown(i, n);
      for (let end = n - 1; end > 0; end--) {
        await snakeSwapSlots(0, end);
        const hl = {}; for (let s = end; s < n; s++) hl[s] = 'settled';
        snakeSetStatus('Moved max to slot ' + end);
        await snakeRender(hl); await snakeTick();
        await siftDown(0, end);
      }
      await snakeRender(snakeAllSettled());
    }

    const SNAKE_RUNNERS = { bubble: snakeBubbleSort, selection: snakeSelectionSort, insertion: snakeInsertionSort, merge: snakeMergeSort, quick: snakeQuickSort, heap: snakeHeapSort };

    // independent random practice data — nothing to do with the class list
    function snakeGenerateValues(count) {
      const pool = [];
      for (let v = 1; v <= 99; v++) pool.push(v);
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      return pool.slice(0, count).map(marks => ({ marks }));
    }

    function snakeResetChain() {
      const count = parseInt(snakeSizeSlider.value, 10);
      snakeStudents = snakeGenerateValues(count);
      snakeOrder = snakeStudents.map((_, i) => i);
      snakeComparisons = 0; snakeSwaps = 0; snakeSteps = 0;
      snakeCompCount.textContent = 0; snakeSwapCount.textContent = 0; snakeStepCount.textContent = 0;
      snakeBuildNodes();
      snakeSetStatus('Pick an algorithm, then press Play.');
    }

    async function snakeRunSort() {
      if (snakeStudents.length < 2) { snakeSetStatus('Need at least 2 values.'); return; }
      snakeRunning = true; snakeStopped = false; snakePaused = false;
      snakePlayBtn.disabled = true; snakePauseBtn.disabled = false; snakeStopBtn.disabled = false; snakeShuffleBtn.disabled = true;
      snakeAlgoBtns.forEach(b => b.disabled = true);
      try {
        await SNAKE_RUNNERS[snakeAlgo]();
        snakeSetStatus('Sorted in ' + snakeComparisons + ' comparison(s), ' + snakeSwaps + ' swap(s).');
      } catch (e) {
        snakeSetStatus('Stopped.');
      }
      snakeRunning = false;
      snakePlayBtn.disabled = false; snakePauseBtn.disabled = true; snakeStopBtn.disabled = true; snakeShuffleBtn.disabled = false;
      snakeAlgoBtns.forEach(b => b.disabled = false);
    }

    snakePlayBtn.addEventListener('click', () => {
      if (snakeRunning && snakePaused) { snakePaused = false; snakePauseBtn.innerHTML = '&#10073;&#10073; Pause'; return; }
      if (!snakeRunning) snakeRunSort();
    });
    snakePauseBtn.addEventListener('click', () => {
      snakePaused = !snakePaused;
      snakePauseBtn.innerHTML = snakePaused ? '&#9654; Resume' : '&#10073;&#10073; Pause';
    });
    snakeStopBtn.addEventListener('click', () => { snakeStopped = true; snakePaused = false; });
    snakeShuffleBtn.addEventListener('click', () => {
      if (snakeRunning) return;
      snakeResetChain();
      snakeSetStatus('New random values generated — press Play to sort.');
    });
    snakeSpeedSlider.addEventListener('input', () => {
      const map = { 1: [900, 'Slowest'], 2: [700, 'Slow'], 3: [550, 'Normal'], 4: [350, 'Fast'], 5: [180, 'Fastest'] };
      const [ms, label] = map[snakeSpeedSlider.value];
      snakeSpeedMs = ms; snakeSpeedTag.textContent = label;
    });
    snakeSizeSlider.addEventListener('input', () => {
      if (snakeRunning) return;
      snakeSizeTag.textContent = snakeSizeSlider.value;
      snakeResetChain();
    });
    snakeAlgoBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        if (snakeRunning) return;
        snakeAlgoBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        snakeAlgo = btn.dataset.algo;
        snakeAlgoBadge.textContent = SNAKE_ALGOS[snakeAlgo].label;
        snakeAlgoDesc.innerHTML = SNAKE_ALGOS[snakeAlgo].desc;
        snakeResetChain();
      });
    });
    window.addEventListener('resize', () => { if (snakeStudents.length) snakePositionAll(); });

    let snakeInitialized = false;
    window.snakeOnTabOpen = function () {
      if (snakeInitialized) { snakePositionAll(); return; } // just re-lay-out in case the panel was hidden during a resize
      snakeInitialized = true;
      snakeResetChain();
    };
  })();

  // ---------- lab catalog: categorized card grid (Learn tab) ----------
  (function () {
    const catalog = document.getElementById('labCatalog');
    if (!catalog) return;

    const CATEGORIES = [
      { name: 'Linear Data Structures', labs: [
        { lab: 'stackqueue', title: 'Stack & Queue', desc: 'Push/pop vs enqueue/dequeue — LIFO and FIFO side by side.' },
        { lab: 'linkedlist', title: 'Linked List', desc: 'Nodes and pointers — insert at head/tail, delete, traverse.' },
        { lab: 'circularqueue', title: 'Circular Queue & Deque', desc: 'A fixed-size buffer that wraps around, plus a double-ended deque.' },
        { lab: 'matrix', title: 'Matrix', desc: 'Spiral traversal of a 2D array, ring by ring.' },
      ]},
      { name: 'Non-Linear Data Structures', labs: [
        { lab: 'trietree', title: 'Trie Tree', desc: 'Watch a prefix tree branch out as you insert words.' },
        { lab: 'avltree', title: 'AVL Tree', desc: 'A BST that rebalances itself with rotations after every insert.' },
        { lab: 'hashing', title: 'Hashing', desc: 'See exactly which bucket a word lands in — and what a collision looks like.' },
        { lab: 'lru', title: 'LRU Cache', desc: 'A HashMap + doubly linked list that evicts the least recently used key.' },
        { lab: 'unionfind', title: 'Union-Find', desc: 'Merge sets one edge at a time, rejecting anything that would form a cycle.' },
      ]},
      { name: 'Searching & Sorting', labs: [
        { lab: 'sorting', title: 'Sorting', desc: 'Six algorithms, one connected chain — watch them slither into order.' },
        { lab: 'searching', title: 'Searching', desc: 'Linear scan vs binary search, side by side on the same data.' },
        { lab: 'countingsort', title: 'Counting Sort', desc: 'Sort without a single comparison — just counts and buckets.' },
      ]},
      { name: 'Graph', labs: [
        { lab: 'graph', title: 'Graph Traversal', desc: "BFS, DFS, and Dijkstra's shortest path on one weighted graph." },
        { lab: 'mst', title: 'Minimum Spanning Tree', desc: "Prim's vs Kruskal's — two ways to build the cheapest connected network." },
        { lab: 'toposort', title: 'Topological Sort', desc: 'Order courses so every prerequisite comes before what needs it.' },
      ]},
      { name: 'Paths', labs: [
        { lab: 'shortestpaths', title: 'Bellman-Ford & Floyd-Warshall', desc: 'Handle negative weights, or solve every pair of nodes at once.' },
      ]},
      { name: 'Algorithm Techniques', labs: [
        { lab: 'recursion', title: 'Recursion', desc: 'Factorial via the call stack — watch it grow, then unwind.' },
        { lab: 'dp', title: 'Dynamic Programming', desc: 'Memoized Fibonacci, 0/1 Knapsack, and Longest Common Subsequence.' },
        { lab: 'nqueens', title: 'N-Queens', desc: 'Backtracking: place a queen, and undo it the moment it’s attacked.' },
        { lab: 'huffman', title: 'Huffman Coding', desc: 'Build a compression tree from letter frequencies, greedily.' },
        { lab: 'bitmanip', title: 'Bit Manipulation', desc: 'Count set bits, spot powers of two, and swap with no temp variable.' },
      ]},
    ];

    catalog.innerHTML = CATEGORIES.map(cat => (
      '<div class="lab-category">' +
        '<div class="lab-category-head"><h3 class="lab-category-title">' + cat.name + '</h3>' +
        '<span class="lab-category-count">' + cat.labs.length + ' lab' + (cat.labs.length > 1 ? 's' : '') + '</span></div>' +
        '<div class="lab-card-grid">' +
          cat.labs.map(l =>
            '<button class="lab-card" data-lab="' + l.lab + '" id="labcard-' + l.lab + '">' +
              '<span class="lab-card-tag">Interactive Lab</span>' +
              '<h4 class="lab-card-title">' + l.title + '</h4>' +
              '<p class="lab-card-desc">' + l.desc + '</p>' +
              '<span class="lab-card-launch">Launch Lab &rarr;</span>' +
            '</button>'
          ).join('') +
        '</div>' +
      '</div>'
    )).join('') + '<div class="lab-active-panel" id="labActivePanel"></div>';

    const activeWrap = document.getElementById('labActivePanel');
    const allPanels = document.querySelectorAll('.lab-panel');
    // move every existing lab panel into the "active panel" slot so it can be shown one at a time
    allPanels.forEach(p => { p.classList.remove('active'); activeWrap.appendChild(p); });

    const backBtn = document.createElement('button');
    backBtn.className = 'lab-back-btn';
    backBtn.innerHTML = '&larr; Back to all labs';
    backBtn.style.display = 'none';
    catalog.insertBefore(backBtn, activeWrap);

    function openLab(lab) {
      document.querySelectorAll('.lab-card').forEach(c => c.classList.toggle('active', c.dataset.lab === lab));
      allPanels.forEach(p => p.classList.toggle('active', p.dataset.labPanel === lab));
      document.querySelectorAll('.lab-category').forEach(el => el.style.display = 'none');
      backBtn.style.display = 'inline-flex';
      activeWrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (lab === 'sorting' && typeof snakeOnTabOpen === 'function') snakeOnTabOpen();
    }
    function closeLab() {
      document.querySelectorAll('.lab-category').forEach(el => el.style.display = '');
      allPanels.forEach(p => p.classList.remove('active'));
      document.querySelectorAll('.lab-card').forEach(c => c.classList.remove('active'));
      backBtn.style.display = 'none';
    }
    catalog.addEventListener('click', e => {
      const card = e.target.closest('.lab-card');
      if (card) openLab(card.dataset.lab);
    });
    backBtn.addEventListener('click', closeLab);

    window.labCatalogOpen = openLab; // exposed for the guided tour
  })();

  // ---------- Searching lab: linear vs binary, independent sorted data ----------
  (function () {
    let arr = [];
    const target = document.getElementById('searchLabTarget');
    const arrayEl = document.getElementById('searchLabArray');
    const status = document.getElementById('searchLabStatus');
    const checksEl = document.getElementById('searchLabChecks');

    function generate() {
      const pool = [];
      for (let v = 1; v <= 99; v++) pool.push(v);
      for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
      arr = pool.slice(0, 12).sort((a, b) => a - b);
      renderArr();
      status.textContent = 'Pick a value, then run a search.';
      checksEl.textContent = '0';
    }

    function renderArr(highlight) {
      arrayEl.innerHTML = arr.map((v, i) => {
        let cls = '', pointer = '';
        if (highlight) {
          if (i < highlight.low || i > highlight.high) cls = 'cell-discarded';
          else if (i === highlight.at) { cls = highlight.hit ? 'cell-hit' : 'cell-compare'; pointer = highlight.hit ? 'FOUND' : (highlight.mode === 'linear' ? 'CHECK' : 'MID'); }
          else if (highlight.mode === 'binary') cls = 'cell-range';
        }
        return '<div class="cell ' + cls + '">' + (pointer ? '<span class="pointer">' + pointer + '</span>' : '') + v + '</div>';
      }).join('');
    }

    async function runLinear(t) {
      let checks = 0;
      for (let i = 0; i < arr.length; i++) {
        checks++; checksEl.textContent = checks;
        status.textContent = 'Checking index ' + i + ' (' + arr[i] + ')';
        renderArr({ low: 0, high: arr.length - 1, at: i, mode: 'linear' });
        await sleep(400);
        if (arr[i] === t) { renderArr({ low: 0, high: arr.length - 1, at: i, hit: true, mode: 'linear' }); status.innerHTML = '<span class="ok">Found ' + t + ' after ' + checks + ' check(s).</span>'; return; }
      }
      renderArr(); status.innerHTML = '<span class="no">' + t + ' not found (' + checks + ' check(s)).</span>';
    }
    async function runBinary(t) {
      let low = 0, high = arr.length - 1, checks = 0;
      while (low <= high) {
        checks++; checksEl.textContent = checks;
        const mid = Math.floor((low + high) / 2);
        status.textContent = 'low=' + low + ', high=' + high + ', mid=' + mid + ' (' + arr[mid] + ')';
        renderArr({ low, high, at: mid, mode: 'binary' });
        await sleep(500);
        if (arr[mid] === t) { renderArr({ low, high, at: mid, hit: true, mode: 'binary' }); status.innerHTML = '<span class="ok">Found ' + t + ' in ' + checks + ' check(s).</span>'; return; }
        else if (arr[mid] < t) low = mid + 1; else high = mid - 1;
      }
      renderArr(); status.innerHTML = '<span class="no">' + t + ' not found (' + checks + ' check(s)).</span>';
    }

    document.getElementById('searchLabLinearBtn').addEventListener('click', () => {
      const t = parseInt(target.value, 10); if (Number.isNaN(t)) return; runLinear(t);
    });
    document.getElementById('searchLabBinaryBtn').addEventListener('click', () => {
      const t = parseInt(target.value, 10); if (Number.isNaN(t)) return; runBinary(t);
    });
    document.getElementById('searchLabShuffleBtn').addEventListener('click', generate);
    generate();
  })();

  // ---------- Stack & Queue lab ----------
  (function () {
    const stack = [], queue = [];
    const stackWell = document.getElementById('stackWell');
    const queueWell = document.getElementById('queueWell');
    const status = document.getElementById('sqStatus');

    function renderStack() {
      stackWell.innerHTML = stack.length === 0 ? '<span class="sq-empty">Empty — nothing pushed yet.</span>' :
        stack.map((v, i) => '<span class="sq-chip' + (i === stack.length - 1 ? ' sq-top' : '') + '">' + v + (i === stack.length - 1 ? ' ← top' : '') + '</span>').join('');
    }
    function renderQueue() {
      queueWell.innerHTML = queue.length === 0 ? '<span class="sq-empty">Empty — nothing enqueued yet.</span>' :
        queue.map((v, i) => '<span class="sq-chip' + (i === 0 ? ' sq-front' : '') + '">' + v + (i === 0 ? ' front' : '') + '</span>').join('');
    }
    function randVal() { return Math.floor(Math.random() * 90) + 10; }

    document.getElementById('stackPushBtn').addEventListener('click', () => {
      const v = randVal(); stack.push(v); renderStack();
      status.textContent = 'Pushed ' + v + ' onto the stack (now on top).';
    });
    document.getElementById('stackPopBtn').addEventListener('click', () => {
      if (stack.length === 0) { status.textContent = 'Stack is empty — nothing to pop.'; return; }
      const v = stack.pop(); renderStack();
      status.textContent = 'Popped ' + v + ' — it was the most recently pushed (LIFO).';
    });
    document.getElementById('queuePushBtn').addEventListener('click', () => {
      const v = randVal(); queue.push(v); renderQueue();
      status.textContent = 'Enqueued ' + v + ' at the back.';
    });
    document.getElementById('queuePopBtn').addEventListener('click', () => {
      if (queue.length === 0) { status.textContent = 'Queue is empty — nothing to dequeue.'; return; }
      const v = queue.shift(); renderQueue();
      status.textContent = 'Dequeued ' + v + ' — it was the longest-waiting item (FIFO).';
    });
    renderStack(); renderQueue();
  })();

  // ---------- Recursion lab: factorial via call stack ----------
  (function () {
    const input = document.getElementById('recurLabInput');
    const status = document.getElementById('recurLabStatus');
    const frames = document.getElementById('recurLabFrames');

    async function run() {
      const n = parseInt(input.value, 10);
      if (Number.isNaN(n) || n < 0 || n > 10) { status.textContent = 'Enter a whole number from 0 to 10.'; return; }
      document.getElementById('recurLabBtn').disabled = true;
      frames.innerHTML = '';
      const els = [];
      for (let i = n; i > 0; i--) {
        const el = document.createElement('div');
        el.className = 'stack-frame';
        el.textContent = 'factorial(' + i + ') = ' + i + ' × factorial(' + (i - 1) + ')';
        frames.appendChild(el); els.push(el);
        status.textContent = 'Calling factorial(' + i + ') — pushing onto the call stack';
        await sleep(380);
      }
      const base = document.createElement('div');
      base.className = 'stack-frame returning';
      base.textContent = 'factorial(0) = 1  ← base case';
      frames.appendChild(base);
      await sleep(500);

      let result = 1;
      for (let i = 1; i <= n; i++) {
        result *= i;
        els[n - i].classList.add('returning');
        els[n - i].textContent = 'factorial(' + i + ') = ' + i + ' × factorial(' + (i - 1) + ') → returns ' + result;
        status.textContent = 'Returning from factorial(' + i + ') with running product ' + result;
        await sleep(400);
      }
      status.innerHTML = '<span class="ok">factorial(' + n + ') = ' + result + '</span>';
      document.getElementById('recurLabBtn').disabled = false;
    }
    document.getElementById('recurLabBtn').addEventListener('click', run);
  })();

  // ---------- Hashing lab ----------
  (function () {
    const BUCKET_COUNT = 7;
    let buckets = Array.from({ length: BUCKET_COUNT }, () => []);
    const wrap = document.getElementById('hashBuckets');
    const input = document.getElementById('hashLabInput');
    const log = document.getElementById('hashLabLog');

    function hashOf(word) {
      let sum = 0;
      for (let i = 0; i < word.length; i++) sum += word.charCodeAt(i);
      return sum % BUCKET_COUNT;
    }

    function render(highlightIdx, collided) {
      wrap.innerHTML = '';
      buckets.forEach((chain, i) => {
        const div = document.createElement('div');
        div.className = 'hash-bucket' + (i === highlightIdx ? (collided ? ' hash-collision' : ' hash-hit') : '');
        div.innerHTML = '<div class="hash-bucket-idx">bucket <b>' + i + '</b></div><div class="hash-chain">' +
          (chain.length ? chain.map(w => '<span class="hash-item">' + w + '</span>').join('') : '<span class="sq-empty">empty</span>') +
          '</div>';
        wrap.appendChild(div);
      });
    }

    function insert(word) {
      const sum = word.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
      const idx = sum % BUCKET_COUNT;
      const collided = buckets[idx].length > 0;
      buckets[idx].push(word);
      render(idx, collided);
      log.innerHTML = 'insert("' + word + '") &rarr; letters add up to ' + sum + ' &rarr; ' + sum + ' % ' + BUCKET_COUNT + ' = <b>' + idx + '</b>' +
        (collided ? ' <span class="no">— collision! chained onto what was already there.</span>' : ' <span class="ok">— placed in an empty bucket.</span>');
    }

    document.getElementById('hashLabBtn').addEventListener('click', () => {
      const w = input.value.trim().toLowerCase();
      if (!w) return;
      insert(w);
      input.value = '';
      input.focus();
    });
    input.addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('hashLabBtn').click(); });
    document.getElementById('hashLabResetBtn').addEventListener('click', () => {
      buckets = Array.from({ length: BUCKET_COUNT }, () => []);
      render();
      log.textContent = 'Table cleared. Type a word and insert it to see which bucket it lands in.';
    });
    render();
  })();

  // ---------- Graph lab: BFS vs DFS vs Dijkstra on a small fixed weighted graph ----------
  (function () {
    const NODES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    const EDGES = [['A','B',4],['A','C',2],['B','D',5],['C','D',1],['C','E',8],['D','F',3],['E','F',2],['E','G',6],['F','H',4],['G','H',1]];
    const adj = {};
    NODES.forEach(n => { adj[n] = []; });
    EDGES.forEach(([a, b, w]) => { adj[a].push({ to: b, w }); adj[b].push({ to: a, w }); });

    const svg = document.getElementById('graphSvg');
    const logEl = document.getElementById('graphLog');
    const startSelect = document.getElementById('graphStartSelect');
    const bfsBtn = document.getElementById('graphBfsBtn');
    const dfsBtn = document.getElementById('graphDfsBtn');
    if (!svg) return;

    startSelect.innerHTML = NODES.map(n => '<option value="' + n + '">' + n + '</option>').join('');
    const fromSelect = document.getElementById('dijkstraFromSelect');
    const toSelect = document.getElementById('dijkstraToSelect');
    const dijkstraBtn = document.getElementById('dijkstraBtn');
    const dijkstraLog = document.getElementById('dijkstraLog');
    fromSelect.innerHTML = NODES.map(n => '<option value="' + n + '">' + n + '</option>').join('');
    toSelect.innerHTML = NODES.map((n, i) => '<option value="' + n + '"' + (i === NODES.length - 1 ? ' selected' : '') + '>' + n + '</option>').join('');

    function layout() {
      const w = Math.max(svg.clientWidth || 600, 320), h = 320;
      const cx = w / 2, cy = h / 2, r = Math.min(w, h) / 2 - 40;
      const pos = {};
      NODES.forEach((n, i) => {
        const angle = (i / NODES.length) * 2 * Math.PI - Math.PI / 2;
        pos[n] = { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
      });
      return { pos, w, h };
    }

    function render(state) {
      state = state || {};
      const { pos, w, h } = layout();
      let content = '';
      EDGES.forEach(([a, b, weight]) => {
        const isTraversed = state.traversedEdges && (state.traversedEdges.has(a + '-' + b) || state.traversedEdges.has(b + '-' + a));
        const onPath = state.pathEdges && (state.pathEdges.has(a + '-' + b) || state.pathEdges.has(b + '-' + a));
        content += '<line class="graph-edge' + (onPath ? ' shortest-path' : isTraversed ? ' traversed' : '') + '" x1="' + pos[a].x + '" y1="' + pos[a].y + '" x2="' + pos[b].x + '" y2="' + pos[b].y + '"/>';
        const mx = (pos[a].x + pos[b].x) / 2, my = (pos[a].y + pos[b].y) / 2;
        content += '<text class="graph-weight-text' + (onPath ? ' on-path' : '') + '" x="' + mx + '" y="' + my + '">' + weight + '</text>';
      });
      NODES.forEach(n => {
        let cls = 'graph-node-circle';
        if (state.current === n) cls += ' current';
        else if (state.pathNodes && state.pathNodes.has(n)) cls += ' visited';
        else if (state.visited && state.visited.has(n)) cls += ' visited';
        else if (state.frontier && state.frontier.has(n)) cls += ' frontier';
        content += '<circle class="' + cls + '" cx="' + pos[n].x + '" cy="' + pos[n].y + '" r="22"/>';
        content += '<text class="graph-node-text" x="' + pos[n].x + '" y="' + pos[n].y + '">' + n + '</text>';
      });
      svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
      svg.innerHTML = content;
    }

    async function runDijkstra(start, end) {
      dijkstraBtn.disabled = true;
      const dist = {}, prev = {}, visited = new Set();
      NODES.forEach(n => { dist[n] = Infinity; });
      dist[start] = 0;
      const traversedEdges = new Set();

      while (visited.size < NODES.length) {
        let u = null;
        NODES.forEach(n => { if (!visited.has(n) && (u === null || dist[n] < dist[u])) u = n; });
        if (u === null || dist[u] === Infinity) break;
        visited.add(u);
        dijkstraLog.textContent = 'Visiting ' + u + ' (distance so far: ' + dist[u] + '). Checking its neighbors...';
        render({ current: u, visited, traversedEdges });
        await sleep(550);
        if (u === end) break;
        for (const { to, w } of adj[u]) {
          if (visited.has(to)) continue;
          const alt = dist[u] + w;
          if (alt < dist[to]) {
            dist[to] = alt; prev[to] = u;
            traversedEdges.add(u + '-' + to);
            dijkstraLog.textContent = 'Found a shorter path to ' + to + ' via ' + u + ': distance ' + alt;
            render({ current: u, visited, traversedEdges });
            await sleep(400);
          }
        }
      }

      if (dist[end] === Infinity) {
        render({ visited, traversedEdges });
        dijkstraLog.innerHTML = '<span class="no">No path found from ' + start + ' to ' + end + '.</span>';
        dijkstraBtn.disabled = false;
        return;
      }
      const path = [end];
      let cur = end;
      while (cur !== start) { cur = prev[cur]; path.unshift(cur); }
      const pathNodes = new Set(path);
      const pathEdges = new Set();
      for (let i = 0; i < path.length - 1; i++) pathEdges.add(path[i] + '-' + path[i + 1]);
      render({ pathNodes, pathEdges });
      dijkstraLog.innerHTML = '<span class="done">Shortest path ' + start + ' → ' + end + ': ' + path.join(' → ') + ' (total cost ' + dist[end] + ')</span>';
      dijkstraBtn.disabled = false;
    }
    dijkstraBtn.addEventListener('click', () => {
      if (fromSelect.value === toSelect.value) { dijkstraLog.textContent = 'Pick two different nodes.'; return; }
      runDijkstra(fromSelect.value, toSelect.value);
    });

    async function runBFS(start) {
      bfsBtn.disabled = true; dfsBtn.disabled = true;
      const visited = new Set([start]);
      const frontier = new Set();
      const traversedEdges = new Set();
      const queue = [start];
      const order = [start];
      render({ current: start, visited });
      logEl.textContent = 'Queue: [' + start + '] — starting at ' + start;
      await sleep(600);
      while (queue.length) {
        const node = queue.shift();
        logEl.textContent = 'Dequeued ' + node + '. Checking neighbors: ' + adj[node].map(e => e.to).join(', ');
        render({ current: node, visited, traversedEdges });
        await sleep(600);
        for (const { to: nb } of adj[node]) {
          if (!visited.has(nb)) {
            visited.add(nb); queue.push(nb); order.push(nb);
            traversedEdges.add(node + '-' + nb);
            frontier.add(nb);
            render({ current: node, visited, frontier, traversedEdges });
            await sleep(350);
          }
        }
      }
      render({ visited, traversedEdges });
      logEl.innerHTML = '<span class="done">BFS order: ' + order.join(' → ') + '</span>';
      bfsBtn.disabled = false; dfsBtn.disabled = false;
    }

    async function runDFS(start) {
      bfsBtn.disabled = true; dfsBtn.disabled = true;
      const visited = new Set();
      const traversedEdges = new Set();
      const order = [];
      async function visit(node, from) {
        visited.add(node); order.push(node);
        if (from) traversedEdges.add(from + '-' + node);
        logEl.textContent = 'Visiting ' + node + ' → order so far: ' + order.join(', ');
        render({ current: node, visited, traversedEdges });
        await sleep(600);
        for (const { to: nb } of adj[node]) {
          if (!visited.has(nb)) await visit(nb, node);
        }
      }
      await visit(start, null);
      render({ visited, traversedEdges });
      logEl.innerHTML = '<span class="done">DFS order: ' + order.join(' → ') + '</span>';
      bfsBtn.disabled = false; dfsBtn.disabled = false;
    }

    bfsBtn.addEventListener('click', () => runBFS(startSelect.value));
    dfsBtn.addEventListener('click', () => runDFS(startSelect.value));
    render();
  })();

  // ---------- Linked List lab ----------
  (function () {
    let head = null; // { value, next }
    const track = document.getElementById('llTrack');
    const logEl = document.getElementById('llLog');
    const input = document.getElementById('llValueInput');
    if (!track) return;

    function render(currentValue) {
      if (!head) { track.innerHTML = '<span class="ll-null">List is empty — HEAD → NULL</span>'; return; }
      let html = '<span class="ll-null">HEAD →</span>';
      let node = head, first = true;
      while (node) {
        if (!first) html += '<span class="ll-arrow">→</span>';
        html += '<div class="ll-node' + (node.value === currentValue ? ' current' : '') + '">' +
          '<span class="ll-node-value">' + node.value + '</span><span class="ll-node-ptr">next</span></div>';
        node = node.next;
        first = false;
      }
      html += '<span class="ll-arrow">→</span><span class="ll-null">NULL</span>';
      track.innerHTML = html;
    }

    document.getElementById('llInsertHeadBtn').addEventListener('click', () => {
      const v = parseInt(input.value, 10);
      if (Number.isNaN(v)) return;
      head = { value: v, next: head };
      render(v);
      logEl.innerHTML = '<span class="done">Inserted ' + v + ' at the head — O(1), no shifting needed.</span>';
      input.value = ''; input.focus();
    });
    document.getElementById('llInsertTailBtn').addEventListener('click', () => {
      const v = parseInt(input.value, 10);
      if (Number.isNaN(v)) return;
      const newNode = { value: v, next: null };
      if (!head) { head = newNode; }
      else {
        let node = head, steps = 1;
        while (node.next) { node = node.next; steps++; }
        node.next = newNode;
        logEl.innerHTML = '<span class="done">Inserted ' + v + ' at the tail — had to follow ' + steps + ' pointer(s) to get there, O(n).</span>';
        render(v); input.value = ''; input.focus();
        return;
      }
      render(v);
      logEl.innerHTML = '<span class="done">Inserted ' + v + ' — list was empty, so it\'s both head and tail.</span>';
      input.value = ''; input.focus();
    });
    document.getElementById('llDeleteBtn').addEventListener('click', () => {
      const v = parseInt(input.value, 10);
      if (Number.isNaN(v)) return;
      if (!head) { logEl.textContent = 'List is already empty.'; return; }
      if (head.value === v) { head = head.next; render(); logEl.innerHTML = '<span class="done">Deleted ' + v + ' from the head.</span>'; input.value = ''; return; }
      let node = head;
      while (node.next && node.next.value !== v) node = node.next;
      if (!node.next) { logEl.innerHTML = '<span class="no">' + v + ' not found in the list.</span>'; return; }
      node.next = node.next.next;
      render();
      logEl.innerHTML = '<span class="done">Deleted ' + v + ' — rewired the previous node\'s pointer around it.</span>';
      input.value = '';
    });
    document.getElementById('llTraverseBtn').addEventListener('click', async () => {
      if (!head) { logEl.textContent = 'List is empty.'; return; }
      let node = head, visited = [];
      while (node) {
        visited.push(node.value);
        render(node.value);
        logEl.textContent = 'At node ' + node.value + ' → following .next → visited so far: ' + visited.join(', ');
        await sleep(600);
        node = node.next;
      }
      render();
      logEl.innerHTML = '<span class="done">Reached NULL. Full traversal: ' + visited.join(' → ') + '</span>';
    });
    render();
  })();

  // ---------- Dynamic Programming lab: Fibonacci, plain recursion vs memoized ----------
  (function () {
    const input = document.getElementById('dpInput');
    const logEl = document.getElementById('dpLog');
    const tableWrap = document.getElementById('dpTable');
    if (!input) return;

    function fibPlain(n, counter) {
      counter.calls++;
      if (n <= 1) return n;
      return fibPlain(n - 1, counter) + fibPlain(n - 2, counter);
    }
    function fibMemo(n, memo, counter) {
      counter.calls++;
      if (n <= 1) return n;
      if (memo[n] !== undefined) return memo[n];
      return memo[n] = fibMemo(n - 1, memo, counter) + fibMemo(n - 2, memo, counter);
    }

    document.getElementById('dpRunBtn').addEventListener('click', async () => {
      const n = parseInt(input.value, 10);
      if (Number.isNaN(n) || n < 1 || n > 38) { logEl.textContent = 'Enter a value from 1 to 38 (plain recursion gets very slow past ~35).'; return; }
      const btn = document.getElementById('dpRunBtn');
      btn.disabled = true;
      logEl.textContent = 'Running both versions of fib(' + n + ')...';
      await sleep(50);

      const memoCounter = { calls: 0 };
      const t0 = performance.now();
      const memoResult = fibMemo(n, {}, memoCounter);
      const memoMs = performance.now() - t0;

      // build the DP table visually — this is what fibMemo's memo object looks like once filled
      const dpVals = [0, 1];
      for (let i = 2; i <= n; i++) dpVals.push(dpVals[i - 1] + dpVals[i - 2]);
      tableWrap.innerHTML = '<div class="dp-table">' + dpVals.map((v, i) => '<div class="dp-cell filled"><span class="dp-idx">fib(' + i + ')</span>' + v + '</div>').join('') + '</div>';

      let plainMs = null, plainCalls = null;
      if (n <= 32) {
        const plainCounter = { calls: 0 };
        const t1 = performance.now();
        fibPlain(n, plainCounter);
        plainMs = performance.now() - t1;
        plainCalls = plainCounter.calls;
      }

      logEl.innerHTML =
        '<div><b>Memoized (DP):</b> fib(' + n + ') = ' + memoResult + ' in ' + memoMs.toFixed(3) + 'ms, ' + memoCounter.calls + ' call(s).</div>' +
        (plainMs !== null
          ? '<div><b>Plain recursion:</b> ' + plainMs.toFixed(1) + 'ms, ' + plainCalls.toLocaleString() + ' call(s).</div>' +
            '<div class="done" style="margin-top:6px;">Memoization used ' + (plainCalls / memoCounter.calls).toFixed(0) + '× fewer calls.</div>'
          : '<div class="no" style="margin-top:6px;">Skipped plain recursion for n > 32 — it would take far too long (calls roughly double for every +1 to n).</div>');
      btn.disabled = false;
    });
  })();

  // ---------- Trie tree lab: visualize the tree as words are inserted ----------
  (function () {
    const svg = document.getElementById('trieTreeSvg');
    const input = document.getElementById('trieTreeInput');
    const logEl = document.getElementById('trieTreeLog');
    if (!svg) return;

    const root = { children: {}, isEnd: false, char: '•' };

    function insert(word) {
      let node = root;
      for (const ch of word.toLowerCase()) {
        if (!node.children[ch]) node.children[ch] = { children: {}, isEnd: false, char: ch };
        node = node.children[ch];
      }
      node.isEnd = true;
    }

    function layout() {
      const w = Math.max(svg.clientWidth || 600, 320);
      const positions = [];
      function measure(node) {
        const keys = Object.keys(node.children);
        if (keys.length === 0) return 1;
        return keys.reduce((sum, k) => sum + measure(node.children[k]), 0);
      }
      function place(node, depth, xMin, xMax) {
        const x = (xMin + xMax) / 2, y = 30 + depth * 55;
        positions.push({ node, x, y });
        const keys = Object.keys(node.children);
        let cursor = xMin;
        keys.forEach(k => {
          const child = node.children[k];
          const span = measure(child);
          const totalSpan = measure(node);
          const childWidth = (xMax - xMin) * (span / totalSpan);
          place(child, depth + 1, cursor, cursor + childWidth);
          cursor += childWidth;
        });
      }
      place(root, 0, 20, w - 20);
      return { positions, w };
    }

    function render() {
      const { positions, w } = layout();
      const maxDepth = positions.reduce((m, p) => Math.max(m, p.y), 0);
      let content = '';
      positions.forEach(p => {
        Object.values(p.node.children).forEach(child => {
          const cp = positions.find(q => q.node === child);
          if (cp) content += '<line class="bst-edge" x1="' + p.x + '" y1="' + p.y + '" x2="' + cp.x + '" y2="' + cp.y + '"/>';
        });
      });
      positions.forEach(p => {
        content += '<circle class="bst-node-circle' + (p.node.isEnd ? ' visited' : '') + '" cx="' + p.x + '" cy="' + p.y + '" r="16"/>';
        content += '<text class="bst-node-text" style="font-size:12px" x="' + p.x + '" y="' + (p.y + 4) + '">' + p.node.char + '</text>';
      });
      svg.setAttribute('viewBox', '0 0 ' + w + ' ' + (maxDepth + 40));
      svg.innerHTML = content;
    }

    document.getElementById('trieTreeInsertBtn').addEventListener('click', () => {
      const w = input.value.trim();
      if (!w) return;
      insert(w);
      render();
      logEl.innerHTML = '<span class="done">Inserted "' + w + '". Gold nodes mark the end of a complete word.</span>';
      input.value = ''; input.focus();
    });
    input.addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('trieTreeInsertBtn').click(); });
    document.getElementById('trieTreeResetBtn').addEventListener('click', () => {
      root.children = {};
      render();
      logEl.textContent = 'Tree cleared. Insert a word to start building it again.';
    });
    render();
  })();

  // ---------- N-Queens lab: backtracking ----------
  (function () {
    const boardEl = document.getElementById('nqueensBoard');
    const sizeSelect = document.getElementById('nqueensSizeSelect');
    const logEl = document.getElementById('nqueensLog');
    const btn = document.getElementById('nqueensBtn');
    if (!boardEl) return;

    function buildBoard(n) {
      boardEl.style.gridTemplateColumns = 'repeat(' + n + ', auto)';
      boardEl.innerHTML = '';
      const cells = [];
      for (let r = 0; r < n; r++) {
        cells.push([]);
        for (let c = 0; c < n; c++) {
          const cell = document.createElement('div');
          cell.className = 'nq-cell' + ((r + c) % 2 === 0 ? ' light' : '');
          boardEl.appendChild(cell);
          cells[r].push(cell);
        }
      }
      return cells;
    }

    async function solve(n) {
      btn.disabled = true;
      const cells = buildBoard(n);
      const cols = new Set(), diag1 = new Set(), diag2 = new Set();
      const queenCol = new Array(n).fill(-1);
      let steps = 0, solved = false;

      async function place(row) {
        if (solved) return;
        if (row === n) { solved = true; return; }
        for (let col = 0; col < n; col++) {
          steps++;
          const safe = !cols.has(col) && !diag1.has(row - col) && !diag2.has(row + col);
          cells[row][col].classList.add('trying');
          logEl.textContent = 'Row ' + row + ': trying column ' + col + (safe ? ' — looks safe, placing queen.' : ' — attacked, skip.');
          await sleep(280);
          cells[row][col].classList.remove('trying');
          if (safe) {
            cols.add(col); diag1.add(row - col); diag2.add(row + col); queenCol[row] = col;
            cells[row][col].classList.add('queen'); cells[row][col].textContent = '♛';
            await place(row + 1);
            if (!solved) {
              cols.delete(col); diag1.delete(row - col); diag2.delete(row + col); queenCol[row] = -1;
              cells[row][col].classList.remove('queen'); cells[row][col].textContent = '';
              cells[row][col].classList.add('rejected');
              logEl.textContent = 'Backtracking from row ' + row + ', column ' + col + ' — no solution down that path.';
              await sleep(280);
              cells[row][col].classList.remove('rejected');
            }
          }
          if (solved) return;
        }
      }
      await place(0);
      logEl.innerHTML = solved
        ? '<span class="done">Solved in ' + steps + ' step(s) — a valid arrangement for ' + n + ' queens.</span>'
        : '<span class="no">No solution found.</span>';
      btn.disabled = false;
    }

    btn.addEventListener('click', () => solve(parseInt(sizeSelect.value, 10)));
    buildBoard(parseInt(sizeSelect.value, 10));
  })();

  // ---------- LRU Cache lab ----------
  (function () {
    const track = document.getElementById('lruTrack');
    const logEl = document.getElementById('lruLog');
    const capInput = document.getElementById('lruCapacityInput');
    const keyInput = document.getElementById('lruKeyInput');
    const valueInput = document.getElementById('lruValueInput');
    if (!track) return;

    let order = []; // array of {key, value}, index 0 = most recently used

    function render(highlightKey, evicted) {
      if (order.length === 0 && !evicted) { track.innerHTML = '<span class="ll-null">Cache is empty.</span>'; return; }
      let html = '<span class="ll-null">MRU →</span>';
      order.forEach((item, i) => {
        if (i > 0) html += '<span class="ll-arrow">→</span>';
        html += '<div class="ll-node' + (item.key === highlightKey ? ' current' : '') + '">' +
          '<span class="ll-node-value">' + item.key + ':' + item.value + '</span></div>';
      });
      if (evicted) {
        html += '<span class="ll-arrow">→</span><div class="ll-node" style="border-color:var(--danger); opacity:0.6;">' +
          '<span class="ll-node-value" style="color:var(--danger)">' + evicted.key + ':' + evicted.value + ' (evicted)</span></div>';
      }
      html += '<span class="ll-arrow">→</span><span class="ll-null">LRU</span>';
      track.innerHTML = html;
    }

    function capacity() { return Math.max(2, Math.min(6, parseInt(capInput.value, 10) || 3)); }

    document.getElementById('lruPutBtn').addEventListener('click', () => {
      const k = parseInt(keyInput.value, 10), v = parseInt(valueInput.value, 10);
      if (Number.isNaN(k) || Number.isNaN(v)) return;
      const idx = order.findIndex(o => o.key === k);
      let evicted = null;
      if (idx !== -1) {
        order.splice(idx, 1);
        logEl.innerHTML = 'put(' + k + ', ' + v + ') — key existed, updated &amp; moved to the front.';
      } else if (order.length === capacity()) {
        evicted = order.pop();
        logEl.innerHTML = '<span class="no">put(' + k + ', ' + v + ') — cache full, evicted key ' + evicted.key + ' (least recently used).</span>';
      } else {
        logEl.innerHTML = 'put(' + k + ', ' + v + ') — inserted at the front.';
      }
      order.unshift({ key: k, value: v });
      render(k, evicted);
      keyInput.value = ''; valueInput.value = ''; keyInput.focus();
    });

    document.getElementById('lruGetBtn').addEventListener('click', () => {
      const k = parseInt(keyInput.value, 10);
      if (Number.isNaN(k)) return;
      const idx = order.findIndex(o => o.key === k);
      if (idx === -1) {
        logEl.innerHTML = '<span class="no">get(' + k + ') → not found (miss).</span>';
        render();
      } else {
        const [item] = order.splice(idx, 1);
        order.unshift(item);
        logEl.innerHTML = '<span class="done">get(' + k + ') → ' + item.value + ' — moved to the front (most recently used).</span>';
        render(k);
      }
      keyInput.value = ''; keyInput.focus();
    });

    document.getElementById('lruResetBtn').addEventListener('click', () => {
      order = [];
      render();
      logEl.textContent = 'Cache reset (capacity ' + capacity() + ').';
    });

    render();
  })();

  // ---------- Topological Sort lab: subject prerequisites (DAG) ----------
  (function () {
    const svg = document.getElementById('topoSvg');
    const logEl = document.getElementById('topoLog');
    const btn = document.getElementById('topoSortBtn');
    if (!svg) return;

    const COURSES = ['Math101', 'Phys101', 'Math201', 'CS101', 'CS201', 'CS301'];
    const PREREQS = [['Math101','Math201'],['Math101','CS101'],['Phys101','CS301'],['CS101','CS201'],['Math201','CS201'],['CS201','CS301']];
    const adj = {}; COURSES.forEach(c => { adj[c] = []; });
    PREREQS.forEach(([a, b]) => adj[a].push(b));

    // simple layered layout: courses with no remaining unplaced prereqs go in the next column
    function computeLayers() {
      const indeg = {}; COURSES.forEach(c => { indeg[c] = 0; });
      PREREQS.forEach(([, b]) => indeg[b]++);
      const layers = [];
      const remaining = new Set(COURSES);
      const localIndeg = { ...indeg };
      while (remaining.size) {
        const layer = [...remaining].filter(c => localIndeg[c] === 0);
        layer.forEach(c => { remaining.delete(c); adj[c].forEach(n => localIndeg[n]--); });
        layers.push(layer);
      }
      return layers;
    }

    function layout() {
      const layers = computeLayers();
      const w = Math.max(svg.clientWidth || 600, 340), h = 280;
      const pos = {};
      layers.forEach((layer, li) => {
        const x = 60 + li * ((w - 120) / Math.max(1, layers.length - 1));
        layer.forEach((c, ci) => {
          const y = 40 + ci * ((h - 80) / Math.max(1, layer.length - 1)) + (layer.length === 1 ? (h - 80) / 2 : 0);
          pos[c] = { x, y: layer.length === 1 ? h / 2 : y };
        });
      });
      return { pos, w, h };
    }

    function render(state) {
      state = state || {};
      const { pos, w, h } = layout();
      let content = '';
      PREREQS.forEach(([a, b]) => {
        const p1 = pos[a], p2 = pos[b];
        const done = state.visitedEdges && state.visitedEdges.has(a + '-' + b);
        content += '<line class="graph-edge' + (done ? ' traversed' : '') + '" x1="' + p1.x + '" y1="' + p1.y + '" x2="' + p2.x + '" y2="' + p2.y + '" marker-end="url(#arrow)"/>';
      });
      COURSES.forEach(c => {
        let cls = 'graph-node-circle';
        if (state.current === c) cls += ' current';
        else if (state.done && state.done.has(c)) cls += ' visited';
        content += '<circle class="' + cls + '" cx="' + pos[c].x + '" cy="' + pos[c].y + '" r="30"/>';
        content += '<text class="graph-node-text" style="font-size:10px" x="' + pos[c].x + '" y="' + pos[c].y + '">' + c + '</text>';
      });
      svg.innerHTML = '<defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6" style="fill:var(--text-faint)"/></marker></defs>' + content;
      svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    }

    async function runTopoSort() {
      btn.disabled = true;
      const visited = new Set(), done = new Set(), visitedEdges = new Set();
      const order = [];
      async function visit(c) {
        visited.add(c);
        logEl.textContent = 'Visiting ' + c + ' — first finishing everything it points to...';
        render({ current: c, done });
        await sleep(500);
        for (const nb of adj[c]) {
          visitedEdges.add(c + '-' + nb);
          if (!visited.has(nb)) await visit(nb);
        }
        done.add(c);
        order.unshift(c); // prepend — a node is placed once everything after it is finished
        logEl.textContent = c + ' has no unfinished dependents — placing it. Order so far: ' + order.join(', ');
        render({ done, visitedEdges });
        await sleep(400);
      }
      for (const c of COURSES) if (!visited.has(c)) await visit(c);
      render({ done, visitedEdges });
      logEl.innerHTML = '<span class="done">Valid order: ' + order.join(' → ') + '</span>';
      btn.disabled = false;
    }
    btn.addEventListener('click', runTopoSort);
    render();
  })();

  // ---------- Union-Find lab: cycle detection while adding edges ----------
  (function () {
    const svg = document.getElementById('ufSvg');
    const logEl = document.getElementById('ufLog');
    const btn = document.getElementById('unionFindBtn');
    if (!svg) return;

    const NODES = ['1', '2', '3', '4', '5', '6', '7'];
    const CANDIDATE_EDGES = [['1','2'],['2','3'],['1','3'],['4','5'],['5','6'],['3','4'],['6','7'],['1','7']];
    const SET_COLORS = ['var(--accent)', 'var(--gold)', 'var(--violet)', 'var(--danger)', '#2dd4bf', '#f472b6', '#84cc16'];

    let parent = {}, rank = {};
    function reset() { NODES.forEach(n => { parent[n] = n; rank[n] = 0; }); }
    function find(x) { if (parent[x] !== x) parent[x] = find(parent[x]); return parent[x]; }
    function union(a, b) {
      const ra = find(a), rb = find(b);
      if (ra === rb) return false;
      if (rank[ra] < rank[rb]) parent[ra] = rb;
      else if (rank[ra] > rank[rb]) parent[rb] = ra;
      else { parent[rb] = ra; rank[ra]++; }
      return true;
    }

    function layout() {
      const w = Math.max(svg.clientWidth || 600, 320), h = 240;
      const cx = w / 2, cy = h / 2, r = Math.min(w, h) / 2 - 40;
      const pos = {};
      NODES.forEach((n, i) => {
        const angle = (i / NODES.length) * 2 * Math.PI - Math.PI / 2;
        pos[n] = { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
      });
      return { pos, w, h };
    }

    function colorFor(root) {
      return SET_COLORS[Math.abs(hashStr(root)) % SET_COLORS.length];
    }
    function hashStr(s) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return h; }

    function render(acceptedEdges, rejectedEdge, highlightNodes) {
      const { pos, w, h } = layout();
      let content = '';
      (acceptedEdges || []).forEach(([a, b]) => {
        content += '<line class="graph-edge traversed" x1="' + pos[a].x + '" y1="' + pos[a].y + '" x2="' + pos[b].x + '" y2="' + pos[b].y + '"/>';
      });
      if (rejectedEdge) {
        const [a, b] = rejectedEdge;
        content += '<line style="stroke:var(--danger); stroke-width:2.5; stroke-dasharray:4" x1="' + pos[a].x + '" y1="' + pos[a].y + '" x2="' + pos[b].x + '" y2="' + pos[b].y + '"/>';
      }
      NODES.forEach(n => {
        const root = find(n);
        const isHighlight = highlightNodes && highlightNodes.includes(n);
        content += '<circle class="graph-node-circle' + (isHighlight ? ' current' : '') + '" style="fill:color-mix(in srgb, ' + colorFor(root) + ' 18%, transparent); stroke:' + colorFor(root) + '" cx="' + pos[n].x + '" cy="' + pos[n].y + '" r="20"/>';
        content += '<text class="graph-node-text" x="' + pos[n].x + '" y="' + pos[n].y + '">' + n + '</text>';
      });
      svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
      svg.innerHTML = content;
    }

    async function run() {
      btn.disabled = true;
      reset();
      const accepted = [];
      render();
      await sleep(400);
      for (const [a, b] of CANDIDATE_EDGES) {
        logEl.textContent = 'Considering edge ' + a + '-' + b + '...';
        render(accepted, null, [a, b]);
        await sleep(500);
        if (find(a) === find(b)) {
          logEl.innerHTML = '<span class="no">Edge ' + a + '-' + b + ' rejected — ' + a + ' and ' + b + ' are already connected, so this would create a cycle.</span>';
          render(accepted, [a, b]);
          await sleep(700);
        } else {
          union(a, b);
          accepted.push([a, b]);
          logEl.innerHTML = '<span class="done">Edge ' + a + '-' + b + ' accepted — merged two separate sets.</span>';
          render(accepted);
          await sleep(500);
        }
      }
      logEl.innerHTML += '<div style="margin-top:6px;">Done. ' + accepted.length + ' edge(s) accepted out of ' + CANDIDATE_EDGES.length + ' — the rest would have formed a cycle.</div>';
      btn.disabled = false;
    }
    btn.addEventListener('click', run);
    reset();
    render();
  })();

  // ---------- Matrix lab: spiral traversal ----------
  (function () {
    const boardEl = document.getElementById('matrixBoard');
    const logEl = document.getElementById('matrixLog');
    const btn = document.getElementById('matrixBtn');
    if (!boardEl) return;
    const ROWS = 4, COLS = 5;
    let grid = [];
    let n = 1;
    for (let r = 0; r < ROWS; r++) { grid.push([]); for (let c = 0; c < COLS; c++) grid[r].push(n++); }
    const cells = [];
    boardEl.style.gridTemplateColumns = 'repeat(' + COLS + ', auto)';
    for (let r = 0; r < ROWS; r++) {
      cells.push([]);
      for (let c = 0; c < COLS; c++) {
        const cell = document.createElement('div');
        cell.className = 'nq-cell light';
        cell.style.fontSize = '14px';
        cell.textContent = grid[r][c];
        boardEl.appendChild(cell);
        cells[r].push(cell);
      }
    }
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      let top = 0, bottom = ROWS - 1, left = 0, right = COLS - 1;
      const order = [];
      while (top <= bottom && left <= right) {
        for (let c = left; c <= right; c++) { order.push(grid[top][c]); cells[top][c].classList.add('queen'); logEl.textContent = 'Visiting ' + grid[top][c] + ' → order: ' + order.join(', '); await sleep(180); }
        top++;
        for (let r = top; r <= bottom; r++) { order.push(grid[r][right]); cells[r][right].classList.add('queen'); logEl.textContent = 'Visiting ' + grid[r][right] + ' → order: ' + order.join(', '); await sleep(180); }
        right--;
        if (top <= bottom) { for (let c = right; c >= left; c--) { order.push(grid[bottom][c]); cells[bottom][c].classList.add('queen'); logEl.textContent = 'Visiting ' + grid[bottom][c] + ' → order: ' + order.join(', '); await sleep(180); } bottom--; }
        if (left <= right) { for (let r = bottom; r >= top; r--) { order.push(grid[r][left]); cells[r][left].classList.add('queen'); logEl.textContent = 'Visiting ' + grid[r][left] + ' → order: ' + order.join(', '); await sleep(180); } left++; }
      }
      logEl.innerHTML = '<span class="done">Spiral order: ' + order.join(', ') + '</span>';
      btn.disabled = false;
    });
  })();

  // ---------- Circular Queue / Deque lab ----------
  (function () {
    const boardEl = document.getElementById('cqBoard');
    const logEl = document.getElementById('cqLog');
    if (!boardEl) return;
    const SIZE = 6;
    let buf = new Array(SIZE).fill(null);
    let front = 0, rear = -1, count = 0;

    function render(highlight) {
      boardEl.style.gridTemplateColumns = 'repeat(' + SIZE + ', auto)';
      boardEl.innerHTML = '';
      for (let i = 0; i < SIZE; i++) {
        const cell = document.createElement('div');
        cell.className = 'nq-cell light' + (i === highlight ? ' trying' : buf[i] !== null ? ' queen' : '');
        cell.style.fontSize = '13px';
        let label = buf[i] !== null ? String(buf[i]) : '';
        if (count > 0 && i === front) label = 'F:' + label;
        if (count > 0 && i === rear) label = (label ? label + ' ' : '') + 'R';
        cell.textContent = label;
        boardEl.appendChild(cell);
      }
    }
    document.getElementById('cqEnqueueBtn').addEventListener('click', () => {
      if (count === SIZE) { logEl.innerHTML = '<span class="no">Full — cannot enqueue (rear would overwrite front).</span>'; return; }
      rear = (rear + 1) % SIZE;
      buf[rear] = Math.floor(Math.random() * 90) + 10;
      count++;
      render(rear);
      logEl.innerHTML = 'Enqueued ' + buf[rear] + ' at rear (index ' + rear + ')' + (rear === 0 && count > 1 ? ' — wrapped around to the start!' : '') + '.';
    });
    document.getElementById('cqDequeueBtn').addEventListener('click', () => {
      if (count === 0) { logEl.innerHTML = '<span class="no">Empty — nothing to dequeue.</span>'; return; }
      const v = buf[front];
      logEl.innerHTML = 'Dequeued ' + v + ' from front (index ' + front + ').';
      buf[front] = null;
      front = (front + 1) % SIZE;
      count--;
      render();
    });
    document.getElementById('cqFrontBtn').addEventListener('click', () => {
      if (count === SIZE) { logEl.innerHTML = '<span class="no">Full — cannot push to front.</span>'; return; }
      front = (front - 1 + SIZE) % SIZE;
      buf[front] = Math.floor(Math.random() * 90) + 10;
      count++;
      render(front);
      logEl.innerHTML = 'Deque: pushed ' + buf[front] + ' onto the front (index ' + front + ') — something only a deque allows, not a plain queue.';
    });
    render();
  })();

  // ---------- AVL Tree lab: self-balancing BST with rotations ----------
  (function () {
    const svg = document.getElementById('avlSvg');
    const input = document.getElementById('avlValueInput');
    const logEl = document.getElementById('avlLog');
    if (!svg) return;
    let root = null;

    function h(node) { return node ? node.height : 0; }
    function bal(node) { return node ? h(node.left) - h(node.right) : 0; }
    function update(node) { node.height = 1 + Math.max(h(node.left), h(node.right)); }
    function rotateRight(y) { const x = y.left; y.left = x.right; x.right = y; update(y); update(x); return x; }
    function rotateLeft(x) { const y = x.right; x.right = y.left; y.left = x; update(x); update(y); return y; }

    function insert(node, v, log) {
      if (!node) return { value: v, left: null, right: null, height: 1 };
      if (v < node.value) node.left = insert(node.left, v, log);
      else if (v > node.value) node.right = insert(node.right, v, log);
      else return node;
      update(node);
      const b = bal(node);
      if (b > 1 && v < node.left.value) { log.push(node.value + ': left-left case → rotate right'); return rotateRight(node); }
      if (b < -1 && v > node.right.value) { log.push(node.value + ': right-right case → rotate left'); return rotateLeft(node); }
      if (b > 1 && v > node.left.value) { log.push(node.value + ': left-right case → rotate left then right'); node.left = rotateLeft(node.left); return rotateRight(node); }
      if (b < -1 && v < node.right.value) { log.push(node.value + ': right-left case → rotate right then left'); node.right = rotateRight(node.right); return rotateLeft(node); }
      return node;
    }

    function layout(node, depth, xMin, xMax, positions) {
      if (!node) return;
      const x = (xMin + xMax) / 2, y = 30 + depth * 55;
      positions.push({ node, x, y });
      layout(node.left, depth + 1, xMin, x, positions);
      layout(node.right, depth + 1, x, xMax, positions);
    }
    function render() {
      const w = Math.max(svg.clientWidth || 600, 300);
      const positions = [];
      layout(root, 0, 16, w - 16, positions);
      let content = '';
      positions.forEach(p => {
        if (p.node.left) { const c = positions.find(q => q.node === p.node.left); content += '<line class="bst-edge" x1="' + p.x + '" y1="' + p.y + '" x2="' + c.x + '" y2="' + c.y + '"/>'; }
        if (p.node.right) { const c = positions.find(q => q.node === p.node.right); content += '<line class="bst-edge" x1="' + p.x + '" y1="' + p.y + '" x2="' + c.x + '" y2="' + c.y + '"/>'; }
      });
      positions.forEach(p => {
        content += '<circle class="bst-node-circle" cx="' + p.x + '" cy="' + p.y + '" r="18"/>';
        content += '<text class="bst-node-text" style="font-size:12px" x="' + p.x + '" y="' + (p.y + 4) + '">' + p.node.value + '</text>';
      });
      const maxY = positions.reduce((m, p) => Math.max(m, p.y), 40);
      svg.setAttribute('viewBox', '0 0 ' + w + ' ' + (maxY + 30));
      svg.innerHTML = content;
    }

    document.getElementById('avlInsertBtn').addEventListener('click', () => {
      const v = parseInt(input.value, 10);
      if (Number.isNaN(v)) return;
      const log = [];
      root = insert(root, v, log);
      render();
      logEl.innerHTML = log.length
        ? '<span class="done">Inserted ' + v + '. Rebalanced: ' + log.join('; ') + '.</span>'
        : 'Inserted ' + v + ' — tree was already balanced, no rotation needed.';
      input.value = ''; input.focus();
    });
    document.getElementById('avlResetBtn').addEventListener('click', () => {
      root = null; render(); logEl.textContent = 'Tree cleared.';
    });
    render();
  })();

  // ---------- Counting Sort lab ----------
  (function () {
    const arrayEl = document.getElementById('countingSortArray');
    const bucketsEl = document.getElementById('countingSortBuckets');
    const logEl = document.getElementById('countingSortLog');
    const btn = document.getElementById('countingSortBtn');
    if (!btn) return;
    let values = [];
    function shuffle() {
      values = Array.from({ length: 10 }, () => Math.floor(Math.random() * 15));
      arrayEl.innerHTML = values.map(v => '<div class="cell">' + v + '</div>').join('');
      logEl.textContent = '';
      bucketsEl.innerHTML = '';
    }
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      const maxV = Math.max(...values);
      const counts = new Array(maxV + 1).fill(0);
      for (const v of values) counts[v]++;
      logEl.textContent = 'Counting occurrences of each value (0 to ' + maxV + ')...';
      bucketsEl.innerHTML = '<div class="dp-table">' + counts.map((c, i) => '<div class="dp-cell' + (c > 0 ? ' filled' : '') + '"><span class="dp-idx">' + i + '</span>' + c + '</div>').join('') + '</div>';
      await sleep(700);
      const sorted = [];
      for (let v = 0; v <= maxV; v++) for (let k = 0; k < counts[v]; k++) sorted.push(v);
      arrayEl.innerHTML = sorted.map(v => '<div class="cell cell-settled">' + v + '</div>').join('');
      logEl.innerHTML = '<span class="done">Sorted by rebuilding from counts — no comparisons made.</span>';
      btn.disabled = false;
    });
    shuffle();
  })();

  // ---------- MST lab: Prim's and Kruskal's on the weighted graph ----------
  (function () {
    const svg = document.getElementById('mstSvg');
    const logEl = document.getElementById('mstLog');
    if (!svg) return;
    const NODES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    const EDGES = [['A','B',4],['A','C',2],['B','D',5],['C','D',1],['C','E',8],['D','F',3],['E','F',2],['E','G',6],['F','H',4],['G','H',1]];
    const adj = {}; NODES.forEach(n => { adj[n] = []; });
    EDGES.forEach(([a, b, w]) => { adj[a].push({ to: b, w }); adj[b].push({ to: a, w }); });

    function layout() {
      const w = Math.max(svg.clientWidth || 600, 320), h = 320;
      const cx = w / 2, cy = h / 2, r = Math.min(w, h) / 2 - 40;
      const pos = {};
      NODES.forEach((n, i) => { const a = (i / NODES.length) * 2 * Math.PI - Math.PI / 2; pos[n] = { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }; });
      return { pos, w, h };
    }
    function render(mstEdges, current) {
      const { pos, w, h } = layout();
      const mstSet = new Set((mstEdges || []).map(([a, b]) => a + '-' + b));
      let content = '';
      EDGES.forEach(([a, b, weight]) => {
        const inMst = mstSet.has(a + '-' + b) || mstSet.has(b + '-' + a);
        content += '<line class="graph-edge' + (inMst ? ' shortest-path' : '') + '" x1="' + pos[a].x + '" y1="' + pos[a].y + '" x2="' + pos[b].x + '" y2="' + pos[b].y + '"/>';
        const mx = (pos[a].x + pos[b].x) / 2, my = (pos[a].y + pos[b].y) / 2;
        content += '<text class="graph-weight-text' + (inMst ? ' on-path' : '') + '" x="' + mx + '" y="' + my + '">' + weight + '</text>';
      });
      NODES.forEach(n => {
        const cls = 'graph-node-circle' + (n === current ? ' current' : mstSet.size && [...mstSet].some(k => k.startsWith(n + '-') || k.endsWith('-' + n)) ? ' visited' : '');
        content += '<circle class="' + cls + '" cx="' + pos[n].x + '" cy="' + pos[n].y + '" r="22"/>';
        content += '<text class="graph-node-text" x="' + pos[n].x + '" y="' + pos[n].y + '">' + n + '</text>';
      });
      svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
      svg.innerHTML = content;
    }

    async function runPrim() {
      document.getElementById('primBtn').disabled = true; document.getElementById('kruskalBtn').disabled = true;
      const inTree = new Set(['A']);
      const mstEdges = [];
      let totalCost = 0;
      render([], 'A');
      await sleep(500);
      while (inTree.size < NODES.length) {
        let best = null;
        inTree.forEach(u => adj[u].forEach(({ to, w }) => {
          if (!inTree.has(to) && (!best || w < best.w)) best = { from: u, to, w };
        }));
        if (!best) break;
        logEl.textContent = 'Cheapest edge leaving the tree: ' + best.from + '-' + best.to + ' (weight ' + best.w + ')';
        await sleep(500);
        inTree.add(best.to); mstEdges.push([best.from, best.to]); totalCost += best.w;
        render(mstEdges, best.to);
        await sleep(400);
      }
      logEl.innerHTML = '<span class="done">Prim\'s MST total cost: ' + totalCost + '</span>';
      document.getElementById('primBtn').disabled = false; document.getElementById('kruskalBtn').disabled = false;
    }

    async function runKruskal() {
      document.getElementById('primBtn').disabled = true; document.getElementById('kruskalBtn').disabled = true;
      const parent = {}; NODES.forEach(n => parent[n] = n);
      function find(x) { if (parent[x] !== x) parent[x] = find(parent[x]); return parent[x]; }
      const sortedEdges = [...EDGES].sort((a, b) => a[2] - b[2]);
      const mstEdges = [];
      let totalCost = 0;
      render([]);
      await sleep(400);
      for (const [a, b, w] of sortedEdges) {
        logEl.textContent = 'Considering edge ' + a + '-' + b + ' (weight ' + w + ')...';
        await sleep(450);
        if (find(a) === find(b)) {
          logEl.innerHTML = '<span class="no">Skipped ' + a + '-' + b + ' — would form a cycle.</span>';
        } else {
          parent[find(a)] = find(b); mstEdges.push([a, b]); totalCost += w;
          logEl.innerHTML = '<span class="done">Added ' + a + '-' + b + '.</span>';
          render(mstEdges);
        }
        await sleep(350);
      }
      logEl.innerHTML = '<span class="done">Kruskal\'s MST total cost: ' + totalCost + '</span>';
      document.getElementById('primBtn').disabled = false; document.getElementById('kruskalBtn').disabled = false;
    }
    document.getElementById('primBtn').addEventListener('click', runPrim);
    document.getElementById('kruskalBtn').addEventListener('click', runKruskal);
    render([]);
  })();

  // ---------- Bellman-Ford & Floyd-Warshall lab ----------
  (function () {
    const logEl = document.getElementById('shortestPathsLog');
    const tableEl = document.getElementById('shortestPathsTable');
    if (!logEl) return;
    const NODES = ['A', 'B', 'C', 'D', 'E'];
    // small graph with one negative edge, no negative cycle
    const EDGES = [['A','B',6],['A','C',4],['B','D',1],['C','B',-3],['C','D',3],['D','E',2],['B','E',9]];

    document.getElementById('bellmanFordBtn').addEventListener('click', async () => {
      const btn = document.getElementById('bellmanFordBtn'); btn.disabled = true;
      const dist = {}; NODES.forEach(n => dist[n] = Infinity); dist['A'] = 0;
      for (let i = 0; i < NODES.length - 1; i++) {
        let changed = false;
        for (const [u, v, w] of EDGES) {
          if (dist[u] + w < dist[v]) { dist[v] = dist[u] + w; changed = true; }
        }
        logEl.textContent = 'Pass ' + (i + 1) + ' of relaxing every edge: ' + NODES.map(n => n + '=' + (dist[n] === Infinity ? '∞' : dist[n])).join(', ');
        await sleep(600);
        if (!changed) break;
      }
      logEl.innerHTML = '<span class="done">Shortest distances from A: ' + NODES.map(n => n + '=' + dist[n]).join(', ') + ' (found despite the negative edge C→B).</span>';
      btn.disabled = false;
    });

    document.getElementById('floydWarshallBtn').addEventListener('click', async () => {
      const btn = document.getElementById('floydWarshallBtn'); btn.disabled = true;
      const n = NODES.length;
      const idx = {}; NODES.forEach((nm, i) => idx[nm] = i);
      const dist = Array.from({ length: n }, () => new Array(n).fill(Infinity));
      for (let i = 0; i < n; i++) dist[i][i] = 0;
      EDGES.forEach(([u, v, w]) => { dist[idx[u]][idx[v]] = Math.min(dist[idx[u]][idx[v]], w); });

      function renderTable() {
        let html = '<div class="dp-table" style="flex-direction:column;">';
        html += '<div class="dp-table">' + ['', ...NODES].map(h => '<div class="dp-cell"><b>' + h + '</b></div>').join('') + '</div>';
        NODES.forEach((rn, i) => {
          html += '<div class="dp-table">' + ['<div class="dp-cell filled"><b>' + rn + '</b></div>', ...dist[i].map(d => '<div class="dp-cell">' + (d === Infinity ? '∞' : d) + '</div>')].join('') + '</div>';
        });
        html += '</div>';
        tableEl.innerHTML = html;
      }
      renderTable();
      for (let k = 0; k < n; k++) {
        logEl.textContent = 'Trying node ' + NODES[k] + ' as a via-point for every pair...';
        await sleep(500);
        for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
          if (dist[i][k] + dist[k][j] < dist[i][j]) dist[i][j] = dist[i][k] + dist[k][j];
        }
        renderTable();
        await sleep(300);
      }
      logEl.innerHTML = '<span class="done">All-pairs shortest distances computed — read row/column for any A..E pair.</span>';
      btn.disabled = false;
    });
  })();

  // ---------- Kahn's Algorithm: second method on the Topo Sort lab ----------
  (function () {
    const btn = document.getElementById('topoSortBtn');
    if (!btn) return;
    const wrap = btn.parentElement;
    const kahnBtn = document.createElement('button');
    kahnBtn.className = 'btn-ghost';
    kahnBtn.id = 'kahnBtn';
    kahnBtn.textContent = "Run Kahn's algorithm";
    wrap.appendChild(kahnBtn);

    const COURSES = ['Math101', 'Phys101', 'Math201', 'CS101', 'CS201', 'CS301'];
    const PREREQS = [['Math101','Math201'],['Math101','CS101'],['Phys101','CS301'],['CS101','CS201'],['Math201','CS201'],['CS201','CS301']];
    const adj = {}; COURSES.forEach(c => adj[c] = []);
    PREREQS.forEach(([a, b]) => adj[a].push(b));
    const logEl = document.getElementById('topoLog');

    kahnBtn.addEventListener('click', async () => {
      kahnBtn.disabled = true;
      const indeg = {}; COURSES.forEach(c => indeg[c] = 0);
      PREREQS.forEach(([, b]) => indeg[b]++);
      let queue = COURSES.filter(c => indeg[c] === 0);
      const order = [];
      while (queue.length) {
        logEl.textContent = "Kahn's: queue = [" + queue.join(', ') + '] (indegree 0 — no unmet prerequisites)';
        await sleep(600);
        const c = queue.shift();
        order.push(c);
        adj[c].forEach(nb => { indeg[nb]--; if (indeg[nb] === 0) queue.push(nb); });
      }
      logEl.innerHTML = '<span class="done">Kahn\'s order: ' + order.join(' → ') + ' (same idea as the DFS version above, built with a Queue instead of recursion).</span>';
      kahnBtn.disabled = false;
    });
  })();

  // ---------- Huffman Coding lab ----------
  (function () {
    const svg = document.getElementById('huffmanSvg');
    const input = document.getElementById('huffmanInput');
    const logEl = document.getElementById('huffmanLog');
    if (!svg) return;

    document.getElementById('huffmanBtn').addEventListener('click', () => {
      const text = input.value.trim();
      if (!text) return;
      const freq = {};
      for (const ch of text) freq[ch] = (freq[ch] || 0) + 1;
      let nodes = Object.entries(freq).map(([ch, f]) => ({ ch, freq: f, left: null, right: null }));
      if (nodes.length === 1) nodes.push({ ch: null, freq: 0, left: null, right: null });
      while (nodes.length > 1) {
        nodes.sort((a, b) => a.freq - b.freq);
        const a = nodes.shift(), b = nodes.shift();
        nodes.push({ ch: null, freq: a.freq + b.freq, left: a, right: b });
      }
      const root = nodes[0];
      const codes = {};
      (function walk(node, path) {
        if (!node) return;
        if (node.ch !== null) { codes[node.ch] = path || '0'; return; }
        walk(node.left, path + '0'); walk(node.right, path + '1');
      })(root, '');

      // layout + render
      const positions = [];
      function measure(node) { if (!node.left && !node.right) return 1; return (node.left ? measure(node.left) : 0) + (node.right ? measure(node.right) : 0); }
      function place(node, depth, xMin, xMax) {
        const x = (xMin + xMax) / 2, y = 30 + depth * 55;
        positions.push({ node, x, y });
        if (node.left) { const span = measure(node.left), total = measure(node); place(node.left, depth + 1, xMin, xMin + (xMax - xMin) * span / total); }
        if (node.right) { const span = measure(node.right), total = measure(node); place(node.right, depth + 1, xMax - (xMax - xMin) * span / total, xMax); }
      }
      const w = Math.max(svg.clientWidth || 600, 320);
      place(root, 0, 16, w - 16);
      let content = '';
      positions.forEach(p => {
        if (p.node.left) { const c = positions.find(q => q.node === p.node.left); content += '<line class="bst-edge" x1="' + p.x + '" y1="' + p.y + '" x2="' + c.x + '" y2="' + c.y + '"/><text class="graph-weight-text" x="' + ((p.x + c.x) / 2 - 6) + '" y="' + ((p.y + c.y) / 2) + '">0</text>'; }
        if (p.node.right) { const c = positions.find(q => q.node === p.node.right); content += '<line class="bst-edge" x1="' + p.x + '" y1="' + p.y + '" x2="' + c.x + '" y2="' + c.y + '"/><text class="graph-weight-text" x="' + ((p.x + c.x) / 2 + 6) + '" y="' + ((p.y + c.y) / 2) + '">1</text>'; }
      });
      positions.forEach(p => {
        const label = p.node.ch !== null ? (p.node.ch === ' ' ? '␣' : p.node.ch) + ':' + p.node.freq : p.node.freq;
        content += '<circle class="bst-node-circle' + (p.node.ch !== null ? ' visited' : '') + '" cx="' + p.x + '" cy="' + p.y + '" r="18"/>';
        content += '<text class="bst-node-text" style="font-size:10px" x="' + p.x + '" y="' + (p.y + 3) + '">' + label + '</text>';
      });
      const maxY = positions.reduce((m, p) => Math.max(m, p.y), 40);
      svg.setAttribute('viewBox', '0 0 ' + w + ' ' + (maxY + 30));
      svg.innerHTML = content;

      const originalBits = text.length * 8;
      const huffmanBits = [...text].reduce((sum, ch) => sum + codes[ch].length, 0);
      const codeList = Object.entries(codes).map(([ch, code]) => (ch === ' ' ? '␣' : ch) + '=' + code).join(', ');
      logEl.innerHTML = '<div>Codes: ' + codeList + '</div>' +
        '<div class="done" style="margin-top:6px;">Fixed-width (8 bits/char): ' + originalBits + ' bits → Huffman: ' + huffmanBits + ' bits (' + Math.round((1 - huffmanBits / originalBits) * 100) + '% smaller).</div>';
    });
  })();

  // ---------- 0/1 Knapsack & LCS: added to the DP lab ----------
  (function () {
    const dpLogEl = document.getElementById('dpLog');
    if (!dpLogEl) return;
    const runBtn = document.getElementById('dpRunBtn');
    const wrap = runBtn.parentElement;

    const knapBtn = document.createElement('button');
    knapBtn.className = 'btn-ghost'; knapBtn.id = 'knapsackBtn'; knapBtn.textContent = '0/1 Knapsack demo';
    const lcsBtn = document.createElement('button');
    lcsBtn.className = 'btn-ghost'; lcsBtn.id = 'lcsBtn'; lcsBtn.textContent = 'LCS demo';
    wrap.appendChild(knapBtn); wrap.appendChild(lcsBtn);
    const tableWrap = document.getElementById('dpTable');

    knapBtn.addEventListener('click', () => {
      const items = [{ name: 'Book', w: 2, v: 3 }, { name: 'Laptop', w: 4, v: 8 }, { name: 'Charger', w: 1, v: 2 }, { name: 'Bottle', w: 3, v: 4 }];
      const capacity = 6;
      const n = items.length;
      const dp = Array.from({ length: n + 1 }, () => new Array(capacity + 1).fill(0));
      for (let i = 1; i <= n; i++) {
        for (let cap = 0; cap <= capacity; cap++) {
          dp[i][cap] = dp[i - 1][cap];
          if (items[i - 1].w <= cap) dp[i][cap] = Math.max(dp[i][cap], dp[i - 1][cap - items[i - 1].w] + items[i - 1].v);
        }
      }
      let html = '<div class="dp-table">' + ['cap→', ...Array.from({ length: capacity + 1 }, (_, c) => c)].map(h => '<div class="dp-cell"><b>' + h + '</b></div>').join('') + '</div>';
      items.forEach((it, i) => {
        html += '<div class="dp-table">' + ['<div class="dp-cell filled"><b>' + it.name + '</b></div>', ...dp[i + 1].map(v => '<div class="dp-cell">' + v + '</div>')].join('') + '</div>';
      });
      tableWrap.innerHTML = html;
      dpLogEl.innerHTML = '<span class="done">Best value with capacity ' + capacity + ': ' + dp[n][capacity] + '</span> — each row adds one item, each column is a capacity limit; every cell asks "skip this item, or take it?"';
    });

    lcsBtn.addEventListener('click', () => {
      const a = 'STUDENT', b = 'STUDIED';
      const n = a.length, m = b.length;
      const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
      for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) {
        dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
      let html = '<div class="dp-table">' + ['', ...b.split('')].map(h => '<div class="dp-cell"><b>' + h + '</b></div>').join('') + '</div>';
      for (let i = 0; i <= n; i++) {
        html += '<div class="dp-table">' + ['<div class="dp-cell filled"><b>' + (i === 0 ? '' : a[i - 1]) + '</b></div>', ...dp[i].map(v => '<div class="dp-cell">' + v + '</div>')].join('') + '</div>';
      }
      tableWrap.innerHTML = html;
      dpLogEl.innerHTML = '<span class="done">LCS("' + a + '", "' + b + '") length = ' + dp[n][m] + '</span> — each cell asks "do these two letters match? extend diagonally. If not, take the best of skipping one letter from either string."';
    });
  })();

  // ---------- Bit Manipulation lab ----------
  (function () {
    const logEl = document.getElementById('bitmanipLog');
    if (!logEl) return;
    document.getElementById('bitCountBtn').addEventListener('click', () => {
      const v = parseInt(document.getElementById('bitInputA').value, 10);
      if (Number.isNaN(v) || v < 0) return;
      let count = 0, n = v;
      while (n > 0) { count += n & 1; n >>= 1; }
      logEl.innerHTML = v + ' in binary is <b>' + v.toString(2) + '</b> — <span class="done">' + count + ' set bit(s).</span>';
    });
    document.getElementById('bitPow2Btn').addEventListener('click', () => {
      const v = parseInt(document.getElementById('bitInputA').value, 10);
      if (Number.isNaN(v) || v <= 0) return;
      const isPow2 = (v & (v - 1)) === 0;
      logEl.innerHTML = v + ' &amp; (' + v + '-1) = ' + (v & (v - 1)) + ' → ' +
        (isPow2 ? '<span class="done">yes, a power of 2 — only one bit is set.</span>' : '<span class="no">no — more than one bit is set.</span>');
    });
    document.getElementById('bitSwapBtn').addEventListener('click', () => {
      let a = parseInt(document.getElementById('bitSwapA').value, 10);
      let b = parseInt(document.getElementById('bitSwapB').value, 10);
      if (Number.isNaN(a) || Number.isNaN(b)) return;
      const beforeA = a, beforeB = b;
      a = a ^ b; b = a ^ b; a = a ^ b;
      logEl.innerHTML = 'Before: A=' + beforeA + ', B=' + beforeB + ' → <span class="done">After XOR swap: A=' + a + ', B=' + b + '</span> (no temporary variable used).';
    });
  })();

  // ---------- guided tour: walks through the whole app on its own ----------
  (function () {
    const tourBtn = document.getElementById('tourBtn');
    const tourStopBtn = document.getElementById('tourStopBtn');
    const tourBanner = document.getElementById('tourBanner');
    const tourBannerText = document.getElementById('tourBannerText');
    let tourStopped = false;

    function click(id) { const el = document.getElementById(id); if (el) el.click(); }
    function setVal(id, v) { const el = document.getElementById(id); if (el) el.value = v; }
    function goTab(tab) { click_tab(tab); }
    function click_tab(tab) {
      const btn = document.querySelector('.tab-btn[data-tab="' + tab + '"]');
      if (btn) btn.click();
    }
    function say(text) { tourBannerText.textContent = text; }
    function tourSleep(ms) { return new Promise(r => setTimeout(r, ms)); }

    const TOUR_STEPS = [
      { tab: 'overview', text: 'Welcome! This is the Overview tab — add students, search, undo, and see live class stats. Watch the top-right corner of each card as we go.', focus: 'tourBanner', wait: 2200 },
      { tab: 'overview', text: 'Adding a new student "Tour Demo" with 73 marks — it drops straight into the ranked list, sorted automatically.', focus: 'addBtn', action: () => { setVal('name', 'Tour Demo'); setVal('marks', '73'); click('addBtn'); }, wait: 1600 },
      { tab: 'overview', text: 'Searching for "Tour Demo" — a plain linear scan through the list.', focus: 'searchBtn', action: () => { setVal('searchInput', 'Tour Demo'); click('searchBtn'); }, wait: 1200 },
      { tab: 'overview', text: 'Undo pops the last action off a Stack (LIFO) and reverses it — Tour Demo disappears again.', focus: 'undoBtn', action: () => click('undoBtn'), wait: 1200 },
      { tab: 'overview', text: 'Rank lookup jumps straight to any position — here, rank #3.', focus: 'kthBtn', action: () => { setVal('kthInput', '3'); click('kthBtn'); }, wait: 1400 },
      { tab: 'sorting', text: 'Sorting tab. First up: Bubble Sort — compares neighbors and swaps them if out of order, one pass at a time.', focus: 'bubbleBtn', action: () => click('bubbleBtn'), wait: 7000 },
      { tab: 'sorting', text: 'Selection Sort — finds the minimum of the unsorted part each pass, one swap per pass.', focus: 'selectionBtn', action: () => click('selectionBtn'), wait: 7000 },
      { tab: 'sorting', text: 'Insertion Sort — grows a sorted section from the left, shifting values into place.', focus: 'insertionBtn', action: () => click('insertionBtn'), wait: 6000 },
      { tab: 'sorting', text: 'Merge Sort — divide and conquer: split in half recursively, then merge back in order.', focus: 'mergeBtn', action: () => click('mergeBtn'), wait: 4500 },
      { tab: 'searching', text: 'Searching tab. Linear Search checks every student one by one.', focus: 'linearSearchBtn', action: () => { setVal('linearSearchInput', 'Priya'); click('linearSearchBtn'); }, wait: 4000 },
      { tab: 'searching', text: 'Binary Search sorts first, then halves the range each step — far fewer checks.', focus: 'bsearchBtn', action: () => { setVal('bsearchInput', '92'); click('bsearchBtn'); }, wait: 3500 },
      { tab: 'structures', text: 'Structures tab. This Queue tracks the 5 most recent additions — first in, first out (opposite of the Undo stack).', focus: 'queueRow', wait: 2000 },
      { tab: 'structures', text: 'Grade Distribution tallies every letter grade in one pass using a HashMap.', focus: 'gradeBars', wait: 1800 },
      { tab: 'structures', text: 'Checking for duplicate marks using a HashSet — O(1) lookups instead of comparing every pair.', focus: 'dupBtn', action: () => click('dupBtn'), wait: 3500 },
      { tab: 'structures', text: 'Building a Binary Search Tree — smaller left, larger right — then reading it inorder gives sorted order automatically.', focus: 'bstBtn', action: () => click('bstBtn'), wait: 5500 },
      { tab: 'patterns', text: 'Patterns tab. "Two Sum": finding two students whose marks add to 170, using a hash map instead of checking every pair.', focus: 'twosumBtn', action: () => { setVal('twosumInput', '170'); click('twosumBtn'); }, wait: 3500 },
      { tab: 'patterns', text: 'Reversing the list with two pointers — one from each end, swapping toward the middle.', focus: 'reverseBtn', action: () => click('reverseBtn'), wait: 3500 },
      { tab: 'patterns', text: 'Sliding Window finds the best-average streak of 3 consecutive students.', focus: 'windowBtn', action: () => { setVal('windowInput', '3'); click('windowBtn'); }, wait: 4500 },
      { tab: 'patterns', text: 'Prefix Sum precomputes running totals, so the class average "so far" is a single lookup.', focus: 'prefixBtn', action: () => click('prefixBtn'), wait: 1200 },
      { tab: 'patterns', text: 'Recursion sums the marks by calling itself down the list, then adds up as it unwinds — watch the call stack.', focus: 'recurBtn', action: () => click('recurBtn'), wait: 4500 },
      { tab: 'snake', text: 'Learn tab — 21 standalone practice labs organized into 6 categories, each with their own random data, independent of your class list.', focus: 'labCatalog', wait: 2400 },
      { tab: 'overview', text: "That's the whole project! Every tab is still fully interactive — explore anything, anytime.", focus: 'tourBanner', wait: 2600 },
    ];

    function scrollToStep(step) {
      const el = document.getElementById(step.focus || 'tourBanner');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    async function runTour() {
      tourStopped = false;
      tourBtn.disabled = true;
      tourBanner.classList.add('active');
      const prevSpeedFactor = globalSpeedFactor;
      globalSpeedFactor = SPEED_FACTORS[4]; // run the tour at a brisk, watchable pace
      syncSpeedSliders(4);

      for (const step of TOUR_STEPS) {
        if (tourStopped) break;
        goTab(step.tab);
        say(step.text);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        await tourSleep(450);
        scrollToStep(step);
        await tourSleep(500);
        if (tourStopped) break;
        if (step.action) step.action();
        await tourSleep(step.wait);
      }

      globalSpeedFactor = prevSpeedFactor;
      tourBanner.classList.remove('active');
      tourBtn.disabled = false;
    }

    tourBtn.addEventListener('click', runTour);
    tourStopBtn.addEventListener('click', () => { tourStopped = true; });
  })();

  // seed with sample data (not recorded in undo history)
  addStudent('Rahul', 78, false);
  addStudent('Priya', 92, false);
  addStudent('Aman', 65, false);
  addStudent('Sneha', 88, false);
  addStudent('Kabir', 55, false);
  addStudent('Isha', 97, false);
  addStudent('Arjun', 71, false);
  addStudent('Divya', 83, false);
  addStudent('Rohan', 46, false);
  addStudent('Kavya', 90, false);
  addStudent('Yash', 68, false);
  addStudent('Neha', 59, false);
  addStudent('Karan', 76, false);
  addStudent('Ananya', 99, false);
  addStudent('Vikram', 39, false);
  addStudent('Simran', 85, false);
  addStudent('Aditya', 62, false);
  addStudent('Meera', 94, false);
  addStudent('Harsh', 51, false);
  addStudent('Riya', 80, false);
})();
