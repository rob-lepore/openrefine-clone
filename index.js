class CheckboxListFilter {
  init(params) {
    this.params = params;
    this.eGui = document.createElement("div");
    this.eGui.className = "checkbox-filter-panel";

    // get all unique values for this column across the full dataset
    const values = new Set();
    params.api.forEachNode((node) => {
      const v = node.data[params.colDef.field];
      if (v !== "" && v !== null && v !== undefined) values.add(String(v));
    });
    this.allValues = Array.from(values).sort();
    this.selected = new Set(this.allValues); // default: everything selected (no filtering)

    this.buildUI();
  }

  buildUI() {
    this.eGui.innerHTML = "";

    const searchBox = document.createElement("input");
    searchBox.type = "text";
    searchBox.placeholder = "Search values...";
    searchBox.className = "checkbox-filter-search";
    searchBox.addEventListener("input", () => this.renderList(searchBox.value));
    this.eGui.appendChild(searchBox);

    const actions = document.createElement("div");
    actions.className = "checkbox-filter-actions";
    const selectAllBtn = document.createElement("button");
    selectAllBtn.textContent = "Select all";
    selectAllBtn.addEventListener("click", () => {
      this.selected = new Set(this.allValues);
      this.renderList(searchBox.value);
      this.params.filterChangedCallback();
    });
    const clearBtn = document.createElement("button");
    clearBtn.textContent = "Clear";
    clearBtn.addEventListener("click", () => {
      this.selected.clear();
      this.renderList(searchBox.value);
      this.params.filterChangedCallback();
    });
    actions.appendChild(selectAllBtn);
    actions.appendChild(clearBtn);
    this.eGui.appendChild(actions);

    this.listEl = document.createElement("div");
    this.listEl.className = "checkbox-filter-list";
    this.eGui.appendChild(this.listEl);

    this.renderList("");
  }

  renderList(searchTerm) {
    this.listEl.innerHTML = "";
    const term = searchTerm.toLowerCase();
    this.allValues
      .filter((v) => v.toLowerCase().includes(term))
      .forEach((v) => {
        const row = document.createElement("label");
        row.className = "checkbox-filter-row";

        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = this.selected.has(v);
        cb.addEventListener("change", () => {
          if (cb.checked) this.selected.add(v);
          else this.selected.delete(v);
          this.params.filterChangedCallback();
        });

        const text = document.createElement("span");
        text.textContent = v;

        row.appendChild(cb);
        row.appendChild(text);
        this.listEl.appendChild(row);
      });
  }

  getGui() {
    return this.eGui;
  }

  isFilterActive() {
    return this.selected.size < this.allValues.length;
  }

  doesFilterPass(params) {
    const value = params.data[this.params.colDef.field];
    return this.selected.has(String(value));
  }

  getModel() {
    if (!this.isFilterActive()) return null;
    return { values: Array.from(this.selected) };
  }

  setModel(model) {
    this.selected = model ? new Set(model.values) : new Set(this.allValues);
    this.buildUI();
  }
}

