"use strict";
const VERSION = "1.3.0"; // Mantener igual a CACHE en sw.js
const COLORES = ["rojo", "naranja", "amarillo", "verde", "azul", "violeta", "negro", "gris", "blanco"];
const SEVS = Parser.SEVS;
const ESTADOS = ["Realizada", "A confirmar"];
const DISCIPLINAS = Parser.DISCIPLINAS;
const GCOL = ["#0f8a82", "#c0463a", "#3b78c2", "#c7861c", "#7a5bb5", "#4a9a62", "#b5507e", "#6f7f35"];

let S = nuevoEstado();
let vista = "notas", filtroEstado = "activa", filtroColor = "";
let abierta = null, notaNueva = false;
let calMes = primeroDeMes(new Date()), calDia = "";
let persistente = false, ocultoDesde = 0, iniciada = false;

function nuevoEstado() {
  return { notas: [], fichas: [], ajustes: { orden: "modificada", vista: "lista", veterinario: "Miguel", ultimoRespaldo: 0, ultimaImportacion: 0 } };
}

/* ---------------- utilidades ---------------- */
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const uid = (p = "n") => p + "-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const isoLocal = (d) => { d = new Date(d); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
const hoy = () => isoLocal(Date.now());
const fmtFecha = (iso) => iso ? iso.split("-").reverse().join("/") : "—";
const fmtCorta = (ms) => new Date(ms).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" });
const fmtLarga = (ms) => new Date(ms).toLocaleString("es-AR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const norm = Parser.norm;
const clave = (r) => [r.fecha, norm(r.establecimiento), norm(r.caballo)].join("|");
const clavePac = (r) => norm(r.establecimiento) + "|" + norm(r.caballo);
const sevClass = (s) => "sev-" + (s === "Sin hallazgos" ? "Sin" : s || "Sin");
const sevLabel = (s) => s === "Confirmar" ? "Confirmar gravedad" : (s || "—");
function primeroDeMes(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function toast(msg, ms = 2800) {
  const t = $("#toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("show"), ms);
}
function opts(list, sel, label = (x) => x) {
  return list.map((o) => `<option value="${esc(o)}"${o === sel ? " selected" : ""}>${esc(label(o))}</option>`).join("");
}

/* ---------------- guardado ---------------- */
let tGuardar = null;
function guardar() {
  clearTimeout(tGuardar);
  tGuardar = setTimeout(() => Store.guardar(S).catch((e) => toast("No se pudo guardar: " + e.message)), 300);
}
function guardarYa() { clearTimeout(tGuardar); return Store.guardar(S).catch(() => {}); }

/* ---------------- inicio y bloqueo ---------------- */
async function iniciar() {
  registrarSW();
  if (history.state) history.replaceState(null, ""); // al recargar no hay editor ni dialogo abierto
  let r;
  try { r = await Store.cargar(); }
  catch (e) { document.body.innerHTML = `<p style="padding:20px">Este navegador no permite guardar datos (${esc(e.message)}). Abrí la app desde Chrome o Safari, no en modo incógnito.</p>`; return; }
  if (r.bloqueado) { mostrarLock(); return; }
  arrancar(r.estado);
}
function arrancar(estado) {
  if (estado) S = normalizar(estado);
  else { S = nuevoEstado(); S.notas = notasDeBienvenida(); guardar(); }
  $("#lock").hidden = true;
  $("#app").hidden = false;
  if (!iniciada) {
    iniciada = true;
    Store.persistente().then((p) => { persistente = p; renderMas(); });
    let v = "preguntar";
    try { v = sessionStorage.getItem("cuaderno-vista") || "preguntar"; } catch (e) {}
    ir(v);
  } else ir(vista);
}
function normalizar(e) {
  const base = nuevoEstado();
  const out = { notas: Array.isArray(e.notas) ? e.notas : [], fichas: Array.isArray(e.fichas) ? e.fichas : [], ajustes: { ...base.ajustes, ...(e.ajustes || {}) } };
  out.notas.forEach((n) => {
    n.tipo = n.tipo === "lista" ? "lista" : "texto";
    n.items = Array.isArray(n.items) ? n.items : [];
    if (!COLORES.includes(n.color)) n.color = "amarillo";
    n.estado = ["activa", "archivada", "papelera"].includes(n.estado) ? n.estado : "activa";
    n.creada = +n.creada || Date.now(); n.modificada = +n.modificada || n.creada;
    n.disciplina = DISCIPLINAS.includes(n.disciplina) ? n.disciplina : "";
  });
  out.fichas.forEach((f) => { if (f) { f.disciplina = DISCIPLINAS.includes(f.disciplina) ? f.disciplina : ""; f.cliente = String(f.cliente || ""); } });
  return out;
}
function mostrarLock() {
  $("#app").hidden = true;
  $("#lock").hidden = false;
  $("#lock-err").hidden = true;
  $("#lock-pin").value = "";
  setTimeout(() => $("#lock-pin").focus(), 50);
}
$("#lock-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector("button"); btn.disabled = true;
  try { arrancar(await Store.desbloquear($("#lock-pin").value)); }
  catch (err) { $("#lock-err").hidden = false; $("#lock-pin").select(); }
  btn.disabled = false;
});
async function bloquearAhora() {
  await guardarYa();
  if (!Store.tienePin()) return;
  cerrarEditor(true);
  $$("dialog[open]").forEach((d) => cerrarDialogo(d));
  Store.bloquear();
  S = nuevoEstado();
  mostrarLock();
}
document.addEventListener("visibilitychange", () => {
  if (document.hidden) { guardarYa(); ocultoDesde = Date.now(); }
  else if (Store.tienePin() && ocultoDesde && Date.now() - ocultoDesde > 60000) bloquearAhora();
});
window.addEventListener("pagehide", () => { guardarYa(); });

function notasDeBienvenida() {
  const t = Date.now();
  return [
    { id: uid(), tipo: "texto", color: "amarillo", fijada: true, estado: "activa", creada: t, modificada: t, fecha: "", items: [],
      titulo: "Bienvenido al Cuaderno",
      texto: "Funciona como ColorNote: notas de colores, listas, calendario, archivo y papelera.\n\nTodo queda guardado en este teléfono y funciona sin internet.\n\nNovedades:\n• Las notas de visitas se pueden pasar a fichas de pacientes (menú ⋮ de la nota).\n• En «Pacientes» ves la historia de cada caballo por establecimiento.\n• En «Preguntar» podés escribir o dictar: «¿cuántos caballos de polo atendí en junio?» o «¿cuándo atendí a Lucero?».\n• En «Más» podés traer tus notas de ColorNote, poner un PIN y guardar respaldos.\n\nPodés borrar esta nota cuando quieras." },
    { id: uid(), tipo: "texto", color: "verde", fijada: false, estado: "activa", creada: t - 1000, modificada: t - 1000, fecha: "", items: [], ejemplo: true,
      titulo: "Ejemplo de visita (inventado)",
      texto: "3 Marzo 2026\n\"Haras El Ejemplo\"\n• Tormenta\nPuntas severas\nLesiones en carrillos\n• Lucero\nDientes de lobo\nRampas leves\n• Pampa\nCorrecta oclusión\nControl en próxima visita" },
  ];
}

/* ---------------- navegacion ---------------- */
const TITULOS = { notas: "Notas", preguntar: "Preguntar", calendario: "Calendario", pacientes: "Pacientes", panel: "Panel", mas: "Más" };
function ir(v) {
  if (!TITULOS[v]) v = "preguntar";
  vista = v;
  $$(".vista").forEach((s) => (s.hidden = s.id !== "v-" + v));
  $$("nav.bottom button").forEach((b) => { if (b.dataset.v === v) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); });
  $("#fab").hidden = !["notas", "calendario"].includes(v) || (v === "notas" && filtroEstado !== "activa");
  try { sessionStorage.setItem("cuaderno-vista", v); } catch (e) {}
  renderVista();
  window.scrollTo(0, 0);
}
function renderVista() {
  let titulo = TITULOS[vista];
  if (vista === "notas" && filtroEstado === "archivada") titulo = "Archivo";
  if (vista === "notas" && filtroEstado === "papelera") titulo = "Papelera";
  $("#titulo-vista").textContent = titulo;
  renderTopActions();
  renderBannerRespaldo();
  ({ notas: renderNotas, preguntar: renderPreguntar, calendario: renderCal, pacientes: renderPacientes, panel: renderPanel, mas: renderMas })[vista]();
}
function renderTopActions() {
  const acc = [];
  if (vista === "notas" && filtroEstado === "papelera" && S.notas.some((n) => n.estado === "papelera")) acc.push(`<button class="btn danger" id="btn-vaciar">Vaciar</button>`);
  if (Store.tienePin()) acc.push(`<button class="icon-btn" id="btn-lock" aria-label="Bloquear" title="Bloquear">🔒</button>`);
  $("#top-actions").innerHTML = acc.join("");
}
$("#top-actions").addEventListener("click", (e) => {
  if (e.target.closest("#btn-lock")) bloquearAhora();
  if (e.target.closest("#btn-vaciar")) {
    const n = S.notas.filter((x) => x.estado === "papelera").length;
    if (!confirm(`Se van a borrar para siempre ${n} nota(s) de la papelera.`)) return;
    S.notas = S.notas.filter((x) => x.estado !== "papelera");
    guardar(); renderVista(); toast("Papelera vacía.");
  }
});
$$("nav.bottom button").forEach((b) => (b.onclick = () => { if (b.dataset.v === "notas") filtroEstado = "activa"; ir(b.dataset.v); }));

/* Boton "atras" de Android: cierra dialogos y el editor en vez de salir de la app */
function empujarHistoria(estado) { history.pushState(estado, ""); }
// Los "atras" que dispara la propia app (al cerrar algo con un boton) no deben cerrar nada mas
let popsPropios = 0;
function volverHistoria() { popsPropios++; history.back(); }
window.addEventListener("popstate", () => {
  if (popsPropios > 0) { popsPropios--; return; }
  const abiertos = $$("dialog[open]");
  if (abiertos.length) { const d = abiertos[abiertos.length - 1]; d._hist = false; d.close(); return; }
  if (!$("#editor").hidden) cerrarEditor(true);
});
function abrirDialogo(d) {
  d.showModal();
  empujarHistoria({ dlg: d.id });
  d._hist = true;
}
/* Cerrar siempre por aca: el evento "close" puede demorarse, y la historia tiene que quedar al dia */
function cerrarDialogo(d, encadenar = false) {
  if (d.open) d.close();
  trasCerrar(d, encadenar);
}
function trasCerrar(d, encadenar = false) {
  if (!d._hist) return;
  d._hist = false;
  // "encadenar": el dialogo abre otra pantalla que reemplaza su lugar en la historia
  if (encadenar) return;
  if (history.state && history.state.dlg === d.id) volverHistoria();
}
$$("dialog").forEach((d) => {
  d.addEventListener("close", () => trasCerrar(d)); // Esc en computadora
  d.addEventListener("click", (e) => { if (e.target.closest("[data-cerrar]")) cerrarDialogo(d); });
});

/* ---------------- notas ---------------- */
function textoBusqueda(n) { return norm([n.titulo, n.texto, n.items.map((i) => i.t).join(" ")].join(" ")); }
function tituloNota(n) {
  if (n.titulo.trim()) return n.titulo.trim();
  const primera = (n.tipo === "lista" ? (n.items[0] || {}).t : n.texto.split("\n").find((l) => l.trim())) || "";
  return primera.trim() || "Sin título";
}
function vistaPrevia(n) {
  if (n.tipo === "lista") {
    const hechos = n.items.filter((i) => i.ok).length;
    return n.items.slice(0, 4).map((i) => (i.ok ? "☑ " : "☐ ") + i.t).join("\n") + (n.items.length ? `\n${hechos}/${n.items.length} hechos` : "");
  }
  const lineas = n.texto.split("\n").filter((l) => l.trim());
  if (!n.titulo.trim()) lineas.shift();
  return lineas.slice(0, 6).join("\n");
}
function tarjetaNota(n) {
  return `<button class="nota c-${n.color}" data-id="${esc(n.id)}">
    <span class="t">${n.fijada && n.estado === "activa" ? "📌" : ""}${n.tipo === "lista" ? "☑" : ""}<span>${esc(tituloNota(n))}</span></span>
    <span class="p">${esc(vistaPrevia(n))}</span>
    <span class="m">${esc(fmtCorta(n.modificada))}</span></button>`;
}
function notasFiltradas() {
  const q = norm($("#q").value);
  const orden = S.ajustes.orden;
  const cmp = {
    modificada: (a, b) => b.modificada - a.modificada,
    creada: (a, b) => b.creada - a.creada,
    titulo: (a, b) => tituloNota(a).localeCompare(tituloNota(b), "es"),
    color: (a, b) => COLORES.indexOf(a.color) - COLORES.indexOf(b.color) || b.modificada - a.modificada,
  }[orden] || ((a, b) => b.modificada - a.modificada);
  return S.notas
    .filter((n) => n.estado === filtroEstado && (!filtroColor || n.color === filtroColor) && (!q || textoBusqueda(n).includes(q)))
    .sort((a, b) => (filtroEstado === "activa" ? (b.fijada ? 1 : 0) - (a.fijada ? 1 : 0) : 0) || cmp(a, b));
}
function renderNotas() {
  $("#filtro-color").innerHTML = `<button class="sw todos" data-c="" aria-pressed="${!filtroColor}" aria-label="Todos los colores"></button>` +
    COLORES.map((c) => `<button class="sw c-${c}" data-c="${c}" aria-pressed="${filtroColor === c}" aria-label="${c}"></button>`).join("");
  $("#orden").value = S.ajustes.orden;
  $("#btn-vista").textContent = S.ajustes.vista === "grilla" ? "☰" : "▦";
  const est = $("#estado-notas");
  est.hidden = filtroEstado === "activa";
  if (!est.hidden) est.innerHTML = `<span>${filtroEstado === "papelera" ? "Las notas de la papelera se pueden restaurar." : "Notas archivadas."}</span><button class="btn" id="btn-volver-notas">Volver a notas</button>`;
  const lista = notasFiltradas();
  const cont = $("#lista-notas");
  cont.className = "notas " + (S.ajustes.vista === "grilla" ? "grilla" : "lista");
  if (!lista.length) {
    const hayFiltro = $("#q").value || filtroColor;
    cont.innerHTML = `<div class="vacio">${hayFiltro ? "Ninguna nota coincide con la búsqueda." : filtroEstado === "activa" ? "No hay notas. Tocá + para crear una." : "No hay nada acá."}</div>`;
    return;
  }
  cont.innerHTML = lista.map(tarjetaNota).join("");
}
$("#q").addEventListener("input", renderNotas);
$("#orden").addEventListener("change", (e) => { S.ajustes.orden = e.target.value; guardar(); renderNotas(); });
$("#btn-vista").onclick = () => { S.ajustes.vista = S.ajustes.vista === "grilla" ? "lista" : "grilla"; guardar(); renderNotas(); };
$("#filtro-color").addEventListener("click", (e) => { const b = e.target.closest("[data-c]"); if (!b) return; filtroColor = b.dataset.c; renderNotas(); });
$("#estado-notas").addEventListener("click", (e) => { if (e.target.closest("#btn-volver-notas")) { filtroEstado = "activa"; ir("notas"); } });
$("#lista-notas").addEventListener("click", (e) => { const b = e.target.closest(".nota"); if (b) abrirNota(b.dataset.id); });

/* ---------------- nueva nota ---------------- */
$("#fab").onclick = () => abrirDialogo($("#dlg-nueva"));
$("#dlg-nueva").addEventListener("click", (e) => {
  const b = e.target.closest("[data-tipo]"); if (!b) return;
  cerrarDialogo($("#dlg-nueva"), true);
  crearNota(b.dataset.tipo);
});
function crearNota(tipo) {
  const t = Date.now();
  const n = { id: uid(), tipo: tipo === "lista" ? "lista" : "texto", titulo: "", texto: "", items: [], color: "amarillo", fecha: vista === "calendario" && calDia ? calDia : "", disciplina: "", fijada: false, estado: "activa", creada: t, modificada: t };
  if (tipo === "visita") {
    const d = new Date();
    const mes = d.toLocaleDateString("es-AR", { month: "long" });
    n.color = "verde";
    n.texto = `${d.getDate()} ${mes.charAt(0).toUpperCase() + mes.slice(1)} ${d.getFullYear()}\n"Establecimiento"\n• `;
  }
  S.notas.unshift(n);
  abrirNota(n.id, true, true);
}

/* ---------------- editor ---------------- */
function abrirNota(id, nueva = false, reemplazarHistoria = false) {
  const n = S.notas.find((x) => x.id === id);
  if (!n) return;
  abierta = n; notaNueva = nueva;
  const ed = $("#editor");
  ed.className = "editor c-" + n.color;
  $("#ed-titulo").value = n.titulo;
  $("#ed-texto").value = n.texto;
  $("#ed-fecha").value = n.fecha || "";
  $("#ed-texto").hidden = n.tipo === "lista";
  $("#ed-lista").hidden = n.tipo !== "lista";
  $("#ed-paleta").hidden = true;
  $("#ed-menu-box").hidden = true;
  $("#ed-fijar").style.opacity = n.fijada ? "1" : ".45";
  $("#ed-fechas").textContent = `Creada ${fmtLarga(n.creada)} · Modificada ${fmtLarga(n.modificada)}`;
  renderItems();
  bannerFichas();
  ed.hidden = false;
  document.body.style.overflow = "hidden";
  if (reemplazarHistoria) history.replaceState({ ed: n.id }, ""); else empujarHistoria({ ed: n.id });
  autoAltura();
  if (nueva) setTimeout(() => (n.tipo === "lista" ? $("#ed-item-in") : n.texto ? $("#ed-texto") : $("#ed-titulo")).focus(), 80);
}
function notaVacia(n) { return !n.titulo.trim() && !n.texto.trim() && !n.items.length; }
function cerrarEditor(desdeHistoria = false) {
  if ($("#editor").hidden) return;
  const n = abierta;
  $("#editor").hidden = true;
  document.body.style.overflow = "";
  abierta = null;
  if (n && notaVacia(n)) S.notas = S.notas.filter((x) => x !== n);
  guardar();
  if (!desdeHistoria && history.state && history.state.ed) volverHistoria();
  renderVista();
}
function tocada() {
  if (!abierta) return;
  abierta.modificada = Date.now();
  $("#ed-fechas").textContent = `Creada ${fmtLarga(abierta.creada)} · Modificada ${fmtLarga(abierta.modificada)}`;
  guardar();
}
function autoAltura() {
  const t = $("#ed-texto");
  t.style.height = "auto";
  t.style.height = Math.max(t.scrollHeight, window.innerHeight * 0.55) + "px";
}
$("#ed-volver").onclick = () => cerrarEditor();
$("#ed-titulo").addEventListener("input", (e) => { abierta.titulo = e.target.value; tocada(); });
$("#ed-texto").addEventListener("input", (e) => { abierta.texto = e.target.value; autoAltura(); tocada(); clearTimeout(bannerFichas._t); bannerFichas._t = setTimeout(bannerFichas, 800); });
$("#ed-fecha").addEventListener("change", (e) => { abierta.fecha = e.target.value; tocada(); });
$("#ed-disc").addEventListener("change", (e) => ponerDisciplina(abierta, e.target.value));
$("#ed-fijar").onclick = () => { abierta.fijada = !abierta.fijada; $("#ed-fijar").style.opacity = abierta.fijada ? "1" : ".45"; guardar(); toast(abierta.fijada ? "Fijada arriba de todo." : "Ya no está fijada."); };
$("#ed-color").onclick = () => {
  const p = $("#ed-paleta");
  p.innerHTML = COLORES.map((c) => `<button class="sw c-${c}" data-c="${c}" aria-pressed="${abierta.color === c}" aria-label="${c}"></button>`).join("");
  p.hidden = !p.hidden; $("#ed-menu-box").hidden = true;
};
$("#ed-paleta").addEventListener("click", (e) => {
  const b = e.target.closest("[data-c]"); if (!b) return;
  abierta.color = b.dataset.c; $("#editor").className = "editor c-" + abierta.color;
  $("#ed-paleta").hidden = true; tocada();
});

/* Disciplina de la nota: la que eligio Miguel o, si no eligio, la que dice el texto ("Polo" en un renglon) */
function discNota(n) { return n.disciplina || Parser.disciplina(n.texto); }
function opcionesDisc(n) {
  const det = Parser.disciplina(n.texto);
  return `<option value="">${det ? "Según el texto: " + det : "Sin definir"}</option>` + opts(DISCIPLINAS, n.disciplina);
}
// No cambia "modificada": completar disciplinas no tiene que reordenar las notas
function ponerDisciplina(n, d) {
  const antes = n.disciplina || "";
  n.disciplina = DISCIPLINAS.includes(d) ? d : "";
  S.fichas.forEach((f) => { if (f.nota_id === n.id && (!f.disciplina || f.disciplina === antes)) f.disciplina = n.disciplina; });
  guardar();
}
function bannerFichas() {
  const b = $("#ed-fichas-banner");
  const n = abierta;
  if (n) { $("#ed-disc").innerHTML = opcionesDisc(n); $("#ed-disc").parentElement.hidden = n.tipo !== "texto"; }
  if (!n || n.tipo !== "texto" || n.estado === "papelera") { b.hidden = true; return; }
  const res = Parser.leer(n.texto, { est: n.titulo, anio: new Date(n.creada).getFullYear() });
  const conFecha = res.fichas.filter((f) => f.fecha).length;
  const ya = S.fichas.filter((f) => f.nota_id === n.id).length;
  if (!res.fichas.length || !conFecha) { b.hidden = true; return; }
  b.hidden = false;
  b.innerHTML = `Encontré ${res.fichas.length} caballo${res.fichas.length === 1 ? "" : "s"} en esta nota${ya ? ` (ya pasaste ${ya} a fichas)` : ""}. <button class="linklike" id="btn-a-fichas">Pasar a fichas</button>`;
}
$("#ed-fichas-banner").addEventListener("click", (e) => { if (e.target.closest("#btn-a-fichas")) abrirFichas(abierta); });

$("#ed-menu").onclick = () => {
  const n = abierta, m = $("#ed-menu-box");
  const it = [];
  if (n.estado === "papelera") {
    it.push(["restaurar", "Restaurar"], ["borrar", "Eliminar para siempre", "danger"]);
  } else {
    if (n.tipo === "texto") it.push(["fichas", "Pasar a fichas de pacientes"]);
    it.push(n.tipo === "texto" ? ["a-lista", "Convertir en lista de tareas"] : ["a-texto", "Convertir en texto"]);
    if (n.tipo === "lista" && n.items.some((i) => i.ok)) it.push(["limpiar", "Quitar ítems tildados"]);
    if (navigator.share) it.push(["compartir", "Compartir"]);
    it.push(n.estado === "archivada" ? ["desarchivar", "Sacar del archivo"] : ["archivar", "Archivar"]);
    it.push(["papelera", "Eliminar", "danger"]);
  }
  m.innerHTML = it.map(([k, t, c]) => `<button data-a="${k}" class="${c || ""}">${esc(t)}</button>`).join("");
  m.hidden = !m.hidden; $("#ed-paleta").hidden = true;
};
$("#ed-menu-box").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-a]"); if (!b) return;
  const n = abierta; $("#ed-menu-box").hidden = true;
  switch (b.dataset.a) {
    case "fichas": abrirFichas(n); break;
    case "a-lista":
      n.items = n.texto.split("\n").map((l) => l.replace(/^[•·\-*]\s*/, "").trim()).filter(Boolean).map((t) => ({ t, ok: false }));
      n.texto = ""; n.tipo = "lista"; tocada(); reabrir(n); break;
    case "a-texto":
      n.texto = n.items.map((i) => (i.ok ? "✓ " : "") + i.t).join("\n"); n.items = []; n.tipo = "texto"; tocada(); reabrir(n); break;
    case "limpiar": n.items = n.items.filter((i) => !i.ok); tocada(); renderItems(); break;
    case "compartir":
      try { await navigator.share({ title: tituloNota(n), text: n.tipo === "lista" ? n.items.map((i) => (i.ok ? "☑ " : "☐ ") + i.t).join("\n") : n.texto }); } catch (err) {}
      break;
    case "archivar": n.estado = "archivada"; tocada(); cerrarEditor(); toast("Nota archivada."); break;
    case "desarchivar": n.estado = "activa"; tocada(); cerrarEditor(); toast("Nota devuelta a Notas."); break;
    case "papelera": n.estado = "papelera"; n.fijada = false; tocada(); cerrarEditor(); toast("Nota enviada a la papelera."); break;
    case "restaurar": n.estado = "activa"; tocada(); cerrarEditor(); toast("Nota restaurada."); break;
    case "borrar":
      if (!confirm("¿Borrar esta nota para siempre?")) return;
      S.notas = S.notas.filter((x) => x !== n); abierta = null; cerrarEditor(); toast("Nota borrada."); break;
  }
});
function reabrir(n) {
  // Cambia el tipo sin agregar otra entrada a la historia
  $("#ed-texto").value = n.texto; $("#ed-texto").hidden = n.tipo === "lista"; $("#ed-lista").hidden = n.tipo !== "lista";
  renderItems(); bannerFichas(); autoAltura();
}

