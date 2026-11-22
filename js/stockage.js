/* Stockage des données de la semaine (panier, menus, cases cochées, notes).
   Tout est écrit d'abord sur le téléphone (localStorage), puis envoyé à Supabase dès que le réseau le permet.
   Une donnée = une clé. Deux personnes qui cochent des lignes différentes ne s'écrasent jamais. */
(function () {
  'use strict';
  const CFG = globalThis.MENUS_CONFIG || {};
  const K_CACHE = 'menus:cache', K_FILE = 'menus:file', K_MDP = 'menus:mdp', K_QUI = 'menus:qui';
  let cache = { kv: {}, curseur: null };
  let file = [];
  let statut = 'local';
  const ecouteurs = new Set();
  let minuterie = null, enCours = false;

  function lireLS(k, def) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch (e) { return def; } }
  function ecrireLS(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* stockage plein ou privé */ } }

  function configure() { return !!(CFG.supabaseUrl && CFG.supabaseKey); }
  function mdp() { return CFG.acces || lireLS(K_MDP, null); }

  async function rpc(nom, corps) {
    const r = await fetch(CFG.supabaseUrl.replace(/\/$/, '') + '/rest/v1/rpc/' + nom, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: CFG.supabaseKey, Authorization: 'Bearer ' + CFG.supabaseKey },
      body: JSON.stringify(corps)
    });
    if (!r.ok) {
      const t = await r.text();
      const e = new Error(t); e.mdp = /mot de passe/i.test(t); throw e;
    }
    return r.status === 204 ? null : r.json();
  }

  function notifier(cles) { for (const f of ecouteurs) try { f(cles); } catch (e) { console.error(e); } }
  function changerStatut(s) { if (s !== statut) { statut = s; notifier(['__statut']); } }

  async function synchroniser() {
    if (!configure() || !mdp() || enCours) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) { changerStatut('hors ligne'); return; }
    enCours = true;
    try {
      // 1. Envoyer ce qui attend
      while (file.length) {
        const lot = file.slice(0, 50);
        await rpc('kv_ecrire', { mdp: mdp(), entrees: lot.map(x => ({ cle: x.cle, valeur: x.valeur })), par: lireLS(K_QUI, null) });
        file.splice(0, lot.length); ecrireLS(K_FILE, file);
      }
      // 2. Recevoir ce qui a changé
      const lignes = await rpc('kv_lire', { mdp: mdp(), depuis: cache.curseur });
      const changees = [];
      for (const l of lignes || []) {
        if (file.some(x => x.cle === l.cle)) continue; // une écriture locale plus récente attend
        const avant = cache.kv[l.cle];
        if (!avant || avant.maj !== l.maj) { cache.kv[l.cle] = { v: l.valeur, maj: l.maj }; changees.push(l.cle); }
        if (!cache.curseur || l.maj > cache.curseur) cache.curseur = l.maj;
      }
      ecrireLS(K_CACHE, cache);
      changerStatut('ok');
      if (changees.length) notifier(changees);
    } catch (e) {
      console.warn('synchro', e);
      changerStatut(e.mdp ? 'mot de passe' : 'hors ligne');
    } finally { enCours = false; }
  }

  function planifier(delai) { clearTimeout(minuterie); minuterie = setTimeout(synchroniser, delai); }

  const Stockage = {
    init() {
      cache = lireLS(K_CACHE, { kv: {}, curseur: null });
      file = lireLS(K_FILE, []);
      statut = configure() ? (mdp() ? 'hors ligne' : 'mot de passe') : 'local';
      // Données saisies en mode local avant le branchement du partage : on les envoie une fois.
      if (configure()) {
        for (const [cle, x] of Object.entries(cache.kv)) if (x.maj == null && x.v != null && !file.some(f => f.cle === cle)) file.push({ cle, valeur: x.v });
        ecrireLS(K_FILE, file);
      }
      if (typeof window !== 'undefined') {
        window.addEventListener('online', () => synchroniser());
        document.addEventListener('visibilitychange', () => { if (!document.hidden) synchroniser(); });
        setInterval(() => { if (!document.hidden) synchroniser(); }, 15000);
      }
      return synchroniser();
    },
    configure, statut: () => statut, enAttente: () => file.length,
    get(cle, def) { const x = cache.kv[cle]; return x && x.v != null ? x.v : def; },
    cles(prefixe) { return Object.keys(cache.kv).filter(k => k.startsWith(prefixe) && cache.kv[k].v != null); },
    set(cle, valeur) {
      cache.kv[cle] = { v: valeur, maj: (cache.kv[cle] && cache.kv[cle].maj) || null };
      ecrireLS(K_CACHE, cache);
      if (configure()) { file = file.filter(x => x.cle !== cle); file.push({ cle, valeur }); ecrireLS(K_FILE, file); planifier(400); }
      notifier([cle]);
    },
    ecouter(f) { ecouteurs.add(f); return () => ecouteurs.delete(f); },
    async connexion(motDePasse, qui) {
      if (!configure()) return true;
      const ok = await rpc('kv_verifier', { mdp: motDePasse });
      if (!ok) return false;
      ecrireLS(K_MDP, motDePasse); if (qui) ecrireLS(K_QUI, qui);
      cache.curseur = null; await synchroniser(); return true;
    },
    qui: () => lireLS(K_QUI, null),
    setQui(q) { ecrireLS(K_QUI, q); },
    deconnexion() { try { localStorage.removeItem(K_MDP); } catch (e) {} changerStatut('mot de passe'); },
    synchroniser,
    exporter() { const out = {}; for (const [k, x] of Object.entries(cache.kv)) if (x.v != null) out[k] = x.v; return { exporte: new Date().toISOString(), donnees: out }; },
    importer(obj) { for (const [k, v] of Object.entries(obj.donnees || {})) Stockage.set(k, v); }
  };
  globalThis.Stockage = Stockage;
})();
