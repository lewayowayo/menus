// Tests du moteur : node test/run.mjs
// Rejoue la semaine du 18 novembre 2026 (critères des étapes 2 et 3 du brief).
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
vm.runInThisContext(fs.readFileSync(path.join(racine, 'js/moteur.js'), 'utf8'));
const M = globalThis.Moteur;
const R = JSON.parse(fs.readFileSync(path.join(racine, 'recettes.json'))).recettes;
let ok = 0, ko = 0;
const t = (nom, cond, detail) => { if (cond) { ok++; } else { ko++; console.error('✗ ' + nom + (detail ? ' : ' + detail : '')); } };
const nom = id => (R.find(r => r.id === id) || {}).nom;

// Toutes les recettes autorisées (aucune n'est encore validée au départ).
const ASSOUPLIR = { statut: true };

// --- Semaine du 18/11 : panier réel
const s = M.semaineVide('2026-11-18');
s.panier = ['chou frisé', 'blettes', 'patates douces', 'panais', 'navet'].map(n => ({ nom: n }));
s.supercoop = '2026-11-19';
const p = M.proposer(R, [], s, { assouplir: ASSOUPLIR });
t('10 créneaux remplis', Object.values(p.creneaux).filter(Boolean).length === 10, JSON.stringify(p.manques));
s.creneaux = M.fusion(s, p.creneaux);
const ids = Object.values(p.creneaux).map(x => x.recette);
t('pas de doublon dans la semaine', new Set(ids).size === ids.length);
const hist = M.historique(R, []);
for (const c of M.CRENEAUX) {
  const id = p.creneaux[c.cle].recette; const d = M.dateCreneau(s.debut, c.cle);
  const der = hist[id].derniere;
  t(`pas de plat récent (${c.cle})`, !der || M.ecartJours(der, d) >= 21 || der >= s.debut && false, `${nom(id)} servie le ${der}`);
}
t('mercredi soir rapide', (R.find(r => r.id === p.creneaux.mer_soir.recette).duree_min || 99) <= 25);
t('chaque proposition a une raison', Object.values(p.creneaux).every(x => x.raison));
const b = M.bilan(R, s);
t('légumes du panier utilisés', !b.some(x => x.startsWith('pas utilisé')), b.join(' / '));

const parId = Object.fromEntries(R.map(r => [r.id, r]));
t('mercredi midi : pas un plat de plus de 40 min', (parId[p.creneaux.mer_midi.recette].duree_min || 0) <= 40, nom(p.creneaux.mer_midi.recette));
const types = Object.values(p.creneaux).map(x => M.norm(nom(x.recette)).split(' ')[0]).filter(x => x.length > 3);
t('pas deux plats du même type', new Set(types).size === types.length, types.join(', '));

// --- Courses avant correction, et cases cochées
let L = M.courses(R, s, {});
const lignes = mag => L[mag].rayons.flatMap(r => r.lignes);
t('deux listes non vides', lignes('auchan').length > 0 && lignes('supercoop').length > 0);
t('rien du panier dans les listes', ![...lignes('auchan'), ...lignes('supercoop')].some(l => ['chou frise', 'blette', 'patate douce', 'panai', 'navet'].includes(M.norm(l.nom))));
const merSoir = R.find(r => r.id === p.creneaux.mer_soir.recette);
const fraisMer = (merSoir.ingredients || []).filter(i => i.rayon === 'fruits_legumes' && !i.placard && !s.panier.some(x => M.norm(x.nom) === M.norm(i.nom)));
for (const i of fraisMer) t('exception fraîcheur mercredi soir : ' + i.nom, lignes('auchan').some(l => M.norm(l.nom) === M.norm(i.nom) && l.avance));
const coches = {}; for (const l of lignes('auchan').slice(0, 4)) coches[l.cle] = true;

// --- Mercredi : un plat remplacé (réel), jeudi : un autre remplacé (réel)
const alt1 = M.alternatives(R, [], s, 'mer_soir', { assouplir: ASSOUPLIR }).find(a => !a.exclusions.length);
s.creneaux.mer_soir.reel = { type: 'recette', recette: alt1.recette };
s.creneaux.jeu_soir.reel = { type: 'libre', texte: 'Poulet rôti apporté par les invités' };
const ef = M.effectif(s.creneaux.mer_soir);
t('le réel prime sur le prévu', ef.recette === alt1.recette);
t('le prévu reste en mémoire', s.creneaux.mer_soir.prevu.recette === p.creneaux.mer_soir.recette);

// Relancer ne touche pas aux créneaux corrigés
s.graine = 5;
const p2 = M.proposer(R, [], s, { assouplir: ASSOUPLIR });
t('relancer garde les créneaux corrigés', !('mer_soir' in p2.creneaux) && !('jeu_soir' in p2.creneaux));

