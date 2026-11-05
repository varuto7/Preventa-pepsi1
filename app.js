(() => {
  "use strict";

  const STORAGE_PREFIX = "pp_";

  const K = {
    clientes: STORAGE_PREFIX + "clientes_v1",
    productos: STORAGE_PREFIX + "productos_v1",
    stock: STORAGE_PREFIX + "stock_v1",
    relacionClientesProductos: STORAGE_PREFIX + "clientes_productos_v1",
    objetivos: STORAGE_PREFIX + "objetivos_v1",
    configuracion: STORAGE_PREFIX + "configuracion_v1",
    pedidos: STORAGE_PREFIX + "pedidos_v1",
    visitas: STORAGE_PREFIX + "visitas_v1",
    objetivosCampanas: "pp_objetivos_campanas_v1",
    acciones: "pp_acciones_v1"
  };

  function storageRawGet(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.error("Error leyendo localStorage (" + key + "):", e);
      return null;
    }
  }

  function storageRawSet(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (e) {
      console.error("Error escribiendo localStorage (" + key + "):", e);
      alert("No se pudieron guardar los cambios.");
      throw e;
    }
  }

  function read(key) {
    const raw = storageRawGet(key);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function write(key, data) {
    storageRawSet(key, JSON.stringify(data));
    document.dispatchEvent(new CustomEvent("pp-datos-actualizados", { detail: { key } }));
  }

  const uid = () => "id-" + Date.now() + "-" + Math.random().toString(36).slice(2, 9);
  const esc = str => String(str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");

  const PRODUCTOS_INICIALES = [
    { id: "p1", nombre: "Pepsi 33cl Lata", familia: "PepsiCo", porCaja: 24, activo: true },
    { id: "p2", nombre: "Pepsi Zero 33cl Lata", familia: "PepsiCo", porCaja: 24, activo: true },
    { id: "p3", nombre: "Matutano Jamón 45g", familia: "Matutano", porCaja: 20, activo: true },
    { id: "p4", nombre: "Matutano Regular 45g", familia: "Matutano", porCaja: 20, activo: true },
    { id: "p5", nombre: "Cervezas Victoria 33cl", familia: "Cervezas Victoria", porCaja: 24, activo: true },
    { id: "p6", nombre: "Fini Boogey 100g", familia: "Fini", porCaja: 12, activo: true }
  ];

  const CONFIG_INICIAL = {
    fechaReferenciaQ1: "2026-01-05",
    plazoEntregaHoras: 48
  };

  if (!storageRawGet(K.productos)) storageRawSet(K.productos, JSON.stringify(PRODUCTOS_INICIALES));
  if (!storageRawGet(K.clientes)) storageRawSet(K.clientes, JSON.stringify([]));
  if (!storageRawGet(K.stock)) storageRawSet(K.stock, JSON.stringify({}));
  if (!storageRawGet(K.relacionClientesProductos)) storageRawSet(K.relacionClientesProductos, JSON.stringify([]));
  if (!storageRawGet(K.objetivos)) storageRawSet(K.objetivos, JSON.stringify([]));
  if (!storageRawGet(K.configuracion)) storageRawSet(K.configuracion, JSON.stringify(CONFIG_INICIAL));

  function clientes() { return read(K.clientes); }
  function productos() { return read(K.productos); }
  function getConfig() {
    try {
      return JSON.parse(storageRawGet(K.configuracion)) || CONFIG_INICIAL;
    } catch(e) { return CONFIG_INICIAL; }
  }

  function guardarCliente({ id, nombre, codigo, direccion, contacto, diaRuta, frecuencia, categoria, cerradoHasta, notasCierre }) {
    const lista = clientes();
    const limpioNombre = String(nombre || "").trim();
    if (!limpioNombre) { alert("El nombre es obligatorio."); return false; }

    const datosCliente = {
      nombre: limpioNombre,
      codigo: String(codigo || "").trim(),
      direccion: String(direccion || "").trim(),
      contacto: String(contacto || "").trim(),
      diaRuta: diaRuta || "Lunes",
      frecuencia: frecuencia || "Semanal",
      categoria: categoria || "B",
      cerradoHasta: cerradoHasta || "",
      notasCierre: String(notasCierre || "").trim()
    };

    if (id) {
      const c = lista.find(x => x.id === id);
      if (!c) return false;
      Object.assign(c, datosCliente);
    } else {
      lista.push({ id: uid(), ...datosCliente });
    }
    write(K.clientes, lista);
    return true;
  }

  function eliminarCliente(id) {
    write(K.clientes, clientes().filter(c => c.id !== id));
    const stockData = JSON.parse(storageRawGet(K.stock) || "{}");
    delete stockData[id];
    storageRawSet(K.stock, JSON.stringify(stockData));
  }

  function guardarProducto({ id, nombre, familia, porCaja }) {
    const lista = productos();
    const limpioNombre = String(nombre || "").trim();
    if (!limpioNombre) { alert("El nombre del producto es obligatorio."); return false; }
    const numCaja = Number(porCaja) > 0 ? Number(porCaja) : 1;

    if (id) {
      const p = lista.find(x => x.id === id);
      if (!p) return false;
      p.nombre = limpioNombre;
      p.familia = String(familia || "General").trim();
      p.porCaja = numCaja;
    } else {
      lista.push({ id: uid(), nombre: limpioNombre, familia: String(familia || "General").trim(), porCaja: numCaja, activo: true });
    }
    write(K.productos, lista);
    return true;
  }

  function stockGet(clienteId, productoId) {
    try {
      const s = JSON.parse(storageRawGet(K.stock) || "{}");
      return Number(s[clienteId]?.[productoId]) || 0;
    } catch (e) { return 0; }
  }

  function stockSet(clienteId, productoId, unidades) {
    try {
      const s = JSON.parse(storageRawGet(K.stock) || "{}");
      if (!s[clienteId]) s[clienteId] = {};
      s[clienteId][productoId] = Math.max(0, Number(unidades) || 0);
      storageRawSet(K.stock, JSON.stringify(s));
      return true;
    } catch (e) { return false; }
  }

  function initNavigation() {
    const botones = document.querySelectorAll("nav button[data-view]");
    botones.forEach(btn => {
      btn.onclick = () => {
        botones.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        const vista = btn.dataset.view;
        document.querySelectorAll("main .view").forEach(v => v.classList.add("hidden"));
        const target = document.getElementById("vista-" + vista);
        if (target) target.classList.remove("hidden");
      };
    });
  }

  function renderClientesUI() {
    const zona = document.getElementById("clientes-app");
    if (!zona) return;
    const lista = clientes();
    const hoyStr = new Date().toISOString().slice(0, 10);

    zona.innerHTML = `
      <form id="form-cliente">
        <input type="hidden" name="id" value="">
        <div class="grid">
          <div>
            <label>Código Cliente / Ref</label>
            <input type="text" name="codigo" placeholder="Ej. CLI-1042">
          </div>
          <div>
            <label>Nombre del establecimiento *</label>
            <input type="text" name="nombre" required placeholder="Ej. Bar El Paso">
          </div>
        </div>

        <div class="grid">
          <div>
            <label>Dirección</label>
            <input type="text" name="direccion" placeholder="Ej. Calle Mayor 12">
          </div>
          <div>
            <label>Persona de Contacto / Teléfono</label>
            <input type="text" name="contacto" placeholder="Ej. Manolo - 600000000">
          </div>
        </div>

        <div class="grid">
          <div>
            <label>Día de ruta habitual</label>
            <select name="diaRuta">
              <option value="Lunes">Lunes</option>
              <option value="Martes">Martes</option>
              <option value="Miércoles">Miércoles</option>
              <option value="Jueves">Jueves</option>
              <option value="Viernes">Viernes</option>
            </select>
          </div>
          <div>
            <label>Frecuencia de visita</label>
            <select name="frecuencia">
              <option value="Semanal">Semanal (Todas las semanas)</option>
              <option value="Q1">Q1 (Quincenal - Ciclo 1)</option>
              <option value="Q2">Q2 (Quincenal - Ciclo 2)</option>
              <option value="M1">M1 (Mensual - Ciclo 1)</option>
              <option value="M2">M2 (Mensual - Ciclo 2)</option>
              <option value="M3">M3 (Mensual - Ciclo 3)</option>
              <option value="M4">M4 (Mensual - Ciclo 4)</option>
            </select>
          </div>
          <div>
            <label>Categoría comercial</label>
            <select name="categoria">
              <option value="A+">Categoría A+ (Top)</option>
              <option value="A">Categoría A (Alto)</option>
              <option value="B" selected>Categoría B (Estándar)</option>
              <option value="C">Categoría C (Ocasional)</option>
            </select>
          </div>
        </div>

        <div style="margin-top: 10px; background: #f8fafc; padding: 10px; border-radius: 8px; border: 1px solid #e2e8f0;">
          <label style="margin-top: 0;">Estado de Cierre Temporal / Vacaciones</label>
          <div class="grid">
            <div>
              <label style="font-weight: normal; font-size: 12px;">Cerrado hasta la fecha (incluida)</label>
              <input type="date" name="cerradoHasta">
            </div>
            <div>
              <label style="font-weight: normal; font-size: 12px;">Notas de cierre</label>
              <input type="text" name="notasCierre" placeholder="Ej. Vacaciones de verano">
            </div>
          </div>
        </div>

        <div class="actions" style="margin-top: 15px;">
          <button type="submit" class="primary">Guardar ficha de cliente</button>
        </div>
      </form>

      <h3 style="margin-top: 25px;">Listado de Clientes (${lista.length})</h3>
      ${lista.length ? lista.map(c => {
        const estaCerrado = c.cerradoHasta && c.cerradoHasta >= hoyStr;
        return `
          <div class="item" style="${estaCerrado ? 'background: #fff8f8; border-left: 4px solid #b42318;' : ''}">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <div>
                <strong>${esc(c.nombre)}</strong> ${c.codigo ? `<span class="pill">${esc(c.codigo)}</span>` : ''}
                ${estaCerrado ? `<span class="pill" style="background:#fee2e2; color:#b42318; font-weight:bold;">Cerrado hasta ${c.cerradoHasta}</span>` : ''}
              </div>
              <span class="pill" style="background: #0056a6; color: white;">Cat: ${esc(c.categoria || "B")}</span>
            </div>

            <p class="muted" style="margin: 6px 0;">
              ${c.direccion ? `📍 ${esc(c.direccion)} · ` : ''} 📞 ${esc(c.contacto || "Sin contacto")}<br>
              Ruta: <strong>${esc(c.diaRuta)}</strong> · Frecuencia: <strong>${esc(c.frecuencia)}</strong>
            </p>

            ${c.notasCierre ? `<p class="muted" style="color: #b42318; font-size: 12px; margin: 2px 0;">Aviso: ${esc(c.notasCierre)}</p>` : ''}

            <div class="actions">
              <button type="button" class="secondary" data-editar="${esc(c.id)}">Editar Ficha</button>
              <button type="button" class="danger" data-eliminar="${esc(c.id)}">Eliminar</button>
            </div>
          </div>
        `;
      }).join("") : '<p class="empty">No hay clientes dados de alta.</p>'}
    `;

    const form = zona.querySelector("#form-cliente");
    form.onsubmit = e => {
      e.preventDefault();
      const fd = new FormData(form);
      if (guardarCliente({
        id: fd.get("id"),
        codigo: fd.get("codigo"),
        nombre: fd.get("nombre"),
        direccion: fd.get("direccion"),
        contacto: fd.get("contacto"),
        diaRuta: fd.get("diaRuta"),
        frecuencia: fd.get("frecuencia"),
        categoria: fd.get("categoria"),
        cerradoHasta: fd.get("cerradoHasta"),
        notasCierre: fd.get("notasCierre")
      })) {
        form.reset();
        form.querySelector('[name="id"]').value = "";
        renderClientesUI();
        document.dispatchEvent(new CustomEvent("pp-actualizar-todo"));
      }
    };

    zona.querySelectorAll("[data-eliminar]").forEach(btn => {
      btn.onclick = () => {
        if (confirm("¿Eliminar cliente? Se borrarán también sus registros asociados.")) {
          eliminarCliente(btn.dataset.eliminar);
          renderClientesUI();
          document.dispatchEvent(new CustomEvent("pp-actualizar-todo"));
        }
      };
    });

    zona.querySelectorAll("[data-editar]").forEach(btn => {
      btn.onclick = () => {
        const c = lista.find(x => x.id === btn.dataset.editar);
        if (!c) return;
        form.querySelector('[name="id"]').value = c.id;
        form.querySelector('[name="codigo"]').value = c.codigo || "";
        form.querySelector('[name="nombre"]').value = c.nombre;
        form.querySelector('[name="direccion"]').value = c.direccion || "";
        form.querySelector('[name="contacto"]').value = c.contacto || "";
        form.querySelector('[name="diaRuta"]').value = c.diaRuta || "Lunes";
        form.querySelector('[name="frecuencia"]').value = c.frecuencia || "Semanal";
        form.querySelector('[name="categoria"]').value = c.categoria || "B";
        form.querySelector('[name="cerradoHasta"]').value = c.cerradoHasta || "";
        form.querySelector('[name="notasCierre"]').value = c.notasCierre || "";
        window.scrollTo({ top: 0, behavior: "smooth" });
      };
    });
  }

  function renderCatalogoUI() {
    const zona = document.getElementById("catalogo-app");
    if (!zona) return;
    const lista = productos();

    zona.innerHTML = `
      <form id="form-producto">
        <input type="hidden" name="id" value="">
        <label>Nombre del producto</label>
        <input type="text" name="nombre" required placeholder="Ej. Pepsi Max 33cl">
        <label>Familia / Marca</label>
        <select name="familia">
          <option value="PepsiCo">PepsiCo</option>
          <option value="Matutano">Matutano</option>
          <option value="Cervezas Victoria">Cervezas Victoria</option>
          <option value="Fini">Fini</option>
          <option value="General">General / Otros</option>
        </select>
        <label>Unidades por caja</label>
        <input type="number" name="porCaja" min="1" value="24" required>
        <div class="actions" style="margin-top: 15px;">
          <button type="submit" class="primary">Guardar producto</button>
        </div>
      </form>

      <h3 style="margin-top: 20px;">Artículos en Catálogo (${lista.length})</h3>
      ${lista.length ? lista.map(p => `
        <div class="item">
          <strong>${esc(p.nombre)}</strong>
          <p class="muted">Familia: <strong>${esc(p.familia || "General")}</strong> · Unidades por caja: ${Number(p.porCaja) || 1}</p>
        </div>
      `).join("") : '<p class="empty">Catálogo vacío.</p>'}
    `;

    const form = zona.querySelector("#form-producto");
    form.onsubmit = e => {
      e.preventDefault();
      const fd = new FormData(form);
      if (guardarProducto({ id: fd.get("id"), nombre: fd.get("nombre"), familia: fd.get("familia"), porCaja: fd.get("porCaja") })) {
        form.reset();
        renderCatalogoUI();
        document.dispatchEvent(new CustomEvent("pp-actualizar-todo"));
      }
    };
  }

  function renderInicio() {
    const r = document.getElementById("resumen");
    if (!r) return;
    const totalClientes = clientes().length;
    const totalPedidos = read(K.pedidos).length;
    const totalVisitas = read(K.visitas).length;

    r.innerHTML = `
      <p>Clientes dados de alta: <strong>${totalClientes}</strong></p>
      <p>Pedidos registrados: <strong>${totalPedidos}</strong></p>
      <p>Visitas realizadas: <strong>${totalVisitas}</strong></p>

      <div style="margin-top: 20px; border-top: 1px solid #e2e8f0; padding-top: 15px;">
        <h4>Copias de Seguridad (Resistencia Offline)</h4>
        <p class="muted" style="font-size: 12px;">Exporta todos los datos guardados en tu dispositivo a un fichero o restáuralos en cualquier momento.</p>
        <div class="actions">
          <button type="button" id="btn-exportar" class="secondary">📥 Exportar Copia de Seguridad</button>
          <label class="secondary" style="display:inline-block; cursor:pointer; margin:0; padding:10px 12px; background:#e8eff8; color:#06477f; border-radius:8px; font-weight:bold; font-size:13px;">
            📤 Importar Copia <input type="file" id="file-importar" accept=".json" style="display:none">
          </label>
        </div>
      </div>
    `;

    // Lógica Exportar
    r.querySelector("#btn-exportar").onclick = () => {
      const backupData = {};
      Object.keys(K).forEach(k => {
        backupData[k] = storageRawGet(K[k]);
      });
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
      const dlAnchor = document.createElement('a');
      dlAnchor.setAttribute("href", dataStr);
      dlAnchor.setAttribute("download", "preventa_pepsi_backup_" + new Date().toISOString().slice(0,10) + ".json");
      document.body.appendChild(dlAnchor);
      dlAnchor.click();
      dlAnchor.remove();
    };

    // Lógica Importar
    r.querySelector("#file-importar").onchange = (e) => {
      const fileReader = new FileReader();
      if (e.target.files[0]) {
        fileReader.readAsText(e.target.files[0], "UTF-8");
        fileReader.onload = event => {
          try {
            const imported = JSON.parse(event.target.result);
            Object.keys(imported).forEach(k => {
              if (imported[k]) storageRawSet(k, imported[k]);
            });
            alert("¡Copia de seguridad restaurada con éxito!");
            renderAll();
            document.dispatchEvent(new CustomEvent("pp-actualizar-todo"));
          } catch(err) {
            alert("Error al procesar el archivo de copia de seguridad.");
          }
        };
      }
    };
  }

  function renderAll() {
    renderInicio();
    renderClientesUI();
    renderCatalogoUI();
  }

  document.addEventListener("DOMContentLoaded", () => {
    initNavigation();
    renderAll();
  });

  window.PP = {
    K, read, write, esc, clientes, productos, getConfig, stockGet, stockSet, renderAll
  };
})();