/* lista de tareas */
function renderItems() {
  const n = abierta;
  if (!n || n.tipo !== "lista") { $("#ed-items").innerHTML = ""; return; }
  $("#ed-items").innerHTML = n.items.map((it, i) => `<li class="${it.ok ? "ok" : ""}" data-i="${i}">
    <input type="checkbox" ${it.ok ? "checked" : ""} aria-label="Hecho">
    <input type="text" value="${esc(it.t)}" aria-label="Ítem">
    <button class="icon-btn" data-quitar aria-label="Quitar ítem">✕</button></li>`).join("");
}
$("#ed-items").addEventListener("change", (e) => {
  const li = e.target.closest("li"); if (!li || e.target.type !== "checkbox") return;
  const it = abierta.items[+li.dataset.i]; it.ok = e.target.checked; li.classList.toggle("ok", it.ok); tocada();
});
$("#ed-items").addEventListener("input", (e) => {
  const li = e.target.closest("li"); if (!li || e.target.type !== "text") return;
  abierta.items[+li.dataset.i].t = e.target.value; tocada();
});
$("#ed-items").addEventListener("click", (e) => {
  if (!e.target.closest("[data-quitar]")) return;
  abierta.items.splice(+e.target.closest("li").dataset.i, 1); renderItems(); tocada();
});
$("#ed-nuevo-item").addEventListener("submit", (e) => {
  e.preventDefault();
  const inp = $("#ed-item-in"), t = inp.value.trim();
  if (!t) return;
  abierta.items.push({ t, ok: false }); inp.value = ""; renderItems(); tocada(); inp.focus();
});

