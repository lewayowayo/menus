# Menus de la semaine

Lis ce fichier en premier. Etienne ouvre une conversation ici pour ajouter une recette, saisir un panier, appliquer les avis de la famille ou corriger une règle. Il ne doit rien avoir à réexpliquer.

## L'appli en deux phrases

PWA statique (même pile que Houle et Révisions : HTML + JS sans framework ni build), publiée sur GitHub Pages depuis `main` du dépôt `lewayowayo/menus`. Les recettes vivent dans le dépôt (seule source de vérité, l'appli ne les modifie jamais) ; ce qui change chaque semaine (panier, menu, cases cochées, notes, avis) vit dans Supabase (accès libre, sans mot de passe depuis le 22/11/2026), avec copie locale sur chaque téléphone pour le hors-ligne.

- `recettes/<id>-<slug>/recette.json` + pièces jointes : une recette par dossier. Format : `docs/format-recette.md`.
- `recettes.json` : index généré par `node scripts/build.mjs` (ne jamais l'éditer à la main).
- `js/moteur.js` : menu par règles, historique, listes de courses (logique pure, testée par `node test/run.mjs`).
- `js/stockage.js` : copie locale + synchro Supabase (`supabase/schema.sql`). `config.js` : URL et clé publique Supabase.
- `js/app.js`, `index.html` : interface. `sw.js` : hors-ligne.
- Aucun appel à une IA depuis l'appli. L'intelligence, c'est cette conversation.

## Règles de la famille (priment sur tout le reste)

Famille de 5 à Bordeaux : Etienne (sportif, ne mange pas de frites), Marie, Emma (15 ans), Diego (12 ans), Billie (8 ans). Quantités toujours pour 5.
- Marie évite le gluten, de façon souple (un peu de temps en temps n'est pas grave). Elle n'est **pas** végétarienne. Le soir, elle mange peu de féculents. Son option = substitution sans gluten de sa part (`marie.ajouter` / `marie.retirer`) + une phrase pour le soir (`marie.soir`).
- Jamais de saumon (gros poisson plein de polluants) : toujours de la truite. Pas de thon, pas d'aubergine. `build.mjs` refuse ces ingrédients.
- Courses : Supercoop (coopérative, bio) en priorité ; Auchan Drive pour les viandes simples (poulet…), le sec, les féculents, le sans gluten. La répartition par rayon est réglable dans l'appli (Plus > Magasin par rayon). Si le passage à Supercoop est réglé après certains repas, ces repas prennent leurs produits Supercoop sur la liste Auchan.
- Le panier AMAP arrive le mardi soir ; le menu se fait le mardi soir ou le mercredi matin (le mardi, l'appli ouvre d'office la semaine qui commence le lendemain). Une semaine = 10 repas : tous les soirs du mercredi au mardi, plus samedi midi, dimanche midi et le mercredi midi suivant.
- Courses le mercredi après-midi, drive et Supercoop le même jour (Supercoop est juste à côté de la maison). Un second passage à Supercoop est possible dans la semaine : les produits frais des repas à partir de ce jour-là y sont mis de côté (meilleures DLC).

## Ne jamais inventer de contenu culinaire

Quand tu rédiges une fiche à partir d'une source, tu transcris ce qui s'y trouve. Si la source ne donne ni quantités ni étapes : demande à Etienne, ou estime et signale-le (`"estime": true` sur l'ingrédient, et une ligne dans `a_completer`). Les 40 fiches de départ ont été rédigées par Claude en version standard (`"redaction": "claude"`) à la demande d'Etienne : elles restent `a_valider` tant que la famille ne les a pas relues.

## Procédure : « ajoute cette recette »

1. **Lire la source.**
   - Capture ou photo : la lire directement. HEIC ou PNG → convertir et compresser : `sips -s format jpeg -s formatOptions 75 -Z 1400 entree.heic --out recettes/<dossier>/capture.jpg` (viser < 400 Ko).
   - Vidéo (enregistrement d'écran du reel fait sur l'iPhone, envoyé par AirDrop ou déposé dans la conversation) : `swift scripts/images-video.swift <video> <dossier-scratchpad> 1` extrait une image par seconde (rien à installer ; `0.5` si les gestes vont vite). Lire les images dans l'ordre, noter les ingrédients et quantités montrés à l'écran ou incrustés, puis les étapes. Le son n'est pas lu : si la voix off donne des quantités, demander à Etienne. Garder 1 ou 2 images parlantes comme pièces jointes.
   - Lien : le lire (agent web-fetch) ; Instagram demande souvent une connexion → demander une capture.
2. **Rédiger la fiche** selon `docs/format-recette.md` : prochain id libre (`ls recettes | tail -1`, jamais réutiliser un id), noms d'ingrédients du vocabulaire commun (c'est ce qui permet l'addition dans les courses), quantités pour 5 (si la source est pour 4 ou pour « une tarte », dire comment tu as converti et le noter dans `a_completer`), option Marie, champ `etienne` si frites, étiquettes (`creneaux`, `legumes_amap`, `legumes_libres`, `tres_frais`, `saisons`, `vegetarien`). Statut : `a_tester` pour une nouveauté, `validee` seulement si Etienne dit qu'elle est testée et approuvée.
3. **Montrer la fiche à Etienne** en clair (ingrédients, étapes, option Marie, ce qui a été estimé) et attendre son accord.
4. **Vérifier** : `node scripts/build.mjs` (doit finir par ✓) puis `node test/run.mjs`.
5. **Publier** : `git add -A && git commit -m "Recette : <nom>" && git push`. GitHub Pages se met à jour en 1 à 2 minutes ; l'appli prend la nouvelle version à la prochaine ouverture (le service worker change de version à chaque build).

## Autres demandes fréquentes

- **« Voici les avis de la famille »** (texte copié depuis Plus > Avis et notes) : pour chaque fiche, appliquer la correction demandée ; « validée telle quelle » → `statut: "validee"`, retirer la ligne « rédigée par Claude » de `a_completer` et passer `redaction` à `famille` ; « à écarter » → `statut: "ecartee"` (ne jamais supprimer le dossier : l'historique s'y réfère par id). Puis build, test, commit, push.
- **Renommer une recette** : changer `nom` seulement. L'id et le dossier restent (le dossier peut être renommé si on garde le préfixe `rNNN-`).
- **Panier de la semaine** : il se saisit dans l'appli (onglet Semaine > Panier), pas ici. Si Etienne envoie une photo du panier ici, lui dire ce que tu y vois pour qu'il le coche, ou le saisir toi-même seulement si l'accès Supabase est configuré dans la conversation.
- **Changer une règle du menu** : `js/moteur.js` (`exclusions` pour les règles dures, `noter` pour les préférences). Ajouter le cas dans `test/run.mjs`.

## Historique et délai entre deux passages

L'historique commence avec l'appli (20/11/2026) : il se construit à partir des semaines enregistrées (le réel prime sur le prévu). Le champ `ancien` des fiches (passages de l'ancienne tâche planifiée) est archivé et n'est plus utilisé. Délai minimum avant de reproposer une recette : 2 semaines par défaut, réglable dans Plus > Règles du menu (`reglages.recenceJours`).

## Partage entre téléphones (Supabase)

Projet Supabase d'Etienne, table `kv` (une ligne par donnée), accessible par les fonctions `kv_lire`, `kv_ecrire`, `kv_verifier`. Depuis le 22/11/2026, pas de mot de passe à la demande d'Etienne : l'appli envoie le jeton public `acces` de `config.js` (son empreinte est dans la table `secret`), et demande seulement « Qui es-tu ? » au premier lancement. Pour remettre un vrai mot de passe : retirer `acces` de `config.js` et changer l'empreinte dans `secret` (avec la clé secrète ou la requête de `supabase/schema.sql`). `config.js` vide = mode local (chaque téléphone garde ses données ; elles sont envoyées automatiquement au premier branchement).

Rôles : Etienne et Marie font tout ; Emma, Diego et Billie (comptes « enfants », `ADULTES` dans `js/app.js`) consultent le menu et les recettes, notent, donnent leur avis et cochent les courses, sans proposer ni modifier le menu, le panier ou les réglages. Ce n'est pas une sécurité : on peut changer de prénom dans Plus.

Habituels des courses (goûters, petit-déj : brioche, gros yaourts, fromage blanc au lait de montagne) : clé `habituels`, ajoutés à chaque semaine ; `habituels-retires:<mercredi>` pour ceux enlevés une semaine. Réglables dans Plus.

Clés : `semaine:<mercredi>` (panier, créneaux `prevu` / `reel` / `verrou`, jour Supercoop), `coche:<mercredi>:<magasin>:<ingrédient>`, `extras:<mercredi>`, `note:<id>`, `avis:<id>`, `legumes`, `photo:<id>`, `reglages`.

## Agir directement sur les données de l'appli

`scripts/donnees.mjs` lit et écrit dans Supabase avec la clé secrète de `.env.local` (fichier ignoré par git, jamais publié). Pas besoin de MCP ni de mot de passe famille.
- Panier depuis des photos : lire les photos (HEIC → `sips` en JPEG dans le scratchpad), lister à Etienne ce que tu vois, puis `node scripts/donnees.mjs panier <mercredi> --legumes "chou frisé; blettes" --autres "tartinade courgette" --restes "rutabaga"`. Le mercredi = celui qui ouvre la semaine concernée (le panier du mardi va dans la semaine du lendemain).
- Avis et notes de la famille : `node scripts/donnees.mjs avis`, puis appliquer aux fiches.
- Le reste : `cles`, `lire`, `ecrire` (voir l'en-tête du script).

## Tester en local

`python3 -m http.server 8766` puis http://localhost:8766 (config `.claude/launch.json`, nom `menus`).
