let gridApi = null;

const datasets = {
  _activeidx: -1,
  getActive: () => {
    return datasets._list[datasets._activeidx];
  },
  get: (idx) => {
    return datasets._list[idx];
  },
  _list: [],
  columnState: [],
};

function main() {

  document.addEventListener("DOMContentLoaded", async () => {
    UIManager.setup();

    let i;
    for (i = 0; i < 3; i++) {
      const response = await fetch(`input${i + 1}.tsv`);
      if (response.status == 404) {
        break;
      }
      const blob = await response.blob();
      const file = new File([blob], `data${i + 1}.tsv`, {
        type: blob.type || "text/tsv",
        lastModified: Date.now(),
      });

      await DataManager.loadFile(file);
    }
    if (i < 3) UIManager.els.COMPbtn.classList.add("disabled");

    fileNamesRes = await fetch("user_file_names.json");
    fileNames = await fileNamesRes.json();
    for (let k in Object.keys(fileNames)) {
      if (!datasets.get(k)) break;
      datasets.get(k).name = fileNames[k];
    }

    TableManager.switchDataset(0);
    document.getElementById("fileTabs").classList.remove("hidden");
  });

}

main();

class UIManager {

  static els = {
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

  static setup() {
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
    this.els.HOMbtn.addEventListener("click", () => {
      TableManager.switchDataset(0);
    });
    this.els.HETbtn.addEventListener("click", () => {
      TableManager.switchDataset(1);
    });
    this.els.COMPbtn.addEventListener("click", () => {
      if (this.els.COMPbtn.classList.contains("disabled")) return;
      TableManager.switchDataset(2);
    });

    // els.fileInput.addEventListener("change", (e) => {
    //   const file = e.target.files[0];
    //   if (file) loadFile(file);
    // });

    this.els.confInput.addEventListener("change", DataManager.loadFilters);

    this.els.pageSizeSel.addEventListener("change", () => {
      if (!gridApi) return;
      const val = parseInt(els.pageSizeSel.value, 10);
      if (val === 0) {
        gridApi.setGridOption("pagination", false);
      } else {
        gridApi.setGridOption("pagination", true);
        gridApi.setGridOption("paginationPageSize", val);
      }
    });

    this.els.colToggleBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (this.els.colToggleMenu.classList.contains("hidden")) {
        this.buildColumnToggleMenu();
        this.els.colToggleMenu.classList.remove("hidden");
      } else {
        this.els.colToggleMenu.classList.add("hidden");
      }
    });

    // close when clicking outside
    document.addEventListener("click", (e) => {
      if (
        !this.els.colToggleMenu.contains(e.target) &&
        e.target !== this.els.colToggleBtn
      ) {
        this.els.colToggleMenu.classList.add("hidden");
      }
    });

    document
      .getElementById("colSelectAll")
      .addEventListener("click", () => this.setAllColumns(true));
    document
      .getElementById("colDeselectAll")
      .addEventListener("click", () => this.setAllColumns(false));

    this.els.downloadBtn.addEventListener("click", DataManager.downloadData);
    this.els.downloadSelBtn.addEventListener("click", DataManager.downloadData);

