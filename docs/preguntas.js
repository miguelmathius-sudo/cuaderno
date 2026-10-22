"use strict";
/* Responde preguntas en castellano sobre las visitas: "¿cuantos caballos de polo atendi en junio?",
   "¿cuando atendi a Lucero?". Todo se calcula en el telefono con reglas fijas: no usa internet
   ni manda nada afuera. Entiende: periodo (mes, año, "este mes", "ayer", una fecha), disciplina
   (polo / salto) y palabras sueltas (caballo, establecimiento, cliente, hallazgo, pieza). */
const Preguntas = (() => {
  const norm = Parser.norm;
  const MES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const MES_CORTO = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const RE_MES = "(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)";
  // Palabras de la pregunta que no sirven para buscar
  const VACIAS = new Set(("cuanto cuantos cuanta cuantas cuando cual cuales quien quienes que como donde " +
    "caballo caballos yegua yeguas animal animales paciente pacientes cliente clientes establecimiento establecimientos " +
    "atendi atendido atendidos atendimos atendiste atiendo atender vi vimos revise revisado revisados revisamos hice hicimos hizo " +
    "fue fueron fui es son esta estan estuvo tengo tiene tienen tuvo tenia tenian hay hubo " +
    "el la los las lo le les un una unos unas de del al a en y o u con sin por para mi mis me se te " +
    "este esta estos estas ese esa eso todo toda todos todas durante desde hasta entre " +
    "ano anos mes meses semana dia dias fecha fechas hoy ayer pasado pasada ultimo ultima ultimos ultimas vez veces " +
    "visita visitas revision revisiones atencion atenciones lista listar mostrar mostrame decime dame ver buscar busca " +
    "total cantidad numero disciplina polo salto saltos carrera carreras psc pura sangre lugar lugares sitio sitios mas menos " +
    "nuevo nuevos nueva nuevas reatendido reatendidos reatendida reatendidas repetido repetidos conocia conocias conocido conocidos antes primera primer").split(" "));

  const pad = (n) => String(n).padStart(2, "0");
  const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
  const finMes = (y, m) => new Date(y, m, 0).getDate();
  const fmt = (i) => i.split("-").reverse().join("/");
  const nMes = (s) => (s === "setiembre" ? 9 : MES.indexOf(s) + 1);
  const pl = (n, uno, muchos) => `${n} ${n === 1 ? uno : muchos}`;
  function sumar(f, dias) {
    const [y, m, d] = f.split("-").map(Number), t = new Date(y, m - 1, d + dias);
    return iso(t.getFullYear(), t.getMonth() + 1, t.getDate());
  }

  /* Busca el periodo en la pregunta (ya normalizada). Devuelve {desde, hasta, txt, resto} o null. */
  function periodo(q, hoy) {
    const [Y, M] = hoy.split("-").map(Number);
    const pasado = /\bano pasado\b/.test(q), este = /\beste ano\b/.test(q);
    // Un mes sin año es el mas reciente: en octubre, "diciembre" es el del año anterior
    const anioDe = (mes, dicho) => (dicho ? +dicho : pasado ? Y - 1 : este ? Y : mes > M ? Y - 1 : Y);
    const sinAnio = (s) => s.replace(/\b(?:de |del |en )?(?:el )?(?:ano pasado|este ano)\b/g, " ");
    let m;

    if ((m = q.match(/\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/))) {
      let y = m[3] ? +m[3] : Y; if (y < 100) y += 2000;
      const d = iso(y, +m[2], +m[1]);
      return { desde: d, hasta: d, txt: "el " + fmt(d), resto: q.replace(m[0], " ") };
    }
    if ((m = q.match(new RegExp(`\\b(\\d{1,2}) (?:de )?${RE_MES}\\b(?: (?:de |del )?(\\d{4}))?`)))) {
      const mes = nMes(m[2]), d = iso(anioDe(mes, m[3]), mes, +m[1]);
      return { desde: d, hasta: d, txt: "el " + fmt(d), resto: sinAnio(q.replace(m[0], " ")) };
    }
    const reMes = new RegExp(`\\b${RE_MES}\\b(?: (?:de |del )?(\\d{4}))?`, "g");
    const ms = [...q.matchAll(reMes)];
    if (ms.length) {
      const a = ms[0], b = ms[ms.length - 1], ma = nMes(a[1]), mb = nMes(b[1]);
      const yb = anioDe(mb, b[2]);
      const ya = a[2] ? +a[2] : ma > mb ? yb - 1 : yb;
      const txt = a === b ? `en ${MES[ma - 1]} de ${ya}` : `entre ${MES[ma - 1]}${ya !== yb ? " de " + ya : ""} y ${MES[mb - 1]} de ${yb}`;
      return { desde: iso(ya, ma, 1), hasta: iso(yb, mb, finMes(yb, mb)), txt, resto: sinAnio(q.replace(reMes, " ")) };
    }

    const [hy, hm, hd] = hoy.split("-").map(Number);
    const lunes = sumar(hoy, -((new Date(hy, hm - 1, hd).getDay() + 6) % 7));
    const mesAnt = M === 1 ? [Y - 1, 12] : [Y, M - 1];
    const relativos = [
      [/\b(?:la )?semana pasada\b/, () => [sumar(lunes, -7), sumar(lunes, -1), "la semana pasada"]],
      [/\b(?:el )?mes pasado\b/, () => [iso(mesAnt[0], mesAnt[1], 1), iso(mesAnt[0], mesAnt[1], finMes(mesAnt[0], mesAnt[1])), `en ${MES[mesAnt[1] - 1]} de ${mesAnt[0]}`]],
      [/\b(?:en |de |del )?(?:el )?ano pasado\b/, () => [iso(Y - 1, 1, 1), iso(Y - 1, 12, 31), "en " + (Y - 1)]],
      [/\bultim[oa]s (\d+) (dias?|semanas?|mes(?:es)?)\b/, (x) => {
        const n = +x[1] * (x[2][0] === "d" ? 1 : x[2][0] === "s" ? 7 : 30);
        return [sumar(hoy, -n), hoy, `en los últimos ${x[1]} ${x[2]}`];
      }],
      [/\bhoy\b/, () => [hoy, hoy, "hoy"]],
      [/\bayer\b/, () => [sumar(hoy, -1), sumar(hoy, -1), "ayer"]],
      [/\b(?:esta|en la) semana\b/, () => [lunes, sumar(lunes, 6), "esta semana"]],
      [/\b(?:este|en el|del) mes\b/, () => [iso(Y, M, 1), iso(Y, M, finMes(Y, M)), `en ${MES[M - 1]} de ${Y}`]],
      [/\b(?:en |de |del )?(?:todo )?(?:este|el|lo que va del) ano\b/, () => [iso(Y, 1, 1), iso(Y, 12, 31), "en " + Y]],
      [/\b(?:en |de |del |ano )?(20\d{2})\b/, (x) => [iso(+x[1], 1, 1), iso(+x[1], 12, 31), "en " + x[1]]],
    ];
    for (const [re, f] of relativos) {
      if ((m = q.match(re))) { const [desde, hasta, txt] = f(m); return { desde, hasta, txt, resto: q.replace(m[0], " ") }; }
    }
    return null;
  }

  /* "rampas" encuentra "rampa"; "severos" encuentra "severa". Siempre palabra entera: "pampa" no encuentra "pampero". */
  function reTermino(t) {
    if (/^\d+$/.test(t)) return new RegExp(`\\b${t}\\b`);
    const r = t.replace(/(?:os|as|es|o|a|e|s)$/, "");
    return new RegExp(`\\b${r.length >= 3 ? r : t}(?:os|as|es|o|a|e|s)?\\b`);
  }
  // Paciente = cliente + caballo (un cliente de polo mueve sus caballos entre lugares); sin cliente, lugar + caballo
  const clavePac = (v) => norm(v.cliente || v.establecimiento) + "|" + norm(v.caballo);
  const distintos = (l) => new Set(l.map(clavePac)).size;
  function agrupar(lista, etiqueta) {
    const g = new Map();
    for (const v of lista) { const k = etiqueta(v); if (!g.has(k)) g.set(k, []); g.get(k).push(v); }
    return [...g.entries()].map(([label, l]) => ({ label, n: distintos(l) }));
  }

  /* visitas: [{fecha, establecimiento, caballo, hallazgos, oclusion, proxima_accion, severidad, estado, disciplina, cliente}]
     hoy: "AAAA-MM-DD". Devuelve null si la pregunta esta vacia. */
  function responder(pregunta, visitas, hoy, disciplinas = Parser.DISCIPLINAS) {
    const q = norm(pregunta).replace(/[¿?¡!.,;:()"«»]/g, " ").replace(/\s+/g, " ").trim();
    if (!q) return null;
    const cuenta = /\bcuant[oa]s?\b/.test(q);
    const p = periodo(q, hoy);
    let resto = p ? p.resto : q;
    const sinDisc = /\bsin disciplina\b/.test(resto);
    // Disciplina: cualquiera de la lista (las fijas y las que agrego Miguel), en singular o plural
    let disciplina = "";
    if (!sinDisc) {
      const m = resto.match(/\b(?:psc|pura sangre(?: de carrera)?|sangre pura)\b/);
      if (m) { disciplina = "Carrera"; resto = resto.replace(m[0], " "); }
      else for (const d of disciplinas.filter((x) => x !== "Otra")) {
        const re = new RegExp(`\\b${norm(d).replace(/[^a-z0-9 ]/g, "")}(?:s|es)?\\b`);
        if (re.test(resto)) { disciplina = d; resto = resto.replace(re, " "); break; }
      }
    }
    const terminos = resto.replace(/[^a-z0-9 ]/g, " ").split(" ").filter((t) => t.length > 1 && !VACIAS.has(t));
    const res = terminos.map(reTermino);
    const texto = (v) => norm([v.caballo, v.establecimiento, v.cliente, v.hallazgos, v.oclusion, v.proxima_accion, /^(Severa|Moderada|Leve)$/.test(v.severidad) ? v.severidad : ""].join(" · "));

    // Las visitas programadas que todavia no llegaron no cuentan como atendidas
    const base = visitas.filter((v) => v.fecha && !(v.estado === "A confirmar" && v.fecha > hoy)
      && (!p || (v.fecha >= p.desde && v.fecha <= p.hasta)) && res.every((r) => r.test(texto(v))));
    // Nuevo = su primera visita registrada cae dentro del periodo; si no, ya lo conocia (reatendido)
    const primera = new Map();
    for (const v of visitas) {
      if (!v.fecha || (v.estado === "A confirmar" && v.fecha > hoy)) continue;
      const k = clavePac(v);
      if (!primera.has(k) || v.fecha < primera.get(k)) primera.set(k, v.fecha);
    }
    const soloNuevos = /\bnuev[oa]s?\b/.test(q), soloConocidos = /\b(reatendid|repetid|ya (?:los |las )?conoc|ya atendid)/.test(q);
    let lista = base.filter((v) => (sinDisc ? !v.disciplina : !disciplina || v.disciplina === disciplina));
    lista.forEach((v) => { v.nuevo = !!p && primera.get(clavePac(v)) >= p.desde; });
    if (p && soloNuevos) lista = lista.filter((v) => v.nuevo);
    if (p && soloConocidos) lista = lista.filter((v) => !v.nuevo);
    lista.sort((a, b) => b.fecha.localeCompare(a.fecha) || a.caballo.localeCompare(b.caballo, "es"));

    const C = distintos(lista), R = lista.length;
    const E = new Set(lista.map((v) => norm(v.establecimiento))).size;
    const tipo = p && soloNuevos ? " nuevos" : p && soloConocidos ? " que ya conocías" : "";
    const desc = (disciplina ? (disciplina === "Criollo" ? " criollos" : ` de ${disciplina.toLowerCase()}`) : sinDisc ? " sin disciplina cargada" : "")
      + (terminos.length ? ` que coinciden con «${terminos.join(" ")}»` : "") + (p ? " " + p.txt : "");
    const porCliente = agrupar(lista, (v) => v.cliente || v.establecimiento || "Sin cliente").sort((a, b) => b.n - a.n);
    let titular, detalle = "";
    if (!R) titular = `No encontré caballos${tipo}${desc}.`;
    else if (cuenta) {
      titular = `Atendiste ${pl(C, "caballo", "caballos")}${tipo}${desc}.`;
      detalle = `${R === 1 ? "Fue" : "Fueron"} ${pl(R, "revisión", "revisiones")} en ${pl(E, "establecimiento", "establecimientos")}.`;
      if (p && !soloNuevos && !soloConocidos) { const nu = distintos(lista.filter((v) => v.nuevo)); detalle += ` ${pl(nu, "era nuevo", "eran nuevos")} y ${C - nu} ya ${C - nu === 1 ? "lo" : "los"} habías atendido antes.`; }
      if (porCliente.length > 1) detalle += ` Donde más: ${porCliente[0].label} (${pl(porCliente[0].n, "caballo", "caballos")}).`;
      if (!p) detalle += soloNuevos || soloConocidos ? " Para separar nuevos de conocidos decime un período, por ejemplo «este año»." : " Cuenta todas las fechas cargadas.";
    } else if (C === 1) {
      const u = lista[0];
      titular = `Atendiste a ${u.caballo} (${u.establecimiento || "sin establecimiento"}) ${R === 1 ? "una vez" : R + " veces"}${p ? " " + p.txt : ""}.`;
      detalle = R === 1 ? `Fue el ${fmt(u.fecha)}.` : `La última fue el ${fmt(u.fecha)} y la primera el ${fmt(lista[R - 1].fecha)}.`;
    } else {
      const u = lista[0];
      titular = `Encontré ${pl(R, "revisión", "revisiones")} de ${pl(C, "caballo", "caballos")}${desc}.`;
      detalle = `La más reciente: ${fmt(u.fecha)}, ${u.caballo} (${u.establecimiento || "sin establecimiento"}).`;
    }

    const porMes = agrupar(lista, (v) => v.fecha.slice(0, 7)).sort((a, b) => a.label.localeCompare(b.label)).slice(-12)
      .map((x) => ({ label: `${MES_CORTO[+x.label.slice(5) - 1]} ${x.label.slice(0, 4)}`, n: x.n }));
    return {
      titular, detalle, cuenta, lista, terminos, disciplina, caballos: C,
      sinDisciplina: disciplina ? distintos(base.filter((v) => !v.disciplina)) : 0,
      sinRevisar: lista.filter((v) => !v.revisada).length,
      porCliente: porCliente.slice(0, 15),
      porEst: agrupar(lista, (v) => v.establecimiento || "Sin establecimiento").sort((a, b) => b.n - a.n).slice(0, 12),
      porDisc: disciplina || sinDisc ? [] : agrupar(lista, (v) => v.disciplina || "Sin definir").sort((a, b) => b.n - a.n),
      porMes: porMes.length > 1 ? porMes : [],
    };
  }

  /* Cuando no hay visitas que coincidan: busca las palabras renglon por renglon en todas las notas,
     con la ultima fecha que aparece arriba de cada renglon. */
  function buscarEnNotas(terminos, notas) {
    const res = terminos.map(reTermino), out = [];
    if (!res.length) return out;
    for (const n of notas) {
      if (n.estado === "papelera") continue;
      const anio = new Date(n.creada).getFullYear(), tit = norm(n.titulo);
      const lineas = n.tipo === "lista" ? n.items.map((i) => i.t) : n.texto.split(/\r?\n/);
      let f = "", alguna = false;
      for (const l of lineas) {
        const fe = Parser.fecha(l.trim(), anio);
        if (fe) { f = fe; continue; }
        const t = norm(l);
        if (t && res.some((r) => r.test(t)) && res.every((r) => r.test(t + " " + tit))) { out.push({ nota_id: n.id, titulo: n.titulo, fecha: f, linea: l.trim() }); alguna = true; }
      }
      if (!alguna && res.every((r) => r.test(tit))) out.push({ nota_id: n.id, titulo: n.titulo, fecha: "", linea: "" });
    }
    return out.sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 60);
  }

  return { responder, buscarEnNotas, periodo };
})();
