(function () {
  const ALGOS = {
    bubble: { label: 'BUBBLE', desc: 'Repeatedly swaps neighboring values that are out of order until the row settles.', complexity: 'O(n²)' },
    selection: { label: 'SELECTION', desc: 'Each pass finds the smallest remaining value and swaps it into place.', complexity: 'O(n²)' },
    insertion: { label: 'INSERTION', desc: 'Grows a sorted section on the left, sliding each new value into its spot.', complexity: 'O(n²)' },
    merge: { label: 'MERGE', desc: 'Splits the row in half recursively, then merges the halves back in order.', complexity: 'O(n log n)' },
    quick: { label: 'QUICK', desc: 'Picks a pivot, partitions smaller/larger values around it, and recurses.', complexity: 'O(n log n) avg' },
    heap: { label: 'HEAP', desc: 'Builds a max-heap, then repeatedly swaps the max to the end and shrinks the heap.', complexity: 'O(n log n)' }
  };

  const N = 11;
  let values = [];
  let algo = 'bubble';
  let running = false, paused = false, stopped = false;
  let comparisons = 0, swaps = 0, steps = 0;
  let speedMs = 550;

  const stage = document.getElementById('stage');
  const spinePath = document.getElementById('spinePath');
  const spineSvg = document.getElementById('spineSvg');
  const statusLine = document.getElementById('statusLine');
  const compCount = document.getElementById('compCount');
  const swapCount = document.getElementById('swapCount');
  const stepCount = document.getElementById('stepCount');
  const playBtn = document.getElementById('playBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const stopBtn = document.getElementById('stopBtn');
  const shuffleBtn = document.getElementById('shuffleBtn');
  const speedSlider = document.getElementById('speedSlider');
  const speedTag = document.getElementById('speedTag');
  const algoBadge = document.getElementById('algoBadge');
  const algoDesc = document.getElementById('algoDesc');
  const tabs = document.querySelectorAll('.tab');

  function shuffle() {
    values = Array.from({ length: N }, (_, i) => i * 7 + 3);
    for (let i = values.length - 1; i > 0; i--) {
      const j = Math.floor(pseudoRandom() * (i + 1));
      [values[i], values[j]] = [values[j], values[i]];
    }
  }
  let seed = 42;
  function pseudoRandom() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed % 10000) / 10000; }

  function layout() {
    const w = stage.clientWidth, h = stage.clientHeight;
    const marginX = 50, marginY = 40;
    const usableW = w - marginX * 2;
    const cols = Math.min(N, 6);
    const rows = Math.ceil(N / cols);
    const stepX = cols > 1 ? usableW / (cols - 1) : 0;
    const stepY = rows > 1 ? (h - marginY * 2) / (rows - 1) : 0;
    const pos = [];
    for (let i = 0; i < N; i++) {
      const row = Math.floor(i / cols);
      let colInRow = i % cols;
      const rowLen = Math.min(cols, N - row * cols);
      const rowStepX = rowLen > 1 ? usableW / (rowLen - 1) : 0;
      if (row % 2 === 1) colInRow = rowLen - 1 - colInRow; // zigzag: odd rows flow right-to-left, like a snake winding back
      const x = marginX + colInRow * rowStepX;
      const y = marginY + row * stepY;
      pos.push({ x, y });
    }
    return pos;
  }

  let nodeEls = [];
  function buildNodes() {
    stage.querySelectorAll('.node').forEach(n => n.remove());
    nodeEls = values.map((v) => {
      const el = document.createElement('div');
      el.className = 'node';
      el.textContent = v;
      stage.appendChild(el);
      return el;
    });
    positionAll();
  }

  function positionAll(highlightMap) {
    const pos = layout();
    const order = currentOrderIndices();
    order.forEach((valueIdx, slot) => {
      const el = nodeEls[valueIdx];
      el.style.left = pos[slot].x + 'px';
      el.style.top = pos[slot].y + 'px';
      el.className = 'node' + (highlightMap && highlightMap[slot] ? ' ' + highlightMap[slot] : '');
    });
    updateSpine(pos);
  }

  // maps "slot in current visual order" -> which original nodeEl index holds that slot's value
  let displayOrder = [];
  function currentOrderIndices() { return displayOrder; }

  function updateSpine(pos) {
    spineSvg.setAttribute('viewBox', '0 0 ' + stage.clientWidth + ' ' + stage.clientHeight);
    spinePath.setAttribute('points', pos.map(p => p.x + ',' + p.y).join(' '));
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
  async function tick() {
    steps++; stepCount.textContent = steps;
    while (paused && !stopped) await sleep(80);
    if (stopped) throw new Error('stopped');
    await sleep(speedMs);
  }

  function setStatus(text, done) {
    statusLine.textContent = text;
    statusLine.className = 'statusline' + (done ? ' done' : '');
  }

  async function render(highlightBySlot) {
    positionAll(highlightBySlot);
  }

  async function swapSlots(a, b) {
    swaps++; swapCount.textContent = swaps;
    [displayOrder[a], displayOrder[b]] = [displayOrder[b], displayOrder[a]];
  }

  // --- algorithms operate on displayOrder (array of original indices) by slot position ---
  function valAt(slot) { return values[displayOrder[slot]]; }

  async function bubbleSort() {
    const n = N;
    for (let p = 0; p < n - 1; p++) {
      let didSwap = false;
      for (let i = 0; i < n - p - 1; i++) {
        comparisons++; compCount.textContent = comparisons;
        setStatus('Comparing ' + valAt(i) + ' and ' + valAt(i + 1));
        const hl = {}; hl[i] = 'compare'; hl[i + 1] = 'compare';
        for (let s = n - p; s < n; s++) hl[s] = 'settled';
        await render(hl); await tick();
        if (valAt(i) > valAt(i + 1)) {
          await swapSlots(i, i + 1); didSwap = true;
          const hl2 = {}; hl2[i] = 'swap'; hl2[i + 1] = 'swap';
          for (let s = n - p; s < n; s++) hl2[s] = 'settled';
          await render(hl2); await tick();
        }
      }
      if (!didSwap) break;
    }
    await render(allSettled());
  }

  async function selectionSort() {
    const n = N;
    for (let i = 0; i < n - 1; i++) {
      let minSlot = i;
      for (let j = i + 1; j < n; j++) {
        comparisons++; compCount.textContent = comparisons;
        setStatus('Scanning for minimum: ' + valAt(minSlot) + ' vs ' + valAt(j));
        const hl = {}; hl[minSlot] = 'compare'; hl[j] = 'compare';
        for (let s = 0; s < i; s++) hl[s] = 'settled';
        await render(hl); await tick();
        if (valAt(j) < valAt(minSlot)) minSlot = j;
      }
      if (minSlot !== i) {
        await swapSlots(i, minSlot);
        const hl = {}; hl[i] = 'swap';
        for (let s = 0; s <= i; s++) hl[s] = 'settled';
        await render(hl); await tick();
      }
    }
    await render(allSettled());
  }

  async function insertionSort() {
    const n = N;
    for (let i = 1; i < n; i++) {
      let j = i;
      setStatus('Inserting ' + valAt(i) + ' into the sorted section');
      while (j > 0) {
        comparisons++; compCount.textContent = comparisons;
        const hl = {}; hl[j] = 'compare'; hl[j - 1] = 'compare';
        for (let s = 0; s < i; s++) if (!hl[s]) hl[s] = 'settled';
        await render(hl); await tick();
        if (valAt(j - 1) > valAt(j)) {
          await swapSlots(j - 1, j); j--;
        } else break;
      }
    }
    await render(allSettled());
  }

  async function mergeSort() {
    async function sortRange(lo, hi) {
      if (hi - lo <= 1) return;
      const mid = Math.floor((lo + hi) / 2);
      await sortRange(lo, mid);
      await sortRange(mid, hi);
      const merged = [];
      let a = lo, b = mid;
      while (a < mid && b < hi) {
        comparisons++; compCount.textContent = comparisons;
        const hl = {}; hl[a] = 'compare'; hl[b] = 'compare';
        await render(hl); await tick();
        if (valAt(a) <= valAt(b)) merged.push(displayOrder[a++]);
        else merged.push(displayOrder[b++]);
      }
      while (a < mid) merged.push(displayOrder[a++]);
      while (b < hi) merged.push(displayOrder[b++]);
      for (let k = 0; k < merged.length; k++) displayOrder[lo + k] = merged[k];
      const hl = {}; for (let k = lo; k < hi; k++) hl[k] = 'swap';
      setStatus('Merged range [' + lo + ', ' + (hi - 1) + ']');
      await render(hl); await tick();
    }
    await sortRange(0, N);
    await render(allSettled());
  }

  async function quickSort() {
    async function sortRange(lo, hi) {
      if (lo >= hi) return;
      const pivotSlot = hi;
      const pivotVal = valAt(pivotSlot);
      let i = lo - 1;
      for (let j = lo; j < hi; j++) {
        comparisons++; compCount.textContent = comparisons;
        setStatus('Comparing ' + valAt(j) + ' against pivot ' + pivotVal);
        const hl = { [pivotSlot]: 'pivot', [j]: 'compare' };
        await render(hl); await tick();
        if (valAt(j) < pivotVal) { i++; if (i !== j) await swapSlots(i, j); }
      }
      await swapSlots(i + 1, hi);
      const hl = { [i + 1]: 'settled' };
      await render(hl); await tick();
      await sortRange(lo, i);
      await sortRange(i + 2, hi);
    }
    await sortRange(0, N - 1);
    await render(allSettled());
  }

  async function heapSort() {
    let heapSize = N;
    async function siftDown(root, size) {
      let largest = root;
      while (true) {
        const l = 2 * largest + 1, r = 2 * largest + 2;
        let candidate = largest;
        if (l < size) { comparisons++; compCount.textContent = comparisons; if (valAt(l) > valAt(candidate)) candidate = l; }
        if (r < size) { comparisons++; compCount.textContent = comparisons; if (valAt(r) > valAt(candidate)) candidate = r; }
        const hl = { [largest]: 'compare' }; if (l < size) hl[l] = 'compare'; if (r < size) hl[r] = 'compare';
        setStatus('Sifting down from slot ' + largest);
        await render(hl); await tick();
        if (candidate === largest) break;
        await swapSlots(largest, candidate);
        largest = candidate;
      }
    }
    for (let i = Math.floor(N / 2) - 1; i >= 0; i--) await siftDown(i, N);
    for (let end = N - 1; end > 0; end--) {
      await swapSlots(0, end);
      const hl = {}; for (let s = end; s < N; s++) hl[s] = 'settled';
      setStatus('Moved max to slot ' + end);
      await render(hl); await tick();
      await siftDown(0, end);
    }
    await render(allSettled());
  }

  function allSettled() { const hl = {}; for (let s = 0; s < N; s++) hl[s] = 'settled'; return hl; }

  const RUNNERS = { bubble: bubbleSort, selection: selectionSort, insertion: insertionSort, merge: mergeSort, quick: quickSort, heap: heapSort };

  function resetRow() {
    shuffle();
    displayOrder = values.map((_, i) => i);
    comparisons = 0; swaps = 0; steps = 0;
    compCount.textContent = 0; swapCount.textContent = 0; stepCount.textContent = 0;
    buildNodes();
    setStatus('Pick an algorithm, then press Play.');
  }

  async function runSort() {
    running = true; stopped = false; paused = false;
    playBtn.disabled = true; pauseBtn.disabled = false; stopBtn.disabled = false; shuffleBtn.disabled = true;
    tabs.forEach(t => t.disabled = true);
    try {
      await RUNNERS[algo]();
      setStatus('Sorted in ' + comparisons + ' comparison(s), ' + swaps + ' swap(s).', true);
    } catch (e) {
      setStatus('Stopped.');
    }
    running = false;
    playBtn.disabled = false; pauseBtn.disabled = true; stopBtn.disabled = true; shuffleBtn.disabled = false;
    tabs.forEach(t => t.disabled = false);
  }

  playBtn.addEventListener('click', () => {
    if (running && paused) { paused = false; pauseBtn.textContent = '┃┃ Pause'; return; }
    if (!running) runSort();
  });
  pauseBtn.addEventListener('click', () => {
    paused = !paused;
    pauseBtn.innerHTML = paused ? '&#9654; Resume' : '&#10073;&#10073; Pause';
  });
  stopBtn.addEventListener('click', () => { stopped = true; paused = false; });
  shuffleBtn.addEventListener('click', () => { if (!running) resetRow(); });

  speedSlider.addEventListener('input', () => {
    const map = { 1: [900, 'Slowest'], 2: [700, 'Slow'], 3: [550, 'Normal'], 4: [350, 'Fast'], 5: [180, 'Fastest'] };
    const [ms, label] = map[speedSlider.value];
    speedMs = ms; speedTag.textContent = label;
  });

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      if (running) return;
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      algo = tab.dataset.algo;
      algoBadge.textContent = ALGOS[algo].label;
      algoDesc.textContent = ALGOS[algo].desc + ' (' + ALGOS[algo].complexity + ')';
      resetRow();
    });
  });

  window.addEventListener('resize', () => positionAll());

  resetRow();
})();