    this.els.downloadConfBtn.addEventListener("click", DataManager.downloadFilters);

  }

  static enableToolbar() {
    [
      this.els.downloadConfBtn,
      this.els.downloadBtn,
      this.els.pageSizeSel,
      this.els.colToggleBtn,
      this.els.importMenu,
      this.els.exportMenu,
    ].forEach((el) => (el.disabled = false));
  }

  static buildColumnToggleMenu() {
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

    this.wireDragAndDrop(listEl);
  }

  static wireDragAndDrop(listEl) {
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
        this.applyColumnOrder(listEl);
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

  static applyColumnOrder(listEl) {
    if (!gridApi) return;
    const orderedFields = Array.from(
      listEl.querySelectorAll(".col-toggle-item"),
    ).map((item) => item.dataset.field);

    gridApi.moveColumns(orderedFields, 0); // move all columns into this order, starting at index 0
  }

  static setAllColumns(visible) {
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
}

class DataManager {
  
  static stateURI = {
    0: "hom_state.json",
    1: "het_state.json",
    2: "comp_state.json",
  };

  static downloadFilters() {
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
  }

  /* Apply filter configuration to the specified dataset */
  static async loadFilters(uri, dataset) {
    console.error("wrong call");
    return;
    try {
      const res = await fetch(uri);
      const obj = await res.json();
      console.log(obj);
      // const obj = JSON.parse(await file.text());
      // gridApi.setFilterModel(obj.filterModel);
      // gridApi.applyColumnState({ state: obj.columnState, applyOrder: true });
      // dataset.filterModel = obj.filterModel;
      return obj;
    } catch (err) {
      console.error("Invalid JSON:", err);
    }
  }

  static loadFile(file) {
    function parseTSV(text) {
      // Normalize line endings, drop trailing empty lines
      const lines = text
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .split("\n");
      while (lines.length && lines[lines.length - 1] === "") lines.pop();
      if (lines.length === 0) return { headers: [], rows: [] };

      const splitLine = (line) => line.split("\t");
      const headers = splitLine(lines[0]);
      const rows = [];
      let rowIdCounter = 0;
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
        TableManager.addDataset({ headers, rows }, "");
        resolve({ headers, rows });
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  static async downloadData(e) {
    function tsvEscape(val) {
      if (val === null || val === undefined) return "";
      let s = String(val);
      // TSV has no standard quoting; safest is to strip/replace tabs & newlines
      s = s.replace(/\t/g, " ").replace(/\r?\n/g, " ");
      return s;
    }

    const selected = e.srcElement === UIManager.els.downloadSelBtn;
    if (!gridApi) return;

    const gtypeLabels = { 0: "HOM", 1: "HET", 2: "COMP" };
    const lines = []; // declared OUTSIDE the loop now
    let headerWritten = false;
    const originalDataset = datasets._activeidx; // save so we can restore after export

    for (let i = 0; i < datasets._list.length; i++) {
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

    try {
      const response = await fetch("output.tsv", {
        method: "PUT",
        body: tsvContent,
      });

      if (!response.ok) {
        console.log(response);
        throw new Error(
          `Errore HTTP: ${response.status} ${response.statusText}`,
        );
      }

      alert("File salvato con successo!");
    } catch (error) {
      alert(`Errore durante il salvataggio: ${error.message}`);
    }
  }

  static async saveState(whichDataset, state) {
    console.log("saving state for ds ", whichDataset);

    const notes = {};
    datasets.getActive().rows.forEach((r) => {
      if (r["Notes"]) notes[r.__id] = r["Notes"];
    });
    const obj = {
      state: state,
      notes: notes,
    };

    await fetch(this.stateURI[whichDataset], {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(obj),
    });
  }

  static async getState(whichDataset) {
    console.log("getting state for ds ", whichDataset);
    try {
      const res = await fetch(this.stateURI[whichDataset]);
      const state = await res.json();
      return state;
    } catch (err) {
      console.error("Invalid JSON:", err);
    }
  }
}

class TableManager {
  static initGrid(headers, rows, state) {
    console.log("Initializing", { headers, rows, state });
    const { scroll, ...stateToRestore } = state;

    const columnDefs = this.buildColumnDefs(headers, rows);

    const gridOptions = {
      initialState: stateToRestore,
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
      animateRows: true,
      undoRedoCellEditing: true,
      undoRedoCellEditingLimit: 50,
      pagination: UIManager.els.pageSizeSel.value != 0,
      paginationPageSize: UIManager.els.pageSizeSel.value,
      paginationPageSizeSelector: false,
      onSelectionChanged: this.updateDatasetsState,
      onModelUpdated: this.updateDatasetsState,
      onRowDataUpdated: this.updateDatasetsState,
      onFilterChanged: this.updateDatasetsState,
      onColumnVisible: this.updateDatasetsState,
      onColumnMoved: this.updateDatasetsState,
      onColumnResized: (e) => {
        if (e.finished) this.updateDatasetsState();
      },
      onColumnPinned: this.updateDatasetsState,
      onCellValueChanged: (e) => {
        const rowID = e.data["__id"];
        datasets.getActive().rows[rowID]["Notes"] = e.newValue;
        this.updateDatasetsState();
      },
    };

    // Add checkbox selection column
    columnDefs[0].checkboxSelection = true;
    columnDefs[0].headerCheckboxSelection = true;

    const eGridDiv = document.getElementById("myGrid");
    eGridDiv.innerHTML = "";
    gridApi = agGrid.createGrid(eGridDiv, gridOptions);

    UIManager.enableToolbar();
    this.updateStatus();
  }

  static buildColumnDefs(headers, rows) {
    const invalidValues = ["", undefined, null, ".", "NA", "NaN", " "];
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
        filter: numeric ? "agNumberColumnFilter" : this.CheckboxListFilter,
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
        floatingFilterComponent: numeric ? "" : this.CheckboxListFloatingFilter,
        minWidth: 120,
        cellRenderer: isLink
          ? this.cellRenderers.linkCellRenderer
          : !numeric
            ? this.cellRenderers.textAreaCellRenderer
            : undefined,
      };
    });
  }

  static addDataset(ds, name) {
    ds.headers.unshift("Notes");
    ds.filterModel = {};
    ds.selectedIds = new Set();
    ds.name = name;
    datasets._list.push(ds);
  }

  static async switchDataset(which) {
    if (datasets._activeidx === which || which >= datasets._list.length) return;

    if (datasets._activeidx != -1) {
      datasets.getActive().selectedIds = new Set(
        gridApi.getSelectedRows().map((r) => r.__id),
      );
    }

    datasets._activeidx = which;
    let ds = datasets.getActive();
    let savedState = await DataManager.getState(which);

    for (const k of Object.keys(savedState.notes)) {
      ds.rows[k].Notes = savedState.notes[k];
    }
    console.log({ savedState });
    this.initGrid(ds.headers, ds.rows, savedState.state);
    document.getElementById("folder-filename").textContent = ds.name;

    if (ds.selectedIds && ds.selectedIds.size > 0) {
      gridApi.forEachNode((node) => {
        if (ds.selectedIds.has(node.data.__id)) {
          node.setSelected(true, false); // false = don't clear other selections while looping
        }
      });
    }
    gridApi.applyColumnState({ state: datasets.columnState, applyOrder: true });
  }

  static updateStatus() {
    if (!gridApi) {
      UIManager.els.status.textContent = "No file loaded";
      return;
    }
    let total = 0;
    gridApi.forEachNode(() => total++);
    let displayed = gridApi.getDisplayedRowCount();
    let selected = gridApi.getSelectedRows().length;
    UIManager.els.status.textContent =
      `${displayed} shown / ${total} total rows` +
      (selected > 0 ? ` — ${selected} selected` : "");
  }

  static updateDatasetsState() {
    datasets.columnState = gridApi.getColumnState();
    datasets.getActive().filterModel = gridApi.getFilterModel();
    TableManager.updateStatus();
    DataManager.saveState(datasets._activeidx, gridApi.getState());
  }

  static cellRenderers = {
    textAreaCellRenderer: (params) => {
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
    },

    linkCellRenderer: (params) => {
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
    },
  };

  static CheckboxListFilter = class {
    init(params) {
      this.params = params;
      this.excluded = new Set(); // unico stato reale del filtro
      this.allValues = [];
      this.eGui = document.createElement("div");
      this.eGui.className = "checkbox-filter-panel";
    }

    computeValues() {
      const field = this.params.colDef.field;
      const values = new Set();
      this.params.api.forEachNode((n) => values.add(String(n.data[field])));
      this.allValues = Array.from(values).sort();
    }

    afterGuiAttached() {
      this.computeValues(); // dati aggiornati (anche le note modificate)
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
        this.excluded.clear();
        this.renderList(searchBox.value);
        this.params.filterChangedCallback();
      });
      const clearBtn = document.createElement("button");
      clearBtn.textContent = "Clear";
      clearBtn.addEventListener("click", () => {
        this.allValues.forEach((v) => this.excluded.add(v));
        this.renderList(searchBox.value);
        this.params.filterChangedCallback();
      });
      actions.append(selectAllBtn, clearBtn);
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
          cb.checked = !this.excluded.has(v);
          cb.addEventListener("change", () => {
            if (cb.checked) this.excluded.delete(v);
            else this.excluded.add(v);
            this.params.filterChangedCallback();
          });

          const text = document.createElement("span");
          text.textContent = v;
          row.append(cb, text);
          this.listEl.appendChild(row);
        });
    }

    getGui() {
      return this.eGui;
    }

    isFilterActive() {
      return this.excluded.size > 0;
    }

    doesFilterPass(p) {
      return !this.excluded.has(String(p.data[this.params.colDef.field]));
    }

    getModel() {
      return this.excluded.size ? { excluded: Array.from(this.excluded) } : null;
    }

    setModel(model) {
      this.excluded = new Set(model?.excluded ?? []);
      if (this.listEl) this.renderList(""); // solo se la UI esiste già
    }
  }

  static CheckboxListFloatingFilter = class {
    init(params) {
      this.eGui = document.createElement("div");
      this.eGui.style.cssText = "margin:auto 0;opacity:.8";
    }
    getGui() {
      return this.eGui;
    }
    onParentModelChanged(model) {
      this.eGui.textContent = model ? `${model.excluded.length} excluded` : "";
    }
  }
}


