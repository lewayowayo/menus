// Usage unique : crée un dossier par recette du seed, avec les métadonnées du seed.
// Les champs culinaires (ingredients, etapes, marie, étiquettes) sont remplis ensuite.
import fs from 'node:fs';
const seed = JSON.parse(fs.readFileSync(new URL('./recettes-seed.json', import.meta.url)));
const MOIS = {janv:1,'févr':2,mars:3,avr:4,mai:5,juin:6,juillet:7,'juil':7,'août':8,sept:9,oct:10,nov:11,'déc':12};
function date(s){ if(!s) return null; const m = s.replace('1er','1').match(/(\d+)\s+([a-zéû]+)\.?\s+(\d{4})/i); if(!m) return null;
  const mo = MOIS[m[2].toLowerCase()]; return `${m[3]}-${String(mo).padStart(2,'0')}-${m[1].padStart(2,'0')}`; }
function slug(s){ return s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/œ/g,'oe').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').split('-').slice(0,5).join('-'); }
function minutes(t){ if(!t) return null; const h=t.match(/(\d+)\s*h\s*(\d+)?/); if(h) return +h[1]*60+(+h[2]||0); return +t.match(/\d+/)[0]; }
function saisons(s){ return {Toute:['toute'],'Été':['ete'],'Printemps':['printemps'],'Automne/Hiver':['automne','hiver']}[s] || ['toute']; }
for (const r of seed.recettes) {
  const id = 'r' + String(r.numero).padStart(3,'0');
  const dir = `recettes/${id}-${slug(r.nom)}`;
  fs.mkdirSync(dir, {recursive:true});
  const fiche = {
    id, nom: r.nom, statut: 'a_valider', redaction: null, a_completer: [],
    choisie_par: r.choisie_par, origine: r.origine, categorie: r.categorie,
    source: { nom: r.source, lien: null },
    duree_min: minutes(r.temps), saisons: saisons(r.saison),
    sans_gluten: { statut: null, note: r.sans_gluten },
    vegetarien: null, creneaux: [], legumes_amap: [], tres_frais: [],
    portions: 5, ingredients: [], etapes: [],
    marie: { texte: null, ajouter: [], retirer: [], soir: null },
    etienne: null,
    remarque: r.remarque,
    ancien: { option_marie: r.option_marie_soir, fois_au_menu: r.fois_au_menu, derniere_fois: date(r.derniere_fois) ?? r.derniere_fois },
    pieces_jointes: []
  };
  fs.writeFileSync(`${dir}/recette.json`, JSON.stringify(fiche, null, 1) + '\n');
}
console.log('ok', seed.recettes.length);
