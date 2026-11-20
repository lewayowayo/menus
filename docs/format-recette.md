# Format d'une fiche recette

Une recette = un dossier `recettes/<id>-<slug>/` contenant `recette.json` et ses pièces jointes (`.jpg`, `.pdf`).
L'`id` (`r001`, `r002`…) est définitif : on ne le change jamais, même si la recette est renommée ou écartée. Le slug du dossier est indicatif.

## Champs

| Champ | Valeurs |
|---|---|
| `id` | `rNNN`, jamais réutilisé |
| `nom` | texte |
| `statut` | `validee` (entre dans le roulement) · `a_valider` (fiche à relire par Etienne) · `a_tester` · `petite_folie` (hors roulement) · `ecartee` |
| `redaction` | `source` (transcrite d'une capture, d'un lien ou d'une recette famille) · `claude` (version standard rédigée par Claude, à valider) |
| `a_completer` | liste de ce qui manque ou a été estimé, ex. `["quantités estimées pour 5", "temps de cuisson"]` |
| `choisie_par`, `origine`, `categorie` | texte. Catégories : `Comfort food`, `Plat complet rapide`, `Classique familial`, `Recette du monde`, `Soupe / léger` |
| `source` | `{ "nom": "...", "lien": "https://..." ou null }` |
| `duree_min` | durée totale en minutes (entier) |
| `saisons` | `["toute"]` ou parmi `printemps`, `ete`, `automne`, `hiver` |
| `sans_gluten` | `{ "statut": "naturel" \| "adaptable" \| "non", "note": "..." }` |
| `vegetarien` | `true` / `false` (pour toute la famille) |
| `creneaux` | parmi `rapide` (≤ 25 min), `leger`, `genereux`, `midi_simple`. Liste vide = n'importe quel soir |
| `legumes_amap` | légumes du panier AMAP que la recette utilise, noms du vocabulaire ci-dessous (ex. `["épinards", "potimarron"]`) |
| `tres_frais` | produits à consommer vite : `avocat`, `poisson`, `poisson fumé`, `herbes fraîches`, `salade`… |
| `veille` | `true` pour un plat à lancer la veille (pot-au-feu…) : proposé seulement le dimanche midi, signalé dans le menu |
| `portions` | toujours 5 |
| `ingredients` | voir ci-dessous, quantités pour 5 |
| `etapes` | liste d'objets `{ "texte": "...", "minuteur": 600 }` (`minuteur` en secondes, seulement quand l'étape a une durée à surveiller) |
| `marie` | voir ci-dessous |
| `etienne` | `null`, ou `{ "texte": "...", "ajouter": [...], "retirer": [...] }` quand le plat contient des frites |
| `remarque` | texte libre |
| `ancien` | historique de l'ancienne tâche planifiée (ne pas modifier) |
| `pieces_jointes` | `[{ "fichier": "capture.jpg", "legende": "..." }]` |

## Ingrédient

```json
{ "nom": "oignon", "qte": 2, "unite": "piece", "rayon": "fruits_legumes", "placard": false }
```

