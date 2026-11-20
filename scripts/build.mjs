// Vérifie toutes les fiches de recettes/ et produit recettes.json (l'index lu par l'appli).
// Usage : node scripts/build.mjs        (échoue avec la liste des erreurs si une fiche est invalide)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dossier = path.join(racine, 'recettes');
const STATUTS = ['validee', 'a_valider', 'a_tester', 'petite_folie', 'ecartee'];
const SAISONS = ['toute', 'printemps', 'ete', 'automne', 'hiver'];
const CRENEAUX = ['rapide', 'leger', 'genereux', 'midi_simple'];
const RAYONS = ['boucherie', 'poissonnerie', 'alternatives', 'fruits_legumes', 'cremerie', 'epicerie', 'feculents', 'boulangerie', 'surgeles', 'sans_gluten'];
const UNITES = ['g', 'kg', 'ml', 'cl', 'l', 'piece', 'gousse', 'cas', 'cac', 'pincee', 'botte', 'brin', 'tranche', 'boite', 'pot', 'sachet', 'paquet', null];
const INTERDITS = [/saumon/i, /\bthon\b/i, /aubergine/i];

const erreurs = []; const avertissements = [];
const recettes = []; const ids = new Set();

function verifIngredient(i, ou) {
  if (!i.nom) erreurs.push(`${ou} : ingrédient sans nom`);
  if (i.qte != null && typeof i.qte !== 'number') erreurs.push(`${ou} : ${i.nom} qte non numérique`);
  if (!UNITES.includes(i.unite ?? null)) erreurs.push(`${ou} : ${i.nom} unité inconnue « ${i.unite} »`);
  if (i.rayon && !RAYONS.includes(i.rayon)) erreurs.push(`${ou} : ${i.nom} rayon inconnu « ${i.rayon} »`);
  if (i.magasin && !['auchan', 'supercoop'].includes(i.magasin)) erreurs.push(`${ou} : ${i.nom} magasin inconnu`);
  for (const re of INTERDITS) if (re.test(i.nom)) erreurs.push(`${ou} : ingrédient interdit dans la famille : ${i.nom}`);
}

for (const d of fs.readdirSync(dossier).sort()) {
  const f = path.join(dossier, d, 'recette.json');
  if (!fs.existsSync(f)) continue;
  let r;
  try { r = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { erreurs.push(`${d} : JSON invalide (${e.message})`); continue; }
  const ou = r.id || d;
  if (!/^r\d{3,}$/.test(r.id || '')) erreurs.push(`${d} : id invalide`);
  if (!d.startsWith(r.id + '-')) erreurs.push(`${d} : le dossier doit commencer par l'id ${r.id}`);
  if (ids.has(r.id)) erreurs.push(`${ou} : id en double`); ids.add(r.id);
  if (!STATUTS.includes(r.statut)) erreurs.push(`${ou} : statut inconnu ${r.statut}`);
  for (const s of r.saisons || []) if (!SAISONS.includes(s)) erreurs.push(`${ou} : saison inconnue ${s}`);
  for (const c of r.creneaux || []) if (!CRENEAUX.includes(c)) erreurs.push(`${ou} : créneau inconnu ${c}`);
  for (const re of INTERDITS) if (re.test(r.nom)) erreurs.push(`${ou} : nom contient un produit interdit`);
  (r.ingredients || []).forEach(i => verifIngredient(i, ou));
  for (const v of [r.marie, r.etienne]) if (v) { (v.ajouter || []).forEach(i => verifIngredient(i, ou + ' (variante)')); }
  for (const p of r.pieces_jointes || []) {
    const pf = path.join(dossier, d, p.fichier);
    if (!fs.existsSync(pf)) erreurs.push(`${ou} : pièce jointe manquante ${p.fichier}`);
    else if (/\.(heic|png)$/i.test(p.fichier)) avertissements.push(`${ou} : ${p.fichier} devrait être converti en JPEG`);
    else if (fs.statSync(pf).size > 600_000) avertissements.push(`${ou} : ${p.fichier} pèse plus de 600 Ko, à compresser`);
    p.chemin = `recettes/${d}/${p.fichier}`;
  }
  if (r.statut === 'validee' && !(r.ingredients || []).length) erreurs.push(`${ou} : une recette validée doit avoir ses ingrédients`);
  if (r.duree_min == null) avertissements.push(`${ou} : durée inconnue`);
  r.dossier = d;
  recettes.push(r);
}

for (const a of avertissements) console.warn('⚠︎ ' + a);
if (erreurs.length) { for (const e of erreurs) console.error('✗ ' + e); console.error(`\n${erreurs.length} erreur(s), recettes.json non mis à jour.`); process.exit(1); }

const sortie = { genere: new Date().toISOString(), recettes };
fs.writeFileSync(path.join(racine, 'recettes.json'), JSON.stringify(sortie));
// Version des fichiers pour le service worker : change à chaque build.
const v = Date.now().toString(36);
const sw = path.join(racine, 'sw.js');
if (fs.existsSync(sw)) fs.writeFileSync(sw, fs.readFileSync(sw, 'utf8').replace(/const VERSION='[^']*'/, `const VERSION='${v}'`));
const parStatut = {}; for (const r of recettes) parStatut[r.statut] = (parStatut[r.statut] || 0) + 1;
console.log(`✓ ${recettes.length} recettes`, parStatut, `version ${v}`);
