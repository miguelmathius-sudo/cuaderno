"use strict";
/* Convierte el texto de una nota en fichas de pacientes (una por caballo y visita).
   Reglas acordadas con Miguel:
   - Paciente = Establecimiento + Caballo (hay nombres repetidos entre establecimientos).
   - La fecha nunca se inventa: si la nota no la dice, se pide.
   - Gravedad general: si la nota menciona una sola (todo "leve"), se toma. Si mezcla o no dice,
     queda "Confirmar" para que Miguel la defina. */
const Parser = (() => {
  const MESES = { enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12 };
  const SEVS = ["Severa", "Moderada", "Leve", "Confirmar", "Sin hallazgos"];
  const DISCIPLINAS = ["Polo", "Salto", "Otra"];
  const HALLAZGOS = [
    ["Puntas", /punta/i],
    ["Lesión en carrillos", /carrillo/i],
    ["Dientes de lobo", /dientes? de lobo|\bd\.? ?lobo/i],
    ["Rampas", /rampa/i],
    ["Crestas transversas", /cresta/i],
    ["Ondas", /\bondas?\b/i],
    ["Escalón", /escal[oó]n/i],
    ["Desvío", /desv[ií]o/i],
    ["Desnivel", /desnivel/i],
    ["Canal pulpar", /canal pulpar|pulpa/i],
  ];
  const BULLET = /^[•·●◦▪►\-*�]\s*/;
  // Donde termina el nombre del caballo en una linea del formato viejo ("Delirio (preso) rampas 11")
  const INICIO_HALLAZGO = /^(d\.?\s*lobo|dientes?|rampas?|puntas?|lobo|lesi\S*|ondas?|escal\S*|desv\S*|crestas?|carrillos?|oclusi\S*|correct\S*|desnivel\S*|canal|pieza|caries|control|limad|extrac|fractur\S*|leve\S*|moderad\S*|sever\S*|sin\b|ok\b|bien\b|[(\d])/i;
  // Lineas administrativas que no son caballos
  const NO_CABALLO = /^(pagad|pago|cobr|total|debe|saldo|\$|factur|precio|turno)/i;

  const norm = (s) => String(s || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const iso = (y, mo, d) => (mo < 1 || mo > 12 || d < 1 || d > 31) ? null : `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  function fecha(line, anio) {
    const l = norm(line).replace(/[.,]/g, " ").replace(/\s+/g, " ").trim();
    let m = l.match(/^(?:(?:lunes|martes|miercoles|jueves|viernes|sabado|domingo) )?(\d{1,2}) (?:de )?([a-z]+)(?: (?:de |del )?(\d{4}))?$/);
    if (m && MESES[m[2]]) return iso(m[3] ? +m[3] : (anio || new Date().getFullYear()), MESES[m[2]], +m[1]);
    m = l.match(/^(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?$/);
    if (m) { let y = m[3] ? +m[3] : (anio || new Date().getFullYear()); if (y < 100) y += 2000; return iso(y, +m[2], +m[1]); }
    return null;
  }
  function establecimiento(line) {
    let m = line.match(/^["“”«'‘’](.+?)["“”»'‘’]\s*$/);
    if (m) return m[1].trim();
    m = line.match(/^(?:establecimiento|haras|caballeriza|campo|cliente)\s*:\s*(.+)$/i);
    return m ? m[1].trim() : null;
  }
  function separarNombre(line) {
    const sep = line.match(/^(.+?)\s*(?::|\s[-–]\s)\s*(.*)$/);
    if (sep) return [sep[1].trim(), sep[2].trim()];
    const pal = line.split(/\s+/);
    for (let i = 1; i < pal.length; i++) {
      if (INICIO_HALLAZGO.test(pal.slice(i).join(" "))) return [pal.slice(0, i).join(" "), pal.slice(i).join(" ")];
    }
    return [line.trim(), ""];
  }
  /* Disciplina escrita en la nota: "Polo" o "Salto" solos en uno de los primeros renglones,
     o "Disciplina: polo" en cualquier parte. i = numero de renglon (sin contar los vacios). */
  function lineaDisciplina(line, i) {
    const l = norm(line).replace(/[.:]+$/, "");
    let m = l.match(/^disciplina\s*:?\s*(.+)$/);
    if (!m && i < 5) m = l.match(/^(?:caballos de |de )?(polo|salto)$/);
    if (!m) return null;
    return /polo/.test(m[1]) ? "Polo" : /salto/.test(m[1]) ? "Salto" : "Otra";
  }
  function disciplina(texto) {
    const lineas = String(texto || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    for (let i = 0; i < lineas.length; i++) { const d = lineaDisciplina(lineas[i], i); if (d) return d; }
    return "";
  }
  function gravedades(texto) {
    const t = norm(texto), n = [];
    if (/\blev(e|es)\b/.test(t)) n.push("Leve");
    if (/\bmoderad[oa]s?\b/.test(t)) n.push("Moderada");
    if (/\b(sever[oa]s?|graves?)\b/.test(t)) n.push("Severa");
    return n;
  }

  function construir(c, defs) {
    const hall = [], ocl = [], acc = [];
    let estado = "Realizada";
    for (const l of c.lineas) {
      if (/a confirmar|pautad/i.test(l)) estado = "A confirmar";
      if (/oclusi[oó]n/i.test(l)) ocl.push(l);
      else if (/^(proxim[oa]|control|seguir|volver|revisar|pautad)/.test(norm(l))) acc.push(l);
      else hall.push(l);
    }
    const niveles = gravedades(hall.concat(ocl).join(" "));
    let severidad, motivo = "";
    if (!c.lineas.length) { severidad = "Confirmar"; motivo = "No hay hallazgos anotados."; }
    else if (!hall.length && !niveles.length) severidad = ocl.length ? "Sin hallazgos" : "Confirmar";
    else if (niveles.length === 1) severidad = niveles[0];
    else { severidad = "Confirmar"; motivo = niveles.length ? `La nota mezcla gravedades (${niveles.join(", ").toLowerCase()}).` : "La nota no dice la gravedad."; }
    return {
      id: "f-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      _incluir: true, _motivo: motivo,
      fecha: c.fecha || defs.fecha || "",
      establecimiento: c.est || defs.est || "",
      caballo: c.caballo,
      oclusion: ocl.join("; "),
      hallazgos: hall.join("; "),
      severidad, estado,
      disciplina: defs.disciplina || "",
      proxima_accion: acc.join("; "),
      veterinario: defs.vet || "Miguel",
      nota_id: defs.nota_id || "",
      nota_original: [c.caballo].concat(c.lineas).join("\n"),
    };
  }

  /* defs: {fecha, est, vet, anio, nota_id, disciplina}. Devuelve {fichas, ignoradas}. */
  function leer(texto, defs = {}) {
    const lineas = String(texto || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const conVinetas = lineas.some((l) => BULLET.test(l) && !/^[_\-=—–]{4,}$/.test(l));
    const out = [], ignoradas = [];
    let f = "", est = "", cur = null;
    const cerrar = () => { if (cur) out.push(construir(cur, defs)); cur = null; };
    for (const [i, line] of lineas.entries()) {
      if (/^[_\-=—–]{4,}$/.test(line)) { cerrar(); continue; }
      if (lineaDisciplina(line, i)) continue;
      const fe = fecha(line, defs.anio);
      if (fe) { cerrar(); f = fe; continue; }
      const es = establecimiento(line);
      if (es) { cerrar(); est = es; continue; }
      if (conVinetas) {
        if (BULLET.test(line)) {
          cerrar();
          const [nombre, resto] = separarNombre(line.replace(BULLET, ""));
          cur = { caballo: nombre, fecha: f, est, lineas: resto ? [resto] : [] };
        } else if (cur) cur.lineas.push(line);
        else ignoradas.push(line);
      } else {
        // Formato viejo: cada linea es "Caballo hallazgos", despues de una fecha
        if (NO_CABALLO.test(norm(line)) || (!f && !defs.fecha)) { ignoradas.push(line); continue; }
        cerrar();
        const [nombre, resto] = separarNombre(line);
        cur = { caballo: nombre, fecha: f, est, lineas: resto ? [resto] : [] };
        cerrar();
      }
    }
    cerrar();
    return { fichas: out, ignoradas };
  }

  function piezas(texto) {
    // Numeracion Triadan: cuadrante 1-4 + pieza 01-11
    return [...new Set(String(texto).match(/\b[1-4](?:0[1-9]|1[01])\b/g) || [])];
  }
  /* Primera fecha que aparece en el texto (para ubicar la nota en el calendario) */
  function primeraFecha(texto, anio) {
    for (const l of String(texto || "").split(/\r?\n/).slice(0, 6)) {
      const f = fecha(l.trim(), anio);
      if (f) return f;
    }
    return "";
  }

  return { leer, fecha, primeraFecha, piezas, gravedades, disciplina, norm, SEVS, DISCIPLINAS, HALLAZGOS };
})();
