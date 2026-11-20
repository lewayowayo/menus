/* Moteur des menus : logique pure, sans interface ni réseau.
   Chargé tel quel dans le navigateur (globalThis.Moteur) et dans les tests Node. */
(function () {
  'use strict';

  // ---------- Semaine et créneaux ----------
  const CRENEAUX = [
    { cle: 'mer_soir', jour: 0, label: 'Mercredi soir', court: 'Mer soir', soir: true, besoin: 'rapide', note: 'Rapide (25 min max), retour des courses' },
    { cle: 'jeu_soir', jour: 1, label: 'Jeudi soir', court: 'Jeu soir', soir: true },
    { cle: 'ven_soir', jour: 2, label: 'Vendredi soir', court: 'Ven soir', soir: true },
    { cle: 'sam_midi', jour: 3, label: 'Samedi midi', court: 'Sam midi', soir: false, besoin: 'midi_simple', note: 'Simple' },
    { cle: 'sam_soir', jour: 3, label: 'Samedi soir', court: 'Sam soir', soir: true },
    { cle: 'dim_midi', jour: 4, label: 'Dimanche midi', court: 'Dim midi', soir: false, besoin: 'genereux', note: 'Plat généreux, parfois des invités' },
    { cle: 'dim_soir', jour: 4, label: 'Dimanche soir', court: 'Dim soir', soir: true, besoin: 'leger', note: 'Léger' },
    { cle: 'lun_soir', jour: 5, label: 'Lundi soir', court: 'Lun soir', soir: true },
    { cle: 'mar_soir', jour: 6, label: 'Mardi soir', court: 'Mar soir', soir: true },
    { cle: 'mer_midi', jour: 7, label: 'Mercredi midi', court: 'Mer midi', soir: false, besoin: 'midi_simple', note: 'Simple, ou restes' }
  ];
  const JOURS = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];
  const JOURS_LONG = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

  function ymd(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function parse(s) { const [y, m, j] = s.split('-').map(Number); return new Date(y, m - 1, j, 12); }
  function ajouterJours(s, n) { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); }
  function ecartJours(a, b) { return Math.round((parse(b) - parse(a)) / 86400000); }
  /** Mercredi qui ouvre la semaine contenant la date (une semaine va du mercredi soir au mercredi midi suivant). */
  function debutSemaine(s) {
    const d = parse(s); const dow = d.getDay(); // 3 = mercredi
    let recul = (dow - 3 + 7) % 7;
    d.setDate(d.getDate() - recul); return ymd(d);
  }
  function dateCreneau(debut, cle) { return ajouterJours(debut, CRENEAUX.find(c => c.cle === cle).jour); }
  function dateCourte(s) { const d = parse(s); return JOURS_LONG[d.getDay()] + ' ' + d.getDate() + '/' + (d.getMonth() + 1); }

  function semaineVide(debut) {
    const creneaux = {};
    for (const c of CRENEAUX) creneaux[c.cle] = { prevu: null, reel: null, verrou: false };
    return { debut, supercoop: debut, supercoop2: null, panier: [], restes: '', creneaux, graine: 0 };
  }
  /** Ajoute les créneaux manquants (semaines enregistrées avant l'ajout d'un créneau). */
  function completer(semaine) {
    for (const c of CRENEAUX) if (!semaine.creneaux[c.cle]) semaine.creneaux[c.cle] = { prevu: null, reel: null, verrou: false };
    return semaine;
  }
  /** Semaine à ouvrir par défaut : le mardi soir, on prépare déjà celle qui commence le lendemain. */
  function semaineParDefaut(aujourdhui) {
    const d = parse(aujourdhui).getDay();
    return d === 2 ? ajouterJours(aujourdhui, 1) : debutSemaine(aujourdhui);
  }

  // ---------- Texte ----------
  function norm(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/œ/g, 'oe').replace(/æ/g, 'ae')
      .replace(/\(.*?\)/g, ' ').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()
      .split(' ').map(m => m.length > 3 ? m.replace(/(s|x)$/, '') : m).join(' ');
  }

  // ---------- Recettes ----------
  function estMangeable(r) { return r && r.statut !== 'ecartee'; }
  function aIngredients(r) { return r && Array.isArray(r.ingredients) && r.ingredients.length > 0; }
  function saisonDe(dateStr) {
    const m = parse(dateStr).getMonth() + 1;
    if (m >= 3 && m <= 5) return 'printemps';
    if (m >= 6 && m <= 8) return 'ete';
    if (m >= 9 && m <= 11) return 'automne';
    return 'hiver';
  }
  function deSaison(r, dateStr) {
    const s = r.saisons || ['toute'];
    return s.includes('toute') || s.includes(saisonDe(dateStr));
  }

  /** Plat effectivement servi (ou prévu) à un créneau : le réel prime sur le prévu. */
  function effectif(cr) {
    if (!cr) return null;
    if (cr.reel) {
      if (cr.reel.type === 'annule') return { type: 'annule' };
      if (cr.reel.type === 'libre') return { type: 'libre', texte: cr.reel.texte };
      if (cr.reel.type === 'recette') return { type: 'recette', recette: cr.reel.recette, corrige: true };
    }
    if (cr.prevu && cr.prevu.recette) return { type: 'recette', recette: cr.prevu.recette, corrige: false };
    return null;
  }

  /** Historique : toutes les assiettes réellement servies (ou prévues) par recette, à partir des semaines et de l'ancien historique. */
  function historique(recettes, semaines) {
    const h = {};
    for (const r of recettes) {
      const a = r.ancien;
      h[r.id] = { dates: [], fois: a && a.fois_au_menu ? a.fois_au_menu : 0, derniere: a && /^\d{4}-/.test(a.derniere_fois || '') ? a.derniere_fois : null, ancienne: a && /^\d{4}-/.test(a.derniere_fois || '') ? a.derniere_fois : null };
    }
    for (const s of semaines) {
      for (const c of CRENEAUX) {
        const e = effectif(s.creneaux[c.cle]);
        if (!e || e.type !== 'recette' || !h[e.recette]) continue;
        const d = dateCreneau(s.debut, c.cle);
        const x = h[e.recette];
        x.dates.push({ date: d, semaine: s.debut, creneau: c.cle });
        // L'ancien historique compte déjà ce qui a été servi jusqu'à sa dernière date.
        if (!x.ancienne || d > x.ancienne) x.fois++;
        if (!x.derniere || d > x.derniere) x.derniere = d;
      }
    }
    return h;
  }

  /** Dernière date de service strictement avant `avant` (hors semaine en cours). */
  function derniereAvant(hist, id, avant, semaineCourante) {
    const x = hist[id]; if (!x) return null;
    let best = x.ancienne && x.ancienne < avant ? x.ancienne : null;
    for (const d of x.dates) if (d.semaine !== semaineCourante && d.date < avant && (!best || d.date > best)) best = d.date;
    return best;
  }

  // ---------- Proposition de menu ----------
  const REGLES_DURES = {
    statut: 'Seulement les recettes validées',
    recence: 'Pas servie dans les 3 dernières semaines',
    saison: 'De saison',
    duree: 'Mercredi soir en 25 min maximum'
  };

  function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967295; }

  /** Pourquoi une recette est exclue d'un créneau (liste vide = autorisée). */
  function exclusions(r, cre, ctx) {
    const out = [];
    const date = dateCreneau(ctx.semaine.debut, cre.cle);
    if (!estMangeable(r) || r.statut === 'petite_folie') out.push('hors roulement');
    if (r.statut !== 'validee' && !ctx.assouplir.statut) out.push('statut');
    const der = derniereAvant(ctx.hist, r.id, date, ctx.semaine.debut);
    if (der && ecartJours(der, date) < 21 && !ctx.assouplir.recence) out.push('recence');
    if (!deSaison(r, date) && !ctx.assouplir.saison) out.push('saison');
    if (cre.besoin === 'rapide' && (r.duree_min == null || r.duree_min > 25) && !ctx.assouplir.duree) out.push('duree');
    return out;
  }

  function panierNoms(semaine) { return (semaine.panier || []).map(p => norm(p.nom)); }

  // Familles de légumes interchangeables : une recette qui accepte « racines » peut utiliser panais, navet…
  const FAMILLES = {
    racines: ['carotte', 'panais', 'navet', 'patate douce', 'betterave', 'céleri-rave', 'topinambour', 'rutabaga', 'radis noir', 'pomme de terre', 'persil tubéreux'],
    feuilles: ['épinards', 'blettes', 'chou frisé', 'kale', 'chou kale', 'pak choi', 'oseille', 'fanes'],
    courges: ['potimarron', 'butternut', 'courge', 'courge spaghetti', 'citrouille', 'potiron', 'sucrine du Berry'],
    choux: ['chou blanc', 'chou rouge', 'chou vert', 'chou frisé', 'chou chinois', 'chou pointu', 'chou de Bruxelles', 'brocoli', 'chou-fleur', 'kale', 'chou kale', 'pak choi', 'romanesco']
  };
  const FAMILLES_N = {}; for (const [k, v] of Object.entries(FAMILLES)) FAMILLES_N[k] = new Set(v.map(norm));
  /** Légumes du panier qu'une recette peut utiliser : nommément, ou via une famille interchangeable. */
  function legumesUtilises(r, panier) {
    const exacts = new Set((r.legumes_amap || []).map(norm));
    const out = [];
    for (const p of panier) {
      if (exacts.has(p)) out.push({ nom: p, exact: true });
      else if ((r.legumes_libres || []).some(f => FAMILLES_N[f] && FAMILLES_N[f].has(p))) out.push({ nom: p, exact: false });
    }
    return out;
  }

  /** Note d'une recette pour un créneau, avec les raisons lisibles. */
  function nomPanier(semaine, n) { const p = (semaine.panier || []).find(x => norm(x.nom) === n); return p ? p.nom : n; }

  function noter(r, cre, ctx, choisis) {
    let score = 0; const raisons = [];
    const idx = CRENEAUX.indexOf(cre);
    const panier = panierNoms(ctx.semaine);
    // Légumes du panier
    const utilises = new Set();
    for (const [k, id] of Object.entries(choisis)) { if (k === cre.cle) continue; const x = ctx.parId[id]; if (x) for (const l of legumesUtilises(x, panier)) utilises.add(l.nom); }
    const leg = legumesUtilises(r, panier);
    if (leg.length) {
      let pts = 0; for (const l of leg) pts += utilises.has(l.nom) ? 0.8 : (l.exact ? 3.5 : 2.5);
      score += pts;
      const noms = leg.map(l => nomPanier(ctx.semaine, l.nom));
      raisons.push((leg.every(l => l.exact) ? 'utilise ' : 'peut utiliser ') + noms.join(', ') + ' du panier');
    }
    // Très frais
    if ((r.tres_frais || []).length) {
      if (idx <= 2) { score += 1.5; raisons.push(r.tres_frais.join(', ') + ' en début de semaine'); }
      else score -= 2.5;
    }
    // Créneau
    const cr = r.creneaux || [];
    if (cre.besoin && cr.includes(cre.besoin)) { score += cre.besoin === 'rapide' ? 2 : 4; raisons.push({ rapide: 'rapide', genereux: 'plat généreux', leger: 'léger', midi_simple: 'simple pour le midi' }[cre.besoin]); }
    else if (cre.besoin === 'leger' && cr.includes('genereux')) score -= 3;
    else if (cre.besoin === 'genereux' && cr.includes('leger')) score -= 2;
    else if (!cre.besoin && cr.includes('midi_simple') && !cr.includes('rapide')) score -= 1.5;
    // Durée : un midi simple ou un soir de semaine ne doivent pas demander des heures
    const d = r.duree_min;
    if (d != null) {
      if (cre.besoin === 'midi_simple' && d > 40) score -= d > 90 ? 6 : 3;
      else if (cre.besoin !== 'genereux' && d > 75) score -= 3;
    }
    // Même type de plat dans la semaine (deux quiches, deux lasagnes…)
    const type = x => norm(x.nom).split(' ')[0];
    for (const [k, id] of Object.entries(choisis)) {
      if (k === cre.cle) continue; const x = ctx.parId[id];
      if (x && x.id !== r.id && type(x) === type(r) && type(r).length > 3) score -= 4;
    }
    // Variété des catégories avec les créneaux voisins
    for (const v of [CRENEAUX[idx - 1], CRENEAUX[idx + 1]]) {
      if (!v) continue; const x = ctx.parId[choisis[v.cle]];
      if (x && x.categorie === r.categorie) { score -= 3; }
    }
    // Objectifs de la semaine
    const deja = Object.entries(choisis).filter(([k]) => k !== cre.cle).map(([, id]) => ctx.parId[id]).filter(Boolean);
    if (r.vegetarien && deja.filter(x => x.vegetarien).length < 2) { score += 1.2; raisons.push('végétarien'); }
    if (r.categorie === 'Recette du monde' && !deja.some(x => x.categorie === 'Recette du monde')) { score += 1.2; raisons.push('recette du monde'); }
    // Ancienneté
    const date = dateCreneau(ctx.semaine.debut, cre.cle);
    const der = derniereAvant(ctx.hist, r.id, date, ctx.semaine.debut);
    if (!der) { score += 3; raisons.push('jamais servie'); }
    else {
      const sem = Math.floor(ecartJours(der, date) / 7);
      score += Math.min(sem, 12) * 0.35;
        if (sem >= 4) raisons.push('pas servie depuis ' + sem + ' semaines');
      else if (sem >= 1) raisons.push('servie il y a ' + sem + ' semaine' + (sem > 1 ? 's' : ''));
      else raisons.push('déjà servie ces jours-ci');
    }
    // Pénalités quand on a assoupli une règle
    const ex = exclusions(r, cre, { ...ctx, assouplir: {} });
    if (ex.includes('statut')) score -= 0.5;
    if (ex.includes('saison')) { score -= 3; raisons.push('hors saison'); }
    if (ex.includes('recence')) { score -= 4; }
    if (ex.includes('duree')) { score -= 2; raisons.push(r.duree_min ? r.duree_min + ' min' : 'durée inconnue'); }
    if (!aIngredients(r)) score -= 1;
    // Petite variation reproductible pour « relancer »
    score += hash(r.id + ':' + cre.cle + ':' + (ctx.semaine.graine || 0)) * 0.9;
    return { score, raison: raisons.slice(0, 3).join(', ') };
  }

  function contexte(recettes, semaines, semaine, assouplir) {
    const parId = {}; for (const r of recettes) parId[r.id] = r;
    const autres = semaines.filter(s => s.debut !== semaine.debut);
    return { recettes, parId, hist: historique(recettes, autres), semaine, assouplir: assouplir || {} };
  }

  /** Créneaux qu'on ne touche pas en relançant : verrouillés, déjà corrigés, ou passés. */
  function fige(semaine, cle, aujourdhui) {
    const cr = semaine.creneaux[cle];
    if (!cr) return false;
    if (cr.verrou || cr.reel) return true;
    if (aujourdhui && dateCreneau(semaine.debut, cle) < aujourdhui && cr.prevu) return true;
    return false;
  }

  /**
   * Propose le menu pour les créneaux non figés. Ne modifie pas `semaine`, renvoie
   * { creneaux: {cle: {recette, raison}|null}, manques: [cle], bilan: [texte] }.
   */
  function proposer(recettes, semaines, semaine, options) {
    options = options || {};
    const ctx = contexte(recettes, semaines, semaine, options.assouplir);
    const choisis = {};
    for (const c of CRENEAUX) {
      const e = effectif(semaine.creneaux[c.cle]);
      if (fige(semaine, c.cle, options.aujourdhui) && e && e.type === 'recette') choisis[c.cle] = e.recette;
    }
    const res = {}; const manques = [];
    // Ordre de remplissage : créneaux contraints d'abord, puis la semaine dans l'ordre.
    const ordre = CRENEAUX.filter(c => !fige(semaine, c.cle, options.aujourdhui) && !(options.passer || []).includes(c.cle))
      .sort((a, b) => (b.besoin ? 1 : 0) - (a.besoin ? 1 : 0) || CRENEAUX.indexOf(a) - CRENEAUX.indexOf(b));
    for (const c of ordre) {
      const pris = new Set(Object.values(choisis));
      const cands = recettes.filter(r => !pris.has(r.id) && exclusions(r, c, ctx).length === 0)
        .map(r => ({ r, ...noter(r, c, ctx, { ...choisis, [c.cle]: r.id }) }))
        .sort((a, b) => b.score - a.score || (a.r.id < b.r.id ? -1 : 1));
      if (!cands.length) { res[c.cle] = null; manques.push(c.cle); continue; }
      choisis[c.cle] = cands[0].r.id;
      res[c.cle] = { recette: cands[0].r.id, raison: cands[0].raison || 'meilleur choix restant' };
    }
    return { creneaux: res, manques, bilan: bilan(recettes, { ...semaine, creneaux: fusion(semaine, res) }) };
  }

  function fusion(semaine, res) {
    const out = {};
    for (const c of CRENEAUX) {
      out[c.cle] = { prevu: null, reel: null, verrou: false, ...semaine.creneaux[c.cle] };
      if (c.cle in res) out[c.cle].prevu = res[c.cle];
    }
    return out;
  }

  /** Objectifs de la semaine non atteints, en phrases. */
  function bilan(recettes, semaine) {
    const parId = {}; for (const r of recettes) parId[r.id] = r;
    const plats = CRENEAUX.map(c => effectif(semaine.creneaux[c.cle])).filter(e => e && e.type === 'recette').map(e => parId[e.recette]).filter(Boolean);
    const out = [];
    const veg = plats.filter(r => r.vegetarien).length;
    if (veg < 2) out.push(veg + ' repas végétarien' + (veg > 1 ? 's' : '') + ' (objectif : 2)');
    if (!plats.some(r => r.categorie === 'Recette du monde')) out.push('aucune recette du monde');
    const panier = panierNoms(semaine);
    const couverts = new Set(); for (const r of plats) for (const l of legumesUtilises(r, panier)) couverts.add(l.nom);
    const oublies = (semaine.panier || []).filter(p => p.legume !== false && !couverts.has(norm(p.nom))).map(p => p.nom);
    if (oublies.length) out.push('pas utilisé : ' + oublies.join(', '));
    const sans = plats.filter(r => !aIngredients(r)).map(r => r.nom);
    if (sans.length) out.push(sans.length + ' plat' + (sans.length > 1 ? 's' : '') + ' sans ingrédients (liste incomplète)');
    return out;
  }

  /** Alternatives classées pour un créneau, le reste du menu restant fixe. */
  function alternatives(recettes, semaines, semaine, cle, options) {
    options = options || {};
    const ctx = contexte(recettes, semaines, semaine, options.assouplir);
    const c = CRENEAUX.find(x => x.cle === cle);
    const choisis = {};
    for (const x of CRENEAUX) { if (x.cle === cle) continue; const e = effectif(semaine.creneaux[x.cle]); if (e && e.type === 'recette') choisis[x.cle] = e.recette; }
    const pris = new Set(Object.values(choisis));
    const actuel = effectif(semaine.creneaux[cle]);
    return recettes.filter(r => estMangeable(r) && (!actuel || actuel.recette !== r.id))
      .map(r => {
        const ex = exclusions(r, c, ctx);
        const n = noter(r, c, ctx, { ...choisis, [cle]: r.id });
        return { recette: r.id, score: n.score - (pris.has(r.id) ? 5 : 0), raison: n.raison, exclusions: ex, dejaCetteSemaine: pris.has(r.id) };
      })
      .sort((a, b) => (a.exclusions.length ? 1 : 0) - (b.exclusions.length ? 1 : 0) || b.score - a.score);
  }

  // ---------- Courses ----------
  const RAYONS = {
    boucherie: 'Boucherie', poissonnerie: 'Poissonnerie', alternatives: 'Alternatives végétales', fruits_legumes: 'Fruits et légumes',
    cremerie: 'Frais et crèmerie', epicerie: 'Épicerie', feculents: 'Féculents et sec', boulangerie: 'Boulangerie', surgeles: 'Surgelés', sans_gluten: 'Sans gluten'
  };
  const ORDRE_RAYONS = {
    auchan: ['boucherie', 'poissonnerie', 'alternatives', 'fruits_legumes', 'cremerie', 'epicerie', 'feculents', 'boulangerie', 'surgeles', 'sans_gluten'],
    supercoop: ['fruits_legumes', 'cremerie', 'alternatives', 'boucherie', 'poissonnerie', 'epicerie', 'feculents', 'boulangerie', 'surgeles', 'sans_gluten']
  };
  const MAGASIN_PAR_RAYON = {
    boucherie: 'auchan', poissonnerie: 'auchan', alternatives: 'supercoop', fruits_legumes: 'supercoop', cremerie: 'supercoop',
    epicerie: 'supercoop', feculents: 'auchan', boulangerie: 'auchan', surgeles: 'auchan', sans_gluten: 'auchan'
  };
  const MAGASINS = { auchan: 'Auchan Drive', supercoop: 'Supercoop' };
  // Produits qu'on préfère acheter au plus près du repas (second passage à Supercoop).
  const RAYONS_FRAIS = ['fruits_legumes', 'cremerie', 'boucherie', 'poissonnerie', 'alternatives'];

  const UNITES = {
    g: ['masse', 1], kg: ['masse', 1000], ml: ['volume', 1], cl: ['volume', 10], l: ['volume', 1000]
  };
  const NOM_UNITE = { piece: '', gousse: 'gousse', cas: 'c. à s.', cac: 'c. à c.', pincee: 'pincée', botte: 'botte', brin: 'brin', tranche: 'tranche', boite: 'boîte', pot: 'pot', sachet: 'sachet', paquet: 'paquet' };

  function arrondi(x) { return Math.round(x * 100) / 100; }
  function fmtNombre(x) { return String(arrondi(x)).replace('.', ','); }
  function fmtUnite(u, q) {
    if (u === 'piece') return '';
    const n = NOM_UNITE[u] ?? u;
    if (!n) return '';
    if (q > 1 && !['c. à s.', 'c. à c.'].includes(n) && !/s$/.test(n)) return n === 'boîte' ? 'boîtes' : n + 's';
    return n;
  }
  /** Additionne une liste de {qte, unite} : masses et volumes convertis entre eux, le reste par unité. */
  function additionner(qs) {
    const parts = {}; let selonGout = false;
    for (const q of qs) {
      if (q.qte == null || !isFinite(q.qte)) { selonGout = true; continue; }
      const u = q.unite || 'piece';
      if (UNITES[u]) { const [f, k] = UNITES[u]; parts[f] = (parts[f] || 0) + q.qte * k; }
      else parts['u:' + u] = (parts['u:' + u] || 0) + q.qte;
    }
    return { parts, selonGout };
  }
  function soustraire(total, q) {
    if (q.qte == null) return;
    const u = q.unite || 'piece';
    const k = UNITES[u] ? UNITES[u][0] : 'u:' + u;
    const f = UNITES[u] ? UNITES[u][1] : 1;
    if (k in total.parts) total.parts[k] = Math.max(0, total.parts[k] - q.qte * f);
  }
  function texteQuantite(total) {
    const out = [];
    for (const [k, v] of Object.entries(total.parts)) {
      if (v <= 0) continue;
      if (k === 'masse') out.push(v >= 1000 ? fmtNombre(v / 1000) + ' kg' : fmtNombre(v) + ' g');
      else if (k === 'volume') out.push(v >= 1000 ? fmtNombre(v / 1000) + ' l' : v >= 100 && v % 10 === 0 ? fmtNombre(v / 10) + ' cl' : fmtNombre(v) + ' ml');
      else { const u = k.slice(2); const s = fmtUnite(u, v); out.push(fmtNombre(v) + (s ? ' ' + s : '')); }
    }
    if (!out.length) return total.selonGout ? 'selon le goût' : '';
    return out.join(' + ');
  }

  /** Ingrédients d'un plat pour un créneau donné : base + option Marie (+ Etienne). */
  function ingredientsDuPlat(r) {
    const liste = (r.ingredients || []).map(i => ({ ...i }));
    const appliquer = (v) => {
      if (!v) return;
      for (const ret of v.retirer || []) {
        const n = norm(ret.nom);
        for (const i of liste) if (norm(i.nom) === n) {
          if (ret.qte == null) i._retire = true;
          else if (i.qte != null) {
            const t = additionner([i]); soustraire(t, ret);
            const u = i.unite || 'piece'; const f = UNITES[u] ? UNITES[u][1] : 1; const k = UNITES[u] ? UNITES[u][0] : 'u:' + u;
            i.qte = arrondi((t.parts[k] || 0) / f);
            if (i.qte <= 0) i._retire = true;
          }
        }
      }
      for (const a of v.ajouter || []) liste.push({ ...a, _pour: v === r.marie ? 'Marie' : 'Etienne' });
    };
    appliquer(r.marie);
    appliquer(r.etienne);
    return liste.filter(i => !i._retire);
  }

  /**
   * Calcule les deux listes. Renvoie
   * { auchan: {rayons: [{rayon, lignes}], verifier: []}, supercoop: {...}, maison: [], sansIngredients: [recette], plats: n }
   * Chaque ligne : { cle, nom, quantite, rayon, magasin, pour: [plats], avance: bool }
   */
  function courses(recettes, semaine, reglages) {
    reglages = reglages || {};
    const parId = {}; for (const r of recettes) parId[r.id] = r;
    const politique = { ...MAGASIN_PAR_RAYON, ...(reglages.magasinParRayon || {}) };
    const panier = new Set((semaine.panier || []).map(p => norm(p.nom)));
    const supercoopDate = semaine.supercoop || semaine.debut;
    const second = semaine.supercoop2 && semaine.supercoop2 > supercoopDate ? semaine.supercoop2 : null;
    const groupes = {}; const maison = {}; const sansIngredients = []; let plats = 0;
    for (const c of CRENEAUX) {
      const e = effectif(semaine.creneaux[c.cle]);
      if (!e || e.type !== 'recette') continue;
      const r = parId[e.recette]; if (!r) continue;
      plats++;
      if (!aIngredients(r)) { sansIngredients.push({ recette: r, creneau: c.cle }); continue; }
      const date = dateCreneau(semaine.debut, c.cle);
      for (const i of ingredientsDuPlat(r)) {
        const n = norm(i.nom);
        if (panier.has(n)) { (maison[n] = maison[n] || { nom: i.nom, pour: new Set() }).pour.add(r.nom); continue; }
        let mag = i.magasin || politique[i.rayon] || 'auchan';
        let avance = false;
        if (mag === 'supercoop' && date < supercoopDate && !i.placard) { mag = 'auchan'; avance = true; }
        const tard = mag === 'supercoop' && second && date >= second && !i.placard && RAYONS_FRAIS.includes(i.rayon);
        const cle = mag + ':' + n + (i.placard ? ':p' : '') + (tard ? ':2' : '');
        const g = groupes[cle] = groupes[cle] || { cle, nom: i.nom, rayon: i.rayon || 'epicerie', magasin: mag, placard: !!i.placard, tard, qs: [], pour: new Set(), avance: false, marie: false, estime: false };
        g.qs.push(i); g.pour.add(r.nom); if (avance) g.avance = true; if (i._pour === 'Marie') g.marie = true; if (i.estime) g.estime = true;
      }
    }
    const out = { sansIngredients, plats, maison: Object.values(maison).map(m => ({ nom: m.nom, pour: [...m.pour] })) };
    for (const mag of ['auchan', 'supercoop']) {
      const lignes = Object.values(groupes).filter(g => g.magasin === mag).map(g => ({
        cle: g.cle, nom: g.nom, rayon: g.rayon, magasin: mag, placard: g.placard, tard: g.tard, quantite: texteQuantite(additionner(g.qs)),
        pour: [...g.pour], avance: g.avance, marie: g.marie, estime: g.estime
      })).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
      const parRayon = liste => {
        const rayons = [];
        for (const ry of ORDRE_RAYONS[mag]) {
          const l = liste.filter(x => x.rayon === ry);
          if (l.length) rayons.push({ rayon: ry, titre: RAYONS[ry], lignes: l });
        }
        const autres = liste.filter(x => !ORDRE_RAYONS[mag].includes(x.rayon));
        if (autres.length) rayons.push({ rayon: 'autre', titre: 'Autres', lignes: autres });
        return rayons;
      };
      out[mag] = {
        rayons: parRayon(lignes.filter(x => !x.placard && !x.tard)),
        plusTard: parRayon(lignes.filter(x => x.tard)),
        dateSecond: mag === 'supercoop' ? second : null,
        verifier: lignes.filter(x => x.placard)
      };
    }
    return out;
  }

  /** Liste en texte propre, rayon par rayon, pour le drive. */
  function texteListe(liste, mag, semaine, extras) {
    const l = liste[mag];
    const lignes = [MAGASINS[mag].toUpperCase() + ' — semaine du ' + dateCourte(semaine.debut), ''];
    for (const ry of l.rayons) {
      lignes.push(ry.titre.toUpperCase());
      for (const x of ry.lignes) lignes.push('- ' + x.nom + (x.quantite ? ' : ' + x.quantite : ''));
      lignes.push('');
    }
    if (l.plusTard && l.plusTard.length) {
      lignes.push('SECOND PASSAGE (' + dateCourte(l.dateSecond).toUpperCase() + ')');
      for (const ry of l.plusTard) for (const x of ry.lignes) lignes.push('- ' + x.nom + (x.quantite ? ' : ' + x.quantite : ''));
      lignes.push('');
    }
    for (const x of extras || []) lignes.push('- ' + x);
    if (l.verifier.length) {
      lignes.push('À VÉRIFIER DANS LE PLACARD');
      for (const x of l.verifier) lignes.push('- ' + x.nom + (x.quantite && x.quantite !== 'selon le goût' ? ' : ' + x.quantite : ''));
    }
    return lignes.join('\n').trim() + '\n';
  }

  globalThis.Moteur = {
    CRENEAUX, REGLES_DURES, RAYONS, MAGASINS, MAGASIN_PAR_RAYON, ORDRE_RAYONS, JOURS,
    ymd, parse, ajouterJours, completer, semaineParDefaut, ecartJours, debutSemaine, dateCreneau, dateCourte, semaineVide, saisonDe, deSaison,
    norm, effectif, historique, FAMILLES, legumesUtilises, exclusions, proposer, alternatives, bilan, fusion,
    ingredientsDuPlat, additionner, texteQuantite, courses, texteListe, aIngredients
  };
})();
