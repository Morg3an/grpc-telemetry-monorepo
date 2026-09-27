document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const rawPointsInput = document.getElementById('input-raw-points');
  const pointsCountBadge = document.getElementById('points-count-badge');
  const metricIdInput = document.getElementById('input-metric-id');
  const hostInput = document.getElementById('input-host');
  const btnDispatch = document.getElementById('btn-dispatch-grpc');
  const btnGenerateSynthetic = document.getElementById('btn-generate-synthetic');
  const countInput = document.getElementById('input-count');
  const distributionSelect = document.getElementById('select-distribution');
  const btnRefreshHealth = document.getElementById('btn-refresh-health');

  // Status indicators
  const cruncherStatusDot = document.getElementById('cruncher-status-dot');
  const cruncherStatusText = document.getElementById('cruncher-status-text');

  // Channel buttons
  const channelButtons = document.querySelectorAll('.channel-btn');

  // Stats elements
  const valCount = document.getElementById('val-count');
  const valMean = document.getElementById('val-mean');
  const valMedian = document.getElementById('val-median');
  const valStd = document.getElementById('val-std');
  const valMin = document.getElementById('val-min');
  const valMax = document.getElementById('val-max');
  const valVariance = document.getElementById('val-variance');
  const valSum = document.getElementById('val-sum');

  // Timing elements
  const timingGrpc = document.getElementById('timing-grpc');
  const timingPython = document.getElementById('timing-python');

  // Percentiles
  const pValues = {
    p25: document.getElementById('val-p25'),
    p50: document.getElementById('val-p50'),
    p75: document.getElementById('val-p75'),
    p90: document.getElementById('val-p90'),
    p95: document.getElementById('val-p95'),
    p99: document.getElementById('val-p99'),
  };

  // Efficiency elements
  const savingsBadge = document.getElementById('savings-badge');
  const effSizeJson = document.getElementById('eff-size-json');
  const effSizeProto = document.getElementById('eff-size-proto');
  const effBarJson = document.getElementById('eff-bar-json');
  const effBarProto = document.getElementById('eff-bar-proto');
  const jsonViewer = document.getElementById('json-viewer');

  // Canvas
  const canvas = document.getElementById('histogram-canvas');
  const axisMin = document.getElementById('axis-min');
  const axisMean = document.getElementById('axis-mean');
  const axisMax = document.getElementById('axis-max');

  let cachedDatasets = {};
  let currentPoints = [];

  // Update count badge when typing
  function updateCountBadge() {
    const raw = rawPointsInput.value.trim();
    if (!raw) {
      pointsCountBadge.textContent = '0';
      currentPoints = [];
      drawHistogram([]);
      return;
    }
    currentPoints = parsePoints(raw);
    pointsCountBadge.textContent = currentPoints.length.toLocaleString();
    drawHistogram(currentPoints);
  }

  rawPointsInput.addEventListener('input', updateCountBadge);

  function parsePoints(text) {
    if (!text.trim()) return [];
    try {
      if (text.trim().startsWith('[') && text.trim().endsWith(']')) {
        const arr = JSON.parse(text);
        if (Array.isArray(arr)) return arr.map(Number).filter(n => !isNaN(n));
      }
    } catch (_) {}

    return text
      .split(/[\s,;\n]+/)
      .map(s => Number(s.trim()))
      .filter(n => !isNaN(n));
  }

  // Draw technical histogram on HTML5 Canvas
  function drawHistogram(points, meanVal) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    // Draw background gridlines
    ctx.strokeStyle = '#18202c';
    ctx.lineWidth = 1;
    for (let y = 20; y < height; y += 30) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    if (!points || points.length === 0) {
      ctx.fillStyle = '#475569';
      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.fillText('NO DATA IN BUFFER', width / 2 - 50, height / 2);
      return;
    }

    let min = Infinity;
    let max = -Infinity;
    let sum = 0;
    for (let i = 0; i < points.length; i++) {
      const v = points[i];
      if (v < min) min = v;
      if (v > max) max = v;
      sum += v;
    }

    const mean = meanVal !== undefined ? meanVal : sum / points.length;

    if (axisMin) axisMin.textContent = `MIN: ${min.toFixed(2)}`;
    if (axisMean) axisMean.textContent = `μ: ${mean.toFixed(2)}`;
    if (axisMax) axisMax.textContent = `MAX: ${max.toFixed(2)}`;

    const numBuckets = 28;
    const buckets = new Array(numBuckets).fill(0);
    const range = (max - min) || 1;

    for (let i = 0; i < points.length; i++) {
      const idx = Math.min(
        numBuckets - 1,
        Math.floor(((points[i] - min) / range) * numBuckets)
      );
      buckets[idx]++;
    }

    const maxCount = Math.max(...buckets, 1);
    const barWidth = width / numBuckets;
    const padding = 2;

    for (let b = 0; b < numBuckets; b++) {
      const barHeight = (buckets[b] / maxCount) * (height - 20);
      const x = b * barWidth + padding;
      const y = height - barHeight - 2;

      // Technical styling for bars
      ctx.fillStyle = '#223249';
      ctx.fillRect(x, y, barWidth - padding * 2, barHeight);

      // Top edge highlight
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(x, y, barWidth - padding * 2, 2);
    }

    // Draw Mean line indicator
    if (range > 0) {
      const meanX = ((mean - min) / range) * width;
      ctx.strokeStyle = '#f59e0b';
      ctx.setLineDash([4, 3]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(meanX, 0);
      ctx.lineTo(meanX, height);
      ctx.stroke();
      ctx.setLineDash([]);

      // Mean indicator label
      ctx.fillStyle = '#f59e0b';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillText('μ', Math.min(width - 15, Math.max(5, meanX + 3)), 14);
    }
  }

  // Fetch sample presets
  async function loadPresets() {
    try {
      const res = await fetch('/api/sample-datasets');
      const data = await res.json();
      if (data.datasets) {
        data.datasets.forEach(ds => {
          cachedDatasets[ds.id] = ds;
        });
        // Select first channel preset by default
        applyPreset('iot_temp_sensors');
      }
    } catch (err) {
      console.warn('Could not load sample datasets:', err);
      generateSyntheticData();
    }
  }

  function applyPreset(presetId) {
    const ds = cachedDatasets[presetId];
    if (!ds) return;

    metricIdInput.value = ds.id;
    if (ds.metadata?.facility) hostInput.value = ds.metadata.facility;
    else if (ds.metadata?.cluster) hostInput.value = ds.metadata.cluster;
    else if (ds.metadata?.edgeRegion) hostInput.value = ds.metadata.edgeRegion;
    else hostInput.value = 'rack-01';

    rawPointsInput.value = ds.data.join(', ');
    updateCountBadge();
  }

  channelButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      channelButtons.forEach(b => {
        b.classList.remove('active');
        const st = b.querySelector('.ch-status');
        if (st) {
          st.classList.remove('active');
          st.textContent = 'READY';
        }
      });

      btn.classList.add('active');
      const st = btn.querySelector('.ch-status');
      if (st) {
        st.classList.add('active');
        st.textContent = 'ACTIVE';
      }

      const presetId = btn.getAttribute('data-preset');
      applyPreset(presetId);
    });
  });

  // Synthetic Data Synthesis
  function generateSyntheticData() {
    const count = parseInt(countInput.value, 10) || 1000;
    const model = distributionSelect.value;
    const points = [];

    for (let i = 0; i < count; i++) {
      let val = 0;
      if (model === 'normal') {
        const u1 = Math.random() || 0.0001;
        const u2 = Math.random() || 0.0001;
        const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
        val = 50 + z * 10;
      } else if (model === 'uniform') {
        val = 10 + Math.random() * 80;
      } else if (model === 'exponential') {
        val = -Math.log(1.0 - Math.random()) * 25 + 5;
      } else if (model === 'spikes') {
        const isSpike = Math.random() < 0.05;
        val = isSpike ? 200 + Math.random() * 300 : 20 + Math.random() * 15;
      }
      points.push(Number(val.toFixed(2)));
    }

    rawPointsInput.value = points.join(', ');
    updateCountBadge();
    metricIdInput.value = `synthetic_${model}_${count}`;
  }

  btnGenerateSynthetic.addEventListener('click', generateSyntheticData);

  // Check Health
  async function checkHealth() {
    cruncherStatusText.textContent = 'POLLING';
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      if (data.dataService && data.dataService.status === 'UP') {
        cruncherStatusDot.className = 'led-dot online';
        cruncherStatusText.textContent = `ONLINE (v${data.dataService.version})`;
      } else {
        cruncherStatusDot.className = 'led-dot offline';
        cruncherStatusText.textContent = 'DEGRADED';
      }
    } catch (_) {
      cruncherStatusDot.className = 'led-dot offline';
      cruncherStatusText.textContent = 'OFFLINE';
    }
  }

  btnRefreshHealth.addEventListener('click', checkHealth);

  // Dispatch gRPC calculation
  async function dispatchCalculation() {
    const points = parsePoints(rawPointsInput.value);
    if (points.length === 0) {
      alert('SIGNAL BUFFER EMPTY: Provide at least one numeric telemetry point.');
      return;
    }

    btnDispatch.classList.add('loading');
    btnDispatch.disabled = true;

    const payload = {
      metricId: metricIdInput.value || 'telemetry_sample',
      dataPoints: points,
      metadata: {
        host: hostInput.value || 'node-gateway',
        clientTime: new Date().toISOString(),
      },
    };

    try {
      const res = await fetch('/api/metrics/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      jsonViewer.textContent = JSON.stringify(json, null, 2);

      if (!json.success) {
        alert(`RPC Execution Failed: ${json.error || 'Unknown error'}`);
        return;
      }

      const m = json.data;
      const perf = json.performance;

      // Update stat cards
      valCount.textContent = m.count.toLocaleString();
      valMean.textContent = m.mean.toFixed(3);
      valMedian.textContent = m.median.toFixed(3);
      valStd.textContent = m.standardDeviation.toFixed(3);
      valMin.textContent = m.min.toFixed(2);
      valMax.textContent = m.max.toFixed(2);
      valVariance.textContent = m.variance.toFixed(3);
      valSum.textContent = m.sum.toLocaleString(undefined, { maximumFractionDigits: 1 });

      // Update percentiles
      if (m.percentiles) {
        pValues.p25.textContent = m.percentiles.p25.toFixed(2);
        pValues.p50.textContent = m.percentiles.p50.toFixed(2);
        pValues.p75.textContent = m.percentiles.p75.toFixed(2);
        pValues.p90.textContent = m.percentiles.p90.toFixed(2);
        pValues.p95.textContent = m.percentiles.p95.toFixed(2);
        pValues.p99.textContent = m.percentiles.p99.toFixed(2);
      }

      // Update timing
      timingGrpc.textContent = `${perf.grpcRoundtripMs.toFixed(2)} ms`;
      timingPython.textContent = `${m.cruncherProcessingTimeMs.toFixed(2)} ms`;

      // Update wire efficiency
      if (perf.protocolEfficiency) {
        const eff = perf.protocolEfficiency;
        savingsBadge.textContent = `${eff.savingsPercent} BANDWIDTH_SAVED`;
        effSizeJson.textContent = `${eff.jsonBytes.toLocaleString()} BYTES`;
        effSizeProto.textContent = `${eff.protoBytes.toLocaleString()} BYTES`;

        const ratio = Math.max(10, Math.min(100, Math.round((eff.protoBytes / eff.jsonBytes) * 100)));
        effBarProto.style.width = `${ratio}%`;
      }

      // Re-draw histogram with computed mean
      drawHistogram(points, m.mean);
    } catch (err) {
      alert(`Network error connecting to Gateway: ${err.message}`);
    } finally {
      btnDispatch.classList.remove('loading');
      btnDispatch.disabled = false;
    }
  }

  btnDispatch.addEventListener('click', dispatchCalculation);

  // Keyboard shortcut: Ctrl+Enter or Cmd+Enter to dispatch
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      dispatchCalculation();
    }
  });

  // Window resize re-draws canvas
  window.addEventListener('resize', () => {
    if (canvas) {
      canvas.width = canvas.parentElement.clientWidth;
      drawHistogram(currentPoints);
    }
  });

  // Initialize
  if (canvas) {
    canvas.width = canvas.parentElement.clientWidth || 500;
  }
  checkHealth();
  loadPresets();
});