// Verrou
const s3 = JSON.parse(JSON.stringify(s)); s3.creneaux.sam_soir.verrou = true;
const p3 = M.proposer(R, [], s3, { assouplir: ASSOUPLIR });
t('un créneau verrouillé ne bouge pas', !('sam_soir' in p3.creneaux));

// --- Historique et règle des 3 semaines : la semaine suivante ne repropose pas ce qui a été mangé
const H = M.historique(R, [s]);
t('historique compte le réel', H[alt1.recette].dates.some(d => d.creneau === 'mer_soir'));
t('historique ne compte pas le prévu remplacé', !H[p.creneaux.mer_soir.recette].dates.some(d => d.creneau === 'mer_soir'));
const s2 = M.semaineVide('2026-11-25');
s2.panier = [{ nom: 'poireau' }, { nom: 'carotte' }];
const q = M.proposer(R, [s], s2, { assouplir: ASSOUPLIR });
const manges = M.CRENEAUX.map(c => M.effectif(s.creneaux[c.cle])).filter(e => e && e.type === 'recette').map(e => e.recette);
const repris = Object.values(q.creneaux).filter(Boolean).map(x => x.recette).filter(id => manges.includes(id));
t('semaine suivante : aucun plat mangé la semaine précédente', repris.length === 0, repris.map(nom).join(', '));

// --- Courses après correction : les cases cochées restent
L = M.courses(R, s, {});
const apres = new Set([...lignes('auchan'), ...lignes('supercoop')].map(l => l.cle));
const gardees = Object.keys(coches).filter(k => apres.has(k));
t('les lignes cochées encore utiles sont toujours là', gardees.length > 0);
t('le plat libre ne génère pas de courses', L.plats === 9);

// --- Second passage à Supercoop : les produits frais des repas à partir de samedi y sont mis de côté
const sP = JSON.parse(JSON.stringify(s)); sP.supercoop = '2026-11-18'; sP.supercoop2 = '2026-11-21';
const LP = M.courses(R, sP, {});
const tard = LP.supercoop.plusTard.flatMap(r => r.lignes);
t('second passage non vide', tard.length > 0);
t('second passage : seulement des produits frais', tard.every(l => ['fruits_legumes', 'cremerie', 'boucherie', 'poissonnerie', 'alternatives'].includes(l.rayon)));
t('Supercoop le mercredi : pas d\'exception fraîcheur', !LP.auchan.rayons.flatMap(r => r.lignes).some(l => l.avance));

// --- Mardi soir : on ouvre la semaine qui commence le lendemain
t('mardi → semaine du lendemain', M.semaineParDefaut('2026-11-24') === '2026-11-25');
t('mercredi → semaine du jour', M.semaineParDefaut('2026-11-25') === '2026-11-25');
t('vendredi → semaine en cours', M.semaineParDefaut('2026-11-20') === '2026-11-18');

// --- Ancienne semaine enregistrée sans samedi midi
const vieille = M.semaineVide('2026-11-18'); delete vieille.creneaux.sam_midi;
t('semaine sans samedi midi complétée', !!M.completer(vieille).creneaux.sam_midi);

// --- Addition des quantités
const a = M.additionner([{ qte: 2, unite: 'piece' }, { qte: 300, unite: 'g' }, { qte: 1, unite: 'piece' }, { qte: 0.2, unite: 'kg' }]);
t('2 + 1 pièces et 300 g + 0,2 kg', M.texteQuantite(a) === '3 + 500 g', M.texteQuantite(a));
t('20 cl + 1 pot', M.texteQuantite(M.additionner([{ qte: 20, unite: 'cl' }, { qte: 1, unite: 'pot' }])) === '20 cl + 1 pot');

// --- Option Marie : substitution sans gluten
const carbo = R.find(r => /carbonara/i.test(r.nom));
const ing = M.ingredientsDuPlat(carbo);
t('option Marie ajoutée aux courses', (carbo.marie.ajouter || []).every(x => ing.some(i => i.nom === x.nom)));

// --- Recette sans ingrédients signalée
const sV = M.semaineVide('2026-12-02'); sV.creneaux.jeu_soir.prevu = { recette: 'r001' };
const faux = R.map(r => r.id === 'r001' ? { ...r, ingredients: [] } : r);
t('recette sans ingrédients signalée', M.courses(faux, sV, {}).sansIngredients.length === 1);

// --- Règles famille
t('aucun saumon, thon, aubergine', !R.some(r => JSON.stringify(r.ingredients).match(/saumon|"thon|aubergine/i)));

console.log(`${ok} vérifications OK${ko ? `, ${ko} en échec` : ''}`);
process.exit(ko ? 1 : 0);
