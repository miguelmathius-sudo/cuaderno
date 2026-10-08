"use strict";
/* Almacenamiento local: IndexedDB en el propio telefono, con cifrado opcional por PIN.
   Nada de esto se envia a ningun servidor. */
const Store = (() => {
  const DB = "cuaderno", ST = "kv", KEY = "estado";
  const enc = new TextEncoder(), dec = new TextDecoder();
  let dbp = null, clave = null, sal = null, cerrado = false;

  function abrir() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(ST);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return dbp;
  }
  async function leer(k) {
    const db = await abrir();
    return new Promise((res, rej) => {
      const q = db.transaction(ST).objectStore(ST).get(k);
      q.onsuccess = () => res(q.result);
      q.onerror = () => rej(q.error);
    });
  }
  async function escribir(k, v) {
    const db = await abrir();
    return new Promise((res, rej) => {
      const tx = db.transaction(ST, "readwrite");
      tx.objectStore(ST).put(v, k);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  }

  function b64e(u8) {
    let s = "";
    for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function b64d(s) {
    const b = atob(s), u8 = new Uint8Array(b.length);
    for (let i = 0; i < b.length; i++) u8[i] = b.charCodeAt(i);
    return u8;
  }
  async function derivar(pin, salt) {
    const base = await crypto.subtle.importKey("raw", enc.encode(pin), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 250000, hash: "SHA-256" }, base,
      { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  }

  /* Devuelve {estado} si esta en claro, o {bloqueado:true} si hace falta el PIN. */
  async function cargar() {
    const v = await leer(KEY);
    if (!v) return { estado: null };
    if (v.cifrado) { cerrado = true; return { bloqueado: true }; }
    return { estado: v.datos };
  }
  /* Lanza error si el PIN es incorrecto. */
  async function desbloquear(pin) {
    const v = await leer(KEY);
    const salt = b64d(v.salt);
    const k = await derivar(pin, salt);
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64d(v.iv) }, k, b64d(v.datos));
    clave = k; sal = salt; cerrado = false;
    return JSON.parse(dec.decode(pt));
  }
  async function guardar(estado) {
    // Con la app bloqueada nunca se escribe: evitaria pisar los datos cifrados con datos en claro
    if (cerrado) return;
    if (clave) {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, clave, enc.encode(JSON.stringify(estado)));
      await escribir(KEY, { cifrado: true, v: 1, salt: b64e(sal), iv: b64e(iv), datos: b64e(new Uint8Array(ct)) });
    } else {
      await escribir(KEY, { cifrado: false, v: 1, datos: estado });
    }
  }
  async function ponerPin(pin, estado) {
    sal = crypto.getRandomValues(new Uint8Array(16));
    clave = await derivar(pin, sal);
    await guardar(estado);
  }
  async function quitarPin(estado) {
    clave = null; sal = null;
    await guardar(estado);
  }
  /* Olvida la clave en memoria: la proxima lectura pide el PIN otra vez. */
  function bloquear() { if (clave) { clave = null; sal = null; cerrado = true; } }
  const tienePin = () => !!clave;

  async function persistente() {
    try {
      if (navigator.storage && navigator.storage.persist) {
        if (await navigator.storage.persisted()) return true;
        return await navigator.storage.persist();
      }
    } catch (e) {}
    return false;
  }

  return { cargar, desbloquear, guardar, ponerPin, quitarPin, bloquear, tienePin, persistente };
})();
