(function () {
  const state = {
    client: null,
    filters: null,
    selectedRawis: [],
    lastRows: [],
    lastColumns: [],
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
    takhreej: "التخريج"
  };

  const typeLabels = {
    main: "أصل",
    sub: "تابع",
    part: "جزء",
    h_main: "حاشية أصل",
    h_part: "حاشية جزء"
  };

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    markActiveNav();
    bindExportButtons();
    bindReadingSize();
    await initSupabase();
    await loadFilterTree();
    initFilters();

    if (state.page === "search") bindSearchPage();
    if (state.page === "index") bindIndexPage();
    if (state.page === "narrators") bindNarratorsPage();
    if (state.page === "musnad") bindMusnadPage();
    if (state.page === "browse") bindBrowsePage();
    if (state.page === "hadith") bindHadithPage();
  }

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

  async function loadFilterTree() {
    state.filters = await rpc("app_get_filter_tree");
  }

  function initFilters(scope) {
    const root = scope || document;
    root.querySelectorAll("[data-filter-volume]").forEach((select) => fillSelect(select, state.filters.volumes, "كل المجلدات"));
    updateDependentFilters(root);
    root.querySelectorAll("[data-filter-volume]").forEach((select) => select.addEventListener("change", () => updateDependentFilters(root)));
    root.querySelectorAll("[data-filter-book]").forEach((select) => select.addEventListener("change", () => updateChapterFilter(root)));
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

  function setStatus(message, isError) {
    const el = document.querySelector("[data-status]");
    if (!el) return;
    el.textContent = message || "";
    el.classList.toggle("error", Boolean(isError));
  }

  function setRows(rows, columns) {
    state.lastRows = rows || [];
    state.lastColumns = columns || [];
  }

  function renderTable(target, rows, columns) {
    setRows(rows, columns);
    if (!rows.length) {
      target.innerHTML = '<div class="panel text-center text-muted">لا توجد نتائج.</div>';
      return;
    }
    const head = columns.map((column) => `<th>${labels[column] || column}</th>`).join("");
    const body = rows.map((row) => {
      const cells = columns.map((column) => {
        const value = formatCell(column, row[column], row);
        return `<td data-label="${labels[column] || column}">${value}</td>`;
      }).join("");
      return `<tr>${cells}</tr>`;
    }).join("");
    target.innerHTML = `<div class="table-responsive"><table class="table results-table align-middle"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
    target.querySelectorAll("[data-hadith-link]").forEach((link) => {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        location.href = `/hadith.html?id=${link.dataset.hadithLink}`;
      });
    });
  }

  function formatCell(column, value, row) {
    if (value === null || value === undefined || value === "") return '<span class="text-muted">-</span>';
    if (column === "hadith_id") return `<a href="/hadith.html?id=${value}" data-hadith-link="${value}">${value}</a>`;
    if (column === "hadith_type") return `<span class="badge badge-type">${typeLabels[value] || value}</span>`;
    if (column === "hadith_text") return escapeHtml(value).slice(0, 240) + (value.length > 240 ? "..." : "");
    if (column === "hadith_beginning") return `<a href="/hadith.html?id=${row.hadith_id}" data-hadith-link="${row.hadith_id}">${escapeHtml(value)}</a>`;
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
          <span>رقم: ${escapeHtml(row.hadith_number || "-")}</span>
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
          p_limit: 100,
          p_offset: 0
        });
        renderTable(results, rows, ["hadith_id", "hadith_number", "hadith_type", "hadith_text", "narrators", "volume_name", "book_name", "chapter_name"]);
        setStatus(`عدد النتائج المعروضة: ${rows.length}`);
      });
    });
  }

  function bindIndexPage() {
    const form = document.querySelector("[data-index-form]");
    const results = document.querySelector("[data-results]");
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      await runAction(async () => {
        const rows = await rpc("app_get_hadith_index", { ...filterParams(form), p_limit: 300, p_offset: 0 });
        renderTable(results, rows, ["hadith_id", "hadith_number", "hadith_beginning", "hadith_type", "volume_name", "book_name", "chapter_name"]);
        setStatus(`عدد النتائج المعروضة: ${rows.length}`);
      });
    });
    form.requestSubmit();
  }

  function bindNarratorsPage() {
    const form = document.querySelector("[data-rawi-form]");
    const rawiInput = form.querySelector("[name=rawi_query]");
    const suggestions = document.querySelector("[data-rawi-suggestions]");
    const chips = document.querySelector("[data-rawi-chips]");
    const results = document.querySelector("[data-results]");

    rawiInput.addEventListener("input", debounce(async () => {
      const rows = await rpc("app_search_rawis", { p_query: rawiInput.value, p_limit: 20 });
      suggestions.innerHTML = rows.map((row) => `<option value="${escapeAttr(row.rawi_name)}" data-id="${row.rawi_id}">${escapeAttr(row.matched_alias || row.rawi_name)}"></option>`).join("");
    }, 250));

    form.querySelector("[data-add-rawi]").addEventListener("click", async () => {
      const rows = await rpc("app_search_rawis", { p_query: rawiInput.value, p_limit: 1 });
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
          p_limit: 300,
          p_offset: 0
        });
        renderTable(results, rows, ["rawi_name", "hadith_id", "hadith_number", "hadith_type", "hadith_text", "volume_name", "book_name", "chapter_name"]);
        setStatus(`عدد النتائج المعروضة: ${rows.length}`);
      });
    });
  }

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

  function bindBrowsePage() {
    const volumeSelect = document.querySelector("[data-browse-volume]");
    const tree = document.querySelector("[data-tree]");
    const content = document.querySelector("[data-content]");
    fillSelect(volumeSelect, state.filters.volumes, "اختر المجلد");
    volumeSelect.addEventListener("change", () => renderBrowseTree(tree, Number(volumeSelect.value), content));
  }

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

  async function loadBrowseContent(content, volumeId, bookId, chapterId) {
    await runAction(async () => {
      const showTakhreej = document.querySelector("[name=show_takhreej]").checked;
      const rows = await rpc("app_browse_content", {
        p_volume_id: volumeId || null,
        p_book_id: bookId ? Number(bookId) : null,
        p_chapter_id: chapterId ? Number(chapterId) : null,
        p_limit: 300,
        p_offset: 0
      });
      renderHadithCards(content, rows, { showTakhreej });
      setStatus(`عدد النصوص المعروضة: ${rows.length}`);
    });
  }

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
    (state.lastColumns.length ? state.lastColumns : Object.keys(row)).forEach((key) => {
      mapped[labels[key] || key] = String(row[key] ?? "");
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
