// app.js – Domino Starter (localStorage)
(function () {
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const LS_KEY = 'domino_starter_matches';

  // Estado de partida actual
  let state = {
    fecha: '',
    mesa: '',
    target: 100,
    equipoA: ['', ''],
    equipoB: ['', ''],
    rondas: [], // { ronda: n, puntosA: x, puntosB: y, anota: string }
    totalA: 0,
    totalB: 0,
    finalizada: false,
    ganador: null,
    lisa: false
  };

  // Referencias UI
  const fecha = $('#fecha');
  const mesa = $('#mesa');
  const target = $('#target');
  const targetDisplay = $('#target-display');
  const roundsList = $('#rounds-list');
  const totalA = $('#total-a');
  const totalB = $('#total-b');
  const winnerText = $('#winner-text');
  const lisaText = $('#lisa-text');
  const progressBar = $('#progress-bar');
  const progressBadge = $('#progress-badge');
  const addRoundBtn = $('#add-round');
  const finalizeBtn = $('#finalize-match');
  const newMatchBtn = $('#new-match');
  const showHistoryBtn = $('#show-history');
  const backToMainBtn = $('#back-to-main');
  const clasifBody = $('#clasificacion-body');
  const filtro30 = $('#filtro-30');
  const topControls = $('#top-controls');
  const resetAllBtn = $('#reset-all');

  const inputA1 = $('#equipoA-jugador1');
  const inputA2 = $('#equipoA-jugador2');
  const inputB1 = $('#equipoB-jugador1');
  const inputB2 = $('#equipoB-jugador2');

  // Helpers LocalStorage
  function loadMatches() {
    try {
      return JSON.parse(localStorage.getItem(LS_KEY) || '[]');
    } catch { return []; }
  }
  function saveMatches(arr) {
    localStorage.setItem(LS_KEY, JSON.stringify(arr));
  }

  // Init
  function init() {
    targetDisplay.textContent = target.value;
    renderRoundList();
    renderTotals();
    renderClasificatoria();
  }

  // Eventos básicos
  fecha.addEventListener('change', e => state.fecha = e.target.value);
  mesa.addEventListener('change', e => state.mesa = e.target.value);
  target.addEventListener('change', e => {
    state.target = parseInt(e.target.value, 10);
    targetDisplay.textContent = state.target;
    refreshWinner();
  });
  [inputA1, inputA2].forEach((el, i) => el.addEventListener('input', e => {
    state.equipoA[i] = e.target.value.trim();
  }));
  [inputB1, inputB2].forEach((el, i) => el.addEventListener('input', e => {
    state.equipoB[i] = e.target.value.trim();
  }));

  // Agregar ronda
  addRoundBtn.addEventListener('click', () => {
    const rondaNum = state.rondas.length + 1;
    state.rondas.push({ ronda: rondaNum, puntosA: 0, puntosB: 0, anota: '' });
    renderRoundList();
    refreshWinner();
  });

  // Nueva partida
  newMatchBtn.addEventListener('click', () => {
    if (!confirm('¿Seguro que deseas limpiar la partida actual?')) return;
    state = {
      fecha: '',
      mesa: '',
      target: 100,
      equipoA: ['', ''],
      equipoB: ['', ''],
      rondas: [],
      totalA: 0,
      totalB: 0,
      finalizada: false,
      ganador: null,
      lisa: false
    };
    fecha.value = '';
    mesa.value = '';
    target.value = '100';
    inputA1.value = inputA2.value = inputB1.value = inputB2.value = '';
    init();
  });

  // Finalizar partida
  finalizeBtn.addEventListener('click', () => {
    if (state.rondas.length === 0) return alert('Agrega al menos una ronda.');
    state.finalizada = true;
    const arr = loadMatches();
    arr.push(JSON.parse(JSON.stringify(state)));
    saveMatches(arr);
    alert('✅ Partida guardada en Historial');
    renderClasificatoria();
  });

  // Ver historial
  showHistoryBtn?.addEventListener('click', () => {
    $('#historial-section')?.classList.remove('hidden');
    document.querySelector('section[aria-labelledby="clasificatoria-title"]').classList.add('hidden');
    renderHistorial();
  });
  backToMainBtn?.addEventListener('click', () => {
    $('#historial-section')?.classList.add('hidden');
    document.querySelector('section[aria-labelledby="clasificatoria-title"]').classList.remove('hidden');
  });

  // Reset total
  resetAllBtn?.addEventListener('click', () => {
    if (!confirm('Esto borrará todo el historial guardado. ¿Continuar?')) return;
    localStorage.removeItem(LS_KEY);
    renderClasificatoria();
    renderHistorial();
    alert('Datos borrados.');
  });

  // Render rondas
  function renderRoundList() {
    roundsList.innerHTML = '';
    state.rondas.forEach((r, idx) => {
      const row = document.createElement('div');
      row.className = 'grid grid-cols-12 items-center px-4 py-3';
      row.innerHTML = `
        <div class="col-span-2">#${r.ronda}</div>
        <div class="col-span-3">
          <input type="number" min="0" class="w-full rounded border px-2 py-1" value="${r.puntosA}">
        </div>
        <div class="col-span-3">
          <input type="number" min="0" class="w-full rounded border px-2 py-1" value="${r.puntosB}">
        </div>
        <div class="col-span-2">
          <input type="text" class="w-full rounded border px-2 py-1" placeholder="Quién anota" value="${r.anota}">
        </div>
        <div class="col-span-2 flex gap-2">
          <button class="px-2 py-1 text-sm rounded bg-slate-100 hover:bg-slate-200" data-act="del">Eliminar</button>
        </div>
      `;
      const [inA, inB, inAnota] = row.querySelectorAll('input');
      inA.addEventListener('change', e => { r.puntosA = parseInt(e.target.value || '0', 10); refreshWinner(); });
      inB.addEventListener('change', e => { r.puntosB = parseInt(e.target.value || '0', 10); refreshWinner(); });
      inAnota.addEventListener('input', e => r.anota = e.target.value.trim());
      row.querySelector('button[data-act="del"]').addEventListener('click', () => {
        state.rondas.splice(idx, 1);
        renderRoundList();
        refreshWinner();
      });
      roundsList.appendChild(row);
    });
    finalizeBtn.disabled = state.rondas.length === 0;
  }

  // Totales
  function renderTotals() {
    const sumA = state.rondas.reduce((acc, r) => acc + (r.puntosA || 0), 0);
    const sumB = state.rondas.reduce((acc, r) => acc + (r.puntosB || 0), 0);
    state.totalA = sumA;
    state.totalB = sumB;
    totalA.textContent = sumA;
    totalB.textContent = sumB;
    const t = state.target || 100;
    const pct = Math.min(100, Math.round((Math.max(sumA, sumB) / t) * 100));
    progressBar.style.width = pct + '%';

    let ganador = '-';
    let lisa = false;
    if (sumA >= t || sumB >= t) {
      ganador = sumA >= t && sumA > sumB ? 'Equipo A' : (sumB >= t && sumB > sumA ? 'Equipo B' : 'Empate');
      lisa = (sumA >= t && sumB === 0) || (sumB >= t && sumA === 0);
      progressBadge.textContent = 'Finalizado';
      progressBadge.className = 'badge bg-green-100 text-green-700';
    } else {
      progressBadge.textContent = 'En curso';
      progressBadge.className = 'badge bg-blue-100 text-blue-700';
    }

    state.ganador = ganador !== '-' ? ganador : null;
    state.lisa = lisa;
    winnerText.textContent = ganador;
    lisaText.textContent = lisa ? 'Sí' : 'No';
  }

  function refreshWinner() { renderTotals(); }

  // Clasificatoria
  function computeClasificatoria() {
    const matches = loadMatches();
    const playerStats = new Map();

    function inc(name, key) {
      if (!name) return;
      if (!playerStats.has(name)) playerStats.set(name, { v:0, d:0, t:0, jg:0, jp:0 });
      playerStats.get(name)[key]++;
    }

    for (const m of matches) {
      const A = m.equipoA.filter(Boolean);
      const B = m.equipoB.filter(Boolean);
      const aWins = m.totalA > m.totalB;
      const bWins = m.totalB > m.totalA;

      A.forEach(n => inc(n, 't'));
      B.forEach(n => inc(n, 't'));

      if (aWins) { A.forEach(n => inc(n, 'v')); B.forEach(n => inc(n, 'd')); }
      else if (bWins) { B.forEach(n => inc(n, 'v')); A.forEach(n => inc(n, 'd')); }

      for (const r of m.rondas || []) {
        if ((r.puntosA||0) === (r.puntosB||0)) continue;
        const ganadorR = (r.puntosA||0) > (r.puntosB||0) ? 'A' : 'B';
        if (ganadorR === 'A') { A.forEach(n => inc(n, 'jg')); B.forEach(n => inc(n, 'jp')); }
        else { B.forEach(n => inc(n, 'jg')); A.forEach(n => inc(n, 'jp')); }
      }
    }

    const rows = [];
    for (const [name, s] of playerStats.entries()) {
      const eff = (s.v + s.d) > 0 ? (s.v / (s.v + s.d)) * 100 : 0;
      rows.push({ jugador: name, victorias: s.v, derrotas: s.d, total: s.t, eficiencia: eff, jg: s.jg, jp: s.jp });
    }
    return rows;
  }

  function renderClasificatoria(sortBy='eficiencia', only30=false) {
    const rows = computeClasificatoria();
    let list = rows.slice();
    if (only30) list = list.filter(r => r.total >= 30);

    list.sort((a,b) => sortBy === 'eficiencia' ? b.eficiencia - a.eficiencia : (b[sortBy]||0) - (a[sortBy]||0));

    clasifBody.innerHTML = '';
    for (const r of list) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="px-4 py-3">${r.jugador}</td>
        <td class="px-4 py-3">${r.victorias}</td>
        <td class="px-4 py-3">${r.derrotas}</td>
        <td class="px-4 py-3">${r.total}</td>
        <td class="px-4 py-3">${r.eficiencia.toFixed(1)}%</td>
        <td class="px-4 py-3">${r.jg}</td>
        <td class="px-4 py-3">${r.jp}</td>
      `;
      clasifBody.appendChild(tr);
    }
  }

  // Historial
  function renderHistorial() {
    const body = $('#historial-body');
    const arr = loadMatches();
    body.innerHTML = '';
    for (const m of arr) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="px-4 py-3">${m.fecha || '-'}</td>
        <td class="px-4 py-3">${m.mesa || '-'}</td>
        <td class="px-4 py-3">${m.target}</td>
        <td class="px-4 py-3">${m.equipoA.filter(Boolean).join(' & ') || '-'}</td>
        <td class="px-4 py-3">${m.totalA}</td>
        <td class="px-4 py-3">${m.equipoB.filter(Boolean).join(' & ') || '-'}</td>
        <td class="px-4 py-3">${m.totalB}</td>
        <td class="px-4 py-3">${m.ganador || '-'}</td>
        <td class="px-4 py-3">${m.lisa ? 'Sí' : 'No'}</td>
        <td class="px-4 py-3">${(m.rondas||[]).length}</td>
      `;
      body.appendChild(tr);
    }
  }

  // Controles de orden
  topControls?.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-top]');
    if (!btn) return;
    topControls.querySelectorAll('button[data-top]').forEach(b => b.classList.remove('ring-2','ring-blue-500'));
    btn.classList.add('ring-2','ring-blue-500');
    renderClasificatoria(btn.dataset.top, filtro30?.checked || false);
  });
  filtro30?.addEventListener('change', () => {
    const active = topControls.querySelector('button[data-top].ring-2')?.dataset.top || 'eficiencia';
    renderClasificatoria(active, filtro30.checked);
  });

  // Start
  init();
})();