/* ---------------- fichas de pacientes ---------------- */
let borrador = [], fichaEditando = null;
function avisos(r, esBorrador) {
  const w = [];
  if (!String(r.caballo).trim()) w.push(["err", "Falta el nombre del caballo."]);
  if (!r.fecha) w.push(["err", "Falta la fecha de la visita."]);
  if (!String(r.establecimiento).trim()) w.push(["err", "Falta el establecimiento."]);
  if (r.severidad === "Confirmar") w.push(["", "¿Qué gravedad general le das? " + (r._motivo || "")]);
  if (esBorrador && S.fichas.some((x) => clave(x) === clave(r))) w.push(["", "Ya existe una ficha con la misma fecha, establecimiento y caballo."]);
  return w;
}
const avisosHTML = (r, b) => avisos(r, b).map(([k, t]) => `<div class="warn ${k}">${esc(t)}</div>`).join("");
function tarjetaFicha(r, i, scope) {
  const pz = Parser.piezas([r.hallazgos, r.oclusion, r.proxima_accion].join(" "));
  const b = scope === "borrador";
  return `<article class="rec ${sevClass(r.severidad)}${r._incluir === false ? " off" : ""}" data-scope="${scope}" data-i="${i}">
  <header>
    ${b ? `<input type="checkbox" data-f="_incluir" ${r._incluir !== false ? "checked" : ""} aria-label="Incluir">` : ""}
    <input class="name" data-f="caballo" value="${esc(r.caballo)}" aria-label="Caballo">
    <span class="pill" data-pill>${esc(sevLabel(r.severidad))}</span>
  </header>
  <div class="warns" data-warns>${avisosHTML(r, b)}</div>
  <div class="grid">
    <label>Fecha<input type="date" data-f="fecha" value="${esc(r.fecha)}"></label>
    <label>Establecimiento<input data-f="establecimiento" list="dl-est" value="${esc(r.establecimiento)}"></label>
    <label class="wide">Hallazgos<textarea data-f="hallazgos">${esc(r.hallazgos)}</textarea></label>
    <label class="wide">Oclusión<input data-f="oclusion" value="${esc(r.oclusion)}"></label>
    <label>Gravedad general<select data-f="severidad">${opts(SEVS, r.severidad, sevLabel)}</select></label>
    <label>Estado<select data-f="estado">${opts(ESTADOS, r.estado)}</select></label>
    <label class="wide">Disciplina<select data-f="disciplina"><option value="">Sin definir</option>${opts(DISCIPLINAS, r.disciplina)}</select></label>
    <label class="wide">Próxima acción<input data-f="proxima_accion" value="${esc(r.proxima_accion)}"></label>
    ${pz.length ? `<div class="wide chips">${pz.map((p) => `<span class="chip">Pieza ${p}</span>`).join("")}</div>` : ""}
  </div></article>`;
}
function onCampoFicha(ev) {
  const el = ev.target.closest("[data-f]"), card = ev.target.closest(".rec");
  if (!el || !card) return;
  const b = card.dataset.scope === "borrador";
  const r = b ? borrador[+card.dataset.i] : fichaEditando;
  if (!r) return;
  const f = el.dataset.f;
  r[f] = el.type === "checkbox" ? el.checked : el.value;
  if (f === "severidad") { card.className = card.className.replace(/sev-\S+/, sevClass(r.severidad)); card.querySelector("[data-pill]").textContent = sevLabel(r.severidad); }
  if (f === "_incluir") card.classList.toggle("off", !r._incluir);
  card.querySelector("[data-warns]").innerHTML = avisosHTML(r, b);
  if (b) resumenBorrador();
}
["input", "change"].forEach((t) => { $("#dlg-fichas").addEventListener(t, onCampoFicha); $("#dlg-paciente").addEventListener(t, onCampoFicha); });

