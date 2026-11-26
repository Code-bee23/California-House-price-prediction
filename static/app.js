/**
 * California House Price Predictor - Interactive Frontend Application
 */

// Preset Regions Data
const REGION_PRESETS = {
  bay_area: {
    name: "Silicon Valley / Palo Alto",
    medInc: 10.5,
    houseAge: 28,
    aveRooms: 7.2,
    aveBedrms: 1.05,
    population: 1450,
    aveOccup: 2.8,
    lat: 37.4419,
    lng: -122.1430
  },
  beverly_hills: {
    name: "Beverly Hills / Los Angeles",
    medInc: 8.8,
    houseAge: 35,
    aveRooms: 6.8,
    aveBedrms: 1.1,
    population: 1200,
    aveOccup: 2.6,
    lat: 34.0736,
    lng: -118.4004
  },
  san_diego: {
    name: "San Diego Coast",
    medInc: 6.5,
    houseAge: 22,
    aveRooms: 5.9,
    aveBedrms: 1.04,
    population: 1600,
    aveOccup: 2.9,
    lat: 32.7157,
    lng: -117.1611
  },
  sacramento: {
    name: "Sacramento Suburbs",
    medInc: 4.8,
    houseAge: 18,
    aveRooms: 5.6,
    aveBedrms: 1.02,
    population: 1850,
    aveOccup: 3.1,
    lat: 38.5816,
    lng: -121.4944
  },
  fresno: {
    name: "Fresno / Central Valley",
    medInc: 3.1,
    houseAge: 26,
    aveRooms: 4.9,
    aveBedrms: 1.08,
    population: 2100,
    aveOccup: 3.5,
    lat: 36.7468,
    lng: -119.7726
  }
};

// Global State
let map = null;
let mapMarker = null;
let isLivePredict = true;
let predictDebounceTimer = null;
let lastBatchFile = null;
let lastPredictionData = null;
let sessionHistory = [];

// DOM Ready
document.addEventListener("DOMContentLoaded", () => {
  initTabs();
  initFormInputs();
  initMap();
  initPresets();
  initBatchUpload();
  initSessionHistory();
  loadFeatureImportances();
  checkApiHealth();
  updateCodeSnippets();

  // Initial calculation
  fetchPrediction();
});

// Tab Switching
function initTabs() {
  const tabs = document.querySelectorAll("[data-tab-target]");
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      const targetId = tab.getAttribute("data-tab-target");

      // Update tab buttons
      tabs.forEach(t => {
        t.classList.remove("text-emerald-400", "border-emerald-400", "bg-slate-800/80");
        t.classList.add("text-slate-400", "border-transparent");
      });
      tab.classList.remove("text-slate-400", "border-transparent");
      tab.classList.add("text-emerald-400", "border-emerald-400", "bg-slate-800/80");

      // Switch tab contents
      document.querySelectorAll(".tab-content").forEach(c => c.classList.add("hidden"));
      const targetEl = document.getElementById(targetId);
      if (targetEl) {
        targetEl.classList.remove("hidden");
      }

      // If switching to single estimator, invalidate map size to render properly
      if (targetId === "tab-estimator" && map) {
        setTimeout(() => map.invalidateSize(), 200);
      }
    });
  });
}

// Form Inputs & Range Synchronization
function initFormInputs() {
  const fields = [
    "medInc", "houseAge", "aveRooms", "aveBedrms",
    "population", "aveOccup", "lat", "lng"
  ];

  fields.forEach(field => {
    const range = document.getElementById(`${field}Range`);
    const num = document.getElementById(`${field}Num`);

    if (!range || !num) return;

    // Sync Range -> Number
    range.addEventListener("input", (e) => {
      num.value = e.target.value;
      onInputChange(field);
    });

    // Sync Number -> Range
    num.addEventListener("input", (e) => {
      range.value = e.target.value;
      onInputChange(field);
    });
  });

  // Income Annual Helper Display
  const medIncNum = document.getElementById("medIncNum");
  if (medIncNum) {
    const updateIncomeDisplay = () => {
      const val = parseFloat(medIncNum.value) || 0;
      const annual = val * 10000;
      const helper = document.getElementById("medIncHelper");
      if (helper) helper.innerText = `≈ $${annual.toLocaleString()} / year`;
    };
    medIncNum.addEventListener("input", updateIncomeDisplay);
    document.getElementById("medIncRange")?.addEventListener("input", updateIncomeDisplay);
    updateIncomeDisplay();
  }

  // Live Auto-Predict Toggle
  const liveToggle = document.getElementById("liveAutoPredict");
  if (liveToggle) {
    liveToggle.addEventListener("change", (e) => {
      isLivePredict = e.target.checked;
    });
  }

  // Calculate Button
  const predictBtn = document.getElementById("predictBtn");
  if (predictBtn) {
    predictBtn.addEventListener("click", () => fetchPrediction());
  }

  // Reset to Default Button
  const resetBtn = document.getElementById("resetBtn");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => applyPreset("bay_area"));
  }
}

