"use strict";
/* Importa respaldos de ColorNote (.backup / .dat) directamente en el telefono, sin internet.
   Formato: 28 bytes de cabecera + AES-128-CBC, clave = MD5(PIN + "ColorNote Fixed Salt"), IV en cero.
   El PIN por defecto de ColorNote es "0000". Adentro hay tablas: [id u32][cantidad u32] y
   registros [largo u32][JSON]. */
const ColorNote = (() => {
  // MD5 (RFC 1321). WebCrypto no lo incluye.
  function md5(bytes) {
    const K = new Uint32Array(64), S = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
    for (let i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) >>> 0;
    const len = bytes.length, nblk = ((len + 8) >>> 6) + 1;
    const w = new Uint32Array(nblk * 16);
    for (let i = 0; i < len; i++) w[i >> 2] |= bytes[i] << ((i % 4) * 8);
    w[len >> 2] |= 0x80 << ((len % 4) * 8);
    w[nblk * 16 - 2] = (len * 8) >>> 0;
    w[nblk * 16 - 1] = Math.floor(len / 0x20000000);
    let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
    for (let o = 0; o < w.length; o += 16) {
      let a = a0, b = b0, c = c0, d = d0;
      for (let i = 0; i < 64; i++) {
        let f, g;
        if (i < 16) { f = (b & c) | (~b & d); g = i; }
        else if (i < 32) { f = (d & b) | (~d & c); g = (5 * i + 1) % 16; }
        else if (i < 48) { f = b ^ c ^ d; g = (3 * i + 5) % 16; }
        else { f = c ^ (b | ~d); g = (7 * i) % 16; }
        const s = S[(i >> 4) * 4 + (i % 4)];
        const t = d; d = c; c = b;
        const x = (a + f + K[i] + w[o + g]) >>> 0;
        b = (b + ((x << s) | (x >>> (32 - s)))) >>> 0;
        a = t;
      }
      a0 = (a0 + a) >>> 0; b0 = (b0 + b) >>> 0; c0 = (c0 + c) >>> 0; d0 = (d0 + d) >>> 0;
    }
    const out = new Uint8Array(16), dv = new DataView(out.buffer);
    [a0, b0, c0, d0].forEach((v, i) => dv.setUint32(i * 4, v, true));
    return out;
  }
  const concat = (a, b) => { const r = new Uint8Array(a.length + b.length); r.set(a); r.set(b, a.length); return r; };

  async function descifrar(buffer, pin) {
    const bytes = new Uint8Array(buffer);
    if (bytes.length < 60) throw new Error("El archivo es demasiado chico para ser un respaldo de ColorNote.");
    const enc = new TextEncoder();
    const clave = md5(concat(enc.encode(pin), enc.encode("ColorNote Fixed Salt")));
    let cuerpo = bytes.subarray(28);
    cuerpo = cuerpo.subarray(0, cuerpo.length - (cuerpo.length % 16));
    const k = await crypto.subtle.importKey("raw", clave, { name: "AES-CBC" }, false, ["encrypt", "decrypt"]);
    // WebCrypto exige relleno PKCS7 valido al final. Agregamos un bloque fabricado para que
    // el ultimo bloque descifre a 16 bytes de relleno y el resto quede intacto.
    const ultimo = cuerpo.subarray(cuerpo.length - 16);
    const extra = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-CBC", iv: ultimo }, k, new Uint8Array(16).fill(16))).subarray(0, 16);
    const plano = await crypto.subtle.decrypt({ name: "AES-CBC", iv: new Uint8Array(16) }, k, concat(cuerpo, extra));
    return new Uint8Array(plano);
  }

  function leerTablas(u8) {
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    const dec = new TextDecoder();
    const registros = [];
    let i = 0;
    while (i + 8 <= u8.length) {
      const cant = dv.getUint32(i + 4);
      i += 8;
      if (cant > 1000000) break;
      for (let r = 0; r < cant; r++) {
        if (i + 4 > u8.length) return registros;
        const largo = dv.getUint32(i);
        i += 4;
        if (i + largo > u8.length) return registros;
        try { registros.push(JSON.parse(dec.decode(u8.subarray(i, i + largo)))); } catch (e) {}
        i += largo;
      }
    }
    return registros;
  }

  // Orden de colores de ColorNote (color_index 1..9). Verificar con un respaldo real.
  const COLORES = ["rojo", "naranja", "amarillo", "verde", "azul", "violeta", "negro", "gris", "blanco"];
  const fechaISO = (ms) => { const d = new Date(ms); return isNaN(d) ? "" : new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };

  function aNota(o) {
    const esLista = o.type === 16 || o.note_type === 16;
    let texto = String(o.note || ""), items = [];
    if (esLista) {
      items = texto.split(/\r?\n/).filter((l) => l.trim()).map((l) => {
        const m = l.match(/^\[(V|v|X|x| )\]\s?(.*)$/);
        return m ? { t: m[2], ok: m[1] !== " " } : { t: l, ok: false };
      });
      texto = "";
    }
    const creada = +o.created_date || Date.now();
    return {
      id: "cn-" + (o._id ?? Math.random().toString(36).slice(2)),
      origen: "colornote",
      tipo: esLista ? "lista" : "texto",
      titulo: String(o.title || ""),
      texto, items,
      color: COLORES[(o.color_index | 0) - 1] || "amarillo",
      fecha: +o.reminder_date > 0 ? fechaISO(+o.reminder_date) : "",
      fijada: false,
      // space: 16 = archivo, 32 = papelera; active_state distinto de 0 = borrada. Verificar con un respaldo real.
      estado: o.space === 32 || +o.active_state > 0 ? "papelera" : o.space === 16 ? "archivada" : "activa",
      creada,
      modificada: +o.modified_date || creada,
    };
  }

  /* Devuelve las notas listas para guardar. Lanza error con mensaje en castellano si falla. */
  async function importar(buffer, pin) {
    let plano;
    try { plano = await descifrar(buffer, pin || "0000"); }
    catch (e) { throw new Error(e.message && /chico/.test(e.message) ? e.message : "No se pudo descifrar el archivo."); }
    const notas = leerTablas(plano).filter((o) => o && !o.auth_token && ("note" in o || "title" in o)).map(aNota);
    if (!notas.length) throw new Error("No encontré notas. Revisá el PIN de ColorNote (si nunca pusiste uno, es 0000).");
    return notas;
  }

  return { importar, md5 };
})();
