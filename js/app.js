/* Interface de l'appli Menus. Pas d'IA ici : les recettes viennent de recettes.json (le dépôt),
   la semaine, les courses et les notes viennent de Stockage. */
(function () {
  'use strict';
  const M = globalThis.Moteur, S = globalThis.Stockage;
  const $ = (s, el) => (el || document).querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const FAMILLE = ['Etienne', 'Marie', 'Emma', 'Diego', 'Billie'];
  const STATUTS = { validee: 'Validée', a_valider: 'À valider', a_tester: 'À tester', petite_folie: 'Petite folie', ecartee: 'Écartée' };
  const LEGUMES_BASE = ['carotte', 'pomme de terre', 'oignon', 'poireau', 'courgette', 'tomate', 'salade', 'mâche', 'épinards', 'blettes', 'chou frisé', 'chou blanc', 'chou rouge', 'chou chinois', 'chou-fleur', 'brocoli', 'potimarron', 'butternut', 'courge', 'panais', 'navet', 'patates douces', 'betterave', 'céleri-rave', 'radis', 'radis noir', 'topinambour', 'fenouil', 'endive', 'champignons', 'poivron', 'concombre', 'haricots verts', 'petits pois', 'ail', 'échalote', 'persil', 'coriandre', 'pommes', 'poires', 'kiwis'];

  let RECETTES = [], PAR_ID = {};
  const ui = { ecran: 'semaine', semaine: M.semaineParDefaut(M.ymd(new Date())), magasin: 'auchan', filtre: 'tous', recherche: '' };
  const aujourdhui = () => M.ymd(new Date());

  // ---------- Données ----------
  function semaines() { return S.cles('semaine:').map(k => S.get(k)).filter(Boolean).map(M.completer); }
  function semaine(debut) {
    debut = debut || ui.semaine;
    const s = S.get('semaine:' + debut);
    if (s) return M.completer(s);
    const v = M.semaineVide(debut);
    const auj = aujourdhui();
    if (auj > debut && auj <= M.ajouterJours(debut, 7)) { v.coursesDepuis = auj; v.supercoop = auj; }
    return v;
  }
  function enregistrer(s) { S.set('semaine:' + s.debut, s); }
  function reglages() { const r = S.get('reglages', {}); M.setRecence(r.recenceJours || 14); return r; }
  function recette(id) { return PAR_ID[id]; }
  function hist() { reglages(); return M.historique(RECETTES, semaines()); }
  function qui() { return S.qui() || ''; }

  // ---------- Petits composants ----------
  function toast(t) {
    const el = $('#toast'); el.textContent = t; el.classList.add('on');
    clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('on'), 2200);
  }
  function feuille(html, opts) {
    fermerFeuille();
    const f = document.createElement('div'); f.className = 'feuille-fond';
    f.innerHTML = `<div class="feuille ${opts && opts.grande ? 'grande' : ''}" role="dialog"><div class="poignee"></div>${html}</div>`;
    f.addEventListener('click', e => { if (e.target === f) fermerFeuille(); });
    document.body.appendChild(f); document.body.classList.add('fige');
    return f.firstElementChild;
  }
  function fermerFeuille() { document.querySelectorAll('.feuille-fond').forEach(x => x.remove()); document.body.classList.remove('fige'); }
  async function copier(texte) {
    try { await navigator.clipboard.writeText(texte); toast('Copié'); }
    catch (e) { const t = document.createElement('textarea'); t.value = texte; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); toast('Copié'); }
  }
  function badgeStatut(r) { return `<span class="badge st-${r.statut}">${STATUTS[r.statut] || r.statut}</span>`; }
  function sg(r) { const s = r.sans_gluten && r.sans_gluten.statut; return s === 'naturel' ? '<span class="badge sg">Sans gluten</span>' : s === 'adaptable' ? '<span class="badge sg2">SG adaptable</span>' : ''; }
  function dureeTxt(m) { if (m == null) return 'durée ?'; if (m < 60) return m + ' min'; const h = Math.floor(m / 60), r = m % 60; return h + ' h' + (r ? ' ' + String(r).padStart(2, '0') : ''); }
  function dateFr(s) { if (!s) return ''; const d = M.parse(s); return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined }); }
  const ICONES = {
    semaine: '<svg viewBox="0 0 24 24"><rect x="3" y="4.5" width="18" height="16" rx="3"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/></svg>',
    courses: '<svg viewBox="0 0 24 24"><path d="M5 7h14l-1.3 10.2a2 2 0 0 1-2 1.8H8.3a2 2 0 0 1-2-1.8z"/><path d="M9 7a3 3 0 0 1 6 0"/></svg>',
    recettes: '<svg viewBox="0 0 24 24"><path d="M6 3h11a2 2 0 0 1 2 2v16l-3-2-3 2-3-2-3 2V4a1 1 0 0 1 1-1z"/><path d="M9 8h6M9 12h6"/></svg>',
    plus: '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>'
  };

  // ---------- Navigation ----------
  function aller(ecran) { ui.ecran = ecran; rendre(); window.scrollTo(0, 0); }
  function rendre() {
    document.querySelectorAll('.nav button').forEach(b => b.classList.toggle('active', b.dataset.e === ui.ecran));
    const main = $('#main');
    if (S.configure() && S.statut() === 'mot de passe') { main.innerHTML = ecranConnexion(); return lierConnexion(); }
    if (!qui()) { main.innerHTML = ecranQui(); return lierQui(); }
    ({ semaine: ecranSemaine, courses: ecranCourses, recettes: ecranRecettes, plus: ecranPlus })[ui.ecran]();
    majStatut();
  }
  function majStatut() {
    const el = $('#synchro'); if (!el) return;
    const st = S.statut(), n = S.enAttente();
    el.className = 'synchro s-' + st.replace(' ', '-');
    el.textContent = st === 'ok' ? (n ? n + ' en attente' : 'à jour') : st === 'local' ? 'sur ce téléphone' : st === 'hors ligne' ? 'hors ligne' + (n ? ', ' + n + ' en attente' : '') : 'mot de passe';
  }

  // ---------- Qui es-tu ? ----------
  function ecranQui() {
    return `<div class="connexion"><h1>Menus</h1><p class="sub">Les repas de la famille</p>
      <div class="kick" style="margin:24px 0 10px">Qui es-tu ?</div>
      <div class="puces" id="qui">${FAMILLE.map(p => `<button class="puce" data-p="${p}">${p}</button>`).join('')}</div></div>`;
  }
  function lierQui() {
    $('#qui').onclick = e => { const b = e.target.closest('.puce'); if (!b) return; S.setQui(b.dataset.p); S.synchroniser(); rendre(); };
  }

  // ---------- Connexion ----------
  function ecranConnexion() {
    return `<div class="connexion"><h1>Menus</h1><p class="sub">Les repas de la famille</p>
      <label class="champ">Mot de passe famille<input id="mdp" type="password" autocomplete="current-password"></label>
      <div class="kick" style="margin:14px 0 8px">Qui es-tu ?</div>
      <div class="puces" id="qui">${FAMILLE.map(p => `<button class="puce ${qui() === p ? 'on' : ''}" data-p="${p}">${p}</button>`).join('')}</div>
      <button class="btn plein" id="entrer" style="margin-top:20px;width:100%">Entrer</button><p class="erreur" id="err"></p></div>`;
  }
  function lierConnexion() {
    let choix = qui();
    $('#qui').onclick = e => { const b = e.target.closest('.puce'); if (!b) return; choix = b.dataset.p; document.querySelectorAll('#qui .puce').forEach(x => x.classList.toggle('on', x === b)); };
    $('#entrer').onclick = async () => {
      $('#err').textContent = '';
      try { const ok = await S.connexion($('#mdp').value, choix); if (!ok) $('#err').textContent = 'Mot de passe incorrect.'; else rendre(); }
      catch (e) { $('#err').textContent = 'Impossible de joindre le serveur. Réessaie avec du réseau.'; }
    };
  }

  // ---------- Écran Semaine ----------
  function ecranSemaine() {
    const s = semaine(); const auj = aujourdhui();
    const b = M.bilan(RECETTES, s);
    const vide = M.CRENEAUX.every(c => !M.effectif(s.creneaux[c.cle]));
    const h = hist();
    $('#main').innerHTML = `
      <div class="hdr"><div><div class="kick">Semaine du</div><h1>${esc(M.dateCourte(s.debut))}</h1></div>
        <div class="fleches"><button class="ib" data-a="prec" aria-label="Semaine précédente">‹</button><button class="ib" data-a="suiv" aria-label="Semaine suivante">›</button></div></div>
      <section class="carte panier" data-a="panier">
        <div class="ligne-titre"><h3>Panier AMAP et frigo</h3><span class="lien">Modifier</span></div>
        ${s.panier.length ? `<div class="puces petites">${s.panier.map(p => `<span class="puce on">${p.photo ? '📷 ' : ''}${esc(p.nom)}</span>`).join('')}</div>` : '<p class="vide">Rien de saisi. Touche pour cocher les légumes du panier.</p>'}
        ${s.restes ? `<p class="restes">Restes : ${esc(s.restes)}</p>` : ''}
        <p class="petit">Supercoop : <b>${esc(M.dateCourte(s.supercoop))}</b>${s.supercoop2 ? ` puis <b>${esc(M.dateCourte(s.supercoop2))}</b>` : ''}</p>
      </section>
      <div class="actions-menu">
        <button class="btn plein" data-a="proposer">${vide ? 'Proposer le menu' : 'Relancer le menu (sauf 🔒)'}</button>
      </div>
      ${s.manques && s.manques.length ? blocManques(s) : ''}
      ${Object.keys(s.assouplir || {}).length ? `<p class="petit">Assoupli cette semaine : ${Object.keys(s.assouplir).map(k => esc(M.REGLES_DURES[k].toLowerCase())).join(', ')}. <a data-a="durcir">Rétablir</a></p>` : ''}
      ${b.length && !vide ? `<div class="bilan">${b.map(x => `<div>• ${esc(x)}</div>`).join('')}</div>` : ''}
      <div class="creneaux">${M.CRENEAUX.map(c => carteCreneau(s, c, auj, h)).join('')}</div>
      <p class="petit centre">Proposé par règles, sans IA. Les créneaux verrouillés ou corrigés ne bougent pas quand on relance.</p>`;
    $('#main').onclick = e => {
      const a = e.target.closest('[data-a]'); if (!a) return;
      const act = a.dataset.a;
      if (act === 'prec') { ui.semaine = M.ajouterJours(ui.semaine, -7); rendre(); }
      else if (act === 'suiv') { ui.semaine = M.ajouterJours(ui.semaine, 7); rendre(); }
      else if (act === 'panier') feuillePanier();
      else if (act === 'proposer') proposer();
      else if (act === 'creneau') feuilleCreneau(a.dataset.c);
      else if (act === 'voir') ouvrirRecette(a.dataset.r);
      else if (act === 'durcir') { const s2 = semaine(); s2.assouplir = {}; s2.manques = []; enregistrer(s2); rendre(); }
      else if (act === 'assouplir') { const s2 = semaine(); s2.assouplir = { ...(s2.assouplir || {}), [a.dataset.r]: true }; enregistrer(s2); proposer(); }
    };
  }
  function blocManques(s) {
    const deja = s.assouplir || {};
    const regles = Object.entries(M.REGLES_DURES).filter(([k]) => !deja[k]);
    return `<div class="alerte"><b>${s.manques.length} créneau${s.manques.length > 1 ? 'x' : ''} sans recette possible.</b>
      ${!RECETTES.some(r => r.statut === 'validee') ? '<p>Aucune fiche n\'est encore « validée » : il faut d\'abord autoriser les fiches à valider.</p>' : '<p>Les règles éliminent trop de recettes. Laquelle assouplir pour cette semaine ?</p>'}
      <div class="puces">${regles.map(([k, t]) => `<button class="puce" data-a="assouplir" data-r="${k}">Assouplir : ${esc(t)}</button>`).join('')}</div>
      <p class="petit">Aucun plat n'est inventé pour combler un trou.</p></div>`;
  }
  function carteCreneau(s, c, auj, h) {
    const cr = s.creneaux[c.cle]; const e = M.effectif(cr); const date = M.dateCreneau(s.debut, c.cle);
    const passe = date < auj, ajd = date === auj;
    let corps;
    if (!e) corps = `<div class="plat vide">${passe ? 'Passé, rien de noté' : 'Libre'}</div>${c.note ? `<div class="raison">${esc(c.note)}</div>` : ''}`;
    else if (e.type === 'annule') corps = `<div class="plat barre">Repas annulé</div>`;
    else if (e.type === 'libre') corps = `<div class="plat">${esc(e.texte)}</div><div class="raison">Mangé autre chose${cr.prevu && cr.prevu.recette ? ' (prévu : ' + esc((recette(cr.prevu.recette) || {}).nom || '?') + ')' : ''}</div>`;
    else {
      const r = recette(e.recette);
      if (!r) corps = `<div class="plat">Recette ${esc(e.recette)} introuvable</div>`;
      else {
        const marie = c.soir && r.marie && r.marie.soir ? `<div class="marie">Marie : ${esc(r.marie.soir)}</div>` : '';
        const mSG = r.marie && (r.marie.ajouter || []).length ? `<div class="marie">Marie (sans gluten) : ${esc(r.marie.texte || '')}</div>` : '';
        const et = r.etienne ? `<div class="marie">Etienne : ${esc(r.etienne.texte)}</div>` : '';
        corps = `<div class="plat" data-a="voir" data-r="${r.id}">${esc(r.nom)}</div>
          <div class="raison">${e.corrige ? 'Corrigé' + (cr.prevu && cr.prevu.recette && cr.prevu.recette !== r.id ? ' (prévu : ' + esc((recette(cr.prevu.recette) || {}).nom || '?') + ')' : '') : esc(cr.prevu && cr.prevu.raison || '')}</div>
          ${mSG}${marie}${et}
          ${r.veille ? '<div class="warn">À lancer la veille (' + dureeTxt(r.duree_min) + ' de cuisson)</div>' : ''}
          ${!M.aIngredients(r) ? '<div class="warn">Pas d\'ingrédients : absent des listes de courses</div>' : ''}
          ${r.statut !== 'validee' ? `<div class="tags">${badgeStatut(r)}</div>` : ''}`;
      }
    }
    // Toute la carte est cliquable : la fiche si c'est une recette, sinon les actions du créneau.
    const cible = e && e.type === 'recette' && recette(e.recette) ? `data-a="voir" data-r="${e.recette}"` : `data-a="creneau" data-c="${c.cle}"`;
    return `<div class="creneau ${passe ? 'passe' : ''} ${ajd ? 'ajd' : ''} ${cr.verrou ? 'verrou' : ''}" ${cible}>
      <div class="cr-tete"><span class="cr-label">${c.label}</span><span class="cr-date">${ajd ? 'aujourd\'hui' : M.parse(date).getDate() + '/' + (M.parse(date).getMonth() + 1)}</span>
      ${cr.verrou ? '<span class="cadenas" title="Verrouillé">🔒</span>' : ''}<button class="ib petit-btn" data-a="creneau" data-c="${c.cle}" aria-label="Modifier">•••</button></div>${corps}</div>`;
  }

  function proposer() {
    reglages();
    const s = semaine(); const auj = aujourdhui();
    const passer = M.CRENEAUX.filter(c => M.dateCreneau(s.debut, c.cle) < auj && !M.effectif(s.creneaux[c.cle])).map(c => c.cle);
    s.graine = (s.graine || 0) + 1;
    const p = M.proposer(RECETTES, semaines(), s, { assouplir: s.assouplir, aujourdhui: auj, passer });
    s.creneaux = M.fusion(s, p.creneaux);
    s.manques = p.manques;
    enregistrer(s); rendre();
    toast(p.manques.length ? p.manques.length + ' créneau(x) sans recette possible' : 'Menu proposé');
  }

  // ---------- Panier ----------
  function feuillePanier() {
    const s = semaine();
    const connus = [...new Set([...LEGUMES_BASE, ...S.get('legumes', [])])].sort((a, b) => a.localeCompare(b, 'fr'));
    const dans = new Set(s.panier.map(p => M.norm(p.nom)));
    const jours = []; for (let i = 0; i <= 7; i++) jours.push(M.ajouterJours(s.debut, i));
    const f = feuille(`<h2>Panier et frigo</h2>
      <p class="petit">Coche ce qu'il y a dans le panier AMAP. Les légumes saisis une fois restent dans la liste.</p>
      <div class="puces" id="leg">${connus.map(n => `<button class="puce ${dans.has(M.norm(n)) ? 'on' : ''}" data-n="${esc(n)}">${esc(n)}</button>`).join('')}</div>
      <div class="ajout"><input id="nouveau" placeholder="Autre (légume, tartinade, compote…)"><button class="btn" id="ajouter">Ajouter</button></div>
      <label class="photo-btn">📷 Photo du panier<input type="file" accept="image/*" id="photo" hidden></label>
      <div id="photos">${s.panier.filter(p => p.photo).map(p => `<span class="puce on">📷 ${esc(p.nom)}</span>`).join('')}</div>
      <label class="champ">Restes du frigo<textarea id="restes" rows="2" placeholder="Ex. un fond de riz, 3 carottes">${esc(s.restes || '')}</textarea></label>
      <label class="champ">Passage à Supercoop<select id="supercoop">${jours.map(j => `<option value="${j}" ${j === s.supercoop ? 'selected' : ''}>${M.dateCourte(j)}</option>`).join('')}</select></label>
      <p class="petit">Les repas avant ce jour prennent leurs produits frais sur la liste Auchan.</p>
      <label class="champ">Second passage à Supercoop (facultatif)<select id="supercoop2"><option value="">Pas de second passage</option>${jours.slice(1).map(j => `<option value="${j}" ${j === s.supercoop2 ? 'selected' : ''}>${M.dateCourte(j)}</option>`).join('')}</select></label>
      <p class="petit">Les produits frais (légumes, crèmerie, viande, poisson) des repas à partir de ce jour sont mis de côté pour ce second passage, pour une meilleure fraîcheur.</p>
      <button class="btn plein" id="ok" style="width:100%;margin-top:10px">Enregistrer</button>`, { grande: true });
    const sel = new Map(s.panier.map(p => [M.norm(p.nom), p]));
    f.querySelector('#leg').onclick = e => {
      const b = e.target.closest('.puce'); if (!b) return;
      const n = b.dataset.n, k = M.norm(n);
      if (sel.has(k)) { sel.delete(k); b.classList.remove('on'); } else { sel.set(k, { nom: n }); b.classList.add('on'); }
    };
    const ajouter = () => {
      const v = f.querySelector('#nouveau').value.trim(); if (!v) return;
      sel.set(M.norm(v), { nom: v, legume: estLegume(v) });
      const b = document.createElement('button'); b.className = 'puce on'; b.dataset.n = v; b.textContent = v; f.querySelector('#leg').prepend(b);
      f.querySelector('#nouveau').value = '';
      if (estLegume(v)) S.set('legumes', [...new Set([...S.get('legumes', []), v])]);
    };
    f.querySelector('#ajouter').onclick = ajouter;
    f.querySelector('#nouveau').onkeydown = e => { if (e.key === 'Enter') ajouter(); };
    f.querySelector('#photo').onchange = async e => {
      const fichier = e.target.files[0]; if (!fichier) return;
      const nom = prompt('Ce que montre la photo (ex. « chou frisé », « tartinade betterave ») :', ''); if (!nom) return;
      const data = await reduire(fichier, 900);
      const id = 'photo:' + Date.now().toString(36);
      S.set(id, data);
      sel.set(M.norm(nom), { nom, photo: id, legume: estLegume(nom) });
      f.querySelector('#photos').insertAdjacentHTML('beforeend', `<span class="puce on">📷 ${esc(nom)}</span>`);
      if (estLegume(nom)) S.set('legumes', [...new Set([...S.get('legumes', []), nom])]);
    };
    f.querySelector('#ok').onclick = () => {
      const s2 = semaine(); s2.panier = [...sel.values()]; s2.restes = f.querySelector('#restes').value.trim(); s2.supercoop = f.querySelector('#supercoop').value; s2.supercoop2 = f.querySelector('#supercoop2').value || null;
      enregistrer(s2); fermerFeuille(); rendre();
    };
  }
  function estLegume(n) { return !/tartinade|compote|confiture|jus|soupe|pain|fromage|yaourt|œuf|oeuf|miel|sirop|pâté|terrine/i.test(n); }
  function reduire(fichier, max) {
    return new Promise((ok, ko) => {
      const img = new Image(); const url = URL.createObjectURL(fichier);
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
        ok(c.toDataURL('image/jpeg', 0.72));
      };
      img.onerror = ko; img.src = url;
    });
  }

  // ---------- Actions sur un créneau ----------
  function feuilleCreneau(cle) {
    const s = semaine(); const c = M.CRENEAUX.find(x => x.cle === cle); const cr = s.creneaux[cle];
    const e = M.effectif(cr); const date = M.dateCreneau(s.debut, cle); const passeOuAjd = date <= aujourdhui();
    const f = feuille(`<h2>${c.label}</h2><p class="petit">${M.dateCourte(date)}${c.note ? ' · ' + esc(c.note) : ''}</p>
      <div class="liste-actions">
        <button data-x="remplacer">↻ ${e ? 'Remplacer le plat' : 'Choisir un plat'}<small>${passeOuAjd ? 'compte comme ce qui a été mangé' : 'alternatives classées'}</small></button>
        ${e ? `<button data-x="verrou">${cr.verrou ? '🔓 Déverrouiller' : '🔒 Verrouiller'}<small>${cr.verrou ? '' : 'ne bouge plus quand on relance'}</small></button>` : ''}
        ${e ? '<button data-x="deplacer">⇄ Déplacer vers un autre jour</button>' : ''}
        <button data-x="libre">✎ On a mangé autre chose<small>texte libre (invités, restau…)</small></button>
        ${e && e.type !== 'annule' ? '<button data-x="annuler">✕ Annuler ce repas</button>' : ''}
        ${cr.reel ? '<button data-x="retour">↶ Revenir au plat prévu</button>' : ''}
        ${e ? '<button data-x="vider" class="danger">Vider le créneau</button>' : ''}
      </div>`);
    f.onclick = ev => {
      const b = ev.target.closest('[data-x]'); if (!b) return;
      const x = b.dataset.x; const s2 = semaine(); const cr2 = s2.creneaux[cle];
      if (x === 'remplacer') return feuilleAlternatives(cle);
      if (x === 'verrou') cr2.verrou = !cr2.verrou;
      if (x === 'deplacer') return feuilleDeplacer(cle);
      if (x === 'libre') { const t = prompt('Qu\'avez-vous mangé ?', ''); if (!t) return; cr2.reel = { type: 'libre', texte: t, par: qui(), le: new Date().toISOString() }; }
      if (x === 'annuler') cr2.reel = { type: 'annule', par: qui(), le: new Date().toISOString() };
      if (x === 'retour') cr2.reel = null;
      if (x === 'vider') { cr2.prevu = null; cr2.reel = null; cr2.verrou = false; }
      enregistrer(s2); fermerFeuille(); rendre();
    };
  }
  function feuilleAlternatives(cle) {
    reglages();
    const s = semaine(); const date = M.dateCreneau(s.debut, cle); const reel = date <= aujourdhui();
    const alts = M.alternatives(RECETTES, semaines(), s, cle, { assouplir: s.assouplir });
    const ok = alts.filter(a => !a.exclusions.length), hors = alts.filter(a => a.exclusions.length);
    const RAISON_EXCL = { statut: 'pas encore validée', recence: 'servie récemment', saison: 'hors saison', duree: 'trop longue pour ce créneau', 'hors roulement': 'hors roulement' };
    const ligne = a => { const r = recette(a.recette); return `<button class="alt" data-r="${r.id}"><b>${esc(r.nom)}</b><small>${esc(a.raison || '')}${a.dejaCetteSemaine ? ' · déjà dans la semaine' : ''}${a.exclusions.length ? ' · ' + a.exclusions.map(x => RAISON_EXCL[x] || x).join(', ') : ''}</small></button>`; };
    const f = feuille(`<h2>Remplacer</h2><input id="cherche" class="cherche" placeholder="Chercher une recette">
      <div id="alts">${ok.slice(0, 12).map(ligne).join('') || '<p class="vide">Aucune recette ne respecte toutes les règles.</p>'}
      ${hors.length ? `<details><summary>Hors règles (${hors.length})</summary>${hors.map(ligne).join('')}</details>` : ''}</div>`, { grande: true });
    f.querySelector('#cherche').oninput = e => {
      const q = M.norm(e.target.value);
      f.querySelector('#alts').innerHTML = q ? alts.filter(a => M.norm(recette(a.recette).nom).includes(q)).map(ligne).join('') : ok.slice(0, 12).map(ligne).join('');
    };
    f.onclick = ev => {
      const b = ev.target.closest('.alt'); if (!b) return;
      const s2 = semaine(); const cr = s2.creneaux[cle];
      if (reel && cr.prevu && cr.prevu.recette) cr.reel = { type: 'recette', recette: b.dataset.r, par: qui(), le: new Date().toISOString() };
      else { cr.prevu = { recette: b.dataset.r, raison: 'choisi à la main' }; cr.reel = null; }
      enregistrer(s2); fermerFeuille(); rendre();
    };
  }
  function feuilleDeplacer(cle) {
    const s = semaine();
    const f = feuille(`<h2>Déplacer vers…</h2><p class="petit">Le plat change de place avec celui du créneau choisi.</p><div class="liste-actions">${M.CRENEAUX.filter(c => c.cle !== cle).map(c => {
      const e = M.effectif(s.creneaux[c.cle]); const n = e ? (e.type === 'recette' ? (recette(e.recette) || {}).nom : e.type === 'libre' ? e.texte : 'annulé') : 'libre';
      return `<button data-c="${c.cle}">${c.label}<small>${esc(n)}</small></button>`; }).join('')}</div>`);
    f.onclick = ev => {
      const b = ev.target.closest('[data-c]'); if (!b) return;
      const s2 = semaine(); const a = s2.creneaux[cle], z = s2.creneaux[b.dataset.c];
      s2.creneaux[cle] = z; s2.creneaux[b.dataset.c] = a;
      enregistrer(s2); fermerFeuille(); rendre();
    };
  }

  // ---------- Habituels (goûters, petit-déj) : ajoutés à chaque semaine, retirables semaine par semaine ----------
  const HABITUELS_DEFAUT = [
    { id: 'brioche', nom: 'brioche', mag: 'supercoop' },
    { id: 'yaourts', nom: 'gros pots de yaourt nature', mag: 'supercoop' },
    { id: 'fromage-blanc', nom: 'fromage blanc au lait de montagne', mag: 'supercoop' }
  ];
  function habituels() { return S.get('habituels', HABITUELS_DEFAUT); }
  function habituelsSemaine(s, mag) {
    const retires = S.get('habituels-retires:' + s.debut, []);
    return habituels().filter(h => h.mag === mag && !retires.includes(h.id));
  }

  // ---------- Écran Courses ----------
  function cocheCle(s, cle) { return 'coche:' + s.debut + ':' + cle; }
  function ecranCourses() {
    const s = semaine();
    const sCourses = { ...s, creneaux: { ...s.creneaux } };
    if (s.coursesDepuis) for (const c of M.CRENEAUX) if (M.dateCreneau(s.debut, c.cle) < s.coursesDepuis) sCourses.creneaux[c.cle] = { prevu: null, reel: null };
    const L = M.courses(RECETTES, sCourses, reglages());
    const extras = S.get('extras:' + s.debut, []);
    const mag = ui.magasin; const liste = L[mag];
    const toutes = [...liste.rayons.flatMap(r => r.lignes), ...(liste.plusTard || []).flatMap(r => r.lignes), ...liste.verifier];
    const cles = new Set(toutes.map(l => l.cle));
    const orphelines = S.cles('coche:' + s.debut + ':' + mag + ':').filter(k => !cles.has(k.split(':').slice(2).join(':')) && !k.includes(':x:') && !k.includes(':h:') && (S.get(k) || {}).ok);
    const hab = habituelsSemaine(s, mag);
    const reste = toutes.filter(l => !l.placard && !(S.get(cocheCle(s, l.cle)) || {}).ok).length + extras.filter(x => x.mag === mag && !(S.get(cocheCle(s, mag + ':x:' + x.id)) || {}).ok).length + hab.filter(h => !(S.get(cocheCle(s, mag + ':h:' + h.id)) || {}).ok).length;
    const ligne = l => {
      const c = S.get(cocheCle(s, l.cle)) || {};
      const change = c.ok && c.qte && c.qte !== l.quantite;
      return `<label class="art ${c.ok ? 'fait' : ''}"><input type="checkbox" data-k="${esc(l.cle)}" data-q="${esc(l.quantite)}" data-n="${esc(l.nom)}" ${c.ok ? 'checked' : ''}>
        <span class="art-n">${esc(l.nom)}${l.avance ? ' <span class="badge av">pour mer. soir</span>' : ''}${l.marie ? ' <span class="badge sg">Marie</span>' : ''}
        <small>${esc(l.pour.join(' · '))}${change ? ` · <b class="warn-t">coché pour ${esc(c.qte)}, il faut maintenant ${esc(l.quantite)}</b>` : ''}</small></span>
        <span class="art-q">${esc(l.quantite)}</span></label>`;
    };
    const jours = []; for (let i = 0; i <= 7; i++) jours.push(M.ajouterJours(s.debut, i));
    $('#main').innerHTML = `
      <div class="hdr"><div><div class="kick">Courses · semaine du ${esc(M.dateCourte(s.debut))}</div><h1>${M.MAGASINS[mag]}</h1></div><span class="compte">${reste} à prendre</span></div>
      <div class="onglets"><button class="${mag === 'auchan' ? 'on' : ''}" data-m="auchan">Auchan Drive</button><button class="${mag === 'supercoop' ? 'on' : ''}" data-m="supercoop">Supercoop</button></div>
      ${L.sansIngredients.length ? `<div class="alerte"><b>Liste incomplète :</b> ${L.sansIngredients.map(x => `<a data-r="${x.recette.id}">${esc(x.recette.nom)}</a>`).join(', ')} n'${L.sansIngredients.length > 1 ? 'ont' : 'a'} pas encore d'ingrédients.</div>` : ''}
      ${!L.plats ? '<p class="vide">Pas encore de menu cette semaine.</p>' : ''}
      ${liste.rayons.map(r => `<h3 class="rayon">${esc(r.titre)}</h3><div class="carte serre">${r.lignes.map(ligne).join('')}</div>`).join('')}
      ${(liste.plusTard || []).length ? `<h2 class="second">Second passage · ${esc(M.dateCourte(liste.dateSecond))}</h2>${liste.plusTard.map(r => `<h3 class="rayon">${esc(r.titre)}</h3><div class="carte serre">${r.lignes.map(ligne).join('')}</div>`).join('')}` : ''}
      ${hab.length ? `<h3 class="rayon">Habituels · goûters et petit-déj</h3><div class="carte serre">${hab.map(h => { const c = S.get(cocheCle(s, mag + ':h:' + h.id)) || {}; return `<label class="art ${c.ok ? 'fait' : ''}"><input type="checkbox" data-k="${mag}:h:${esc(h.id)}" ${c.ok ? 'checked' : ''}><span class="art-n">${esc(h.nom)}<small>chaque semaine · ✕ pour l'enlever cette semaine</small></span><button class="suppr" data-hab="${esc(h.id)}" aria-label="Pas cette semaine">✕</button></label>`; }).join('')}</div>` : ''}
      ${extras.filter(x => x.mag === mag).length ? `<h3 class="rayon">Ajouts</h3><div class="carte serre">${extras.filter(x => x.mag === mag).map(x => { const c = S.get(cocheCle(s, mag + ':x:' + x.id)) || {}; return `<label class="art ${c.ok ? 'fait' : ''}"><input type="checkbox" data-k="${mag}:x:${x.id}" ${c.ok ? 'checked' : ''}><span class="art-n">${esc(x.nom)}</span><button class="suppr" data-sup="${x.id}" aria-label="Supprimer">✕</button></label>`; }).join('')}</div>` : ''}
      <div class="ajout"><input id="extra" placeholder="Ajouter un article à cette liste"><button class="btn" id="plusextra">Ajouter</button></div>
      ${liste.verifier.length ? `<h3 class="rayon">À vérifier dans le placard</h3><div class="carte serre verif">${liste.verifier.map(ligne).join('')}</div>` : ''}
      ${orphelines.length ? `<h3 class="rayon">Cochés mais plus nécessaires</h3><div class="carte serre verif">${orphelines.map(k => `<div class="art fait"><span class="art-n">${esc((S.get(k) || {}).nom || k.split(':').slice(3).join(':').replace(/:p$/, ''))}${(S.get(k) || {}).qte ? ' <small style="display:inline">(' + esc(S.get(k).qte) + ')</small>' : ''}<small>le plat a changé : déjà acheté, à garder pour plus tard</small></span><button class="suppr" data-orph="${esc(k)}">✕</button></div>`).join('')}</div>` : ''}
      ${L.maison.length && mag === 'supercoop' ? `<h3 class="rayon">Déjà à la maison (panier)</h3><div class="carte serre">${L.maison.map(m => `<div class="art"><span class="art-n">${esc(m.nom)}<small>${esc(m.pour.join(' · '))}</small></span></div>`).join('')}</div>` : ''}
      <div class="pied-courses">
        <button class="btn plein" id="copier">Copier la liste ${mag === 'auchan' ? 'pour le drive' : ''}</button>
        <label class="champ petit">Compter les repas à partir du<select id="depuis">${jours.map(j => `<option value="${j}" ${j === (s.coursesDepuis || s.debut) ? 'selected' : ''}>${M.dateCourte(j)}</option>`).join('')}</select></label>
        <p class="petit">Les cases cochées sont gardées sur le téléphone même sans réseau, et partagées dès qu'il revient.</p>
      </div>`;
    const main = $('#main');
    main.onclick = e => {
      const m = e.target.closest('[data-m]'); if (m) { ui.magasin = m.dataset.m; return rendre(); }
      const r = e.target.closest('a[data-r]'); if (r) return ouvrirRecette(r.dataset.r);
      const hb = e.target.closest('[data-hab]'); if (hb) { e.preventDefault(); S.set('habituels-retires:' + s.debut, [...S.get('habituels-retires:' + s.debut, []), hb.dataset.hab]); toast('Enlevé pour cette semaine'); return rendre(); }
      const sup = e.target.closest('[data-sup]'); if (sup) { e.preventDefault(); S.set('extras:' + s.debut, S.get('extras:' + s.debut, []).filter(x => x.id !== sup.dataset.sup)); return rendre(); }
      const o = e.target.closest('[data-orph]'); if (o) { S.set(o.dataset.orph, null); return rendre(); }
    };
    main.onchange = e => {
      const cb = e.target.closest('input[type=checkbox][data-k]');
      if (cb) { S.set(cocheCle(s, cb.dataset.k), cb.checked ? { ok: true, qte: cb.dataset.q || null, nom: cb.dataset.n || null, par: qui() } : null); cb.closest('.art').classList.toggle('fait', cb.checked); majCompte(); return; }
      if (e.target.id === 'depuis') { const s2 = semaine(); s2.coursesDepuis = e.target.value; enregistrer(s2); rendre(); }
    };
    const ajoutExtra = () => { const v = $('#extra').value.trim(); if (!v) return; S.set('extras:' + s.debut, [...S.get('extras:' + s.debut, []), { id: Date.now().toString(36), mag, nom: v }]); rendre(); };
    $('#plusextra').onclick = ajoutExtra; $('#extra').onkeydown = e => { if (e.key === 'Enter') ajoutExtra(); };
    $('#copier').onclick = () => {
      const ext = [...hab.map(h => h.nom), ...extras.filter(x => x.mag === mag).map(x => x.nom)];
      copier(M.texteListe(L, mag, s, ext));
    };
    function majCompte() { const n = main.querySelectorAll('.carte:not(.verif) .art input[type=checkbox]:not(:checked)').length; $('.compte').textContent = n + ' à prendre'; }
  }

  // ---------- Écran Recettes ----------
  function ecranRecettes() {
    const h = hist();
    const avis = k => S.get('avis:' + k);
    const compte = st => RECETTES.filter(r => r.statut === st).length;
    const filtres = [['tous', 'Toutes', RECETTES.filter(r => r.statut !== 'ecartee').length], ['a_valider', 'À valider', compte('a_valider')], ['validee', 'Validées', compte('validee')], ['a_tester', 'À tester', compte('a_tester')], ['petite_folie', 'Petites folies', compte('petite_folie')], ['ecartee', 'Écartées', compte('ecartee')]].filter(f => f[0] === 'tous' || f[2]);
    const q = M.norm(ui.recherche);
    const liste = RECETTES.filter(r => (ui.filtre === 'tous' ? r.statut !== 'ecartee' : r.statut === ui.filtre) && (!q || M.norm(r.nom + ' ' + r.categorie + ' ' + (r.ingredients || []).map(i => i.nom).join(' ')).includes(q)))
      .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
    const aValider = compte('a_valider');
    $('#main').innerHTML = `
      <div class="hdr"><div><div class="kick">${RECETTES.length} fiches</div><h1>Recettes</h1></div></div>
      ${aValider ? `<div class="info">${aValider} fiche${aValider > 1 ? 's' : ''} à valider. Ouvre-la, relis, et donne ton avis : Etienne le transmet à Claude, qui met la fiche à jour.</div>` : ''}
      <input class="cherche" id="cherche" placeholder="Chercher (nom, ingrédient…)" value="${esc(ui.recherche)}">
      <div class="puces defile">${filtres.map(([k, t, n]) => `<button class="puce ${ui.filtre === k ? 'on' : ''}" data-f="${k}">${t} <span>${n}</span></button>`).join('')}</div>
      <div class="liste-recettes">${liste.map(r => {
        const x = h[r.id] || {}; const a = avis(r.id);
        return `<button class="recette-carte" data-r="${r.id}">
          ${r.pieces_jointes && r.pieces_jointes[0] && /\.(jpe?g|webp|png)$/i.test(r.pieces_jointes[0].fichier) ? `<img loading="lazy" src="${esc(r.pieces_jointes[0].chemin)}" alt="">` : `<div class="vignette">${esc((r.categorie || '?')[0])}</div>`}
          <span class="rc-corps"><b>${esc(r.nom)}</b>
          <small>${esc(r.categorie || '')} · ${dureeTxt(r.duree_min)}${x.fois ? ' · servie ' + x.fois + ' fois' : ''}</small>
          <span class="tags">${badgeStatut(r)}${sg(r)}${!M.aIngredients(r) ? '<span class="badge warnb">sans ingrédients</span>' : ''}${a ? `<span class="badge avis">avis : ${a.verdict === 'ok' ? 'OK' : 'à corriger'}</span>` : ''}</span></span></button>`;
      }).join('') || '<p class="vide">Aucune recette.</p>'}</div>
      <p class="petit centre">Pour ajouter ou corriger une recette : dans la conversation Claude du projet « Menus », dépose la capture, la photo, la vidéo ou le lien.</p>`;
    $('#cherche').oninput = e => { ui.recherche = e.target.value; const pos = e.target.selectionStart; ecranRecettes(); const c = $('#cherche'); c.focus(); c.setSelectionRange(pos, pos); };
    $('#main').onclick = e => {
      const f = e.target.closest('[data-f]'); if (f) { ui.filtre = f.dataset.f; return rendre(); }
      const r = e.target.closest('[data-r]'); if (r) ouvrirRecette(r.dataset.r);
    };
  }

  function fmtIng(i) {
    const q = i.qte == null ? '' : M.texteQuantite(M.additionner([i]));
    return `<li><span>${esc(i.nom)}${i.note ? ' <small>(' + esc(i.note) + ')</small>' : ''}${i.estime ? ' <small class="warn-t">estimé</small>' : ''}</span><span class="q">${esc(q)}</span></li>`;
  }
  function ouvrirRecette(id) {
    const r = recette(id); if (!r) return;
    const x = hist()[id] || {};
    const note = S.get('note:' + id, {}); const avis = S.get('avis:' + id);
    const f = feuille(`<div class="fiche">
      <div class="fiche-tete"><button class="ib" data-x="fermer">‹ Retour</button>${r.etapes && r.etapes.length ? '<button class="btn plein" data-x="cuisine">Mode cuisine</button>' : ''}</div>
      <h2>${esc(r.nom)}</h2>
      <div class="tags">${badgeStatut(r)}${sg(r)}${r.vegetarien ? '<span class="badge veg">Végétarien</span>' : ''}${r.veille ? '<span class="badge av">À faire la veille</span>' : ''}</div>
      <p class="petit">${esc(r.categorie || '')} · ${dureeTxt(r.duree_min)} · ${esc((r.saisons || []).join(', ').replace('toute', 'toute l\'année').replace('ete', 'été'))} · pour ${r.portions || 5}<br>
      Source : ${r.source && r.source.lien ? `<a href="${esc(r.source.lien)}" target="_blank" rel="noopener">${esc(r.source.nom)}</a>` : esc(r.source && r.source.nom || '?')}${r.choisie_par ? ' · choisie par ' + esc(r.choisie_par) : ''}</p>
      ${r.redaction === 'claude' ? '<div class="info">Fiche rédigée par Claude (version standard), pas encore relue par la famille. Les quantités sont à vérifier.</div>' : ''}
      ${(r.a_completer || []).length ? `<div class="alerte"><b>À compléter</b>${r.a_completer.map(a => `<div>• ${esc(a)}</div>`).join('')}</div>` : ''}
      ${(r.pieces_jointes || []).map(p => /\.pdf$/i.test(p.fichier) ? `<a class="pj" href="${esc(p.chemin)}" target="_blank">📄 ${esc(p.legende || p.fichier)}</a>` : `<a href="${esc(p.chemin)}" target="_blank"><img class="pj-img" loading="lazy" src="${esc(p.chemin)}" alt="${esc(p.legende || '')}"></a>`).join('')}
      <h3>Ingrédients</h3>
      ${M.aIngredients(r) ? `<ul class="ings">${r.ingredients.map(fmtIng).join('')}</ul>` : '<p class="manque">Ingrédients manquants.</p>'}
      <h3>Option Marie</h3>
      <div class="marie-bloc"><p>${esc(r.marie && r.marie.texte || (r.ancien && r.ancien.option_marie) || 'Non renseignée.')}</p>
      ${r.marie && (r.marie.ajouter || []).length ? `<p class="petit">Pour sa part :</p><ul class="ings">${r.marie.ajouter.map(fmtIng).join('')}</ul>` : ''}
      ${r.marie && (r.marie.retirer || []).length ? `<p class="petit">À retirer de sa part : ${r.marie.retirer.map(i => esc(i.nom) + (i.qte ? ' (' + M.texteQuantite(M.additionner([i])) + ')' : '')).join(', ')}</p>` : ''}
      ${r.marie && r.marie.soir ? `<p class="petit">Le soir : ${esc(r.marie.soir)}</p>` : ''}</div>
      ${r.etienne ? `<h3>Pour Etienne</h3><div class="marie-bloc"><p>${esc(r.etienne.texte)}</p>${(r.etienne.ajouter || []).length ? `<ul class="ings">${r.etienne.ajouter.map(fmtIng).join('')}</ul>` : ''}</div>` : ''}
      <h3>Étapes</h3>
      ${r.etapes && r.etapes.length ? `<ol class="etapes">${r.etapes.map(e => `<li>${esc(e.texte || e)}${e.minuteur ? ` <button class="minuteur-btn" data-t="${e.minuteur}" data-l="${esc((e.texte || '').slice(0, 40))}">⏱ ${Math.round(e.minuteur / 60)} min</button>` : ''}</li>`).join('')}</ol>` : '<p class="manque">Étapes manquantes.</p>'}
      ${r.remarque ? `<p class="petit">Remarque : ${esc(r.remarque)}</p>` : ''}
      <h3>Historique</h3>
      <p class="petit">${x.fois ? `Servie ${x.fois} fois depuis le début de l'appli, dernière fois le ${dateFr(x.derniere)}.` : 'Pas encore servie depuis le début de l\'appli (20 novembre 2026).'}</p>
      <h3>Note de la famille</h3>
      <div class="etoiles" data-x="etoiles">${[1, 2, 3, 4, 5].map(n => `<button data-n="${n}" class="${(note.note || 0) >= n ? 'on' : ''}">★</button>`).join('')}</div>
      <textarea id="note-texte" rows="2" placeholder="Un commentaire ? (trop salé, Billie adore…)">${esc(note.texte || '')}</textarea>
      ${note.par ? `<p class="petit">Dernière note par ${esc(note.par)}</p>` : ''}
      <h3>Avis sur la fiche</h3>
      <p class="petit">Pour la faire passer « validée » ou la corriger. Etienne transmet les avis à Claude (menu Plus).</p>
      <div class="puces"><button class="puce ${avis && avis.verdict === 'ok' ? 'on' : ''}" data-v="ok">Validée telle quelle</button><button class="puce ${avis && avis.verdict === 'corriger' ? 'on' : ''}" data-v="corriger">À corriger</button><button class="puce ${avis && avis.verdict === 'ecarter' ? 'on' : ''}" data-v="ecarter">À écarter</button></div>
      <textarea id="avis-texte" rows="2" placeholder="Quoi corriger ? (quantités, étapes, accompagnement…)">${esc(avis && avis.texte || '')}</textarea>
      <button class="btn" data-x="avis" style="margin-top:8px">Enregistrer l'avis</button>
      <p class="petit">Fiche ${r.id}</p></div>`, { grande: true });
    f.onclick = e => {
      const b = e.target.closest('[data-x],[data-n],[data-v],.minuteur-btn'); if (!b) return;
      if (b.dataset.x === 'fermer') return fermerFeuille();
      if (b.dataset.x === 'cuisine') return modeCuisine(id);
      if (b.classList.contains('minuteur-btn')) return Minuteurs.lancer(+b.dataset.t, b.dataset.l);
      if (b.dataset.n) {
        const n = +b.dataset.n; S.set('note:' + id, { note: n, texte: f.querySelector('#note-texte').value.trim(), par: qui(), le: new Date().toISOString() });
        f.querySelectorAll('.etoiles button').forEach(x => x.classList.toggle('on', +x.dataset.n <= n)); toast('Note enregistrée');
      }
      if (b.dataset.v) { f.querySelectorAll('[data-v]').forEach(x => x.classList.toggle('on', x === b)); f.dataset.verdict = b.dataset.v; }
      if (b.dataset.x === 'avis') {
        const v = f.dataset.verdict || (avis && avis.verdict); if (!v) return toast('Choisis d\'abord un avis');
        S.set('avis:' + id, { verdict: v, texte: f.querySelector('#avis-texte').value.trim(), par: qui(), le: new Date().toISOString() }); toast('Avis enregistré'); rendre();
      }
    };
    f.querySelector('#note-texte').onchange = e => { const n = S.get('note:' + id, {}); S.set('note:' + id, { ...n, texte: e.target.value.trim(), par: qui(), le: new Date().toISOString() }); };
  }

  // ---------- Minuteurs ----------
  const Minuteurs = {
    liste: [],
    lancer(sec, libelle) {
      this.liste.push({ id: Date.now() + Math.random(), fin: Date.now() + sec * 1000, libelle: libelle || 'Minuteur', total: sec });
      this.boucle(); toast('Minuteur lancé : ' + Math.round(sec / 60) + ' min');
    },
    boucle() {
      clearInterval(this.t); this.t = setInterval(() => this.maj(), 500); this.maj();
    },
    maj() {
      const el = $('#minuteurs');
      if (!this.liste.length) { el.innerHTML = ''; clearInterval(this.t); return; }
      const now = Date.now();
      el.innerHTML = this.liste.map(m => {
        const r = Math.max(0, Math.round((m.fin - now) / 1000));
        if (r === 0 && !m.sonne) { m.sonne = true; sonner(); }
        return `<div class="min ${r === 0 ? 'fini' : ''}"><span>${esc(m.libelle)}</span><b>${r === 0 ? 'Terminé !' : Math.floor(r / 60) + ':' + String(r % 60).padStart(2, '0')}</b><button data-id="${m.id}">✕</button></div>`;
      }).join('');
      el.onclick = e => { const b = e.target.closest('[data-id]'); if (!b) return; this.liste = this.liste.filter(m => String(m.id) !== b.dataset.id); this.maj(); };
    }
  };
  function sonner() {
    try { navigator.vibrate && navigator.vibrate([400, 200, 400, 200, 400]); } catch (e) {}
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.4, 0.8, 1.2].forEach(t => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = 880; o.connect(g); g.connect(ctx.destination); g.gain.setValueAtTime(0.3, ctx.currentTime + t); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.3); o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.3); });
    } catch (e) {}
  }

  // ---------- Mode cuisine ----------
  async function modeCuisine(id) {
    const r = recette(id); fermerFeuille();
    let verrouEcran = null;
    try { verrouEcran = await navigator.wakeLock.request('screen'); } catch (e) {}
    const pages = [];
    const marieSG = r.marie && (r.marie.ajouter || []).length;
    pages.push({ type: 'debut' });
    r.etapes.forEach((e, i) => pages.push({ type: 'etape', e, i }));
    pages.push({ type: 'fin' });
    let p = 0;
    const el = document.createElement('div'); el.className = 'cuisine'; document.body.appendChild(el); document.body.classList.add('fige');
    const fermer = () => { el.remove(); document.body.classList.remove('fige'); try { verrouEcran && verrouEcran.release(); } catch (e) {} };
    function page() {
      const x = pages[p];
      let corps;
      if (x.type === 'debut') corps = `<div class="cu-kick">Avant de commencer</div><h2>${esc(r.nom)}</h2>
        ${marieSG ? `<div class="cu-marie">Préparer d'abord la part de Marie, sur des ustensiles propres : ${esc(r.marie.texte)}</div>` : ''}
        ${r.etienne ? `<div class="cu-marie">Etienne : ${esc(r.etienne.texte)}</div>` : ''}
        <ul class="cu-ings">${(r.ingredients || []).map(i => `<li>${esc(i.nom)} <b>${esc(i.qte == null ? '' : M.texteQuantite(M.additionner([i])))}</b></li>`).join('')}</ul>`;
      else if (x.type === 'etape') corps = `<div class="cu-kick">Étape ${x.i + 1} sur ${r.etapes.length}</div><p class="cu-texte">${esc(x.e.texte || x.e)}</p>
        ${x.e.minuteur ? `<button class="cu-min" data-t="${x.e.minuteur}">⏱ Lancer ${Math.round(x.e.minuteur / 60)} min</button>` : ''}`;
      else corps = `<div class="cu-kick">C'est prêt</div><h2>Bon appétit !</h2><p class="cu-texte petit">Pense à noter la recette dans sa fiche.</p>`;
      el.innerHTML = `<div class="cu-haut"><button data-c="fermer">✕ Fermer</button><span>${p + 1}/${pages.length}</span></div>
        <div class="cu-corps">${corps}</div>
        <div class="cu-bas"><button data-c="prec" ${p === 0 ? 'disabled' : ''}>‹ Précédent</button><button data-c="suiv" class="plein">${p === pages.length - 1 ? 'Terminer' : 'Suivant ›'}</button></div>`;
    }
    el.onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.c === 'fermer') return fermer();
      if (b.dataset.c === 'prec' && p > 0) p--;
      if (b.dataset.c === 'suiv') { if (p === pages.length - 1) return fermer(); p++; }
      if (b.dataset.t) { const x = pages[p]; Minuteurs.lancer(+b.dataset.t, r.nom.split(/[,(]/)[0].trim().slice(0, 22) + ' · étape ' + (x.i + 1)); return; }
      page();
    };
    page();
  }

  // ---------- Écran Plus ----------
  function ecranPlus() {
    const ws = semaines().sort((a, b) => b.debut.localeCompare(a.debut));
    const avis = S.cles('avis:').map(k => ({ id: k.slice(5), ...S.get(k) })).filter(a => recette(a.id));
    const notes = S.cles('note:').map(k => ({ id: k.slice(5), ...S.get(k) })).filter(a => recette(a.id));
    const reg = reglages(); const pol = { ...M.MAGASIN_PAR_RAYON, ...(reg.magasinParRayon || {}) };
    $('#main').innerHTML = `
      <div class="hdr"><div><div class="kick">Menus</div><h1>Plus</h1></div><span id="synchro" class="synchro"></span></div>
      <section class="carte"><h3>Qui utilise ce téléphone ?</h3><div class="puces" id="qui">${FAMILLE.map(p => `<button class="puce ${qui() === p ? 'on' : ''}" data-p="${p}">${p}</button>`).join('')}</div></section>
      <section class="carte"><h3>Habituels des courses</h3><p class="petit">Ajoutés automatiquement chaque semaine (goûters, petit-déj). Sur la liste, ✕ les enlève pour une semaine seulement.</p>
        ${habituels().map(h => `<div class="reg"><span>${esc(h.nom)} <small class="petit">· ${M.MAGASINS[h.mag]}</small></span><button class="suppr" data-habsup="${esc(h.id)}" aria-label="Supprimer">✕</button></div>`).join('')}
        <div class="ajout"><input id="hab-nom" placeholder="Ex. compote, lait, céréales"><select id="hab-mag" style="width:auto"><option value="supercoop">Supercoop</option><option value="auchan">Auchan</option></select><button class="btn" id="hab-plus">Ajouter</button></div></section>
      <section class="carte"><h3>Avis et notes à transmettre à Claude</h3>
        <p class="petit">${avis.length} avis sur des fiches, ${notes.length} notes. Copie et colle-les dans la conversation Claude « Menus » : il met les fiches à jour.</p>
        <button class="btn" id="copier-avis" ${avis.length + notes.length ? '' : 'disabled'}>Copier pour Claude</button></section>
      <section class="carte"><h3>Historique</h3>${ws.length ? ws.map(w => `<details><summary>Semaine du ${esc(M.dateCourte(w.debut))}</summary><ul class="hist">${M.CRENEAUX.map(c => {
        const cr = w.creneaux[c.cle]; const e = M.effectif(cr); if (!e) return '';
        const nom = e.type === 'recette' ? (recette(e.recette) || {}).nom : e.type === 'libre' ? e.texte : 'annulé';
        const prev = cr.reel && cr.prevu && cr.prevu.recette ? ` <small>(prévu : ${esc((recette(cr.prevu.recette) || {}).nom)})</small>` : '';
        return `<li><b>${c.court}</b> ${esc(nom)}${prev}</li>`; }).join('')}</ul></details>`).join('') : '<p class="vide">Rien encore. Il se remplit tout seul au fil des semaines.</p>'}</section>
      <section class="carte"><h3>Règles du menu</h3><div class="reg"><span>Ne pas reproposer une recette avant</span><select id="recence">${[7, 14, 21, 28].map(j => `<option value="${j}" ${(reg.recenceJours || 14) === j ? 'selected' : ''}>${j / 7} semaine${j > 7 ? 's' : ''}</option>`).join('')}</select></div></section>
      <section class="carte"><h3>Magasin par rayon</h3><p class="petit">Où va chaque rayon par défaut. Une fiche peut forcer un magasin pour un ingrédient précis.</p>
        ${Object.entries(M.RAYONS).map(([k, t]) => `<div class="reg"><span>${esc(t)}</span><select data-ry="${k}"><option value="supercoop" ${pol[k] === 'supercoop' ? 'selected' : ''}>Supercoop</option><option value="auchan" ${pol[k] === 'auchan' ? 'selected' : ''}>Auchan</option></select></div>`).join('')}</section>
      <section class="carte"><h3>Sauvegarde</h3><p class="petit">Exporte tout ce qui vit dans l'appli (semaines, cases, notes, avis) dans un fichier.</p>
        <div class="rangee"><button class="btn" id="export">Exporter</button><label class="btn">Importer<input type="file" id="import" accept="application/json" hidden></label></div></section>
      ${S.configure() ? `<section class="carte"><button class="btn" id="sync">Synchroniser maintenant</button></section>` : '<section class="carte"><p class="petit">Mode local : les données restent sur ce téléphone tant que le partage (Supabase) n\'est pas branché.</p></section>'}
      <p class="petit centre">Recettes mises à jour le ${dateFr(M.ymd(new Date(window.__genere || Date.now())))}</p>`;
    majStatut();
    $('#qui').onclick = e => { const b = e.target.closest('.puce'); if (!b) return; S.setQui(b.dataset.p); rendre(); };
    $('#main').onclick = e => { const b = e.target.closest('[data-habsup]'); if (!b) return; S.set('habituels', habituels().filter(h => h.id !== b.dataset.habsup)); rendre(); };
    $('#hab-plus').onclick = () => { const n = $('#hab-nom').value.trim(); if (!n) return; S.set('habituels', [...habituels(), { id: Date.now().toString(36), nom: n, mag: $('#hab-mag').value }]); rendre(); };
    $('#copier-avis').onclick = () => {
      const l = ['Avis de la famille sur les fiches recettes (appli Menus) :', ''];
      for (const a of avis) l.push(`- ${a.id} « ${recette(a.id).nom} » : ${{ ok: 'validée telle quelle', corriger: 'à corriger', ecarter: 'à écarter' }[a.verdict]}${a.texte ? ' — ' + a.texte : ''} (${a.par || '?'})`);
      if (notes.length) { l.push('', 'Notes :'); for (const n of notes) l.push(`- ${n.id} « ${recette(n.id).nom} » : ${n.note || '?'}/5${n.texte ? ' — ' + n.texte : ''} (${n.par || '?'})`); }
      copier(l.join('\n'));
    };
    $('#main').onchange = e => {
      const s = e.target.closest('[data-ry]'); if (s) { const reg2 = reglages(); S.set('reglages', { ...reg2, magasinParRayon: { ...(reg2.magasinParRayon || {}), [s.dataset.ry]: s.value } }); toast('Enregistré'); }
      if (e.target.id === 'recence') { S.set('reglages', { ...reglages(), recenceJours: +e.target.value }); toast('Enregistré'); }
      if (e.target.id === 'import') {
        const fi = e.target.files[0]; if (!fi) return; fi.text().then(t => { if (confirm('Remplacer les données de l\'appli par celles du fichier ?')) { S.importer(JSON.parse(t)); toast('Importé'); rendre(); } });
      }
    };
    $('#export').onclick = () => {
      const b = new Blob([JSON.stringify(S.exporter(), null, 1)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'menus-sauvegarde-' + aujourdhui() + '.json'; a.click();
    };
    if ($('#sync')) $('#sync').onclick = () => S.synchroniser().then(() => { toast('Synchronisé'); rendre(); });
    if ($('#deco')) $('#deco').onclick = () => { S.deconnexion(); rendre(); };
  }

  // ---------- Démarrage ----------
  async function demarrer() {
    document.querySelector('.nav-in').innerHTML = [['semaine', 'Semaine'], ['courses', 'Courses'], ['recettes', 'Recettes'], ['plus', 'Plus']].map(([k, t]) => `<button data-e="${k}">${ICONES[k]}<span>${t}</span></button>`).join('');
    document.querySelector('.nav').onclick = e => { const b = e.target.closest('[data-e]'); if (b) { fermerFeuille(); aller(b.dataset.e); } };
    try {
      const rep = await fetch('recettes.json', { cache: 'no-cache' });
      const d = await rep.json(); RECETTES = d.recettes; window.__genere = d.genere;
    } catch (e) {
      $('#main').innerHTML = '<p class="alerte">Impossible de charger les recettes. Vérifie le réseau.</p>'; return;
    }
    for (const r of RECETTES) PAR_ID[r.id] = r;
    S.ecouter(cles => { if (document.querySelector('.feuille-fond') && !cles.includes('__statut')) return; if (cles.every(k => k === '__statut')) return majStatut(); if (document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return; rendre(); });
    rendre();
    S.init().then(rendre);
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  window.MenusApp = { ouvrirRecette, rendre };
  demarrer();
})();
