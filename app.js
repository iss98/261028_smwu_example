(() => {
  "use strict";

  const session = { studentId: null, handwriting: null, visualSearch: null, downloadStarted: false };
  const main = document.getElementById("app-main");
  const entryPanel = document.getElementById("entry-panel");
  const visualPanel = document.getElementById("visual-panel");
  const form = document.getElementById("login-form");
  const input = document.getElementById("student-id");
  const error = document.getElementById("id-error");
  const loginView = document.getElementById("login-view");
  const readyView = document.getElementById("ready-view");
  const readyTitle = document.getElementById("ready-title");
  const confirmedId = document.getElementById("confirmed-id");
  const changeId = document.getElementById("change-id");
  const startWritingButton = document.getElementById("start-writing");
  const writingView = document.getElementById("writing-view");
  const writingTitle = document.getElementById("writing-title");
  const writingId = document.getElementById("writing-id");
  const canvasScroll = document.getElementById("canvas-scroll");
  const canvas = document.getElementById("writing-canvas");
  const strokeStatus = document.getElementById("stroke-status");
  const finishWritingButton = document.getElementById("finish-writing");
  const completeView = document.getElementById("writing-complete-view");
  const completeTitle = document.getElementById("complete-title");
  const completeId = document.getElementById("complete-id");
  const completeStrokes = document.getElementById("complete-strokes");
  const completeDuration = document.getElementById("complete-duration");
  const startSearchButton = document.getElementById("start-search");
  const searchView = document.getElementById("search-view");
  const searchTitle = document.getElementById("search-title");
  const searchId = document.getElementById("search-id");
  const searchImage = document.getElementById("search-image");
  const searchStatus = document.getElementById("search-status");
  const finishSearchButton = document.getElementById("finish-search");
  const downloadView = document.getElementById("download-view");
  const downloadTitle = document.getElementById("download-title");
  const downloadId = document.getElementById("download-id");
  const downloadStrokes = document.getElementById("download-strokes");
  const downloadSamples = document.getElementById("download-samples");
  const downloadFilename = document.getElementById("download-filename");
  const downloadAgainButton = document.getElementById("download-again");

  let context = null;
  let writingStartMs = 0;
  let activeStroke = null;
  let activePointerId = null;
  let canvasWidth = 1100;
  const canvasHeight = 420;
  let searchStartMs = 0;
  let searchActive = false;
  let currentPanel = null;
  let pendingSearchSample = null;
  let lastSavedSearchSample = null;
  let lastSavedSearchMs = -Infinity;
  let finalPayload = null;
  let finalFilename = "";

  function clearError() {
    error.textContent = "";
    error.hidden = true;
    input.removeAttribute("aria-invalid");
  }

  function showTaskView(view) {
    entryPanel.hidden = true;
    visualPanel.hidden = true;
    writingView.hidden = view !== "writing";
    completeView.hidden = view !== "complete";
    searchView.hidden = view !== "search";
    downloadView.hidden = view !== "download";
    main.classList.add("task-active");
  }

  function prepareCanvas() {
    const availableWidth = Math.floor(canvasScroll.clientWidth - 32);
    canvasWidth = Math.min(1100, Math.max(720, availableWidth));
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.style.width = `${canvasWidth}px`;
    canvas.style.height = `${canvasHeight}px`;
    canvas.width = Math.round(canvasWidth * pixelRatio);
    canvas.height = Math.round(canvasHeight * pixelRatio);
    context = canvas.getContext("2d");
    if (!context) {
      strokeStatus.textContent = "이 브라우저에서는 손글씨 입력을 사용할 수 없습니다.";
      return false;
    }
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.strokeStyle = "#17383e";
    context.fillStyle = "#17383e";
    context.lineWidth = 3.2;
    context.lineCap = "round";
    context.lineJoin = "round";
    return true;
  }

  function pointFromEvent(event) {
    const bounds = canvas.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width;
    const y = (event.clientY - bounds.top) / bounds.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) return null;
    return {
      x: Number(x.toFixed(4)),
      y: Number(y.toFixed(4)),
      tMs: Math.max(0, Math.round(performance.now() - writingStartMs))
    };
  }

  function drawPoint(point) {
    context.beginPath();
    context.arc(point.x * canvasWidth, point.y * canvasHeight, 1.6, 0, Math.PI * 2);
    context.fill();
  }

  function addPoint(point) {
    const points = activeStroke.points;
    const previous = points[points.length - 1];
    if (previous && previous.x === point.x && previous.y === point.y) return;
    points.push(point);
    if (!previous) {
      drawPoint(point);
      return;
    }
    context.beginPath();
    context.moveTo(previous.x * canvasWidth, previous.y * canvasHeight);
    context.lineTo(point.x * canvasWidth, point.y * canvasHeight);
    context.stroke();
  }

  function finishStroke() {
    if (!activeStroke) return;
    const pointerId = activePointerId;
    activeStroke = null;
    activePointerId = null;
    if (canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
    const count = session.handwriting.strokes.length;
    strokeStatus.textContent = `${count}개 획이 기록되었습니다.`;
    finishWritingButton.disabled = count === 0;
  }

  function beginSearch() {
    if (session.visualSearch) return;
    const bounds = searchImage.getBoundingClientRect();
    session.visualSearch = {
      stimulusId: "library-differences-01",
      startedAt: new Date().toISOString(),
      durationMs: null,
      panelSize: { widthPx: 600, heightPx: 420 },
      displaySize: { widthPx: Math.round(bounds.width), heightPx: Math.round(bounds.height) },
      samples: []
    };
    searchStartMs = performance.now();
    searchActive = true;
    currentPanel = null;
    pendingSearchSample = null;
    lastSavedSearchSample = null;
    lastSavedSearchMs = -Infinity;
    searchStatus.textContent = "그림 위의 마우스 움직임을 기록 중입니다.";
    finishSearchButton.disabled = false;
  }

  function sampleFromImage(event) {
    const bounds = searchImage.getBoundingClientRect();
    const imageX = (event.clientX - bounds.left) * 1280 / bounds.width;
    const imageY = (event.clientY - bounds.top) * 500 / bounds.height;
    const insideY = imageY >= 55 && imageY <= 475;
    let panel = null;
    let left = 0;
    if (insideY && imageX >= 20 && imageX <= 620) {
      panel = "A";
      left = 20;
    } else if (insideY && imageX >= 660 && imageX <= 1260) {
      panel = "B";
      left = 660;
    }
    if (!panel) return null;
    return {
      panel,
      x: Number(((imageX - left) / 600).toFixed(4)),
      y: Number(((imageY - 55) / 420).toFixed(4)),
      tMs: Math.max(0, Math.round(performance.now() - searchStartMs))
    };
  }

  function saveSearchSample(sample) {
    if (!sample) return;
    const previous = lastSavedSearchSample;
    if (previous && previous.panel === sample.panel && previous.x === sample.x && previous.y === sample.y) return;
    session.visualSearch.samples.push(sample);
    lastSavedSearchSample = sample;
    lastSavedSearchMs = sample.tMs;
  }

  function flushPendingSearchSample() {
    if (pendingSearchSample) saveSearchSample(pendingSearchSample);
    pendingSearchSample = null;
  }

  function filenameFor(studentId, createdAt) {
    const safeId = studentId.normalize("NFKC")
      .replace(/[^\p{L}\p{N}_-]+/gu, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || "student";
    const stamp = createdAt.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
    return `handwriting_mouse_${safeId}_${stamp}.json`;
  }

  function downloadJson(payload, filename) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.style.display = "none";
    try {
      document.body.appendChild(link);
      link.click();
    } finally {
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    }
  }

  input.addEventListener("input", clearError);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const studentId = input.value.trim();

    if (!studentId) {
      error.textContent = "학생 아이디를 입력해 주세요.";
      error.hidden = false;
      input.setAttribute("aria-invalid", "true");
      input.focus();
      return;
    }

    clearError();
    session.studentId = studentId;
    confirmedId.textContent = studentId;
    loginView.hidden = true;
    readyView.hidden = false;
    document.title = "아이디 확인 완료 | 관찰 기록실";
    readyTitle.focus();

    document.dispatchEvent(new CustomEvent("study:student-ready", {
      detail: { studentId }
    }));
  });

  changeId.addEventListener("click", () => {
    session.studentId = null;
    session.handwriting = null;
    confirmedId.textContent = "";
    input.value = "";
    clearError();
    readyView.hidden = true;
    loginView.hidden = false;
    document.title = "아이디 입력 | 관찰 기록실";
    input.focus();
  });

  startWritingButton.addEventListener("click", () => {
    if (!session.studentId) return;
    writingId.textContent = session.studentId;
    showTaskView("writing");
    finishWritingButton.disabled = true;
    strokeStatus.textContent = "아직 기록된 획이 없습니다.";
    if (!prepareCanvas()) return;
    session.handwriting = {
      stimulusId: "sentence-01",
      startedAt: new Date().toISOString(),
      durationMs: null,
      canvas: { widthPx: canvasWidth, heightPx: canvasHeight },
      strokes: []
    };
    writingStartMs = performance.now();
    document.title = "문장 따라 쓰기 | 관찰 기록실";
    writingTitle.focus();
  });

  canvas.addEventListener("pointerdown", (event) => {
    if (!session.handwriting || event.pointerType !== "mouse" || event.button !== 0 || activeStroke) return;
    const point = pointFromEvent(event);
    if (!point) return;
    event.preventDefault();
    activePointerId = event.pointerId;
    activeStroke = { points: [] };
    session.handwriting.strokes.push(activeStroke);
    canvas.setPointerCapture(activePointerId);
    addPoint(point);
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!activeStroke || event.pointerId !== activePointerId) return;
    if (!(event.buttons & 1)) {
      finishStroke();
      return;
    }
    const point = pointFromEvent(event);
    if (!point) {
      finishStroke();
      return;
    }
    addPoint(point);
  });

  canvas.addEventListener("pointerup", (event) => {
    if (!activeStroke || event.pointerId !== activePointerId) return;
    const point = pointFromEvent(event);
    if (point) addPoint(point);
    finishStroke();
  });

  canvas.addEventListener("pointercancel", finishStroke);
  canvas.addEventListener("lostpointercapture", finishStroke);

  finishWritingButton.addEventListener("click", () => {
    if (!session.handwriting?.strokes.length) return;
    finishStroke();
    session.handwriting.durationMs = Math.round(performance.now() - writingStartMs);
    completeId.textContent = session.studentId;
    completeStrokes.textContent = `${session.handwriting.strokes.length}개`;
    const seconds = Math.floor(session.handwriting.durationMs / 1000);
    completeDuration.textContent = `${Math.floor(seconds / 60)}분 ${seconds % 60}초`;
    showTaskView("complete");
    document.title = "문장 쓰기 완료 | 관찰 기록실";
    completeTitle.focus();
    document.dispatchEvent(new CustomEvent("study:handwriting-complete", {
      detail: { studentId: session.studentId, handwriting: session.handwriting }
    }));
  });

  startSearchButton.addEventListener("click", () => {
    if (session.handwriting?.durationMs == null) return;
    searchId.textContent = session.studentId;
    showTaskView("search");
    document.title = "틀린 그림 찾기 | 관찰 기록실";
    searchTitle.focus();
    finishSearchButton.disabled = true;
    searchStatus.textContent = "그림을 불러오는 중입니다.";
    if (searchImage.complete) {
      if (searchImage.naturalWidth > 0) beginSearch();
      else searchStatus.textContent = "그림을 불러오지 못했습니다. 페이지를 새로고침해 주세요.";
    } else {
      searchImage.addEventListener("load", beginSearch, { once: true });
      searchImage.addEventListener("error", () => {
        searchStatus.textContent = "그림을 불러오지 못했습니다. 페이지를 새로고침해 주세요.";
      }, { once: true });
    }
  });

  searchImage.addEventListener("pointermove", (event) => {
    if (!searchActive || event.pointerType !== "mouse") return;
    const sample = sampleFromImage(event);
    if (!sample) {
      flushPendingSearchSample();
      currentPanel = null;
      return;
    }
    if (sample.panel !== currentPanel) {
      flushPendingSearchSample();
      currentPanel = sample.panel;
      saveSearchSample(sample);
      return;
    }
    pendingSearchSample = sample;
    if (sample.tMs - lastSavedSearchMs >= 1000 / 30) flushPendingSearchSample();
  });

  searchImage.addEventListener("pointerleave", () => {
    if (!searchActive) return;
    flushPendingSearchSample();
    currentPanel = null;
  });

  finishSearchButton.addEventListener("click", () => {
    if (!searchActive || !session.visualSearch) return;
    flushPendingSearchSample();
    session.visualSearch.durationMs = Math.round(performance.now() - searchStartMs);
    const createdAt = new Date().toISOString();
    const payload = {
      schemaVersion: "1.0.0",
      taskSetVersion: "2026-10-27-v1",
      studentId: session.studentId,
      createdAt,
      handwriting: session.handwriting,
      visualSearch: session.visualSearch
    };
    const filename = filenameFor(session.studentId, createdAt);
    try {
      downloadJson(payload, filename);
    } catch (error) {
      searchStatus.textContent = "다운로드를 시작하지 못했습니다. 완료 버튼을 다시 눌러 주세요.";
      return;
    }
    finalPayload = payload;
    finalFilename = filename;
    searchActive = false;
    session.downloadStarted = true;
    downloadId.textContent = session.studentId;
    downloadStrokes.textContent = `${session.handwriting.strokes.length}개`;
    downloadSamples.textContent = `${session.visualSearch.samples.length}개`;
    downloadFilename.textContent = filename;
    showTaskView("download");
    document.title = "기록 다운로드 | 관찰 기록실";
    downloadTitle.focus();
  });

  downloadAgainButton.addEventListener("click", () => {
    if (!finalPayload || !finalFilename) return;
    downloadJson(finalPayload, finalFilename);
  });

  window.addEventListener("beforeunload", (event) => {
    if (!session.handwriting?.strokes.length || session.downloadStarted) return;
    event.preventDefault();
    event.returnValue = "";
  });
})();