- `nom` : au singulier, en minuscules, le plus court possible tout en restant achetable. Réutiliser **exactement** les noms du vocabulaire ci-dessous : c'est ce qui permet d'additionner les quantités entre recettes.
- `qte` : nombre (pour 5) ou `null` si « selon le goût ».
- `unite` : `g`, `kg`, `ml`, `cl`, `l`, `piece`, `gousse`, `cas` (c. à s.), `cac` (c. à c.), `pincee`, `botte`, `brin`, `tranche`, `boite`, `pot`, `sachet`, `paquet`. Préférer `g` et `piece`.
- `rayon` : `boucherie` (viandes, volailles, charcuterie), `poissonnerie` (truite, poisson fumé), `alternatives` (tofu, steaks végétaux), `fruits_legumes`, `cremerie` (œufs, lait, beurre, crème, fromages, yaourts), `epicerie` (conserves, condiments, sauces, huiles, épices, fruits secs, lait de coco), `feculents` (pâtes, riz, semoule, quinoa, lentilles, farine, vermicelles), `boulangerie`, `surgeles`, `sans_gluten` (pâtes SG, pain SG, farine SG, pâte SG…).
- `placard` : `true` pour ce qu'on a normalement d'avance (sel, poivre, huile, épices, vinaigre, sauce soja, maïzena, bouillon cube, moutarde, sucre, miel). Ces lignes vont en « à vérifier » plutôt qu'en achat ferme.
- `magasin` (facultatif) : `supercoop` ou `auchan`, seulement pour forcer un magasin. Sinon l'appli décide d'après le rayon (réglable dans l'appli).
- `estime` (facultatif) : `true` sur une quantité estimée quand la source n'en donnait pas.

## Option Marie

Marie évite le gluten (souple : un peu de temps en temps n'est pas grave). Elle n'est pas végétarienne. Le soir, elle mange peu de féculents.

```json
"marie": {
  "texte": "Pâtes sans gluten pour sa part.",
  "ajouter": [{ "nom": "pâtes sans gluten", "qte": 100, "unite": "g", "rayon": "sans_gluten", "placard": false }],
  "retirer": [{ "nom": "spaghetti", "qte": 100, "unite": "g" }],
  "soir": "Petite portion de pâtes, plus de salade."
}
```

- `ajouter` / `retirer` : la substitution sans gluten de sa part. S'applique à tous les repas. `retirer` avec `qte` retire sa part ; sans `qte`, retire l'ingrédient en entier.
- Si la recette est naturellement sans gluten : `ajouter` et `retirer` vides, `texte` = « Rien à adapter. »
- `soir` : ce qui change pour elle le soir (moins de féculents), en une phrase. `null` si rien.
- Quand toute la famille peut manger la version sans gluten sans différence (tortillas de maïs, maïzena dans une béchamel, sauce tamari), mettre directement l'ingrédient sans gluten dans `ingredients` plutôt qu'une substitution.

## Vocabulaire commun

oignon · échalote · ail (unité `gousse`) · carotte · pomme de terre · patate douce · poireau · courgette · poivron rouge · poivron vert · tomate · tomate cerise · concombre · avocat · salade verte · mâche · endive · épinards · chou frisé · chou chinois · chou blanc · chou rouge · chou-fleur · brocoli · blettes · panais · navet · potimarron · butternut · courge · champignon de Paris · petits pois · haricots verts · céleri-rave · céleri branche · radis · betterave · fenouil · pomme · poire · citron · citron vert · mangue · banane · gingembre · persil · coriandre · basilic · ciboulette · menthe · thym · laurier · romarin

blanc de poulet · cuisse de poulet · poulet entier · bœuf haché · steak haché · lardons · jambon blanc · magret de canard · rôti de bœuf · truite fumée · filet de truite · œuf

beurre · lait · crème liquide · crème fraîche épaisse · parmesan · emmental râpé · comté · mozzarella · burrata · stracciatella · feta · chèvre · ricotta · cheddar · yaourt nature

riz basmati · riz rond · riz arborio · quinoa · pâtes · spaghetti · penne · pâtes sans gluten · plaques de lasagne · plaques de lasagne sans gluten · vermicelles de riz · lentilles vertes · pois chiches (boîte) · haricots rouges (boîte) · semoule · farine · farine sans gluten · maïzena · tortilla de maïs · pain de mie · pain de mie sans gluten · pain burger · pain burger sans gluten · pâte à pizza · pâte brisée · pâte brisée sans gluten · pâte feuilletée

tomate concassée · coulis de tomate · concentré de tomate · lait de coco · sauce soja sans gluten · huile d'olive · huile neutre · huile de sésame · vinaigre de riz · vinaigre balsamique · moutarde · miel · sucre · bouillon de volaille · bouillon de légumes · sel · poivre · cumin · curcuma · paprika · curry · ras el hanout · piment · cannelle · muscade · herbes de Provence · cacahuète · noix · amande · pruneau · raisins secs · graines de sésame