function main() {
  const els = {
    // HEADER
    fileInput: document.getElementById("fileInput"),
    importMenu: document.getElementById("importBtn"),
    importProject: document.getElementById("importProjectBtn"),
    importFilters: document.getElementById("confBtn"),
    confInput: document.getElementById("confInput"),
    exportMenu: document.getElementById("exportBtn"),
    exportProject: document.getElementById("exportProjectBtn"),
    downloadConfBtn: document.getElementById("downloadConfBtn"),
    downloadBtn: document.getElementById("downloadBtn"),
    downloadSelBtn: document.getElementById("downloadSelBtn"),
    // FILE INPUT MODAL
    loadModal: document.getElementById("loadModal"),
    modalLoadBtn: document.getElementById("modalLoadBtn"),
    fileHOM: document.getElementById("fileHOM"),
    fileHET: document.getElementById("fileHET"),
    fileCOMP: document.getElementById("fileCOMP"),
    // TOOLBAR
    // quickFilter: document.getElementById("quickFilter"),
    pageSizeSel: document.getElementById("pageSizeSel"),
    colToggleBtn: document.getElementById("colToggleBtn"),
    colToggleMenu: document.getElementById("colToggleMenu"),
    resetBtn: document.getElementById("resetBtn"),
    status: document.getElementById("status"),
    // GRID
    HOMbtn: document.getElementById("HOMbtn"),
    HETbtn: document.getElementById("HETbtn"),
    COMPbtn: document.getElementById("COMPbtn"),
    gridWrap: document.getElementById("gridWrap"),
  };

  let gridApi = null;
  let rowIdCounter = 0;

  let datasets = {
    active: -1,
    list: [],
    columnState: [],
  };

  // ---------- TSV parsing ----------
  function parseTSV(text) {
    // Normalize line endings, drop trailing empty lines
    const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
    while (lines.length && lines[lines.length - 1] === "") lines.pop();
    if (lines.length === 0) return { headers: [], rows: [] };

    const splitLine = (line) => line.split("\t");
    const headers = splitLine(lines[0]);
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const cells = splitLine(lines[i]);
      const row = { __id: rowIdCounter++ };
      headers.forEach((h, idx) => {
        row[h] = cells[idx] !== undefined ? cells[idx] : "";
      });
      rows.push(row);
    }
    return { headers, rows };
  }

  function tsvEscape(val) {
    if (val === null || val === undefined) return "";
    let s = String(val);
    // TSV has no standard quoting; safest is to strip/replace tabs & newlines
    s = s.replace(/\t/g, " ").replace(/\r?\n/g, " ");
    return s;
  }

  const invalidValues = ["", undefined, null, ".", "NA", "NaN", " "];
  // ---------- Column definitions ----------
  function buildColumnDefs(headers, rows) {
    const isNumericColumn = (field) => {
      const sample = rows
        .slice(0, 50)
        .map((r) => r[field])
        .filter((v) => !invalidValues.includes(v));
      if (sample.length === 0) return false;
      return sample.every(
        (v) => v !== "" && !isNaN(v) && !isNaN(parseFloat(v)),
      );
    };
    const isLinkColumn = (field) => {
      const sample = rows
        .slice(0, 50)
        .map((r) => r[field])
        .filter((v) => !invalidValues.includes(v));
      if (sample.length === 0) return false;
      return sample.every((v) => /^https?:\/\//i.test(String(v)));
    };

    const numericFields = headers.filter(isNumericColumn);

    // coerce values in place, but keep empty strings as empty strings (not 0/NaN)
    rows.forEach((row) => {
      numericFields.forEach((f) => {
        row[f] = parseFloat(row[f]);
        if (isNaN(row[f])) row[f] = "";
      });
    });

    return headers.map((h) => {
      const isNotes = h == "Notes";
      const numeric = !isNotes && isNumericColumn(h);
      const isLink = !isNotes && !numeric && isLinkColumn(h);

      return {
        field: h,
        headerName: h,
        editable: isNotes,
        pinned: isNotes ? "left" : "",
        sortable: true,
        resizable: true,
        lockVisible: isNotes,
        cellDataType: false,
        filter: numeric ? "agNumberColumnFilter" : CheckboxListFilter,
        filterParams: numeric
          ? {
              filterOptions: [
                "equals",
                "notEqual",
                "greaterThan",
                "greaterThanOrEqual",
                "lessThan",
                "lessThanOrEqual",
                "inRange",
                "blank",
                "notBlank",
              ],
              defaultOption: "equals",
              maxNumConditions: 10,
            }
          : {
              undefined,
            },
        floatingFilter: true,
        minWidth: 120,
        cellRenderer: isLink
          ? linkCellRenderer
          : !numeric
            ? textareaCellRenderer
            : undefined,
      };
    });
  }

  // ---------- Grid setup ----------
  function initGrid(headers, rows) {
    const columnDefs = buildColumnDefs(headers, rows);

    const gridOptions = {
      theme: agGrid.themeQuartz.withParams({
        backgroundColor: "#1f2836",
        browserColorScheme: "dark",
        chromeBackgroundColor: {
          ref: "foregroundColor",
          mix: 0.07,
          onto: "backgroundColor",
        },
        foregroundColor: "#FFF",
      }),
      columnDefs,
      rowData: rows,
      getRowId: (params) => String(params.data.__id),
      defaultColDef: {
        editable: false,
        sortable: true,
        resizable: true,
        filter: "agTextColumnFilter",
        floatingFilter: true,
      },
      rowSelection: "multiple",
      rowHeight: 50,
      suppressRowClickSelection: true,
      animateRows: false,
      undoRedoCellEditing: true,
      undoRedoCellEditingLimit: 50,
      pagination: els.pageSizeSel.value != 0,
      paginationPageSize: els.pageSizeSel.value,
      paginationPageSizeSelector: false,
      onSelectionChanged: updateButtonStates,
      onModelUpdated: updateStatus,
      onRowDataUpdated: updateStatus,
      onFilterChanged: () => {
        updateDatasetFilters();
        updateStatus();
      },
      onColumnVisible: updateDatasetsState,
      onColumnMoved: updateDatasetsState,
      onColumnResized: (e) => {
        if (e.finished) updateDatasetsState();
      },
      onColumnPinned: updateDatasetsState,
      onCheckboxChanged: undefined,
    };

    // Add checkbox selection column
    columnDefs[0].checkboxSelection = true;
    columnDefs[0].headerCheckboxSelection = true;

    const eGridDiv = document.getElementById("myGrid");
    eGridDiv.innerHTML = "";
    gridApi = agGrid.createGrid(eGridDiv, gridOptions);

    enableToolbar();
    updateStatus();
  }

  function enableToolbar() {
    [
      els.downloadConfBtn,
      els.resetBtn,
      els.downloadBtn,
      els.pageSizeSel,
      els.colToggleBtn,
      els.importMenu,
      els.exportMenu,
    ].forEach((el) => (el.disabled = false));
  }

  function updateButtonStates() {
    const selected = gridApi ? gridApi.getSelectedRows().length : 0;
    updateStatus();
  }

  function updateStatus() {
    if (!gridApi) {
      els.status.textContent = "No file loaded";
      return;
    }
    let total = 0;
    gridApi.forEachNode(() => total++);
    let displayed = gridApi.getDisplayedRowCount();
    let selected = gridApi.getSelectedRows().length;
    els.status.textContent =
      `${displayed} shown / ${total} total rows` +
      (selected > 0 ? ` — ${selected} selected` : "");
  }

  function updateDatasetFilters() {
    console.log("changing filters, ", gridApi.getFilterModel());
    datasets.list[datasets.active].filterModel = gridApi.getFilterModel();
  }

  function updateDatasetsState() {
    console.log("changing columns, ", datasets);
    datasets.columnState = gridApi.getColumnState();
  }

  function textareaCellRenderer(params) {
    const wrapper = document.createElement("div");
    wrapper.className = "cell-textarea-wrapper";

    const textarea = document.createElement("textarea");
    textarea.readOnly = true;
    textarea.value = params.value ?? "";
    textarea.className = "cell-textarea";
    textarea.rows = 1;

    wrapper.appendChild(textarea);

    requestAnimationFrame(() => {
      textarea.style.height = "auto";
      const naturalHeight = textarea.scrollHeight;
      const maxHeight = wrapper.clientHeight || naturalHeight;
      textarea.style.height = Math.min(naturalHeight, maxHeight) + "px";
    });

    return wrapper;
  }

  function linkCellRenderer(params) {
    if (!params.value || params.value === "NA") return "";
    const url = params.value;
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = url;
    a.style.color = "var(--accent)";
    a.addEventListener("click", (e) => e.stopPropagation()); // prevent row selection toggling on click
    return a;
  }

  // ---------- File loading ----------
  function addDataset(ds, name) {
    ds.headers.unshift("Notes");
    ds.filterModel = {};
    ds.selectedIds = new Set();
    ds.name = name;
    datasets.list.push(ds);
  }
  function switchDataset(which) {
    if (datasets.active === which || which >= datasets.list.length) return;

    if (datasets.active != -1) {
      datasets.list[datasets.active].selectedIds = new Set(
        gridApi.getSelectedRows().map((r) => r.__id),
      );
    }

    datasets.active = which;
    ds = datasets.list[datasets.active];
    console.log(datasets);
    initGrid(ds.headers, ds.rows);
    document.getElementById("folder-filename").textContent = ds.name;

    if (ds.selectedIds && ds.selectedIds.size > 0) {
      gridApi.forEachNode((node) => {
        if (ds.selectedIds.has(node.data.__id)) {
          node.setSelected(true, false); // false = don't clear other selections while looping
        }
      });
    }
    gridApi.applyColumnState({ state: datasets.columnState, applyOrder: true });
    gridApi.setFilterModel(ds.filterModel);
  }

  function loadFile(file) {
    let originalFileName = file.name || "data.tsv";
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target.result;
        const { headers, rows } = parseTSV(text);
        if (headers.length === 0) {
          alert(
            `Could not parse any columns from file ${originalFileName}. Make sure it is tab-separated.`,
          );
          return;
        }
        addDataset({ headers, rows }, originalFileName);
        resolve({ headers, rows });
        // initGrid(headers, rows);
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  els.modalLoadBtn.addEventListener("click", async () => {
    const homFile = els.fileHOM.files[0];
    const hetFile = els.fileHET.files[0];
    const compFile = els.fileCOMP.files[0]; // may be undefined

    if (!homFile || !hetFile) {
      alert("HOM and HET files are required.");
      return;
    }
    datasets = {
      active: -1,
      list: [],
      columnState: [],
    };
    await loadFile(homFile);
    await loadFile(hetFile);
    if (compFile) await loadFile(compFile);
    else els.COMPbtn.classList.add("disabled");

    console.log("File loaded");
    switchDataset(0);

    document.getElementById("load-form").reset();
    els.loadModal.classList.add("hidden");
    document.getElementById("fileTabs").classList.remove("hidden");
  });
  document.querySelectorAll(".dropdown-wrap").forEach((wrap) => {
    const trigger = wrap.querySelector(".dropdown-trigger");
    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = wrap.classList.contains("open");
      // close all dropdowns first
      document
        .querySelectorAll(".dropdown-wrap")
        .forEach((w) => w.classList.remove("open"));
      // then reopen this one if it wasn't already open
      if (!isOpen) wrap.classList.add("open");
    });
  });

  // close any open dropdown when clicking outside
  document.addEventListener("click", () => {
    document
      .querySelectorAll(".dropdown-wrap")
      .forEach((w) => w.classList.remove("open"));
  });

  // prevent clicks inside the menu from closing it via the document listener above
  document.querySelectorAll(".dropdown-menu").forEach((menu) => {
    menu.addEventListener("click", (e) => e.stopPropagation());
  });

  // document.addEventListener("DOMContentLoaded", async () => {
  //   for (let i = 0; i < 2; i++) {
  //     const response = await fetch(`http://localhost:5500/Galaxy${i + 1}.txt`);
  //     const blob = await response.blob();
  //     const file = new File([blob], "data.csv", {
  //       type: blob.type || "text/csv",
  //       lastModified: Date.now(),
  //     });

  //     loadFile(file);
  //   }
  //   initGrid(datasets.list[0].headers, datasets.list[0].rows);
  //   datasets.columnState = gridApi.getColumnState();
  // });

  els.HOMbtn.addEventListener("click", () => {
    switchDataset(0);
  });
  els.HETbtn.addEventListener("click", () => {
    switchDataset(1);
  });
  els.COMPbtn.addEventListener("click", () => {
    if (els.COMPbtn.classList.contains("disabled")) return;
    switchDataset(2);
  });

  // els.fileInput.addEventListener("change", (e) => {
  //   const file = e.target.files[0];
  //   if (file) loadFile(file);
  // });

  els.confInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    try {
      const obj = JSON.parse(await file.text());
      gridApi.setFilterModel(obj.filterModel);
      gridApi.applyColumnState({ state: obj.columnState, applyOrder: true });
      for (ds of datasets.list) {
        ds.filterModel = obj.filterModel;
      }
    } catch (err) {
      console.error("Invalid JSON:", err);
    }
  });

  // ---------- Toolbar actions ----------

  els.resetBtn.addEventListener("click", () => {
    if (!gridApi) return;
    gridApi.setFilterModel(null);
    gridApi.resetColumnState();
    gridApi.setGridOption("quickFilterText", "");
    updateStatus();
    // reset datasets
    updateDatasetsState();
    for (let d of datasets.list) {
      d.filterModel = {};
    }
  });

  // els.quickFilter.addEventListener("input", () => {
  //   if (!gridApi) return;
  //   gridApi.setGridOption("quickFilterText", els.quickFilter.value);
  // });

  // els.onlyVisibleRows.addEventListener("change", () => {
  //   if (els.onlyVisibleRows.checked) els.onlySelectedRows.checked = false;
  // });
  // els.onlySelectedRows.addEventListener("change", () => {
  //   if (els.onlySelectedRows.checked) els.onlyVisibleRows.checked = false;
  // });

  els.pageSizeSel.addEventListener("change", () => {
    if (!gridApi) return;
    const val = parseInt(els.pageSizeSel.value, 10);
    if (val === 0) {
      gridApi.setGridOption("pagination", false);
    } else {
      gridApi.setGridOption("pagination", true);
      gridApi.setGridOption("paginationPageSize", val);
    }
  });

  // ---------- Export (respects current view: order, visibility, sort, filter, edits) ----------

  els.downloadConfBtn.addEventListener("click", () => {
    configs = {
      columnState: [],
      filterModel: gridApi.getFilterModel(),
    };
    const json = JSON.stringify(configs, null, 2); // pretty-printed
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "configs.json";
    a.click();

    URL.revokeObjectURL(url);
  });

  function downloadData(e) {
    const selected = e.srcElement === els.downloadSelBtn;
    console.log("qui", selected)
    if (!gridApi) return;

    const gtypeLabels = { 0: "HOM", 1: "HET", 2: "COMP" };
    const lines = []; // declared OUTSIDE the loop now
    let headerWritten = false;
    const originalDataset = datasets.active; // save so we can restore after export

    for (let i = 0; i < datasets.list.length; i++) {
      switchDataset(i);

      // 1. Determine visible columns in current display order
      const allColumns = gridApi.getAllDisplayedColumns();
      const fields = allColumns
        .map((c) => c.getColDef().field)
        .filter((f) => f && f !== undefined);

      if (fields.length === 0) {
        alert("No visible columns to export.");
        return;
      }

      // write header once, with GTYPE appended
      if (!headerWritten) {
        lines.push([...fields, "GTYPE"].map(tsvEscape).join("\t"));
        headerWritten = true;
      }

      // 2. Collect rows respecting current sort/filter (or selection)
      const rows = [];

      if (selected) {
        gridApi.getSelectedNodes().forEach((node) => rows.push(node.data));
      } else {
        gridApi.forEachNodeAfterFilterAndSort((node) => {
          if (node.data) rows.push(node.data);
        });
      }

      // 3. Build TSV lines for this dataset, with GTYPE value appended
      rows.forEach((r) => {
        const values = fields.map((f) => tsvEscape(r[f]));
        values.push(gtypeLabels[i]);
        lines.push(values.join("\t"));
      });
    }

    switchDataset(originalDataset); // restore whatever the user was looking at

    if (lines.length <= 1) {
      alert("No rows to export with the current settings.");
      return;
    }

    const tsvContent = lines.join("\n");

    // 4. Trigger download
    const blob = new Blob([tsvContent], {
      type: "text/tab-separated-values;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    // const baseName = originalFileName.replace(/\.[^/.]+$/, "");
    const baseName = "data";
    a.href = url;
    a.download = `${baseName}_combined.tsv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  els.downloadBtn.addEventListener("click", downloadData);
  els.downloadSelBtn.addEventListener("click", downloadData);

  els.colToggleBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (els.colToggleMenu.classList.contains("hidden")) {
      buildColumnToggleMenu();
      els.colToggleMenu.classList.remove("hidden");
    } else {
      els.colToggleMenu.classList.add("hidden");
    }
  });

  // close when clicking outside
  document.addEventListener("click", (e) => {
    if (!els.colToggleMenu.contains(e.target) && e.target !== els.colToggleBtn) {
      els.colToggleMenu.classList.add("hidden");
    }
  });

  function buildColumnToggleMenu() {
    if (!gridApi) return;
    const listEl = document.getElementById("colToggleList");
    listEl.innerHTML = "";

    const filterModel = gridApi.getFilterModel(); // { field: {...filterConfig} } for active filters
    const allColumns = gridApi.getAllGridColumns(); // respects current order

    allColumns.forEach((col) => {
      const colDef = col.getColDef();
      if (!colDef.field) return;

      const locked = colDef.lockVisible === true;
      const isVisible = col.isVisible();
      const hasFilter = Object.prototype.hasOwnProperty.call(
        filterModel,
        colDef.field,
      );

      const item = document.createElement("div");
      item.className = "col-toggle-item" + (locked ? " locked" : "");
      item.draggable = true;
      item.dataset.field = colDef.field;

      const handle = document.createElement("span");
      handle.className = "col-drag-handle";
      handle.textContent = "⠿";

      const label = document.createElement("label");

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = isVisible;
      checkbox.disabled = locked;
      checkbox.addEventListener("change", () => {
        gridApi.setColumnsVisible([colDef.field], checkbox.checked);
      });

      const text = document.createElement("span");
      text.textContent = colDef.headerName || colDef.field;
      if (hasFilter) {
        const span = document.createElement("span");
        span.className = "col-filter-icon";
        span.title = "Filter active on this column";
        span.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="-2 -2 24 24"><title xmlns="">${span.title}</title><path fill="currentColor" d="m2.08 2l6.482 8.101A2 2 0 0 1 9 11.351V18l2-1.5v-5.15a2 2 0 0 1 .438-1.249L17.92 2zm0-2h15.84a2 2 0 0 1 1.561 3.25L13 11.35v5.15a2 2 0 0 1-.8 1.6l-2 1.5A2 2 0 0 1 7 18v-6.65L.519 3.25A2 2 0 0 1 2.08 0"/></svg>`;
        // item.appendChild(span);
        text.appendChild(span);
      }

      label.appendChild(checkbox);
      label.appendChild(text);

      item.appendChild(handle);
      item.appendChild(label);

      listEl.appendChild(item);
    });

    wireDragAndDrop(listEl);
  }

  function wireDragAndDrop(listEl) {
    let draggedEl = null;

    listEl.querySelectorAll(".col-toggle-item").forEach((item) => {
      item.addEventListener("dragstart", (e) => {
        draggedEl = item;
        item.classList.add("dragging");
        e.dataTransfer.effectAllowed = "move";
      });

      item.addEventListener("dragend", () => {
        item.classList.remove("dragging");
        listEl
          .querySelectorAll(".col-toggle-item")
          .forEach((el) => el.classList.remove("drag-over"));
        applyColumnOrder(listEl);
      });

      item.addEventListener("dragover", (e) => {
        e.preventDefault();
        if (item === draggedEl) return;
        item.classList.add("drag-over");
      });

      item.addEventListener("dragleave", () => {
        item.classList.remove("drag-over");
      });

      item.addEventListener("drop", (e) => {
        e.preventDefault();
        if (item === draggedEl) return;
        item.classList.remove("drag-over");

        const rect = item.getBoundingClientRect();
        const after = e.clientY - rect.top > rect.height / 2;
        listEl.insertBefore(draggedEl, after ? item.nextSibling : item);
      });
    });
  }

  function applyColumnOrder(listEl) {
    if (!gridApi) return;
    const orderedFields = Array.from(
      listEl.querySelectorAll(".col-toggle-item"),
    ).map((item) => item.dataset.field);

    gridApi.moveColumns(orderedFields, 0); // move all columns into this order, starting at index 0
  }

  function setAllColumns(visible) {
    if (!gridApi) return;
    const allColumns = gridApi.getColumns();
    const fields = allColumns
      .map((col) => col.getColDef())
      .filter((colDef) => colDef.field && colDef.lockVisible !== true) // skip locked columns
      .map((colDef) => colDef.field);

    gridApi.setColumnsVisible(fields, visible);

    // sync checkboxes in the open menu without rebuilding the whole list
    document
      .querySelectorAll("#colToggleList input[type=checkbox]")
      .forEach((cb) => {
        if (!cb.disabled) cb.checked = visible;
      });
  }

  document
    .getElementById("colSelectAll")
    .addEventListener("click", () => setAllColumns(true));
  document
    .getElementById("colDeselectAll")
    .addEventListener("click", () => setAllColumns(false));
}

main();
