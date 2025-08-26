// app.js – Domino Starter (mejorado)
(function () {
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const LS_KEY = 'domino_starter_matches';

  let state = {
    fecha: '',
    mesa: '',
    target: 100,
    equipoA: ['', ''],
    equipoB: ['', ''],
    rondas: [], // { ronda, puntosA, puntosB, anota }
    totalA: 0,
    totalB: 0,
    finalizada: false,
    ganador: null,
    lisa: false
  };

  // UI refs
    // Filtros de Clasificatoria
  const fDesde = document.getElementById('f_desde');
  const fHasta = document.getElementById('f_hasta');
  const fPeriodo = document.getElementById('f_periodo');
  const fLimpiar = document.getElementById('f_limpiar');

  // Estado de filtros (solo en memoria)
  const filtros = {
    desde: '',   // 'YYYY-MM-DD'
    hasta: '',   // 'YYYY-MM-DD'
    periodo: 'personalizado', // '7d' | '14d' | '30d' | 'todo'
    minPartidas: false        // ≥30
  };
 
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
  const exportClasifBtn = $('#export-clasif');
  const exportHistBtn = $('#export-historial');

  const inputA1 = $('#equipoA-jugador1');
  const inputA2 = $('#equipoA-jugador2');
  const inputB1 = $('#equipoB-jugador1');
  const inputB2 = $('#equipoB-jugador2');

  // LS helpers
  function loadMatches() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); }
    catch { return []; }
  }
  function saveMatches(arr) {
    localStorage.setItem(LS_KEY, JSON.stringify(arr));
  }

  // CSV helper
  function toCSV(rows, headers) {
    const escape = (v) => {
      const s = (v ?? '').toString().replace(/"/g, '""');
      return /[",\n]/.test(s) ? `"${s}"` : s;
    };
    const head = headers.map(escape).join(',');
    const body = rows.map(r => headers.map(h => escape(r[h])).join(',')).join('\n');
    return head + '\n' + body;
  }
  function download(name, content, mime='text/csv;charset=utf-8') {
    const blob = new Blob([content], { type: mime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // Init
  function init()   // --- Listeners de filtros ---
  fPeriodo?.addEventListener('change', () => {
    filtros.periodo = fPeriodo.value;
    aplicarPeriodoRapido();
    renderClasificatoria(); // auto-orden por eficiencia
  });

  fDesde?.addEventListener('change', () => {
    filtros.desde = fDesde.value;
    filtros.periodo = 'personalizado';
    fPeriodo.value = 'personalizado';
    renderClasificatoria();
  });

  fHasta?.addEventListener('change', () => {
    filtros.hasta = fHasta.value;
    filtros.periodo = 'personalizado';
    fPeriodo.value = 'personalizado';
    renderClasificatoria();
  });

  document.getElementById('filtro-30')?.addEventListener('change', (e) => {
    filtros.minPartidas = e.target.checked;
    renderClasificatoria();
  });

  fLimpiar?.addEventListener('click', () => {
    filtros.desde = '';
    filtros.hasta = '';
    filtros.periodo = 'personalizado';
    filtros.minPartidas = false;
    if (fDesde) fDesde.value = '';
    if (fHasta) fHasta.value = '';
    if (fPeriodo) fPeriodo.value = 'personalizado';
    const chk30 = document.getElementById('filtro-30');
    if (chk30) chk30.checked = false;
    renderClasificatoria();
  });

  function aplicarPeriodoRapido() {
    if (filtros.periodo === 'todo') {
      filtros.desde = '';
      filtros.hasta = '';
      if (fDesde) fDesde.value = '';
      if (fHasta) fHasta.value = '';
      return;
    }
    if (!['7d','14d','30d'].includes(filtros.periodo)) return;
    const hoy = new Date();
    const d = new Date(hoy);
    const days = filtros.periodo === '7d' ? 7 : (filtros.periodo === '14d' ? 14 : 30);
    d.setDate(hoy.getDate() - days);
    const toYMD = (x)=> x.toISOString().slice(0,10);
    filtros.desde = toYMD(d);
    filtros.hasta = toYMD(hoy);
    if (fDesde) fDesde.value = filtros.desde;
    if (fHasta) fHasta.value = filtros.hasta;
  }
{
    targetDisplay.textContent = target.value;
    renderRoundList();
    renderTotals();
    renderClasificatoria();
  }

  // Basic events
  fecha.addEventListener('change', e => state.fecha = e.target.value);
  mesa.addEventListener('change', e => state.mesa = e.target.value);
  target.addEventListener('change', e => {
    state.target = clampInt(e.target.value, 50, 10000, 100);
    target.value = state.target;
    targetDisplay.textContent = state.target;
    refreshWinner();
  });
  [inputA1, inputA2].forEach((el, i) => el.addEventListener('input', e => {
    state.equipoA[i] = e.target.value.trim();
  }));
  [inputB1, inputB2].forEach((el, i) => el.addEventListener('input', e => {
    state.equipoB[i] = e.target.value.trim();
  }));

  addRoundBtn.addEventListener('click', () => {
    const rondaNum = state.rondas.length + 1;
    state.rondas.push({ ronda: rondaNum, puntosA: 0, puntosB: 0, anota: '' });
    renderRoundList();
    refreshWinner();
  });

  newMatchBtn.addEventListener('click', () => {
    if (!confirm('¿Seguro que deseas limpiar la partida actual?')) return;
    resetCurrentMatch();
    init();
  });

  finalizeBtn.addEventListener('click', () => {
    if (!validateBeforeFinalize()) return;
    state.finalizada = true;
    const arr = loadMatches();
    arr.push(JSON.parse(JSON.stringify(state)));
    saveMatches(arr);
    alert('✅ Partida guardada en Historial');
    renderClasificatoria();
  });

  showHistoryBtn?.addEventListener('click', () => {
    $('#historial-section')?.classList.remove('hidden');
    document.querySelector('section[aria-labelledby="clasificatoria-title"]').classList.add('hidden');
    renderHistorial();
  });
  backToMainBtn?.addEventListener('click', () => {
    $('#historial-section')?.classList.add('hidden');
    document.querySelector('section[aria-labelledby="clasificatoria-title"]').classList.remove('hidden');
  });

  resetAllBtn?.addEventListener('click', () => {
    if (!confirm('Esto borrará todo el historial guardado. ¿Continuar?')) return;
    localStorage.removeItem(LS_KEY);
    renderClasificatoria();
    renderHistorial();
    alert('Datos borrados.');
  });

  // Export buttons
  exportClasifBtn?.addEventListener('click', () => {
    const data = computeClasificatoria();
    const headers = ['jugador','victorias','derrotas','total','eficiencia','jg','jp','rachaMax','rachaActual'];
    const csv = toCSV(data.map(r => ({
      jugador: r.jugador,
      victorias: r.victorias,
      derrotas: r.derrotas,
      total: r.total,
      eficiencia: r.eficiencia.toFixed(1),
      jg: r.jg, jp: r.jp,
      rachaMax: r.rachaMax,
      rachaActual: r.rachaActual
    })), headers);
    download('clasificatoria.csv', csv);
  });
  exportHistBtn?.addEventListener('click', () => {
    const arr = loadMatches();
    const headers = ['fecha','mesa','target','equipoA','puntosA','equipoB','puntosB','ganador','lisa','rondas'];
    const csv = toCSV(arr.map(m => ({
      fecha: m.fecha || '',
      mesa: m.mesa || '',
      target: m.target,
      equipoA: (m.equipoA||[]).filter(Boolean).join(' & '),
      puntosA: m.totalA,
      equipoB: (m.equipoB||[]).filter(Boolean).join(' & '),
      puntosB: m.totalB,
      ganador: m.ganador || '',
      lisa: m.lisa ? 'Sí' : 'No',
      rondas: (m.rondas||[]).length
    })), headers);
    download('historial.csv', csv);
  });

  // Utils
  function clampInt(v, min, max, fallback=0) {
    let n = parseInt(v, 10);
    if (Number.isNaN(n)) n = fallback;
    n = Math.max(min, Math.min(max, n));
    return n;
  }

  function resetCurrentMatch() {
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
    [inputA1, inputA2, inputB1, inputB2].forEach(i => i.value = '');
  }

  function validateBeforeFinalize() {
    if (state.rondas.length === 0) { alert('Agrega al menos una ronda.'); return false; }
    const namesOK = [...state.equipoA, ...state.equipoB].some(n => n.trim().length > 0);
    if (!namesOK) { alert('Ingresa al menos un nombre de jugador en cada equipo.'); return false; }
    // recalcula por si hay inputs sucios
    renderTotals();
    return true;
  }

  // Rondas UI
  function renderRoundList() {
    roundsList.innerHTML = '';
    state.rondas.forEach((r, idx) => {
      const row = document.createElement('div');
      row.className = 'grid grid-cols-12 items-center px-4 py-3';
      row.innerHTML = `
        <div class="col-span-2">#${r.ronda}</div>
        <div class="col-span-3">
          <input type="number" min="0" class="w-full rounded border border-slate-300 px-2 py-1" value="${r.puntosA}">
        </div>
        <div class="col-span-3">
          <input type="number" min="0" class="w-full rounded border border-slate-300 px-2 py-1" value="${r.puntosB}">
        </div>
        <div class="col-span-2">
          <input type="text" class="w-full rounded border border-slate-300 px-2 py-1" placeholder="Quién anota" value="${r.anota}">
        </div>
        <div class="col-span-2 flex gap-2">
          <button class="px-2 py-1 text-sm rounded bg-slate-100 hover:bg-slate-200" data-act="up">↑</button>
          <button class="px-2 py-1 text-sm rounded bg-slate-100 hover:bg-slate-200" data-act="down">↓</button>
          <button class="px-2 py-1 text-sm rounded bg-red-100 text-red-700 hover:bg-red-200" data-act="del">🗑</button>
        </div>
      `;
      const [inA, inB, inAnota] = row.querySelectorAll('input');
      inA.addEventListener('change', e => { r.puntosA = clampInt(e.target.value, 0, 1000, 0); e.target.value = r.puntosA; refreshWinner(); });
      inB.addEventListener('change', e => { r.puntosB = clampInt(e.target.value, 0, 1000, 0); e.target.value = r.puntosB; refreshWinner(); });
      inAnota.addEventListener('input', e => r.anota = e.target.value.trim());

      row.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => {
          if (btn.dataset.act === 'del') {
            state.rondas.splice(idx, 1);
          } else if (btn.dataset.act === 'up' && idx > 0) {
            [state.rondas[idx-1], state.rondas[idx]] = [state.rondas[idx], state.rondas[idx-1]];
          } else if (btn.dataset.act === 'down' && idx < state.rondas.length - 1) {
            [state.rondas[idx+1], state.rondas[idx]] = [state.rondas[idx], state.rondas[idx+1]];
          }
          // renumerar
          state.rondas.forEach((rr, i) => rr.ronda = i+1);
          renderRoundList();
          refreshWinner();
        });
      });

      roundsList.appendChild(row);
    });
    finalizeBtn.disabled = state.rondas.length === 0;
  }

  // Totales + ganador + progreso
  function renderTotals() {
    const sumA = state.rondas.reduce((acc, r) => acc + (r.puntosA || 0), 0);
    const sumB = state.rondas.reduce((acc, r) => acc + (r.puntosB || 0), 0);
    state.totalA = sumA;
    state.totalB = sumB;
    totalA.textContent = sumA;
    totalB.textContent = sumB;
    const t = state.target || 100;
    const pct = Math.min(100, Math.max(0, Math.round((Math.max(sumA, sumB) / t) * 100)));
    progressBar.style.width = pct + '%';

    let ganador = '-';
    let lisa = false;
    // Gana quien LLEGA y supera al otro
    if ((sumA >= t || sumB >= t) && sumA !== sumB) {
      ganador = sumA > sumB ? 'Equipo A' : 'Equipo B';
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

  // Clasificatoria + Rachas
    function computeClasificatoria() {
    // 1) cargar y filtrar por fecha
    const all = loadMatches();
    const filtered = all.filter(m => {
      // fechas como 'YYYY-MM-DD' (si no hay fecha, lo dejamos pasar en 'todo' o personalizado vacío)
      const f = (m.fecha || '').trim();
      // rango activo?
      let passDate = true;
      if (filtros.periodo !== 'todo') {
        if (filtros.desde && f && f < filtros.desde) passDate = false;
        if (filtros.hasta && f && f > filtros.hasta) passDate = false;
      }
      return passDate;
    });

    // 2) ordenar cronológicamente para rachas
    const ms = filtered.slice().sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''));

    // 3) acumular estadísticas + rachas por ronda
    const stats = new Map(); // name -> { v,d,t,jg,jp, rachaActual, rachaMax }
    const inc = (name, key, by=1) => {
      if (!name) return;
      if (!stats.has(name)) stats.set(name, { v:0,d:0,t:0,jg:0,jp:0, rachaActual:0, rachaMax:0 });
      stats.get(name)[key] += by;
    };
    const touch = (name) => {
      if (!name) return;
      if (!stats.has(name)) stats.set(name, { v:0,d:0,t:0,jg:0,jp:0, rachaActual:0, rachaMax:0 });
      return stats.get(name);
    };

    for (const m of ms) {
      const A = (m.equipoA || []).filter(Boolean);
      const B = (m.equipoB || []).filter(Boolean);
      const aWins = (m.totalA || 0) > (m.totalB || 0);
      const bWins = (m.totalB || 0) > (m.totalA || 0);

      A.forEach(n => inc(n, 't'));
      B.forEach(n => inc(n, 't'));
      if (aWins) { A.forEach(n => inc(n, 'v')); B.forEach(n => inc(n, 'd')); }
      else if (bWins) { B.forEach(n => inc(n, 'v')); A.forEach(n => inc(n, 'd')); }

      for (const r of (m.rondas || [])) {
        const pa = r.puntosA || 0, pb = r.puntosB || 0;
        if (pa === pb) continue;
        const ganadorR = pa > pb ? 'A' : 'B';
        if (ganadorR === 'A') {
          A.forEach(n => { inc(n, 'jg'); const s = touch(n); s.rachaActual++; s.rachaMax = Math.max(s.rachaMax, s.rachaActual); });
          B.forEach(n => { inc(n, 'jp'); const s = touch(n); s.rachaActual = 0; });
        } else {
          B.forEach(n => { inc(n, 'jg'); const s = touch(n); s.rachaActual++; s.rachaMax = Math.max(s.rachaMax, s.rachaActual); });
          A.forEach(n => { inc(n, 'jp'); const s = touch(n); s.rachaActual = 0; });
        }
      }
    }

    // 4) construir filas
    let rows = [];
    for (const [name, s] of stats.entries()) {
      const eff = (s.v + s.d) > 0 ? (s.v / (s.v + s.d)) * 100 : 0;
      rows.push({ jugador: name, victorias: s.v, derrotas: s.d, total: s.t, eficiencia: eff, jg: s.jg, jp: s.jp, rachaMax: s.rachaMax, rachaActual: s.rachaActual });
    }

    // 5) filtro ≥ 30 partidas, si aplica
    if (filtros.minPartidas) rows = rows.filter(r => r.total >= 30);

    // 6) orden automático por eficiencia desc
    rows.sort((a,b) => b.eficiencia - a.eficiencia);

    return rows;
  }

    function renderClasificatoria() {
    const list = computeClasificatoria();
    clasifBody.innerHTML = '';
    for (const r of list) {
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-slate-50';
      tr.innerHTML = `
        <td class="px-4 py-3">${r.jugador}</td>
        <td class="px-4 py-3">${r.victorias}</td>
        <td class="px-4 py-3">${r.derrotas}</td>
        <td class="px-4 py-3">${r.total}</td>
        <td class="px-4 py-3">${r.eficiencia.toFixed(1)}%</td>
        <td class="px-4 py-3">${r.jg ?? 0}</td>
        <td class="px-4 py-3">${r.jp ?? 0}</td>
        <td class="px-4 py-3">${r.rachaMax ?? 0}</td>
        <td class="px-4 py-3">${r.rachaActual ?? 0}</td>
      `;
      clasifBody.appendChild(tr);
    }
  }


  // Historial + borrar fila
  function renderHistorial() {
    const body = $('#historial-body');
    const arr = loadMatches();
    body.innerHTML = '';
    arr.forEach((m, idx) => {
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-slate-50';
      tr.innerHTML = `
        <td class="px-4 py-3">${m.fecha || '-'}</td>
        <td class="px-4 py-3">${m.mesa || '-'}</td>
        <td class="px-4 py-3">${m.target}</td>
        <td class="px-4 py-3">${(m.equipoA||[]).filter(Boolean).join(' & ') || '-'}</td>
        <td class="px-4 py-3">${m.totalA}</td>
        <td class="px-4 py-3">${(m.equipoB||[]).filter(Boolean).join(' & ') || '-'}</td>
        <td class="px-4 py-3">${m.totalB}</td>
        <td class="px-4 py-3">${m.ganador || '-'}</td>
        <td class="px-4 py-3">${m.lisa ? 'Sí' : 'No'}</td>
        <td class="px-4 py-3 flex items-center gap-2">
          ${(m.rondas||[]).length}
          <button class="px-2 py-1 text-xs rounded bg-red-100 text-red-700 hover:bg-red-200" data-del="${idx}">🗑</button>
        </td>
      `;
      body.appendChild(tr);
    });
    // Hook borrar
    body.querySelectorAll('button[data-del]').forEach(btn => {
      btn.addEventListener('click', () => {
        const i = parseInt(btn.getAttribute('data-del'), 10);
        const arr = loadMatches();
        if (i>=0 && i < arr.length && confirm('¿Eliminar esta partida del historial?')) {
          arr.splice(i,1);
          saveMatches(arr);
          renderHistorial();
          renderClasificatoria();
        }
      });
    });
  }

  // Orden y filtro TOPs
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
