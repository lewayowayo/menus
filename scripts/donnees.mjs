// Accès direct de Claude aux données de l'appli (Supabase), depuis le Mac d'Etienne.
// La clé secrète est dans .env.local (jamais publiée) : SUPABASE_SECRET_KEY=sb_secret_...
//
//   node scripts/donnees.mjs cles [prefixe]            liste les clés (ex. semaine:, avis:, note:)
//   node scripts/donnees.mjs lire <cle>                affiche une valeur
//   node scripts/donnees.mjs ecrire <cle> <fichier.json>   remplace une valeur
//   node scripts/donnees.mjs panier <mercredi> --legumes "a; b; c" [--autres "tartinade; compote"] [--restes "texte"]
//        ajoute au panier de la semaine (sans effacer ce qui y est déjà)
//   node scripts/donnees.mjs avis                      avis et notes de la famille, en texte
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = {};
const fEnv = path.join(racine, '.env.local');
if (fs.existsSync(fEnv)) for (const l of fs.readFileSync(fEnv, 'utf8').split('\n')) { const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/); if (m) env[m[1]] = m[2]; }
const cfg = fs.readFileSync(path.join(racine, 'config.js'), 'utf8');
const URL_ = cfg.match(/supabaseUrl:\s*'([^']+)'/)[1];
const CLE = env.SUPABASE_SECRET_KEY;
if (!CLE) { console.error('Clé secrète absente : ajouter SUPABASE_SECRET_KEY=... dans .env.local'); process.exit(1); }
vm.runInThisContext(fs.readFileSync(path.join(racine, 'js/moteur.js'), 'utf8'));
const M = globalThis.Moteur;

async function api(chemin, opts = {}) {
  const r = await fetch(URL_ + '/rest/v1/' + chemin, { ...opts, headers: { apikey: CLE, Authorization: 'Bearer ' + CLE, 'Content-Type': 'application/json', ...(opts.headers || {}) } });
  const t = await r.text();
  if (!r.ok) throw new Error(r.status + ' ' + t);
  return t ? JSON.parse(t) : null;
}
const lire = async cle => { const r = await api('kv?select=valeur,maj,par&cle=eq.' + encodeURIComponent(cle)); return r[0] ? r[0].valeur : null; };
const ecrire = (cle, valeur) => api('kv?on_conflict=cle', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify([{ cle, valeur, par: 'Claude' }]) });
const liste = s => (s || '').split(';').map(x => x.trim()).filter(Boolean);
const arg = nom => { const i = process.argv.indexOf('--' + nom); return i > 0 ? process.argv[i + 1] : null; };

const [cmd, a1, a2] = process.argv.slice(2);
if (cmd === 'cles') {
  const r = await api('kv?select=cle,maj,par&order=cle' + (a1 ? '&cle=like.' + encodeURIComponent(a1 + '*') : ''));
  for (const x of r) console.log(x.cle.padEnd(50), x.maj.slice(0, 16), x.par || '');
} else if (cmd === 'lire') {
  console.log(JSON.stringify(await lire(a1), null, 1));
} else if (cmd === 'ecrire') {
  await ecrire(a1, JSON.parse(fs.readFileSync(a2, 'utf8'))); console.log('✓ ' + a1);
} else if (cmd === 'panier') {
  const debut = a1; if (!/^\d{4}-\d{2}-\d{2}$/.test(debut || '') || M.debutSemaine(debut) !== debut) { console.error('Donner le mercredi qui ouvre la semaine (AAAA-MM-JJ)'); process.exit(1); }
  const s = M.completer((await lire('semaine:' + debut)) || M.semaineVide(debut));
  const deja = new Set(s.panier.map(p => M.norm(p.nom)));
  for (const n of liste(arg('legumes'))) if (!deja.has(M.norm(n))) { s.panier.push({ nom: n, legume: true }); deja.add(M.norm(n)); }
  for (const n of liste(arg('autres'))) if (!deja.has(M.norm(n))) { s.panier.push({ nom: n, legume: false }); deja.add(M.norm(n)); }
  if (arg('restes')) s.restes = [s.restes, arg('restes')].filter(Boolean).join(' ; ');
  await ecrire('semaine:' + debut, s);
  const connus = (await lire('legumes')) || [];
  const nouveaux = liste(arg('legumes')).filter(n => !connus.some(c => M.norm(c) === M.norm(n)));
  if (nouveaux.length) await ecrire('legumes', [...connus, ...nouveaux]);
  console.log('✓ panier de la semaine du ' + debut + ' :', s.panier.map(p => p.nom).join(', '), s.restes ? '| restes : ' + s.restes : '');
} else if (cmd === 'avis') {
  const R = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(racine, 'recettes.json'))).recettes.map(r => [r.id, r]));
  for (const p of ['avis:', 'note:']) {
    const r = await api('kv?select=cle,valeur&cle=like.' + encodeURIComponent(p + '*'));
    for (const x of r) if (x.valeur) { const [id, qui] = x.cle.slice(p.length).split(':'); console.log(p.slice(0, -1), id, (R[id] || {}).nom, qui ? '(' + qui + ')' : '', JSON.stringify(x.valeur)); }
  }
} else {
  console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(0, 11).join('\n'));
}
