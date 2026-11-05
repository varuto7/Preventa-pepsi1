(() => {
  "use strict";
  const P = window.PP;
  if (!P) return;

  const K = {
    pedidos: "pp_pedidos_v1",
    visitas: "pp_visitas_v1",
    objetivosCampanas: "pp_objetivos_campanas_v1",
    recuentosHistorial: "pp_recuentos_historial_v1",
    acciones: "pp_acciones_v1",
    oportunidades: "pp_oportunidades_v1"
  };

  const read = key => P.read(key);
  const write = (key, val) => P.write(key, val);
  const uid = () => "id-" + Date.now() + "-" + Math.random().toString(36).slice(2, 9);
  const today = () => new Date().toISOString().slice(0, 10);

  function pedidosPendientes(clienteId) {
    return read(K.pedidos).filter(p => p.clienteId === clienteId && !p.recepcionAplicada);
  }

  function getUltimoRecuento(clienteId, productoId) {
    const historiales = read(K.recuentosHistorial);
    const recuentoCliente = historiales.find(h => h.clienteId === clienteId);
    if (!recuentoCliente || !recuentoCliente.items) return 0;
    return Number(recuentoCliente.items[productoId]) || 0;
  }

  function getUltimoPedidoClienteProducto(clienteId, productoId) {
    const pedidos = read(K.pedidos);
    const pedCliente = pedidos.find(p => p.clienteId === clienteId);
    if (!pedCliente) return 0;
    
    let totalUdsPedido = 0;
    const prods = P.productos();
    pedCliente.lineas.forEach(l => {
      if (l.productoId === productoId) {
        const prod = prods.find(x => x.id === productoId);
        const porCaja = prod ? Number(prod.porCaja) || 1 : 1;
        totalUdsPedido += (Number(l.cajas) || 0) * porCaja + (Number(l.sueltas) || 0);
      }
    });
    return totalUdsPedido;
  }

  function renderProductosStock() {
    const zona = document.getElementById("productos-app");
    if (!zona) return;
    const listaClientes = P.clientes();

    zona.innerHTML = `
      <label>Selecciona un cliente para ver su stock físico</label>
      <select id="sel-cliente-stock">
        <option value="">Selecciona cliente</option>
        ${listaClientes.map(c => `<option value="${c.id}">${P.esc(c.nombre)} [Cat: ${c.categoria || "B"}]</option>`).join("")}
      </select>
      <div id="detalle-stock-cliente" style="margin-top: 15px;"></div>
    `;

    const sel = zona.querySelector("#sel-cliente-stock");
    sel.onchange = () => {
      const cid = sel.value;
      const det = document.getElementById("detalle-stock-cliente");
      if (!cid) { det.innerHTML = ""; return; }
      const prods = P.productos();

      det.innerHTML = prods.map(p => `
        <div class="item">
          <strong>${P.esc(p.nombre)}</strong>
          <p class="muted">Familia: ${P.esc(p.familia)} · Stock en estantería: <strong>${P.stockGet(cid, p.id)} uds</strong></p>
        </div>
      `).join("");
    };
  }

  function renderPedidos() {
    const contenedor = document.getElementById("pedidos-app");
    if (!contenedor) return;
    const listaClientes = P.clientes();
    const pedidos = read(K.pedidos);

    contenedor.innerHTML = `
      <form id="form-pedido">
        <label>Cliente</label>
        <select name="cliente" required>
          <option value="">Selecciona cliente</option>
          ${listaClientes.map(c => `<option value="${c.id}">${P.esc(c.nombre)} [Cat: ${c.categoria || "B"}]</option>`).join("")}
        </select>
        <label>Fecha</label>
        <input type="date" name="fecha" value="${today()}" required>
        
        <div id="productos-pedido" style="margin-top: 15px;"><p class="muted">Selecciona un cliente para ver el catálogo y las recomendaciones.</p></div>
        
        <button type="submit" class="primary" style="margin-top: 15px;">Guardar pedido</button>
      </form>

      <h3 style="margin-top: 25px;">Pedidos registrados (${pedidos.length})</h3>
      ${pedidos.map(p => {
        const cli = listaClientes.find(c => c.id === p.clienteId);
        return `
          <div class="item">
            <strong>${P.esc(cli ? cli.nombre : "Cliente")}</strong>
            <p class="muted">Fecha: ${p.fecha} · Estado: <strong>${p.estado || "Pendiente"}</strong></p>
            <ul>
              ${p.lineas.map(l => `<li>${l.cajas} cjs, ${l.sueltas} sueltas</li>`).join("")}
            </ul>
          </div>
        `;
      }).join("")}
    `;

    const sel = contenedor.querySelector('[name="cliente"]');
    sel.onchange = () => {
      const cid = sel.value;
      const zonaProds = document.getElementById("productos-pedido");
      if (!cid) { zonaProds.innerHTML = '<p class="muted">Selecciona un cliente.</p>'; return; }
      const prods = P.productos();

      zonaProds.innerHTML = `
        <h4 style="margin: 10px 0 5px 0;">Preparación de Pedido y Recomendaciones</h4>
        <p class="muted" style="font-size: 12px; margin-bottom: 12px;">Sugerencia orientativa basada en stock y consumo. Introduce la cantidad final deseada.</p>
        
        ${prods.map(p => {
          const ultimoRec = getUltimoRecuento(cid, p.id);
          const porCaja = Number(p.porCaja) || 1;
          let sugeridoCajas = ultimoRec < porCaja ? 1 : 0;

          return `
            <div class="item" style="background: #fafafa; margin-bottom: 8px;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <strong>${P.esc(p.nombre)}</strong>
                <span class="pill" style="background: #e8eff8; color: #06477f; font-size: 11px;">Sugerido: ${sugeridoCajas} cjs</span>
              </div>
              <p class="muted" style="font-size: 12px; margin: 3px 0;">Último recuento: ${ultimoRec} uds · Formato: ${porCaja} uds/caja</p>
              
              <div style="display: flex; gap: 10px; margin-top: 6px;">
                <div style="flex:1">
                  <label style="font-size: 11px; margin:0;">Cajas a pedir</label>
                  <input type="number" min="0" value="0" data-cajas="${p.id}" style="padding: 6px;">
                </div>
                <div style="flex:1">
                  <label style="font-size: 11px; margin:0;">Sueltas a pedir</label>
                  <input type="number" min="0" value="0" data-sueltas="${p.id}" style="padding: 6px;">
                </div>
              </div>
            </div>
          `;
        }).join("")}
      `;
    };

    const form = contenedor.querySelector("#form-pedido");
    form.onsubmit = e => {
      e.preventDefault();
      const fd = new FormData(form);
      const clienteId = fd.get("cliente");
      const fecha = fd.get("fecha");
      const zonaProds = document.getElementById("productos-pedido");

      const lineas = P.productos().map(p => ({
        productoId: p.id,
        cajas: Number(zonaProds.querySelector(`[data-cajas="${p.id}"]`)?.value) || 0,
        sueltas: Number(zonaProds.querySelector(`[data-sueltas="${p.id}"]`)?.value) || 0
      })).filter(l => l.cajas > 0 || l.sueltas > 0);

      if (!lineas.length) { alert("Añade al menos un producto al pedido."); return; }

      const actual = read(K.pedidos);
      actual.unshift({
        id: uid(),
        clienteId,
        fecha,
        lineas,
        estado: "Pendiente de recepción (48h)",
        recepcionAplicada: false
      });
      write(K.pedidos, actual);
      renderPedidos();
      alert("¡Pedido guardado con éxito!");
    };
  }

  function renderRutas() {
    const contenedor = document.getElementById("rutas-app");
    if (!contenedor) return;
    const listaClientes = P.clientes();
    const visitasRegistradas = read(K.visitas);
    const hoyStr = today();

    contenedor.innerHTML = `
      <div class="panel" style="background: #f8fafc; padding: 12px; border-radius: 8px; margin-bottom: 15px;">
        <h3>Gestión de Visitas, Ruta y Acciones</h3>
        <p class="muted">Buscador rápido y selección de cliente para visitas y control de acciones.</p>
        
        <input type="text" id="buscador-clientes-ruta" placeholder="🔍 Buscar cliente por nombre, código..." style="margin-bottom: 10px;">
        
        <label>Seleccionar cliente de la cartera</label>
        <select id="sel-cliente-ruta">
          <option value="">Selecciona cliente</option>
          ${listaClientes.map(c => {
            const cerrado = c.cerradoHasta && c.cerradoHasta >= hoyStr;
            return `<option value="${c.id}">${P.esc(c.nombre)} [Cat: ${c.categoria || "B"}] (${c.diaRuta || "Lunes"}) ${cerrado ? ' — [CERRADO]' : ''}</option>`;
          }).join("")}
        </select>
      </div>

      <div id="detalle-ruta-cliente"></div>

      <h3 style="margin-top: 25px;">Historial de Visitas (${visitasRegistradas.length})</h3>
      ${visitasRegistradas.length ? visitasRegistradas.map(v => {
        const cli = listaClientes.find(c => c.id === v.clienteId);
        return `
          <div class="item">
            <strong>${P.esc(cli ? cli.nombre : "Cliente")}</strong>
            <p class="muted" style="margin: 4px 0;">Fecha: ${v.fecha} · Resultado: <strong>${v.resultado}</strong></p>
            ${v.observaciones ? `<p style="margin: 4px 0; font-size: 13px;">Obs: ${P.esc(v.observaciones)}</p>` : ''}
          </div>
        `;
      }).join("") : '<p class="empty">No hay visitas registradas todavía.</p>'}
    `;

    // Filtro buscador en tiempo real
    const inputBuscador = contenedor.querySelector("#buscador-clientes-ruta");
    const sel = contenedor.querySelector("#sel-cliente-ruta");
    
    inputBuscador.oninput = () => {
      const query = inputBuscador.value.toLowerCase();
      const filtrados = listaClientes.filter(c => 
        c.nombre.toLowerCase().includes(query) || (c.codigo && c.codigo.toLowerCase().includes(query))
      );
      sel.innerHTML = `<option value="">Selecciona cliente (${filtrados.length} encontrados)</option>` +
        filtrados.map(c => `<option value="${c.id}">${P.esc(c.nombre)} [Cat: ${c.categoria || "B"}] (${c.diaRuta || "Lunes"})</option>`).join("");
    };

    sel.onchange = () => {
      const cid = sel.value;
      const det = document.getElementById("detalle-ruta-cliente");
      if (!cid) { det.innerHTML = ""; return; }
      
      const cli = listaClientes.find(c => c.id === cid);
      const accionesCli = read(K.acciones).filter(a => a.clienteId === cid && !a.completada);
      const estaCerrado = cli.cerradoHasta && cli.cerradoHasta >= hoyStr;
      const prods = P.productos();

      det.innerHTML = `
        <div class="panel" style="border-left: 4px solid #0056a6;">
          <h4>${P.esc(cli.nombre)} ${cli.codigo ? `<span class="pill">${P.esc(cli.codigo)}</span>` : ''}</h4>
          <p class="muted">📍 ${P.esc(cli.direccion || "Sin dirección")} · 📞 ${P.esc(cli.contacto || "Sin contacto")}</p>
          <p class="muted">Ruta: <strong>${P.esc(cli.diaRuta)}</strong> · Frecuencia: <strong>${P.esc(cli.frecuencia)}</strong> · Cat: <strong>${cli.categoria || "B"}</strong></p>
          
          ${estaCerrado ? `<div class="notice" style="background:#fee2e2; border-color:#f87171; color:#b42318; margin-bottom:10px;">⚠️ Establecimiento cerrado hasta el <strong>${cli.cerradoHasta}</strong>.</div>` : ''}

          <!-- ACCIONES PENDIENTES -->
          <div style="margin: 15px 0; background: #fffbeb; border: 1px solid #fef3c7; padding: 10px; border-radius: 8px;">
            <h5 style="margin: 0 0 8px 0; color: #b45309;">⚠️ Acciones y Recordatorios Pendientes (${accionesCli.length})</h5>
            ${accionesCli.length ? accionesCli.map(ac => `
              <div style="display: flex; justify-content: space-between; align-items: center; background: #fff; padding: 6px; border-radius: 6px; margin-bottom: 5px; border: 1px solid #fde68a;">
                <div>
                  <span style="font-size: 13px;">${P.esc(ac.descripcion)}</span>
                  <div class="muted" style="font-size: 11px;">Prioridad: ${ac.prioridad} · Límite: ${ac.fechaLimite || "Sin fecha"}</div>
                </div>
                <button type="button" class="primary" data-completar-accion="${ac.id}" style="padding: 4px 8px; font-size: 11px;">Completar</button>
              </div>
            `).join("") : '<p class="muted" style="font-size: 12px; margin:0;">No hay acciones pendientes.</p>'}

            <form id="form-nueva-accion" style="margin-top: 10px; display: flex; gap: 5px;">
              <input type="text" name="descAccion" placeholder="Nueva tarea para este cliente..." required style="flex:1; padding: 6px; font-size: 12px;">
              <button type="submit" class="secondary" style="padding: 6px 10px; font-size: 12px;">Añadir</button>
            </form>
          </div>

          <h5 style="margin: 15px 0 8px 0;">Registrar Visita y Recuento de Stock</h5>
          <form id="form-resultado-visita">
            <input type="hidden" name="clienteId" value="${cid}">
            
            <label>Resultado de la visita</label>
            <select name="resultado" id="select-resultado" required>
              <option value="Visitado">Visitado (Atendido con recuento)</option>
              <option value="Cerrado puntual">Cerrado puntual (Solo este día)</option>
              <option value="Cerrado temporal">Cerrado temporal (Vacaciones / Temporada)</option>
              <option value="No visitado">No visitado (Incidencia / Falta de tiempo)</option>
              <option value="Visita aplazada">Visita aplazada (Acordado volver otro día)</option>
            </select>

            <div id="contenedor-dinamico-visita" style="margin-top: 10px;"></div>

            <div id="seccion-recuento" style="margin-top: 15px; border-top: 1px solid #e2e8f0; padding-top: 10px;">
              <h5 style="margin: 5px 0;">Recuento Físico y Análisis de Ventas (48h)</h5>
              
              ${prods.map(p => {
                const ultimoRec = getUltimoRecuento(cid, p.id);
                const ultimoPed = getUltimoPedidoClienteProducto(cid, p.id);
                const stockEsperado = ultimoRec + ultimoPed;
                const actualStockApp = P.stockGet(cid, p.id);

                return `
                  <div class="item" style="background: #fafafa; margin-bottom: 8px;">
                    <strong>${P.esc(p.nombre)}</strong>
                    <div style="display: flex; gap: 15px; font-size: 13px; margin: 4px 0;" class="muted">
                      <span>Último: <strong>${ultimoRec}</strong></span>
                      <span>+ Pedido: <strong>${ultimoPed}</strong></span>
                      <span>= Esperado: <strong>${stockEsperado}</strong></span>
                    </div>
                    <div style="display: flex; gap: 10px; align-items: center; margin-top: 6px;">
                      <div style="flex: 1;">
                        <input type="number" min="0" value="${actualStockApp}" data-recuento-prod="${p.id}" style="padding: 6px;" placeholder="Recuento real...">
                      </div>
                    </div>
                  </div>
                `;
              }).join("")}
            </div>

            <label style="margin-top: 15px;">Observaciones / Motivo</label>
            <textarea name="observaciones" placeholder="Escribe aquí cualquier incidencia..."></textarea>

            <button type="submit" class="primary" style="margin-top: 15px;">Guardar visita y actualizar stock</button>
          </form>
        </div>
      `;

      det.querySelector("#form-nueva-accion").onsubmit = e => {
        e.preventDefault();
        const desc = det.querySelector('[name="descAccion"]').value.trim();
        if (!desc) return;
        const listaAcciones = read(K.acciones);
        listaAcciones.push({ id: uid(), clienteId: cid, descripcion: desc, prioridad: "Normal", fechaLimite: today(), completada: false });
        write(K.acciones, listaAcciones);
        sel.onchange();
      };

      det.querySelectorAll("[data-completar-accion]").forEach(btn => {
        btn.onclick = () => {
          const aid = btn.dataset.completarAccion;
          const listaAcciones = read(K.acciones);
          const ac = listaAcciones.find(x => x.id === aid);
          if (ac) { ac.completada = true; write(K.acciones, listaAcciones); sel.onchange(); }
        };
      });

      const selRes = det.querySelector("#select-resultado");
      const contDinamico = det.querySelector("#contenedor-dinamico-visita");
      const seccionRecuento = det.querySelector("#seccion-recuento");

      selRes.onchange = () => {
        const val = selRes.value;
        if (val === "Cerrado temporal") {
          contDinamico.innerHTML = `<label>Cerrado hasta la fecha:</label><input type="date" name="fechaReapertura" value="${today()}" required><label>Motivo</label><input type="text" name="motivoCierre" placeholder="Vacaciones">`;
          seccionRecuento.style.display = "none";
        } else if (val === "Visita aplazada") {
          contDinamico.innerHTML = `<label>Nueva fecha:</label><input type="date" name="nuevaFechaAplazamiento" value="${today()}" required>`;
          seccionRecuento.style.display = "block";
        } else if (val === "Visitado") {
          contDinamico.innerHTML = "";
          seccionRecuento.style.display = "block";
        } else {
          contDinamico.innerHTML = "";
          seccionRecuento.style.display = "none";
        }
      };

      det.querySelector("#form-resultado-visita").onsubmit = e => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const resultado = fd.get("resultado");
        const observaciones = fd.get("observaciones");

        const historiales = read(K.recuentosHistorial);
        let recCliente = historiales.find(h => h.clienteId === cid);
        if (!recCliente) { recCliente = { clienteId: cid, items: {} }; historiales.push(recCliente); }

        if (resultado === "Visitado" || resultado === "Visita aplazada") {
          prods.forEach(p => {
            const inputProd = det.querySelector(`[data-recuento-prod="${p.id}"]`);
            if (inputProd) {
              const val = Number(inputProd.value) || 0;
              recCliente.items[p.id] = val;
              P.stockSet(cid, p.id, val);
            }
          });
          write(K.recuentosHistorial, historiales);
        }

        const nuevaVisita = { id: uid(), clienteId: cid, fecha: today(), resultado, observaciones };
        if (resultado === "Cerrado temporal") {
          const target = listaClientes.find(x => x.id === cid);
          if (target) { target.cerradoHasta = fd.get("fechaReapertura"); target.notasCierre = fd.get("motivoCierre"); P.write(P.K.clientes, listaClientes); }
        }

        const actualVisitas = read(K.visitas);
        actualVisitas.unshift(nuevaVisita);
        write(K.visitas, actualVisitas);
        alert("¡Visita registrada correctamente!");
        renderRutas();
      };
    };
  }

  function renderObjetivos() {
    const contenedor = document.getElementById("objetivos-app");
    if (!contenedor) return;
    
    const listaClientes = P.clientes();
    const listaProductos = P.productos();
    const campanas = read(K.objetivosCampanas);
    const pedidos = read(P.K.pedidos || "pp_pedidos_v1");

    contenedor.innerHTML = `
      <section class="panel" style="background: #fafafa; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
        <h3>Crear Nuevo Objetivo / Campaña de Empresa</h3>
        <form id="form-campana">
          <label>Nombre de la Campaña / Objetivo</label>
          <input type="text" name="nombre" required placeholder="Ej. Campaña Introducción Q3">

          <label>Producto a impulsar</label>
          <select name="productoId" required>
            <option value="">Selecciona producto</option>
            ${listaProductos.map(p => `<option value="${p.id}">${P.esc(p.nombre)} — [${P.esc(p.familia)}]</option>`).join("")}
          </select>

          <label>Categorías de clientes aplica:</label>
          <div style="display: flex; gap: 15px; margin: 5px 0 10px 0; background: #fff; padding: 10px; border: 1px solid #cbd5e1; border-radius: 8px;">
            <label style="font-weight: normal; margin:0;"><input type="checkbox" name="cats" value="A+" checked> A+</label>
            <label style="font-weight: normal; margin:0;"><input type="checkbox" name="cats" value="A" checked> A</label>
            <label style="font-weight: normal; margin:0;"><input type="checkbox" name="cats" value="B"> B</label>
            <label style="font-weight: normal; margin:0;"><input type="checkbox" name="cats" value="C"> C</label>
          </div>

          <label>Meta exigida (%)</label>
          <input type="number" name="metaPorcentaje" min="1" max="100" value="90" required>

          <button type="submit" class="primary" style="margin-top: 10px;">Crear Objetivo</button>
        </form>
      </section>

      <h3>Campañas Activas y Oportunidades Comerciales</h3>
      ${campanas.length ? campanas.map(camp => {
        const prod = listaProductos.find(p => p.id === camp.productoId);
        const catsAlcanzadas = camp.categoriasPermitidas || [];
        const clientesObjetivo = listaClientes.filter(c => catsAlcanzadas.includes(c.categoria || "B"));
        const totalClientesObj = clientesObjetivo.length;
        let clientesCumplen = 0;

        clientesObjetivo.forEach(cli => {
          let haComprado = false;
          pedidos.forEach(ped => {
            if (ped.clienteId === cli.id) {
              ped.lineas.forEach(l => {
                if (l.productoId === camp.productoId && ((Number(l.cajas) || 0) > 0 || (Number(l.sueltas) || 0) > 0)) haComprado = true;
              });
            }
          });
          if (haComprado) clientesCumplen++;
        });

        const porcentajeActual = totalClientesObj > 0 ? Math.round((clientesCumplen / totalClientesObj) * 100) : 0;
        const metaExigida = Number(camp.metaPorcentaje) || 90;
        const cumplido = porcentajeActual >= metaExigida;

        return `
          <div class="item" style="background: #fff; margin-bottom: 15px; border-left: 5px solid ${cumplido ? '#2e7d32' : '#0056a6'};">
            <strong>${P.esc(camp.nombre)}</strong>
            <p class="muted" style="margin: 4px 0;">Producto: <strong>${P.esc(prod ? prod.nombre : "Producto")}</strong> · Meta: <strong>${metaExigida}%</strong></p>
            <p style="margin: 6px 0;">Progreso: <strong>${clientesCumplen} de ${totalClientesObj} clientes (${porcentajeActual}%)</strong> ${cumplido ? ' <span class="pill" style="background:#e8f5e9; color:#2e7d32;">¡Superado!</span>' : ''}</p>
            
            <div style="background: #e0e0e0; border-radius: 4px; height: 10px; width: 100%; overflow: hidden; margin-bottom: 8px;">
              <div style="background: ${cumplido ? '#2e7d32' : '#0056a6'}; height: 100%; width: ${Math.min(100, porcentajeActual)}%;"></div>
            </div>

            <button type="button" class="danger" data-borrar-camp="${camp.id}" style="padding: 5px 10px; font-size: 12px;">Eliminar campaña</button>
          </div>
        `;
      }).join("") : '<p class="muted">No hay objetivos de empresa creados.</p>'}
    `;

    const formCampana = contenedor.querySelector("#form-campana");
    formCampana.onsubmit = e => {
      e.preventDefault();
      const fd = new FormData(formCampana);
      const cats = [];
      formCampana.querySelectorAll('input[name="cats"]:checked').forEach(cb => cats.push(cb.value));
      if (!cats.length) { alert("Selecciona al menos una categoría."); return; }

      const actual = read(K.objetivosCampanas);
      actual.unshift({
        id: uid(),
        nombre: fd.get("nombre"),
        tipoObjetivo: fd.get("tipoObjetivo"),
        productoId: fd.get("productoId"),
        categoriasPermitidas: cats,
        metaPorcentaje: Number(fd.get("metaPorcentaje")) || 90
      });
      write(K.objetivosCampanas, actual);
      renderObjetivos();
      alert("¡Campaña creada con éxito!");
    };

    contenedor.querySelectorAll("[data-borrar-camp]").forEach(btn => {
      btn.onclick = () => {
        write(K.objetivosCampanas, read(K.objetivosCampanas).filter(c => c.id !== btn.dataset.borrarCamp));
        renderObjetivos();
      };
    });
  }

  function renderAll() {
    renderProductosStock();
    renderPedidos();
    renderRutas();
    renderObjetivos();
  }

  document.addEventListener("DOMContentLoaded", renderAll);
  document.addEventListener("pp-actualizar-todo", renderAll);
})();