function establecimientos() { return [...new Set(S.fichas.map((r) => r.establecimiento).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es")); }
function actualizarDatalist() { $("#dl-est").innerHTML = establecimientos().map((e) => `<option value="${esc(e)}">`).join(""); }

let ignoradasBorrador = [];
function abrirFichas(n) {
  const defs = { est: "", anio: new Date(n.creada).getFullYear(), vet: S.ajustes.veterinario, nota_id: n.id, disciplina: discNota(n) };
  const res = Parser.leer(n.texto, defs);
  if (!res.fichas.length) { toast("No encontré caballos. Escribí cada caballo en su renglón, con una viñeta (•) adelante."); return; }
  const estDefecto = n.titulo.trim();
  res.fichas.forEach((f) => { if (!f.establecimiento && estDefecto) f.establecimiento = estDefecto; });
  borrador = res.fichas; ignoradasBorrador = res.ignoradas;
  actualizarDatalist();
  $("#fichas-defaults").innerHTML = `<label>Fecha para las que no la tienen<input type="date" id="def-fecha"></label>
    <label>Establecimiento para los que no lo tienen<input id="def-est" list="dl-est" value=""></label>`;
  $("#fichas").innerHTML = borrador.map((r, i) => tarjetaFicha(r, i, "borrador")).join("");
  resumenBorrador();
  abrirDialogo($("#dlg-fichas"));
}
function aplicarDefectos() {
  const f = $("#def-fecha").value, e = $("#def-est").value.trim();
  borrador.forEach((r) => { if (f && !r.fecha) r.fecha = f; if (e && !r.establecimiento) r.establecimiento = e; });
  $("#fichas").innerHTML = borrador.map((r, i) => tarjetaFicha(r, i, "borrador")).join("");
  resumenBorrador();
}
$("#fichas-defaults").addEventListener("change", aplicarDefectos);
function resumenBorrador() {
  const incl = borrador.filter((r) => r._incluir !== false);
  const errores = incl.filter((r) => avisos(r).some(([k]) => k === "err")).length;
  const conf = incl.filter((r) => r.severidad === "Confirmar").length;
  $("#fichas-titulo").textContent = `${borrador.length} caballo${borrador.length === 1 ? "" : "s"} en la nota`;
  const p = [];
  if (errores) p.push(`${errores} con datos faltantes`);
  if (conf) p.push(`${conf} con gravedad por confirmar`);
  if (ignoradasBorrador.length) p.push(`no usé ${ignoradasBorrador.length} renglón(es): «${ignoradasBorrador.slice(0, 3).join(" / ")}»`);
  $("#fichas-hint").textContent = p.length ? p.join(" · ") + ". Destildá los que no son caballos." : "Todo completo. Revisá y guardá.";
  $("#fichas-guardar").textContent = `Guardar ${incl.length} ficha${incl.length === 1 ? "" : "s"}`;
  $("#fichas-guardar").disabled = !incl.length;
}
$("#fichas-guardar").onclick = () => {
  const incl = borrador.filter((r) => r._incluir !== false);
  const malos = incl.filter((r) => avisos(r).some(([k]) => k === "err"));
  if (malos.length) {
    toast(`Completá fecha, establecimiento y caballo en ${malos.length} ficha(s), o destildalas.`);
    const card = $(`#fichas .rec[data-i="${borrador.indexOf(malos[0])}"]`); if (card) card.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
  const dup = incl.filter((r) => S.fichas.some((x) => clave(x) === clave(r)));
  let reemplazar = false;
  if (dup.length) reemplazar = confirm(`${dup.length} ficha(s) ya existen.\n\nAceptar: reemplazarlas.\nCancelar: dejar las que estaban y guardar solo las nuevas.`);
  let n = 0;
  for (const r of incl) {
    const { _incluir, _motivo, ...limpia } = r;
    limpia.fecha_carga = hoy();
    const i = S.fichas.findIndex((x) => clave(x) === clave(r));
    if (i >= 0) { if (reemplazar) { S.fichas[i] = { ...limpia, id: S.fichas[i].id }; n++; } }
    else { S.fichas.push(limpia); n++; }
  }
  guardar(); cerrarDialogo($("#dlg-fichas")); bannerFichas();
  toast(`${n} ficha(s) guardadas en Pacientes.`);
};

/* ---------------- pacientes ---------------- */
function colorEst(e) { const l = establecimientos(); return GCOL[Math.max(0, l.indexOf(e)) % GCOL.length]; }
const ordenFichas = (a, b) => (b.fecha || "").localeCompare(a.fecha || "") || a.caballo.localeCompare(b.caballo, "es");
function renderPacientes() {
  const ests = establecimientos();
  const fe = $("#p-est"), cur = fe.value, fs = $("#p-sev"), cs = fs.value;
  fe.innerHTML = `<option value="">Todos los establecimientos</option>` + ests.map((e) => `<option${e === cur ? " selected" : ""}>${esc(e)}</option>`).join("");
  fs.innerHTML = `<option value="">Toda gravedad</option><option value="pend"${cs === "pend" ? " selected" : ""}>Con algo pendiente</option>` + opts(SEVS, cs, sevLabel);
  const q = norm($("#pq").value);
  const out = $("#lista-pacientes");
  if (!S.fichas.length) { out.innerHTML = `<div class="vacio">Todavía no hay fichas. Abrí una nota de visita y tocá «Pasar a fichas».</div>`; return; }
  const pac = new Map();
  for (const f of S.fichas) {
    const k = clavePac(f);
    if (!pac.has(k)) pac.set(k, { est: f.establecimiento, caballo: f.caballo, visitas: [] });
    pac.get(k).visitas.push(f);
  }
  const grupos = new Map();
  for (const p of pac.values()) {
    p.visitas.sort(ordenFichas);
    const u = p.visitas[0];
    const pend = u.severidad === "Confirmar" || u.estado === "A confirmar" || !!u.proxima_accion || u.severidad === "Severa";
    if (fe.value && p.est !== fe.value) continue;
    if (fs.value === "pend" ? !pend : fs.value && u.severidad !== fs.value) continue;
    if (q && !norm([p.caballo, p.est, ...p.visitas.map((v) => v.hallazgos + " " + v.oclusion)].join(" ")).includes(q)) continue;
    if (!grupos.has(p.est)) grupos.set(p.est, []);
    grupos.get(p.est).push(p);
  }
  if (!grupos.size) { out.innerHTML = `<div class="vacio">Ningún paciente coincide con el filtro.</div>`; return; }
  out.innerHTML = [...grupos.entries()].sort((a, b) => a[0].localeCompare(b[0], "es")).map(([est, lista]) => `
    <div class="grupo" style="--g:${colorEst(est)}">
      <h3><span class="dot"></span>${esc(est)} <small>${lista.length} caballo${lista.length === 1 ? "" : "s"}</small></h3>
      ${lista.sort((a, b) => a.caballo.localeCompare(b.caballo, "es")).map((p) => {
        const u = p.visitas[0];
        return `<button class="pac" data-k="${esc(clavePac(u))}"><span><b>${esc(p.caballo)}</b>
          <small>Última visita ${fmtFecha(u.fecha)} · ${p.visitas.length} visita${p.visitas.length === 1 ? "" : "s"}${u.proxima_accion ? " · " + esc(u.proxima_accion) : ""}</small></span>
          <span class="pill ${sevClass(u.severidad)}">${esc(sevLabel(u.severidad))}</span></button>`;
      }).join("")}
    </div>`).join("");
}
["#pq", "#p-est", "#p-sev"].forEach((s) => $(s).addEventListener("input", renderPacientes));
$("#lista-pacientes").addEventListener("click", (e) => { const b = e.target.closest(".pac"); if (b) abrirPaciente(b.dataset.k); });

function abrirPaciente(k, reemplazar = false) {
  const visitas = S.fichas.filter((f) => clavePac(f) === k).sort(ordenFichas);
  if (!visitas.length) { cerrarDialogo($("#dlg-paciente")); return; }
  const u = visitas[0];
  fichaEditando = null;
  $("#paciente-body").innerHTML = `<h2>${esc(u.caballo)}</h2><p class="hint">${esc(u.establecimiento)}</p>
    <ul class="visitas">${visitas.map((v) => `<li>
      <div><b>${fmtFecha(v.fecha)}</b> <span class="pill ${sevClass(v.severidad)}">${esc(sevLabel(v.severidad))}</span>
        <p>${esc(v.hallazgos || v.oclusion || "Sin hallazgos anotados")}</p>
        ${v.proxima_accion ? `<p class="hint">Próxima acción: ${esc(v.proxima_accion)}</p>` : ""}
        ${v.estado === "A confirmar" ? `<p class="hint">Visita a confirmar</p>` : ""}</div>
      <button class="btn" data-editar="${esc(v.id)}">Editar</button></li>`).join("")}</ul>`;
  $("#paciente-foot").innerHTML = `<span></span><button class="btn" data-cerrar>Cerrar</button>`;
  $("#dlg-paciente").dataset.k = k;
  if (!$("#dlg-paciente").open) abrirDialogo($("#dlg-paciente"));
}
$("#dlg-paciente").addEventListener("click", (e) => {
  const ed = e.target.closest("[data-editar]");
  if (ed) {
    const f = S.fichas.find((x) => x.id === ed.dataset.editar); if (!f) return;
    fichaEditando = { ...f };
    const nota = f.nota_id && S.notas.find((n) => n.id === f.nota_id);
    $("#paciente-body").innerHTML = tarjetaFicha(fichaEditando, 0, "ficha") +
      (f.nota_original ? `<details class="hint" style="margin-top:12px"><summary>Texto original de la nota</summary><pre style="white-space:pre-wrap">${esc(f.nota_original)}</pre></details>` : "") +
      (nota ? `<p><button class="linklike" data-ver-nota="${esc(nota.id)}">Abrir la nota de esta visita</button></p>` : "");
    $("#paciente-foot").innerHTML = `<button class="btn danger" data-borrar-ficha>Eliminar</button><span class="row"><button class="btn" data-volver-pac>Cancelar</button><button class="btn primary" data-guardar-ficha>Guardar</button></span>`;
    return;
  }
  if (e.target.closest("[data-volver-pac]")) { abrirPaciente($("#dlg-paciente").dataset.k); return; }
  if (e.target.closest("[data-guardar-ficha]")) {
    if (avisos(fichaEditando).some(([k]) => k === "err")) { toast("Faltan fecha, establecimiento o caballo."); return; }
    const i = S.fichas.findIndex((x) => x.id === fichaEditando.id);
    if (i >= 0) S.fichas[i] = fichaEditando;
    guardar(); toast("Ficha guardada.");
    abrirPaciente(clavePac(fichaEditando)); renderVista(); return;
  }
  if (e.target.closest("[data-borrar-ficha]")) {
    if (!confirm(`¿Eliminar la visita de ${fichaEditando.caballo} del ${fmtFecha(fichaEditando.fecha)}?`)) return;
    S.fichas = S.fichas.filter((x) => x.id !== fichaEditando.id);
    guardar(); toast("Ficha eliminada.");
    abrirPaciente($("#dlg-paciente").dataset.k); renderVista(); return;
  }
  const vn = e.target.closest("[data-ver-nota]");
  if (vn) { cerrarDialogo($("#dlg-paciente"), true); abrirNota(vn.dataset.verNota, false, true); }
});

/* ---------------- panel ---------------- */
function barras(el, items) {
  if (!items.length) { el.innerHTML = `<p class="hint">Sin datos todavía.</p>`; return; }
  const max = Math.max(...items.map((x) => x.n), 1);
  el.innerHTML = items.map((x) => `<div class="bar ${x.cls || ""}" title="${esc(x.label)}: ${x.n}"><span class="lbl">${esc(x.label)}</span>
    <span class="track"><span class="fill" style="width:${(x.n / max) * 100}%;${x.color ? "--s:" + x.color : ""}"></span></span><span class="v">${x.n}</span></div>`).join("");
}
function renderPanel() {
  const F = S.fichas;
  const sev = (s) => F.filter((r) => r.severidad === s).length;
  $("#kpis").innerHTML = [
    ["Caballos", new Set(F.map(clavePac)).size, ""], ["Revisiones", F.length, ""], ["Establecimientos", establecimientos().length, ""],
    ["Severos", sev("Severa"), "alert"], ["Gravedad por confirmar", sev("Confirmar"), "info"], ["Visitas a confirmar", F.filter((r) => r.estado === "A confirmar").length, "info"],
  ].map(([l, n, c]) => `<div class="kpi ${c}"><div class="n">${n}</div><div class="l">${l}</div></div>`).join("");
  barras($("#ch-sev"), SEVS.map((s) => ({ label: sevLabel(s), n: sev(s), cls: sevClass(s) })).filter((x) => x.n));
  const txt = (r) => r.hallazgos + " " + r.oclusion;
  barras($("#ch-hall"), Parser.HALLAZGOS.map(([l, re]) => ({ label: l, n: F.filter((r) => re.test(txt(r))).length })).filter((x) => x.n).sort((a, b) => b.n - a.n));
  barras($("#ch-est"), establecimientos().map((e) => ({ label: e, n: F.filter((r) => r.establecimiento === e).length, color: colorEst(e) })).sort((a, b) => b.n - a.n));
  const rank = { Severa: 0, Confirmar: 1, Moderada: 2 };
  const todo = F.filter((r) => r.severidad === "Severa" || r.severidad === "Confirmar" || r.estado === "A confirmar" || r.proxima_accion)
    .sort((a, b) => (rank[a.severidad] ?? 3) - (rank[b.severidad] ?? 3) || ordenFichas(a, b));
  $("#todo").innerHTML = todo.length ? todo.slice(0, 40).map((r) => {
    const que = r.severidad === "Confirmar" ? "Definir gravedad" : r.estado === "A confirmar" ? "Confirmar visita" : (r.proxima_accion || "Caso severo");
    return `<li data-k="${esc(clavePac(r))}"><span><b>${esc(r.caballo)}</b> <small>${esc(r.establecimiento)} · ${fmtFecha(r.fecha)}</small><br><small>${esc(que)}</small></span><span class="pill ${sevClass(r.severidad)}">${esc(sevLabel(r.severidad))}</span></li>`;
  }).join("") : `<li style="cursor:default"><small>No hay nada pendiente.</small></li>`;
}
$("#todo").addEventListener("click", (e) => { const li = e.target.closest("li[data-k]"); if (li) abrirPaciente(li.dataset.k); });

/* ---------------- preguntar ---------------- */
/* Todas las visitas que conoce la app: las fichas guardadas y, de las notas, las visitas que todavia
   no se pasaron a fichas (leidas al vuelo, "sin revisar"). Asi se puede preguntar apenas se importa. */
function todasLasVisitas() {
  const porId = new Map(S.notas.map((n) => [n.id, n]));
  const pasadas = new Map(); // nota -> fechas que ya tienen fichas
  const out = S.fichas.map((f) => {
    const n = porId.get(f.nota_id);
    if (f.nota_id) { if (!pasadas.has(f.nota_id)) pasadas.set(f.nota_id, new Set()); pasadas.get(f.nota_id).add(f.fecha); }
    return { ...f, disciplina: f.disciplina || (n ? discNota(n) : ""), cliente: f.cliente || (n ? n.titulo : ""), revisada: true };
  });
  for (const n of S.notas) {
    if (n.tipo !== "texto" || n.estado === "papelera" || n.ejemplo) continue;
    const ya = pasadas.get(n.id), d = discNota(n), est = n.titulo.trim();
    for (const f of Parser.leer(n.texto, { anio: new Date(n.creada).getFullYear(), nota_id: n.id }).fichas) {
      if (!f.fecha || (ya && ya.has(f.fecha))) continue;
      out.push({ ...f, establecimiento: f.establecimiento || est, disciplina: d, cliente: n.titulo, revisada: false });
    }
  }
  return out;
}
function notasConCaballos() {
  const g = new Map();
  for (const v of todasLasVisitas()) { if (!g.has(v.nota_id)) g.set(v.nota_id, new Set()); g.get(v.nota_id).add(clavePac(v)); }
  return S.notas.filter((n) => g.has(n.id) && n.estado !== "papelera").map((n) => ({ nota: n, caballos: g.get(n.id).size }));
}
const EJEMPLOS = ["¿Cuántos caballos atendí este mes?", "¿Cuántos de polo este año?", "¿Cuántos de salto este año?", "¿Cuántos caballos atendí en junio?", "¿Cuándo atendí a …?"];
let pregLista = [];
function renderPreguntar() {
  if (!$("#preg-ejemplos").innerHTML) $("#preg-ejemplos").innerHTML = EJEMPLOS.map((e) => `<button type="button">${esc(e)}</button>`).join("");
  const imp = S.ajustes.ultimaImportacion, dias = imp ? Math.floor((Date.now() - imp) / 86400000) : 0;
  $("#cn-info").textContent = imp ? `Notas de ColorNote al ${fmtLarga(imp)}${dias >= 2 ? ` (hace ${dias} días)` : ""}` : "Todavía no trajiste tus notas de ColorNote.";
  const out = $("#preg-res");
  const r = Preguntas.responder($("#preg-q").value, todasLasVisitas(), hoy());
  pregLista = r ? r.lista : [];
  if (!r) { out.innerHTML = `<div class="vacio">Escribí o dictá una pregunta sobre tus visitas. Podés preguntar por mes, año, polo o salto, caballo, cliente, establecimiento o hallazgo. Funciona sin internet.</div>`; return; }
  let h = `<div class="card resp"><p class="resp-t">${esc(r.titular)}</p>${r.detalle ? `<p class="hint">${esc(r.detalle)}</p>` : ""}</div>`;
  if (r.sinDisciplina) h += `<div class="banner warn">Hay ${r.sinDisciplina} caballo(s) más sin disciplina cargada, que no entran en esta cuenta. <button class="linklike" data-abrir-disc>Completar disciplinas</button></div>`;
  if (r.sinRevisar) h += `<div class="banner info">${r.sinRevisar} de estas revisiones salen de notas que todavía no pasaste a fichas: la app las leyó sola y puede haber algún renglón mal interpretado.</div>`;
  if (!r.lista.length && r.terminos.length) {
    const enNotas = Preguntas.buscarEnNotas(r.terminos, S.notas);
    if (enNotas.length) h += `<h3 class="sec">Aparece en estas notas</h3><ul class="todo">${enNotas.map((x) => `<li data-nota="${esc(x.nota_id)}"><span><b>${esc(x.titulo || "Sin título")}</b>${x.fecha ? ` <small>${fmtFecha(x.fecha)}</small>` : ""}<br><small>${esc(x.linea)}</small></span></li>`).join("")}</ul>`;
  }
  if (r.cuenta && r.lista.length) {
    h += `<div class="panels">${r.porCliente.length > 1 ? `<div class="card"><h3 class="sec">Caballos por cliente (título de la nota)</h3><div class="bars" id="preg-cli"></div></div>` : ""}${r.porDisc.length ? `<div class="card"><h3 class="sec">Caballos por disciplina</h3><div class="bars" id="preg-disc"></div></div>` : ""}
      <div class="card"><h3 class="sec">Caballos por establecimiento</h3><div class="bars" id="preg-est"></div></div>
      ${r.porMes.length ? `<div class="card"><h3 class="sec">Caballos por mes</h3><div class="bars" id="preg-mes"></div></div>` : ""}</div>`;
  }
  if (r.lista.length) {
    const tope = 80;
    h += `<h3 class="sec">Revisiones${r.lista.length > tope ? ` (las ${tope} más recientes de ${r.lista.length})` : ""}</h3><ul class="todo">${r.lista.slice(0, tope).map((v, i) => `<li data-i="${i}"><span><b>${esc(v.caballo)}</b> <small>${esc(v.establecimiento)} · ${fmtFecha(v.fecha)}${v.disciplina ? " · " + esc(v.disciplina) : ""}${v.nuevo ? " · nuevo" : ""}</small><br><small>${esc(v.hallazgos || v.oclusion || "Sin hallazgos anotados")}</small></span><span class="pill ${v.revisada ? sevClass(v.severidad) : "sev-Sin"}">${esc(v.revisada ? sevLabel(v.severidad) : "Sin revisar")}</span></li>`).join("")}</ul>`;
  }
  out.innerHTML = h;
  if ($("#preg-cli")) barras($("#preg-cli"), r.porCliente);
  if ($("#preg-disc")) barras($("#preg-disc"), r.porDisc);
  if ($("#preg-est")) barras($("#preg-est"), r.porEst.map((x) => ({ ...x, color: colorEst(x.label) })));
  if ($("#preg-mes")) barras($("#preg-mes"), r.porMes);
}
$("#preg-form").addEventListener("submit", (e) => { e.preventDefault(); $("#preg-q").blur(); renderPreguntar(); });
/* Dictado: lo reconoce Google, necesita internet. Solo viaja lo que se dice, no las notas. */
const Reco = window.SpeechRecognition || window.webkitSpeechRecognition;
let dictado = null;
if (Reco) $("#preg-mic").hidden = false;
$("#preg-mic").onclick = () => {
  if (dictado) { dictado.stop(); return; }
  if (!navigator.onLine) { toast("Para dictar hace falta internet. Sin señal, escribí la pregunta."); return; }
  dictado = new Reco();
  dictado.lang = "es-AR"; dictado.interimResults = true;
  $("#preg-mic").classList.add("grabando"); toast("Hablá ahora…");
  dictado.onresult = (e) => { $("#preg-q").value = [...e.results].map((x) => x[0].transcript).join(""); };
  dictado.onerror = (e) => toast(e.error === "not-allowed" || e.error === "service-not-allowed" ? "Hay que darle permiso al micrófono." : e.error === "no-speech" ? "No escuché nada. Tocá el micrófono y hablá." : "No se pudo dictar. Probá de nuevo.");
  dictado.onend = () => { dictado = null; $("#preg-mic").classList.remove("grabando"); renderPreguntar(); };
  try { dictado.start(); } catch (err) { dictado = null; $("#preg-mic").classList.remove("grabando"); }
};
$("#preg-q").addEventListener("input", () => { clearTimeout(renderPreguntar._t); renderPreguntar._t = setTimeout(renderPreguntar, 350); });
$("#preg-ejemplos").addEventListener("click", (e) => {
  const b = e.target.closest("button"); if (!b) return;
  const abierto = b.textContent.includes("…");
  $("#preg-q").value = abierto ? b.textContent.replace("…?", "") : b.textContent;
  if (abierto) $("#preg-q").focus();
  renderPreguntar();
});
$("#preg-res").addEventListener("click", (e) => {
  if (e.target.closest("[data-abrir-disc]")) { abrirDisciplinas(); return; }
  const n = e.target.closest("li[data-nota]");
  if (n) { abrirNota(n.dataset.nota); return; }
  const li = e.target.closest("li[data-i]"), v = li && pregLista[+li.dataset.i];
  if (!v) return;
  if (v.revisada) abrirPaciente(clavePac(v)); else abrirNota(v.nota_id);
});

function abrirDisciplinas() {
  const filas = notasConCaballos().sort((a, b) => (discNota(a.nota) ? 1 : 0) - (discNota(b.nota) ? 1 : 0) || tituloNota(a.nota).localeCompare(tituloNota(b.nota), "es"));
  $("#disc-lista").innerHTML = filas.length
    ? filas.map(({ nota, caballos }) => `<div class="disc-fila"><span><b>${esc(tituloNota(nota))}</b><br><small>${caballos} caballo${caballos === 1 ? "" : "s"}</small></span>
        <select data-nota="${esc(nota.id)}" aria-label="Disciplina de ${esc(tituloNota(nota))}">${opcionesDisc(nota)}</select></div>`).join("")
    : `<div class="vacio">Todavía no hay notas con caballos.</div>`;
  abrirDialogo($("#dlg-disc"));
}
$("#btn-disc").onclick = abrirDisciplinas;
$("#disc-lista").addEventListener("change", (e) => {
  const s = e.target.closest("select[data-nota]"), n = s && S.notas.find((x) => x.id === s.dataset.nota);
  if (n) ponerDisciplina(n, s.value);
});
$("#dlg-disc").addEventListener("close", () => renderVista());

/* ---------------- calendario ---------------- */
function fechaNota(n) { return n.fecha || Parser.primeraFecha(n.texto, new Date(n.creada).getFullYear()) || isoLocal(n.creada); }
function renderCal() {
  const porDia = new Map();
  S.notas.filter((n) => n.estado === "activa").forEach((n) => { const f = fechaNota(n); if (!porDia.has(f)) porDia.set(f, []); porDia.get(f).push(n); });
  const mes = calMes.toLocaleDateString("es-AR", { month: "long" });
  $("#cal-mes").textContent = mes.charAt(0).toUpperCase() + mes.slice(1) + " " + calMes.getFullYear();
  const inicio = new Date(calMes); inicio.setDate(1 - ((calMes.getDay() + 6) % 7));
  const dows = ["L", "M", "M", "J", "V", "S", "D"].map((d) => `<div class="dow">${d}</div>`).join("");
  let celdas = "";
  const h = hoy();
  for (let i = 0; i < 42; i++) {
    const d = new Date(inicio); d.setDate(inicio.getDate() + i);
    const iso = isoLocal(d), notas = porDia.get(iso) || [];
    celdas += `<button data-d="${iso}" class="${d.getMonth() !== calMes.getMonth() ? "fuera" : ""} ${iso === h ? "hoy" : ""}" aria-pressed="${iso === calDia}">
      ${d.getDate()}<span class="dots">${notas.slice(0, 4).map((n) => `<i class="c-${n.color}"></i>`).join("")}</span></button>`;
  }
  $("#cal").innerHTML = dows + celdas;
  const dia = calDia || h;
  const notasDia = (porDia.get(dia) || []).sort((a, b) => b.modificada - a.modificada);
  const [y, m, d] = dia.split("-").map(Number);
  $("#cal-dia-titulo").textContent = new Date(y, m - 1, d).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });
  $("#cal-dia").innerHTML = notasDia.length ? notasDia.map(tarjetaNota).join("") : `<div class="vacio">No hay notas este día.</div>`;
}
$("#cal-prev").onclick = () => { calMes = new Date(calMes.getFullYear(), calMes.getMonth() - 1, 1); renderCal(); };
$("#cal-next").onclick = () => { calMes = new Date(calMes.getFullYear(), calMes.getMonth() + 1, 1); renderCal(); };
$("#cal").addEventListener("click", (e) => { const b = e.target.closest("[data-d]"); if (!b) return; calDia = b.dataset.d; const [y, m] = calDia.split("-").map(Number); calMes = new Date(y, m - 1, 1); renderCal(); });
$("#cal-dia").addEventListener("click", (e) => { const b = e.target.closest(".nota"); if (b) abrirNota(b.dataset.id); });

/* ---------------- mas: archivo, respaldo, colornote, pin ---------------- */
function diasDesdeRespaldo() { return S.ajustes.ultimoRespaldo ? Math.floor((Date.now() - S.ajustes.ultimoRespaldo) / 86400000) : Infinity; }
function renderBannerRespaldo() {
  const b = $("#backup-banner");
  const d = diasDesdeRespaldo();
  // Lo que vino de ColorNote ya esta a salvo ahi: solo se avisa si hay algo que existe nada mas que aca
  const hayDatos = S.notas.filter((n) => n.origen !== "colornote").length > 2 || S.fichas.length;
  b.hidden = !(vista === "notas" && hayDatos && d >= 7);
  if (!b.hidden) b.innerHTML = `${d === Infinity ? "Todavía no guardaste ningún respaldo." : `Hace ${d} días que no guardás un respaldo.`} <button class="linklike" id="btn-respaldo-ya">Guardar ahora</button>`;
}
$("#backup-banner").addEventListener("click", (e) => { if (e.target.closest("#btn-respaldo-ya")) guardarRespaldo(); });
function renderMas() {
  if (vista !== "mas") return;
  $("#n-archivo").textContent = S.notas.filter((n) => n.estado === "archivada").length || "";
  $("#n-papelera").textContent = S.notas.filter((n) => n.estado === "papelera").length || "";
  $("#respaldo-info").textContent = S.ajustes.ultimoRespaldo
    ? `Último respaldo: ${fmtLarga(S.ajustes.ultimoRespaldo)}. Los datos viven en este teléfono: si se pierde o se borra la app, el respaldo es lo único que queda.`
    : "Nunca guardaste un respaldo. Los datos viven en este teléfono: si se pierde o se borra la app, el respaldo es lo único que queda.";
  const sinDisc = notasConCaballos().filter((x) => !discNota(x.nota)).length;
  $("#disc-info").textContent = (sinDisc ? `${sinDisc} nota(s) con caballos todavía no tienen disciplina.` : "Todas las notas con caballos tienen disciplina.")
    + " Hace falta para preguntas como «¿cuántos caballos de polo atendí este año?».";
  const pin = Store.tienePin();
  $("#pin-info").textContent = pin ? "La app pide PIN al abrirla y las notas están cifradas en el teléfono." : "Sin PIN: cualquiera con tu teléfono desbloqueado puede leer las notas.";
  $("#pin-acciones").innerHTML = pin
    ? `<button class="btn" data-pin="cambiar">Cambiar PIN</button><button class="btn" data-pin="quitar">Quitar PIN</button><button class="btn" data-pin="bloquear">Bloquear ahora</button>`
    : `<button class="btn primary" data-pin="poner">Poner PIN</button>`;
  $("#acerca").textContent = `Cuaderno ${VERSION} · ${S.notas.length} notas · ${S.fichas.length} fichas · almacenamiento ${persistente ? "protegido" : "normal"} · funciona sin internet`;
}
$$(".menu-item[data-ir]").forEach((b) => (b.onclick = () => { filtroEstado = b.dataset.ir; ir("notas"); }));

function descargar(nombre, contenido, tipo) {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  const a = document.createElement("a"); a.href = url; a.download = nombre;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
async function guardarRespaldo() {
  const nombre = `cuaderno-respaldo-${hoy()}.json`;
  const datos = JSON.stringify({ app: "cuaderno", version: 1, exportado: new Date().toISOString(), notas: S.notas, fichas: S.fichas, ajustes: S.ajustes }, null, 1);
  const archivo = new File([datos], nombre, { type: "application/json" });
  let ok = false;
  if (navigator.canShare && navigator.canShare({ files: [archivo] })) {
    try { await navigator.share({ files: [archivo], title: "Respaldo del Cuaderno" }); ok = true; }
    catch (e) { if (e.name === "AbortError") return; }
  }
  if (!ok) { descargar(nombre, datos, "application/json"); ok = true; }
  S.ajustes.ultimoRespaldo = Date.now(); guardar();
  renderBannerRespaldo(); renderMas();
  toast("Respaldo guardado.");
}
$("#btn-respaldo").onclick = guardarRespaldo;

function combinarNotas(nuevas) {
  let agregadas = 0, actualizadas = 0;
  for (const n of nuevas) {
    const i = S.notas.findIndex((x) => x.id === n.id);
    // ColorNote no sabe de disciplinas: al volver a importar se conserva la que ya tenia la nota
    n.disciplina = n.disciplina || (i >= 0 && S.notas[i].disciplina) || "";
    if (i < 0) { S.notas.push(n); agregadas++; }
    else if ((+n.modificada || 0) > (+S.notas[i].modificada || 0) || S.notas[i].faltaEnCN) { S.notas[i] = n; actualizadas++; }
  }
  return { agregadas, actualizadas };
}
$("#file-respaldo").onchange = (e) => {
  const file = e.target.files[0]; if (!file) return;
  const fr = new FileReader();
  fr.onload = () => {
    try {
      const d = JSON.parse(fr.result);
      let notas = [], fichas = [];
      if (d.app === "cuaderno") { notas = normalizar(d).notas; fichas = normalizar(d).fichas; }
      else if (Array.isArray(d.registros)) fichas = d.registros; // respaldo de la maqueta anterior
      else throw new Error("formato");
      if (!confirm(`El respaldo tiene ${notas.length} notas y ${fichas.length} fichas.\n\nSe combinan con lo que ya tenés: no se duplica nada y se queda la versión más nueva de cada nota.`)) return;
      const r = combinarNotas(notas);
      let fn = 0;
      for (const f of fichas) {
        if (!f || !f.caballo) continue;
        const rec = { id: f.id || uid("f"), fecha: f.fecha || "", establecimiento: f.establecimiento || "", cliente: f.cliente || "", caballo: f.caballo, oclusion: f.oclusion || "", hallazgos: f.hallazgos || "", severidad: SEVS.includes(f.severidad) ? f.severidad : "Confirmar", estado: ESTADOS.includes(f.estado) ? f.estado : "Realizada", proxima_accion: f.proxima_accion || "", disciplina: DISCIPLINAS.includes(f.disciplina) ? f.disciplina : "", veterinario: f.veterinario || "Miguel", fecha_carga: f.fecha_carga || hoy(), nota_id: f.nota_id || "", nota_original: f.nota_original || "" };
        const i = S.fichas.findIndex((x) => x.id === rec.id || clave(x) === clave(rec));
        if (i >= 0) S.fichas[i] = { ...rec, id: S.fichas[i].id }; else S.fichas.push(rec);
        fn++;
      }
      guardar(); renderVista();
      toast(`Respaldo restaurado: ${r.agregadas} notas nuevas, ${r.actualizadas} actualizadas, ${fn} fichas.`, 4000);
    } catch (err) { toast("Ese archivo no es un respaldo del Cuaderno."); }
    finally { e.target.value = ""; }
  };
  fr.readAsText(file);
};

let importPendiente = [];
// Notas traidas de ColorNote que ya no figuran en el respaldo nuevo (se borraron alla)
const faltanEnCN = () => { const ids = new Set(importPendiente.map((n) => n.id)); return S.notas.filter((n) => n.origen === "colornote" && n.estado !== "papelera" && !ids.has(n.id)); };
$("#file-colornote").onchange = $("#file-colornote-2").onchange = async (e) => {
  const file = e.target.files[0]; if (!file) return;
  e.target.value = "";
  toast("Leyendo el respaldo…");
  try {
    importPendiente = await ColorNote.importar(await file.arrayBuffer(), $("#cn-pin").value || "0000");
  } catch (err) { toast(err.message, 5000); return; }
  const listas = importPendiente.filter((n) => n.tipo === "lista").length;
  const arch = importPendiente.filter((n) => n.estado === "archivada").length;
  const yaEstan = importPendiente.filter((n) => S.notas.some((x) => x.id === n.id)).length;
  const fechas = importPendiente.map((n) => n.creada).sort((a, b) => a - b);
  $("#import-body").innerHTML = `<h2>${importPendiente.length} notas de ColorNote</h2>
    <p class="hint">Desde ${fmtCorta(fechas[0])} hasta ${fmtCorta(fechas[fechas.length - 1])}. ${listas} son listas y ${arch} están archivadas.</p>
    ${yaEstan ? `<p class="hint">${yaEstan} ya las habías traído antes: se actualizan, no se duplican. Si las cambiaste acá después, se respetan tus cambios.</p>` : ""}
    ${faltanEnCN().length ? `<p class="hint">${faltanEnCN().length} nota(s) que habías traído ya no están en este respaldo de ColorNote: pasan a la papelera de acá (se pueden restaurar).</p>` : ""}
    <label style="flex-direction:row;align-items:center;gap:8px;color:var(--ink)"><input type="checkbox" id="imp-arch" checked style="width:22px;height:22px"> Traer también las archivadas</label>`;
  abrirDialogo($("#dlg-import"));
};
$("#import-ok").onclick = () => {
  const traerArch = $("#imp-arch").checked;
  faltanEnCN().forEach((n) => { n.estado = "papelera"; n.fijada = false; n.faltaEnCN = true; });
  const r = combinarNotas(importPendiente.filter((n) => traerArch || n.estado !== "archivada"));
  importPendiente = [];
  S.ajustes.ultimaImportacion = Date.now();
  guardar(); cerrarDialogo($("#dlg-import")); renderVista();
  toast(`Listo: ${r.agregadas} notas nuevas y ${r.actualizadas} actualizadas.`, 4000);
};

$("#btn-csv").onclick = () => {
  if (!S.fichas.length) { toast("Todavía no hay fichas de pacientes."); return; }
  const cols = ["Fecha", "Establecimiento", "Caballo", "Oclusion", "Hallazgos", "Severidad_General", "Proxima_Accion", "Estado", "Veterinario", "Fecha_Carga"];
  const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const filas = [...S.fichas].sort(ordenFichas).reverse().map((r) => [fmtFecha(r.fecha), r.establecimiento, r.caballo, r.oclusion, r.hallazgos, r.severidad, r.proxima_accion, r.estado, r.veterinario, fmtFecha(r.fecha_carga)].map(q).join(","));
  descargar(`pacientes-${hoy()}.csv`, "﻿" + [cols.join(",")].concat(filas).join("\r\n"), "text/csv;charset=utf-8");
};

$("#pin-acciones").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-pin]"); if (!b) return;
  const a = b.dataset.pin;
  if (a === "bloquear") return bloquearAhora();
  if (a === "quitar") {
    if (!confirm("¿Quitar el PIN? Las notas van a quedar sin cifrar en el teléfono.")) return;
    await guardarYa(); await Store.quitarPin(S); renderVista(); toast("PIN quitado."); return;
  }
  $("#pin-titulo").textContent = a === "cambiar" ? "Cambiar PIN" : "Poner PIN";
  $("#pin-1").value = ""; $("#pin-2").value = ""; $("#pin-err").hidden = true;
  abrirDialogo($("#dlg-pin"));
});
$("#pin-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const p1 = $("#pin-1").value, p2 = $("#pin-2").value, err = $("#pin-err");
  if (!/^\d{4,}$/.test(p1)) { err.textContent = "El PIN tiene que tener 4 números o más."; err.hidden = false; return; }
  if (p1 !== p2) { err.textContent = "Los dos PIN no coinciden."; err.hidden = false; return; }
  await guardarYa(); await Store.ponerPin(p1, S);
  cerrarDialogo($("#dlg-pin")); renderVista(); toast("PIN guardado. La app lo va a pedir al abrirla.");
});

/* ---------------- actualizaciones (service worker) ---------------- */
let actualizacionPedida = false;
function registrarSW() {
  if (!("serviceWorker" in navigator) || location.protocol === "file:") return;
  navigator.serviceWorker.register("sw.js").then((reg) => {
    const avisar = () => { $("#update-banner").hidden = false; $("#btn-actualizar").onclick = async () => { await guardarYa(); actualizacionPedida = true; (reg.waiting || reg.installing)?.postMessage("activar"); }; };
    if (reg.waiting && navigator.serviceWorker.controller) avisar();
    reg.addEventListener("updatefound", () => {
      const w = reg.installing;
      w && w.addEventListener("statechange", () => { if (w.state === "installed" && navigator.serviceWorker.controller) avisar(); });
    });
  }).catch(() => {});
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (actualizacionPedida) location.reload(); });
}

iniciar();
