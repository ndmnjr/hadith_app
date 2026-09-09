(function () {

  // -------------------- ATTRIBUTES --------------------
  const state = {
    client: null,
    filters: null,
    selectedRawis: [], // bindNarratorsPage
    lastRows: [], // bindExportButtons
    lastColumns: [], // bindExportButtons
    page: document.body.dataset.page || "home"
  };

  const labels = {
    hadith_id: "معرّف الحديث",
    hadith_number: "رقم الحديث",
    hadith_beginning: "طرف الحديث",
    hadith_text: "نص الحديث",
    hadith_type: "النوع",
    rawi_id: "معرّف الراوي",
    rawi_name: "اسم الراوي",
    narration_count: "عدد المرويات",
    volume_name: "المجلد",
    book_name: "الكتاب",
    chapter_name: "الباب",
    narrators: "الرواة",
    page_number: "الصفحة",
    takhreej: "التخريج",
    hadith_action: "الإجراء"
  };

  const typeLabels = {
    main: "أصل",
    sub: "تابع",
    part: "جزء",
    h_main: "حاشية أصل",
    h_part: "حاشية جزء"
  };

  // -------------------- START --------------------
  document.addEventListener("DOMContentLoaded", init);

  // -------------------- INIT & ROUTING --------------------
  async function init() {
    markActiveNav();
    ensureHadithDetailModal();
    bindExportButtons();
    bindReadingSize();
    await initSupabase();
    await loadFilterTree();
    initFilters();

    // MAIN SECTIONS
    if (state.page === "search") bindSearchPage(); // البحث في الأحاديث
    if (state.page === "index") bindIndexPage(); // فهرس الأطراف
    if (state.page === "narrators") bindNarratorsPage(); // الرواة
    if (state.page === "musnad") bindMusnadPage(); // مسند الرواة
    if (state.page === "browse") bindBrowsePage(); // تصفح المجلدات والكتب والأبواب

    // SUPPORT SECTIONS
    if (state.page === "hadith") bindHadithPage(); // عرض الحديث مع سياقه
  }

  // -------------------- SUPABASE --------------------
  async function initSupabase() {
    const response = await fetch("/api/config");
    const config = await response.json();
    if (!config.supabaseUrl || !config.supabaseAnonKey) {
      throw new Error("إعدادات Supabase غير مكتملة.");
    }
    state.client = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
  }

  async function rpc(name, params) {
    const { data, error } = await state.client.rpc(name, params || {});
    if (error) throw error;
    return data;
  }

  // -------------------- FILTERS --------------------
  async function loadFilterTree() {
    state.filters = await rpc("app_get_filter_tree");
  }

  function initFilters(scope) {
    const root = scope || document;
    root.querySelectorAll("[data-filter-volume]").forEach((select) => fillSelect(select, state.filters.volumes, "كل المجلدات"));
    root.querySelectorAll("[data-filter-search]").forEach((input) => {
      input.addEventListener("input", () => filterSelectOptions(root, input.dataset.filterSearch, input.value));
    });
    root.querySelectorAll("[data-filter-search]").forEach((input) => filterSelectOptions(root, input.dataset.filterSearch, input.value));
    updateDependentFilters(root);
    root.querySelectorAll("[data-filter-volume]").forEach((select) => select.addEventListener("change", () => updateDependentFilters(root)));
    root.querySelectorAll("[data-filter-book]").forEach((select) => select.addEventListener("change", () => updateChapterFilter(root)));
    root.querySelectorAll("[data-clear-filters]").forEach((button) => button.addEventListener("click", () => clearFilters(root)));
  }

  function clearFilters(root) {
    const form = root.querySelector("[data-search-form], [data-index-form], [data-rawi-form], [data-musnad-form]");
    if (form) form.reset();
    root.querySelectorAll("[data-filter-search]").forEach((input) => { input.value = ""; });
    root.querySelectorAll("select[multiple]").forEach((select) => {
      [...select.options].forEach((option) => { option.selected = false; option.hidden = false; });
    });
    if (form && form.matches("[data-rawi-form]")) {
      state.selectedRawis = [];
      renderRawiChips(form.querySelector("[data-rawi-chips]"));
    }
    updateDependentFilters(root);
    root.querySelectorAll("[data-filter-search]").forEach((input) => filterSelectOptions(root, input.dataset.filterSearch, ""));
  }

  function updateDependentFilters(root) {
    const volumeIds = getSelectedNumbers(root.querySelector("[data-filter-volume]"));
    const books = state.filters.books.filter((book) => !volumeIds.length || volumeIds.includes(Number(book.volume_id)));
    root.querySelectorAll("[data-filter-book]").forEach((select) => fillSelect(select, books, "كل الكتب"));
    updateChapterFilter(root);
  }

  function updateChapterFilter(root) {
    const volumeIds = getSelectedNumbers(root.querySelector("[data-filter-volume]"));
    const bookIds = getSelectedNumbers(root.querySelector("[data-filter-book]"));
    const validBooks = state.filters.books
      .filter((book) => !volumeIds.length || volumeIds.includes(Number(book.volume_id)))
      .map((book) => Number(book.id));
    const chapters = state.filters.chapters.filter((chapter) => {
      const bookId = Number(chapter.book_id);
      return (!bookIds.length || bookIds.includes(bookId)) && (!volumeIds.length || validBooks.includes(bookId));
    });
    root.querySelectorAll("[data-filter-chapter]").forEach((select) => fillSelect(select, chapters, "كل الأبواب"));
  }

  function fillSelect(select, rows, allLabel) {
    const current = getSelectedNumbers(select);
    select.innerHTML = "";
    if (!select.multiple) select.append(new Option(allLabel, ""));
    rows.forEach((row) => select.append(new Option(row.name, row.id)));
    [...select.options].forEach((option) => {
      option.selected = current.includes(Number(option.value));
    });
    const search = document.querySelector(`[data-filter-search="${filterKey(select)}"]`);
    if (search) filterSelectOptions(document, filterKey(select), search.value);
  }

  function filterKey(select) {
    return ["volume", "book", "chapter"].find((key) => select.hasAttribute(`data-filter-${key}`));
  }

  function filterSelectOptions(root, key, query) {
    const select = root.querySelector(`[data-filter-${key}]`) || document.querySelector(`[data-filter-${key}]`);
    if (!select) return;
    const normalizedQuery = String(query || "").trim().toLocaleLowerCase();
    [...select.options].forEach((option) => {
      option.hidden = Boolean(normalizedQuery) && !option.textContent.toLocaleLowerCase().includes(normalizedQuery);
    });
  }

  function getSelectedNumbers(select) {
    if (!select) return [];
    return [...select.selectedOptions].map((option) => Number(option.value)).filter(Boolean);
  }

  function filterParams(root) {
    return {
      p_volume_ids: getSelectedNumbers(root.querySelector("[data-filter-volume]")),
      p_book_ids: getSelectedNumbers(root.querySelector("[data-filter-book]")),
      p_chapter_ids: getSelectedNumbers(root.querySelector("[data-filter-chapter]"))
    };
  }

  // -------------------- UTILS --------------------
  function setStatus(message, isError) {
    const el = document.querySelector("[data-status]");
    if (!el) return;
    el.textContent = message || "";
    el.classList.toggle("error", Boolean(isError));
  }

  // -------------------- RENDER TABLE & CARDS --------------------
  function setRows(rows, columns) {
    state.lastRows = rows || [];
    state.lastColumns = getVisibleColumns(columns);
  }

  function renderTable(target, rows, columns) {
    rows = rows.map((row) => {
      const displayRow = { ...row };
      if (displayRow.hadith_type === "h_part" || displayRow.hadith_type === "h_main") {
        displayRow.hadith_number = `${displayRow.hadith_number || ""} (حاشية)`;
      }
      return displayRow;
    });
    const displayColumns = getVisibleColumns(columns);
    setRows(rows, displayColumns);
    if (!rows.length) {
      target.innerHTML = '<div class="panel text-center text-muted">لا توجد نتائج.</div>';
      return;
    }
    const hasContextColumns = ["volume_name", "book_name", "chapter_name"].some((column) => displayColumns.includes(column));
    const head = `${displayColumns.map((column) => `<th class="${["volume_name", "book_name", "chapter_name"].includes(column) ? "context-column" : ""}">${labels[column] || column}</th>`).join("")}${hasContextColumns ? '<th class="mobile-only">المجلد / الكتاب / الباب</th>' : ""}<th>${labels.hadith_action}</th>`;
    const body = rows.map((row) => {
      const cells = displayColumns.map((column) => {
        const value = formatCell(column, row[column], row);
        const contextClass = ["volume_name", "book_name", "chapter_name"].includes(column) ? "context-column" : "";
        return `<td class="${contextClass}" data-label="${labels[column] || column}">${value}</td>`;
      }).join("");
      const contextValues = ["volume_name", "book_name", "chapter_name"]
        .filter((column) => displayColumns.includes(column))
        .map((column) => escapeHtml(row[column] || "-"));
      const mobileContext = hasContextColumns
        ? `<td class="mobile-only" data-label="المجلد / الكتاب / الباب">${contextValues.join(" / ")}</td>`
        : "";
      const hadithId = row.hadith_id || row.id || "";
      const action = hadithId
        ? `<button type="button" class="btn btn-sm btn-outline-primary" data-hadith-link="${escapeAttr(hadithId)}">استعرض كاملا</button>`
        : '<span class="text-muted">-</span>';
      return `<tr>${cells}${mobileContext}<td data-label="${labels.hadith_action}">${action}</td></tr>`;
    }).join("");
    target.innerHTML = `<div class="table-responsive"><table class="table results-table align-middle"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
    target.querySelectorAll("[data-hadith-link]").forEach((link) => {
      link.addEventListener("click", async (event) => {
        event.preventDefault();
        const hadithId = link.dataset.hadithLink || link.dataset.hadithId;
        if (hadithId) {
          await openHadithDetailModal(Number(hadithId));
        } else {
          location.href = "/hadith.html?id=" + (link.getAttribute("href") || "").split("id=")[1];
        }
      });
    });
  }

  function getVisibleColumns(columns) {
    return (columns || []).filter((column) => {
      if (column === "hadith_id" || column === "id") return false;
      return column !== "hadith_type" || state.page === "search";
    });
  }

  function ensureHadithDetailModal() {
    if (document.getElementById("hadith-detail-modal")) return;

    const modal = document.createElement("div");
    modal.id = "hadith-detail-modal";
    modal.className = "hadith-detail-modal hidden";
    modal.innerHTML = `
      <div class="hadith-detail-backdrop" data-close-hadith-modal="true"></div>
      <div class="hadith-detail-panel-wrap">
        <div class="hadith-detail-panel" role="dialog" aria-modal="true" aria-labelledby="hadith-modal-title">
          <div class="hadith-detail-panel-header">
            <div id="hadith-modal-title" class="hadith-detail-panel-title"></div>
            <button type="button" class="hadith-detail-close-btn" aria-label="إغلاق" data-close-hadith-modal="true">&times;</button>
          </div>
          <div id="hadith-detail-content" class="hadith-detail-content">
            <div id="hadith-detail-header" class="hadith-detail-header"></div>
            <div id="hadith-detail-matn" class="hadith-detail-matn"></div>
            <div id="hadith-detail-hashiah" class="hadith-detail-hashiah hidden"></div>
          </div>
          <div class="hadith-detail-toolbar">
            <div class="hadith-detail-toolbar-left">
              <label class="hadith-detail-toggle">
                <input type="checkbox" id="hadith-detail-toggle" class="hadith-detail-toggle-input">
                <span>تخريج مطول</span>
              </label>
              <button type="button" id="hadith-detail-copy-btn" class="hadith-detail-copy-btn">نسخ النص</button>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const closeTriggers = modal.querySelectorAll("[data-close-hadith-modal]");
    closeTriggers.forEach((trigger) => {
      trigger.addEventListener("click", () => modal.classList.add("hidden"));
    });

    modal.addEventListener("click", (event) => {
      if (event.target === modal) modal.classList.add("hidden");
    });
  }

  async function openHadithDetailModal(hadithId) {
    const modal = document.getElementById("hadith-detail-modal");
    if (!modal) return;

    modal.classList.remove("hidden");

    const content = modal.querySelector("#hadith-detail-content");
    content.dataset.activeId = String(hadithId);

    try {
      const rows = await loadSingleHadithDetails(hadithId);
      renderHadithClusterModal(rows);
    } catch (error) {
      content.innerHTML = '<div class="hadith-detail-empty">تعذّر تحميل الحديث.</div>';
      console.error(error);
    }
  }

  async function loadSingleHadithDetails(hadithId) {
    try {
      const data = await rpc("app_get_single_hadith_details", { p_hadith_id: parseInt(hadithId, 10) });
      return Array.isArray(data) ? data : [data];
    } catch (error) {
      const message = String(error && error.message ? error.message : error || "");
      const isMissingFunction = message.includes("does not exist") || message.includes("function") || message.includes("not found");
      if (!isMissingFunction) throw error;
      const fallback = await rpc("app_get_hadith_context", { p_hadith_id: parseInt(hadithId, 10) });
      return Array.isArray(fallback) ? fallback : [fallback];
    }
  }

  function renderHadithClusterModal(rows) {
    const modal = document.getElementById("hadith-detail-modal");
    if (!modal) return;
    const detailContent = modal.querySelector("#hadith-detail-content");
    const panelTitle = modal.querySelector("#hadith-modal-title");
    const headerContainer = modal.querySelector("#hadith-detail-header");
    const matnContainer = modal.querySelector("#hadith-detail-matn");
    const hashiahContainer = modal.querySelector("#hadith-detail-hashiah");
    const toggle = modal.querySelector("#hadith-detail-toggle");
    const copyButton = modal.querySelector("#hadith-detail-copy-btn");

    const normalizedRows = (Array.isArray(rows) ? rows : []).filter(Boolean);
    if (!normalizedRows.length) {
      headerContainer.innerHTML = "";
      matnContainer.innerHTML = '<div class="hadith-detail-empty">لا يوجد نص للحديث.</div>';
      hashiahContainer.classList.add("hidden");
      return;
    }

    let showFullTakhreej = Boolean(toggle && toggle.checked);
    const headerInfo = normalizedRows[0];

    console.log(normalizedRows);
    panelTitle.textContent = headerInfo.volume_name || "";
    headerContainer.innerHTML = `
      <div class="hadith-detail-volume">${escapeHtml(headerInfo.volume_name || "")}</div>
      <div class="hadith-detail-book">${escapeHtml(headerInfo.book_name || "")}</div>
      <div class="hadith-detail-chapter">${escapeHtml(headerInfo.chapter_name || "")}</div>
    `;

    const matnBlocks = [];
    const hashiahBlocks = [];
    let footnoteIndex = 1;
    let activeMatnBlock = null;
    let activeHashiahBlock = null;

    normalizedRows.forEach((row) => {
      const type = String(row.hadith_type || row.type || "").toLowerCase();
      const htmlContent = row.hadith_text_html || row.text_html || row.hadith_text || row.text || "";

      if (["main", "sub", "part"].includes(type) || row.volume_id in [1, 7]) {
        const block = {
          id: row.hadith_id || row.id,
          type,
          number: row.hadith_number || row.number || "",
          html: htmlContent,
          footnoteIndex: null
        };
        matnBlocks.push(block);
        activeMatnBlock = block;
        activeHashiahBlock = { index: null, items: [] };

        if (showFullTakhreej && (row.long_takhreej || row.takhreej_full)) {
          block.footnoteIndex = footnoteIndex;
          activeHashiahBlock.index = footnoteIndex;
          activeHashiahBlock.items.push({ html: null, takhreej: row.long_takhreej || row.takhreej_full });
          hashiahBlocks.push(activeHashiahBlock);
          footnoteIndex += 1;
        }
      } else if (["h_main", "h_part", "h_sub"].includes(type)) {
        if (!activeMatnBlock) return;

        if (!activeMatnBlock.footnoteIndex) {
          activeMatnBlock.footnoteIndex = footnoteIndex;
          activeHashiahBlock.index = footnoteIndex;
          hashiahBlocks.push(activeHashiahBlock);
          footnoteIndex += 1;
        }

        activeHashiahBlock.items.push({
          html: htmlContent,
          takhreej: showFullTakhreej ? (row.long_takhreej || row.takhreej_full) : (row.short_takhreej || row.takhreej)
        });
      }
    });

    matnContainer.innerHTML = matnBlocks.map((block) => {
      const prefix = block.type === "main"
        ? `<span class="hadith-detail-number">${escapeHtml(toArabicDigits(block.number))} -</span>`
        : block.type === "sub"
          ? `<span class="hadith-detail-bullet">•</span>`
          : "";
      const subScript = block.footnoteIndex ? `<sup class="hadith-detail-sup">(${toArabicDigits(block.footnoteIndex)})</sup>` : "";
      return `
        <div class="hadith-detail-text-block">
          ${prefix}
          <span class="hadith-detail-inline-p">${block.html}</span>
          ${subScript}
        </div>
      `;
    }).join("");

    if (hashiahBlocks.length > 0 && (headerInfo.volume_id >= 7)) {
      hashiahContainer.classList.remove("hidden");
      // make border-top visible when hashiah exists
      hashiahContainer.style.borderTop = "1px solid #ccc";
      hashiahContainer.innerHTML = hashiahBlocks.map((hashiah) => {
        const idx = `<span class="hadith-detail-footnote-index">(${toArabicDigits(hashiah.index)})</span>`;
        const itemsHtml = hashiah.items.map((item) => {
          const htmlStr = item.html ? `<span class="hadith-detail-inline-p">${item.html}</span>` : "";
          const takhreejStr = item.takhreej ? `<span class="hadith-detail-takhreej">${escapeHtml(item.takhreej)}</span>` : "";
          return `<div class="hadith-detail-hashiah-item">${htmlStr}${takhreejStr}</div>`;
        }).join("");
        return `
          <div class="hadith-detail-hashiah-row">
            ${idx}
            <div class="hadith-detail-hashiah-body">${itemsHtml}</div>
          </div>
        `;
      }).join("");
    } else {
      hashiahContainer.classList.add("hidden");
      hashiahContainer.innerHTML = "";
      // remove border-top make it transparent when no hashiah
      hashiahContainer.style.borderTop = "1px solid transparent";
    }

    if (toggle) {
      toggle.onchange = (event) => {
        showFullTakhreej = Boolean(event.target.checked);
        renderHadithClusterModal(normalizedRows);
      };
    }

    if (copyButton) {
      copyButton.onclick = async () => {
        const textToCopy = detailContent.innerText;
        await navigator.clipboard.writeText(textToCopy);
        copyButton.textContent = "تم النسخ ✔️";
        copyButton.classList.add("hadith-detail-copy-btn-success");
        setTimeout(() => {
          copyButton.textContent = "نسخ النص 📋";
          copyButton.classList.remove("hadith-detail-copy-btn-success");
        }, 2000);
      };
    }
  }

  function formatCell(column, value, row) {
    if (value === null || value === undefined || value === "") return '<span class="text-muted">-</span>';
    if (column === "hadith_id") return `<a href="#" data-hadith-link="${value}">${value}</a>`;
    if (column === "hadith_type") return `<span class="badge badge-type">${typeLabels[value] || value}</span>`;
    if (column === "hadith_number") return toArabicDigits(escapeHtml(String(value)));
    if (column === "hadith_text") return escapeHtml(value).slice(0, 240) + (value.length > 240 ? "..." : "");
    if (column === "hadith_beginning") return `<a href="#" data-hadith-link="${row.hadith_id}">${escapeHtml(value)}</a>`;
    return escapeHtml(String(value));
  }

  function renderHadithCards(target, rows, options) {
    setRows(rows, ["hadith_id", "hadith_number", "hadith_type", "volume_name", "book_name", "chapter_name", "hadith_text", "narrators", "takhreej"]);
    if (!rows.length) {
      target.innerHTML = '<div class="panel text-center text-muted">لا توجد أحاديث للعرض.</div>';
      return;
    }
    target.innerHTML = rows.map((row) => hadithCardHtml(row, options)).join("");
    target.querySelectorAll("[data-copy]").forEach((button) => {
      button.addEventListener("click", () => copyText(button.dataset.copy));
    });
  }

  function hadithCardHtml(row, options) {
    const showTakhreej = options && options.showTakhreej;
    const takhreejText = showTakhreej ? (row.takhreej_full || row.takhreej) : row.takhreej;
    const text = row.text_html || escapeHtml(row.hadith_text || "");
    return `
      <article class="hadith-card type-${row.hadith_type || "main"}">
        <div class="hadith-meta">
          <span class="badge badge-type">${typeLabels[row.hadith_type] || row.hadith_type || ""}</span>
          <span>رقم: ${escapeHtml(toArabicDigits(row.hadith_number || "-"))}</span>
          <span>${escapeHtml(row.volume_name || "")}</span>
          <span>${escapeHtml(row.book_name || "")}</span>
          <span>${escapeHtml(row.chapter_name || "")}</span>
          ${row.page_number ? `<span>ص ${row.page_number}</span>` : ""}
        </div>
        <div class="hadith-text">${text}</div>
        ${row.narrators ? `<div class="mt-2 text-muted">الرواة: ${escapeHtml(row.narrators)}</div>` : ""}
        ${takhreejText ? `<div class="takhreej">${escapeHtml(takhreejText)}</div>` : ""}
        <div class="mt-3 no-print">
          <a class="btn btn-sm btn-outline-primary" href="/hadith.html?id=${row.hadith_id}">عرض الحديث</a>
          <button class="btn btn-sm btn-outline-secondary" data-copy="${escapeAttr(row.hadith_text || "")}">نسخ</button>
        </div>
      </article>`;
  }
  
  // -------------------- البحث في الأحاديث bindSearchPage --------------------
  function bindSearchPage() {
    const form = document.querySelector("[data-search-form]");
    const results = document.querySelector("[data-results]");
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      await runAction(async () => {
        const rows = await rpc("app_search_hadith", {
          p_query: form.querySelector("[name=query]").value,
          ...filterParams(form),
          p_types: getSelectedValues(form.querySelector("[name=types]")),
          p_limit: 500,
          p_offset: 0
        });
        renderTable(results, rows, ["hadith_id", "hadith_number", "hadith_type", "hadith_text", "narrators", "volume_name", "book_name", "chapter_name"]);
        setStatus(`عدد النتائج المعروضة: ${rows.length}`);
      });
    });
  }

  // -------------------- bindIndexPage --------------------
  function bindIndexPage() {
    const form = document.querySelector("[data-index-form]");
    const results = document.querySelector("[data-results]");
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      await runAction(async () => {
        const rows = await rpc("app_get_hadith_index", { ...filterParams(form), p_limit: 300, p_offset: 0 });

        renderTable(results, rows, ["hadith_number", "hadith_beginning", "volume_name", "book_name", "chapter_name"]);
        //renderTable(results, rows, ["hadith_id", "hadith_number", "hadith_beginning", "hadith_type", "volume_name", "book_name", "chapter_name"]);
        setStatus(`عدد النتائج المعروضة: ${rows.length}`);
      });
    });
    form.requestSubmit();
  }

  // -------------------- الرواة bindNarratorsPage --------------------  
  function bindNarratorsPage() {
    const form = document.querySelector("[data-rawi-form]");
    const rawiInput = form.querySelector("[name=rawi_query]");
    const suggestions = document.querySelector("[data-rawi-suggestions]");
    const chips = document.querySelector("[data-rawi-chips]");
    const results = document.querySelector("[data-results]");

    rawiInput.addEventListener("input", debounce(async () => {
      const rows = await rpc("app_search_rawis", { p_query: rawiInput.value, p_limit: 500 });
      suggestions.innerHTML = rows.map((row) => `<option value="${escapeAttr(row.rawi_name)}" data-id="${row.rawi_id}">${escapeAttr(row.matched_alias || row.rawi_name)}"></option>`).join("");
    }, 250));

    form.querySelector("[data-add-rawi]").addEventListener("click", async () => {
      const rows = await rpc("app_search_rawis", { p_query: rawiInput.value, p_limit: 500 });
      if (rows[0] && !state.selectedRawis.some((rawi) => rawi.rawi_id === rows[0].rawi_id)) {
        state.selectedRawis.push(rows[0]);
        renderRawiChips(chips);
      }
      rawiInput.value = "";
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      await runAction(async () => {
        const rows = await rpc("app_get_rawi_hadiths", {
          p_rawi_ids: state.selectedRawis.map((rawi) => rawi.rawi_id),
          ...filterParams(form),
          p_limit: 500,
          p_offset: 0
        });
        renderTable(results, rows, ["rawi_name", "hadith_id", "hadith_number", "hadith_type", "hadith_text", "volume_name", "book_name", "chapter_name"]);
        setStatus(`عدد النتائج المعروضة: ${rows.length}`);
      });
    });
  }

  //// bindNarratorsPage helper
  function renderRawiChips(target) {
    target.innerHTML = state.selectedRawis.map((rawi) => `
      <span class="rawi-chip">${escapeHtml(rawi.rawi_name)}
        <button type="button" data-remove-rawi="${rawi.rawi_id}" aria-label="حذف">×</button>
      </span>`).join("");
    target.querySelectorAll("[data-remove-rawi]").forEach((button) => {
      button.addEventListener("click", () => {
        state.selectedRawis = state.selectedRawis.filter((rawi) => String(rawi.rawi_id) !== button.dataset.removeRawi);
        renderRawiChips(target);
      });
    });
  }

  // -------------------- bindMusnadPage --------------------
  function bindMusnadPage() {
    const form = document.querySelector("[data-musnad-form]");
    const results = document.querySelector("[data-results]");
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      await runAction(async () => {
        const rows = await rpc("app_get_narrator_musnad", {
          p_narration_count: Number(form.querySelector("[name=narration_count]").value || 1),
          ...filterParams(form),
          p_limit: 500,
          p_offset: 0
        });
        renderTable(results, rows, ["rawi_name", "narration_count", "hadith_id", "hadith_number", "hadith_type", "hadith_text", "volume_name", "book_name", "chapter_name"]);
        setStatus(`عدد النتائج المعروضة: ${rows.length}`);
      });
    });
  }

  // -------------------- bindBrowsePage --------------------
  function bindBrowsePage() {
    const volumeSelect = document.querySelector("[data-browse-volume]");
    const volumeSearch = document.querySelector('[data-filter-search="browse-volume"]');
    const tree = document.querySelector("[data-tree]");
    const content = document.querySelector("[data-content]");
    fillSelect(volumeSelect, state.filters.volumes, "اختر المجلد");
    volumeSelect.addEventListener("change", () => renderBrowseTree(tree, Number(volumeSelect.value), content));
  }

  //// bindBrowsePage helper
  function renderBrowseTree(tree, volumeId, content) {
    const books = state.filters.books.filter((book) => Number(book.volume_id) === volumeId);
    tree.innerHTML = books.map((book) => {
      const chapters = state.filters.chapters.filter((chapter) => Number(chapter.book_id) === Number(book.id));
      return `
        <button class="tree-item tree-book" data-book="${book.id}">${escapeHtml(book.name)}</button>
        ${chapters.map((chapter) => `<button class="tree-item tree-chapter" data-chapter="${chapter.id}" data-book="${book.id}">${escapeHtml(chapter.name)}</button>`).join("")}
      `;
    }).join("");
    tree.querySelectorAll("[data-book],[data-chapter]").forEach((button) => {
      button.addEventListener("click", async () => {
        tree.querySelectorAll(".active").forEach((item) => item.classList.remove("active"));
        button.classList.add("active");
        await loadBrowseContent(content, volumeId, button.dataset.book, button.dataset.chapter);
      });
    });
  }

  //// bindBrowsePage helper
  async function loadBrowseContent(content, volumeId, bookId, chapterId) {
    await runAction(async () => {
      const showTakhreej = document.querySelector("[name=show_takhreej]").checked;
      const rows = await rpc("app_browse_content", {
        p_volume_id: volumeId || null,
        p_book_id: bookId ? Number(bookId) : null,
        p_chapter_id: chapterId ? Number(chapterId) : null,
        p_limit: 500,
        p_offset: 0
      });
      renderHadithCards(content, rows, { showTakhreej });
      setStatus(`عدد النصوص المعروضة: ${rows.length}`);
    });
  }

  // -------------------- bindHadithPage --------------------
  function bindHadithPage() {
    const target = document.querySelector("[data-hadith-detail]");
    const id = Number(new URLSearchParams(location.search).get("id"));
    if (!id) {
      target.innerHTML = '<div class="panel text-danger">لم يتم تحديد الحديث.</div>';
      return;
    }
    runAction(async () => {
      const rows = await rpc("app_get_hadith_context", { p_hadith_id: id });
      renderHadithCards(target, rows, { showTakhreej: true });
    });
  }

  // -------------------- EXPORT --------------------
  function bindExportButtons() {
    document.querySelectorAll("[data-export]").forEach((button) => {
      button.addEventListener("click", () => {
        if (!state.lastRows.length) {
          setStatus("لا توجد بيانات للتصدير.", true);
          return;
        }
        if (button.dataset.export === "excel") exportExcel();
        if (button.dataset.export === "word") exportWord();
        if (button.dataset.export === "pdf") exportPdf();
      });
    });
  }

  function exportExcel() {
    const rows = state.lastRows.map((row) => mapExportRow(row));
    const sheet = XLSX.utils.json_to_sheet(rows);
    sheet["!dir"] = "rtl";
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "النتائج");
    XLSX.writeFile(book, "hadith-results.xlsx");
  }

  function exportWord() {
    const html = exportHtml();
    downloadBlob("hadith-results.doc", html, "application/msword;charset=utf-8");
  }

  function exportPdf() {
    const win = window.open("", "_blank");
    win.document.write(exportHtml());
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  }

  function exportHtml() {
    const rows = state.lastRows.map((row) => mapExportRow(row));
    const keys = Object.keys(rows[0] || {});
    const head = keys.map((key) => `<th>${escapeHtml(key)}</th>`).join("");
    const body = rows.map((row) => `<tr>${keys.map((key) => `<td>${escapeHtml(row[key] || "")}</td>`).join("")}</tr>`).join("");
    return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تصدير النتائج</title><style>body{direction:rtl;font-family:'Noto Naskh Arabic','Amiri',serif;line-height:1.8}table{width:100%;border-collapse:collapse}td,th{border:1px solid #bbb;padding:6px;text-align:right;vertical-align:top}th{background:#f1f1ee}</style></head><body><h1>تصدير النتائج</h1><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></body></html>`;
  }

  function mapExportRow(row) {
    const mapped = {};
    (state.lastColumns.length ? state.lastColumns : Object.keys(row))
      .filter((key) => key !== "hadith_type" && getVisibleColumns([key]).includes(key))
      .forEach((key) => {
      const value = String(row[key] ?? "");
      mapped[labels[key] || key] = key === "hadith_number" ? toArabicDigits(value) : value;
      });
    return mapped;
  }

  function downloadBlob(filename, content, type) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  // -------------------- UTILS --------------------

  function bindReadingSize() {
    const slider = document.querySelector("[data-reading-size]");
    if (!slider) return;
    slider.addEventListener("input", () => {
      document.documentElement.style.setProperty("--reading-size", `${slider.value}px`);
    });
  }

  async function runAction(action) {
    try {
      setStatus("جاري التحميل...");
      await action();
    } catch (error) {
      console.error(error);
      setStatus(error.message || "حدث خطأ غير متوقع.", true);
    }
  }

  function markActiveNav() {
    document.querySelectorAll("[data-nav]").forEach((link) => {
      link.classList.toggle("active", link.dataset.nav === state.page);
    });
  }

  function getSelectedValues(select) {
    if (!select) return [];
    return [...select.selectedOptions].map((option) => option.value).filter(Boolean);
  }

  function copyText(text) {
    navigator.clipboard.writeText(text).then(() => setStatus("تم النسخ."));
  }

  function toArabicDigits(value) {
    return String(value).replace(/[0-9]/g, (digit) => "٠١٢٣٤٥٦٧٨٩"[Number(digit)]);
  }

  function debounce(fn, delay) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[char]));
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, "&#096;");
  }
})();