function onInputChange(field) {
  // If lat/lng changed, move map marker
  if (field === "lat" || field === "lng") {
    const lat = parseFloat(document.getElementById("latNum").value);
    const lng = parseFloat(document.getElementById("lngNum").value);
    if (!isNaN(lat) && !isNaN(lng) && map && mapMarker) {
      mapMarker.setLatLng([lat, lng]);
      map.panTo([lat, lng]);
    }
  }

  updateCodeSnippets();

  if (isLivePredict) {
    clearTimeout(predictDebounceTimer);
    predictDebounceTimer = setTimeout(() => {
      fetchPrediction();
    }, 250);
  }
}

// Leaflet Interactive Map
function initMap() {
  const mapContainer = document.getElementById("californiaMap");
  if (!mapContainer) return;

  const initialLat = 37.4419;
  const initialLng = -122.1430;

  map = L.map("californiaMap", {
    center: [initialLat, initialLng],
    zoom: 7,
    minZoom: 5,
    maxZoom: 16,
    attributionControl: false
  });

  // OpenStreetMap dark / standard tiles
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
  }).addTo(map);

  // California roughly bounded
  const customIcon = L.divIcon({
    className: "custom-pin",
    html: `<div class="w-7 h-7 bg-emerald-500 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white text-xs font-bold ring-4 ring-emerald-500/30">📍</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28]
  });

  mapMarker = L.marker([initialLat, initialLng], {
    draggable: true,
    icon: customIcon
  }).addTo(map);

  mapMarker.bindPopup("<b>Selected Location</b><br>Drag me anywhere in CA!").openPopup();

  // Marker drag event
  mapMarker.on("drag", (e) => {
    const pos = e.target.getLatLng();
    setCoordinates(pos.lat, pos.lng);
  });

  mapMarker.on("dragend", () => {
    onInputChange("lat");
  });

  // Map click event
  map.on("click", (e) => {
    mapMarker.setLatLng(e.latlng);
    setCoordinates(e.latlng.lat, e.latlng.lng);
    onInputChange("lat");
  });
}

function setCoordinates(lat, lng) {
  // Constrain within California bounds for model
  const clampedLat = Math.min(Math.max(lat, 32.5), 42.0);
  const clampedLng = Math.min(Math.max(lng, -124.5), -114.0);

  const latNum = document.getElementById("latNum");
  const latRange = document.getElementById("latRange");
  const lngNum = document.getElementById("lngNum");
  const lngRange = document.getElementById("lngRange");

  if (latNum && latRange) {
    latNum.value = clampedLat.toFixed(4);
    latRange.value = clampedLat.toFixed(2);
  }
  if (lngNum && lngRange) {
    lngNum.value = clampedLng.toFixed(4);
    lngRange.value = clampedLng.toFixed(2);
  }
}

// Preset Handlers
function initPresets() {
  const presetBtns = document.querySelectorAll("[data-preset]");
  presetBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const presetKey = btn.getAttribute("data-preset");
      applyPreset(presetKey);
    });
  });
}

function applyPreset(key) {
  const preset = REGION_PRESETS[key];
  if (!preset) return;

  const setVal = (id, val) => {
    const num = document.getElementById(`${id}Num`);
    const range = document.getElementById(`${id}Range`);
    if (num) num.value = val;
    if (range) range.value = val;
  };

  setVal("medInc", preset.medInc);
  setVal("houseAge", preset.houseAge);
  setVal("aveRooms", preset.aveRooms);
  setVal("aveBedrms", preset.aveBedrms);
  setVal("population", preset.population);
  setVal("aveOccup", preset.aveOccup);
  setVal("lat", preset.lat);
  setVal("lng", preset.lng);

  // Trigger helper
  const annual = preset.medInc * 10000;
  const helper = document.getElementById("medIncHelper");
  if (helper) helper.innerText = `≈ $${annual.toLocaleString()} / year`;

  // Update map
  if (map && mapMarker) {
    mapMarker.setLatLng([preset.lat, preset.lng]);
    map.flyTo([preset.lat, preset.lng], 9, { duration: 1.2 });
  }

  updateCodeSnippets();
  fetchPrediction();
  showToast(`Loaded ${preset.name} preset`);
}

// Get Form Payload
function getFeaturesPayload() {
  return {
    MedInc: parseFloat(document.getElementById("medIncNum")?.value || 3.8),
    HouseAge: parseFloat(document.getElementById("houseAgeNum")?.value || 25),
    AveRooms: parseFloat(document.getElementById("aveRoomsNum")?.value || 5.4),
    AveBedrms: parseFloat(document.getElementById("aveBedrmsNum")?.value || 1.05),
    Population: parseFloat(document.getElementById("populationNum")?.value || 1400),
    AveOccup: parseFloat(document.getElementById("aveOccupNum")?.value || 3.0),
    Latitude: parseFloat(document.getElementById("latNum")?.value || 37.44),
    Longitude: parseFloat(document.getElementById("lngNum")?.value || -122.14)
  };
}

// Fetch Single Prediction
async function fetchPrediction() {
  const payload = getFeaturesPayload();
  const loadingIndicator = document.getElementById("predictLoading");
  const priceDisplay = document.getElementById("priceDisplay");
  const priceShortDisplay = document.getElementById("priceShortDisplay");
  const confidenceDisplay = document.getElementById("confidenceDisplay");
  const tierBadge = document.getElementById("tierBadge");

  if (loadingIndicator) loadingIndicator.classList.remove("hidden");

  try {
    const response = await fetch("/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.detail || "Prediction request failed");
    }

    const data = await response.json();
    lastPredictionData = { payload, data, timestamp: new Date() };

    // Render Price
    if (priceDisplay) priceDisplay.innerText = data.predicted_price;
    if (priceShortDisplay) priceShortDisplay.innerText = data.predicted_price_short;
    if (confidenceDisplay) confidenceDisplay.innerText = data.confidence_range;

    // Numerical Price Calculation for Financial Metrics
    const rawPrice = parseFloat(data.predicted_price.replace(/[$,]/g, "")) || 0;
    updateFinancialMetrics(rawPrice, payload);
    updateTierBadge(rawPrice, tierBadge);

  } catch (err) {
    console.error("Prediction error:", err);
    if (priceDisplay) priceDisplay.innerText = "Error";
    if (confidenceDisplay) confidenceDisplay.innerText = err.message;
  } finally {
    if (loadingIndicator) loadingIndicator.classList.add("hidden");
  }
}

// Update Financial Calculations
function updateFinancialMetrics(price, payload) {
  // Monthly Mortgage estimation (30-year fixed @ 6.8%, 20% down payment)
  const loanAmount = price * 0.8;
  const monthlyRate = 0.068 / 12;
  const numPayments = 360;
  const monthlyMortgage = (loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments))) /
                          (Math.pow(1 + monthlyRate, numPayments) - 1);

  const mortgageEl = document.getElementById("mortgageEstimate");
  if (mortgageEl) {
    mortgageEl.innerText = isNaN(monthlyMortgage) ? "$--" : `$${Math.round(monthlyMortgage).toLocaleString()}/mo`;
  }

  // Price per Room
  const rooms = payload.AveRooms || 1;
  const pricePerRoom = Math.round(price / rooms);
  const roomPriceEl = document.getElementById("roomPriceEstimate");
  if (roomPriceEl) {
    roomPriceEl.innerText = `$${pricePerRoom.toLocaleString()}`;
  }

  // Price-to-Income Multiple
  const annualIncome = payload.MedInc * 10000;
  const multiple = (price / (annualIncome || 1)).toFixed(1);
  const multipleEl = document.getElementById("incomeMultiple");
  if (multipleEl) {
    multipleEl.innerText = `${multiple}x annual income`;
  }
}

function updateTierBadge(price, badgeEl) {
  if (!badgeEl) return;

  if (price < 150000) {
    badgeEl.innerText = "Affordable Housing";
    badgeEl.className = "px-3 py-1 text-xs font-semibold rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30";
  } else if (price < 300000) {
    badgeEl.innerText = "Moderate / Starter Home";
    badgeEl.className = "px-3 py-1 text-xs font-semibold rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30";
  } else if (price < 450000) {
    badgeEl.innerText = "Upper-Middle Market";
    badgeEl.className = "px-3 py-1 text-xs font-semibold rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30";
  } else {
    badgeEl.innerText = "Luxury / High Demand";
    badgeEl.className = "px-3 py-1 text-xs font-semibold rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30";
  }
}

// Batch CSV Processing
function initBatchUpload() {
  const dropZone = document.getElementById("csvDropZone");
  const fileInput = document.getElementById("csvFileInput");
  const sampleBtn = document.getElementById("loadSampleCsvBtn");
  const downloadSampleBtn = document.getElementById("downloadSampleBtn");
  const processBtn = document.getElementById("processCsvBtn");

  if (!dropZone || !fileInput) return;

  // Drop zone events
  ["dragenter", "dragover"].forEach(event => {
    dropZone.addEventListener(event, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add("border-emerald-500", "bg-slate-800/80");
    });
  });

  ["dragleave", "drop"].forEach(event => {
    dropZone.addEventListener(event, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove("border-emerald-500", "bg-slate-800/80");
    });
  });

  dropZone.addEventListener("drop", (e) => {
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleSelectedFile(files[0]);
    }
  });

  fileInput.addEventListener("change", (e) => {
    if (e.target.files.length > 0) {
      handleSelectedFile(e.target.files[0]);
    }
  });

  // Load sample file directly
  if (sampleBtn) {
    sampleBtn.addEventListener("click", async () => {
      try {
        showToast("Fetching sample test_houses.csv...");
        const res = await fetch("/sample-csv");
        if (!res.ok) throw new Error("Could not fetch sample CSV");
        const blob = await res.blob();
        const file = new File([blob], "test_houses.csv", { type: "text/csv" });
        handleSelectedFile(file);
      } catch (err) {
        showToast("Error loading sample: " + err.message, "error");
      }
    });
  }

  // Download sample CSV
  if (downloadSampleBtn) {
    downloadSampleBtn.addEventListener("click", () => {
      window.location.href = "/sample-csv";
    });
  }

  // Process Button
  if (processBtn) {
    processBtn.addEventListener("click", () => {
      if (lastBatchFile) {
        uploadBatchCsv(lastBatchFile);
      } else {
        showToast("Please select or drop a CSV file first.", "warning");
      }
    });
  }
}

function handleSelectedFile(file) {
  if (!file.name.endsWith(".csv")) {
    showToast("Please upload a .csv file only.", "error");
    return;
  }

  lastBatchFile = file;

  const fileNameEl = document.getElementById("selectedFileName");
  const fileSizeEl = document.getElementById("selectedFileSize");
  const fileCard = document.getElementById("fileSelectedCard");
  const processBtn = document.getElementById("processCsvBtn");

  if (fileNameEl) fileNameEl.innerText = file.name;
  if (fileSizeEl) fileSizeEl.innerText = `${(file.size / 1024).toFixed(1)} KB`;
  if (fileCard) fileCard.classList.remove("hidden");
  if (processBtn) processBtn.removeAttribute("disabled");

  showToast(`File "${file.name}" ready to process.`);
}

async function uploadBatchCsv(file) {
  const batchLoading = document.getElementById("batchLoading");
  const resultsContainer = document.getElementById("batchResultsContainer");
  const downloadResultBtn = document.getElementById("downloadResultCsvBtn");

  if (batchLoading) batchLoading.classList.remove("hidden");

  try {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/predict-file", {
      method: "POST",
      body: formData
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.detail || "Batch prediction failed");
    }

    const csvText = await response.text();
    renderBatchResultsTable(csvText);

    // Setup direct download button with the returned CSV
    if (downloadResultBtn) {
      const blob = new Blob([csvText], { type: "text/csv" });
      const downloadUrl = URL.createObjectURL(blob);
      downloadResultBtn.onclick = () => {
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = `predictions_${file.name}`;
        a.click();
      };
      downloadResultBtn.classList.remove("hidden");
    }

    if (resultsContainer) resultsContainer.classList.remove("hidden");
    showToast("Batch prediction completed successfully!");

  } catch (err) {
    console.error("Batch error:", err);
    showToast(err.message, "error");
  } finally {
    if (batchLoading) batchLoading.classList.add("hidden");
  }
}

function renderBatchResultsTable(csvText) {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) return;

  const headers = lines[0].split(",");
  const tableHead = document.getElementById("batchTableHead");
  const tableBody = document.getElementById("batchTableBody");
  const totalCountEl = document.getElementById("batchTotalRows");

  if (totalCountEl) totalCountEl.innerText = `${lines.length - 1} houses processed`;

  // Render headers
  if (tableHead) {
    tableHead.innerHTML = `<tr>${headers.map(h => `
      <th class="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider bg-slate-800/90 ${h === 'PredictedPrice' ? 'text-emerald-400 font-bold' : ''}">
        ${h}
      </th>
    `).join("")}</tr>`;
  }

  // Render body rows (limit preview to first 25 rows for smooth UI)
  if (tableBody) {
    const previewRows = lines.slice(1, 26);
    tableBody.innerHTML = previewRows.map((line, idx) => {
      const cols = line.split(",");
      return `
        <tr class="hover:bg-slate-800/50 transition-colors border-b border-slate-800/60">
          ${cols.map((col, cIdx) => {
            const isPrediction = headers[cIdx] === "PredictedPrice";
            if (isPrediction) {
              return `<td class="px-4 py-3 text-sm font-bold text-emerald-400">
                <span class="bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-md">${col}</span>
              </td>`;
            }
            return `<td class="px-4 py-3 text-sm text-slate-300">${col}</td>`;
          }).join("")}
        </tr>
      `;
    }).join("");
  }
}

// Model Health Check
async function checkApiHealth() {
  const badge = document.getElementById("modelStatusBadge");
  try {
    const res = await fetch("/health");
    if (res.ok) {
      const data = await res.json();
      if (badge) {
        badge.innerHTML = `
          <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block mr-2"></span>
          <span class="text-emerald-300">${data.model} Active</span>
          <span class="text-slate-400 text-xs ml-2 hidden sm:inline">(MAE: ${data.avg_error || '$32,773'})</span>
        `;
      }
    }
  } catch (err) {
    if (badge) {
      badge.innerHTML = `
        <span class="w-2 h-2 rounded-full bg-amber-400 inline-block mr-2"></span>
        <span class="text-amber-300">API Connecting...</span>
      `;
    }
  }
}

// Dynamic API Code Snippets
function updateCodeSnippets() {
  const payload = getFeaturesPayload();
  const curlCode = document.getElementById("curlCode");
  const pythonCode = document.getElementById("pythonCode");

  const jsonStr = JSON.stringify(payload, null, 2);

  if (curlCode) {
    curlCode.innerText = `curl -X POST "http://127.0.0.1:8000/predict" \\
  -H "Content-Type: application/json" \\
  -d '${jsonStr}'`;
  }

  if (pythonCode) {
    pythonCode.innerText = `import requests

url = "http://127.0.0.1:8000/predict"
data = ${jsonStr}

response = requests.post(url, json=data)
print(response.json())`;
  }
}

// Copy Code Helper
window.copyToClipboard = function(elementId) {
  const el = document.getElementById(elementId);
  if (!el) return;
  navigator.clipboard.writeText(el.innerText).then(() => {
    showToast("Code copied to clipboard!");
  }).catch(() => {
    showToast("Failed to copy code", "error");
  });
};

// Toast Notification
function showToast(message, type = "success") {
  let toastContainer = document.getElementById("toastContainer");
  if (!toastContainer) {
    toastContainer = document.createElement("div");
    toastContainer.id = "toastContainer";
    toastContainer.className = "fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none";
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement("div");
  const bg = type === "error" ? "bg-red-500/90 text-white" :
             type === "warning" ? "bg-amber-500/90 text-white" :
             "bg-emerald-600/95 text-white";

  toast.className = `${bg} px-4 py-2.5 rounded-lg shadow-xl text-sm font-medium flex items-center gap-2 transform translate-y-2 opacity-0 transition-all duration-300 pointer-events-auto border border-white/10`;
  toast.innerHTML = `<span>${type === 'error' ? '⚠️' : '✓'}</span><span>${message}</span>`;

  toastContainer.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.remove("translate-y-2", "opacity-0");
  });

  setTimeout(() => {
    toast.classList.add("opacity-0", "translate-y-2");
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

// Session Valuation History
function initSessionHistory() {
  const saveBtn = document.getElementById("saveHistoryBtn");
  const clearBtn = document.getElementById("clearHistoryBtn");

  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      if (!lastPredictionData) {
        showToast("Please calculate a prediction first.", "warning");
        return;
      }
      pinCurrentValuation(lastPredictionData);
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      sessionHistory = [];
      renderSessionHistory();
      showToast("Session history cleared.");
    });
  }
}

function pinCurrentValuation(item) {
  sessionHistory.unshift(item);
  if (sessionHistory.length > 10) sessionHistory.pop();
  renderSessionHistory();
  showToast(`Pinned ${item.data.predicted_price} to session history!`);
}

function renderSessionHistory() {
  const tbody = document.getElementById("sessionHistoryBody");
  const countBadge = document.getElementById("historyCountBadge");
  if (!tbody) return;

  if (countBadge) countBadge.innerText = `${sessionHistory.length} saved`;

  if (sessionHistory.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="px-4 py-4 text-center text-slate-500 text-xs italic">
          No pinned valuations yet. Click "Pin to Session History" on any estimate to compare properties.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = sessionHistory.map((item, idx) => {
    const time = new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const p = item.payload;
    return `
      <tr class="hover:bg-slate-800/40 transition-colors">
        <td class="px-3 py-2.5 font-mono text-[11px] text-slate-400">${time}</td>
        <td class="px-3 py-2.5 font-mono font-bold text-emerald-400">${item.data.predicted_price}</td>
        <td class="px-3 py-2.5 text-slate-300">$${(p.MedInc * 10000).toLocaleString()}</td>
        <td class="px-3 py-2.5 text-slate-300">${p.HouseAge} yrs</td>
        <td class="px-3 py-2.5 text-slate-300">${p.AveRooms} rms</td>
        <td class="px-3 py-2.5 text-slate-400 font-mono text-[11px]">${p.Latitude.toFixed(2)}°, ${p.Longitude.toFixed(2)}°</td>
        <td class="px-3 py-2.5 text-right">
          <button onclick="restoreSessionItem(${idx})" class="px-2 py-1 text-[11px] font-medium text-emerald-400 hover:text-white bg-emerald-500/10 hover:bg-emerald-500/30 rounded border border-emerald-500/20 transition">
            Restore
          </button>
        </td>
      </tr>
    `;
  }).join("");
}

window.restoreSessionItem = function(idx) {
  const item = sessionHistory[idx];
  if (!item) return;

  const setVal = (id, val) => {
    const num = document.getElementById(`${id}Num`);
    const range = document.getElementById(`${id}Range`);
    if (num) num.value = val;
    if (range) range.value = val;
  };

  const p = item.payload;
  setVal("medInc", p.MedInc);
  setVal("houseAge", p.HouseAge);
  setVal("aveRooms", p.AveRooms);
  setVal("aveBedrms", p.AveBedrms);
  setVal("population", p.Population);
  setVal("aveOccup", p.AveOccup);
  setVal("lat", p.Latitude);
  setVal("lng", p.Longitude);

  if (map && mapMarker) {
    mapMarker.setLatLng([p.Latitude, p.Longitude]);
    map.panTo([p.Latitude, p.Longitude]);
  }

  updateCodeSnippets();
  fetchPrediction();
  showToast(`Restored property valuation (${item.data.predicted_price})`);
};

// Feature Importances Loader
async function loadFeatureImportances() {
  const listEl = document.getElementById("featureImportanceList");
  if (!listEl) return;

  try {
    const res = await fetch("/model-insights");
    if (!res.ok) return;
    const data = await res.json();
    if (!data.feature_importances) return;

    const friendlyNames = {
      MedInc: "Median Income (MedInc)",
      AveOccup: "Average Household Occupancy (AveOccup)",
      Latitude: "Geographic Latitude (North/South)",
      Longitude: "Geographic Longitude (East/West)",
      HouseAge: "Median House Age",
      AveRooms: "Average Number of Rooms",
      Population: "Block Group Population",
      AveBedrms: "Average Number of Bedrooms"
    };

    listEl.innerHTML = data.feature_importances.map(item => `
      <div class="space-y-1">
        <div class="flex justify-between text-xs">
          <span class="font-medium text-slate-300">${friendlyNames[item.feature] || item.feature}</span>
          <span class="font-mono text-emerald-400 font-semibold">${item.importance.toFixed(1)}%</span>
        </div>
        <div class="w-full bg-slate-800/80 h-2 rounded-full overflow-hidden">
          <div class="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-500" style="width: ${item.importance}%"></div>
        </div>
      </div>
    `).join("");

  } catch (err) {
    console.warn("Could not load dynamic feature importances:", err);
  }
}


