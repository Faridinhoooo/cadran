# PickJust — quel smartphone pour ton budget ?

Site en français (Next.js 15, TypeScript, Tailwind CSS 4, SQLite via `node:sqlite`) qui recommande un smartphone
selon un budget total, l'état d'achat, les priorités et le système, avec un catalogue et un comparateur.

Prérequis : Node.js ≥ 22.5 (testé avec Node 26).

## Démarrer

```bash
npm install
npm run import        # crée/actualise data/catalog.db (≈ 5 à 10 min, photos comprises)
npm run dev           # http://localhost:3000
```

Production : `npm run build` puis `npm start`.

## Actualiser les données

```bash
npm run import                         # toutes les sources
npm run import -- --only=offers        # prix seulement (à lancer au moins tous les 7 jours)
npm run import -- --only=eol           # suivi logiciel (endoflife.date, communautaire)
npm run import -- --only=official      # pages officielles : aide Google Pixel, apple.com/fr, Google Store
npm run import -- --only=media --refresh-media
```

L'import est idempotent : identifiants stables, UPSERT, aucune duplication. Les offres d'une source qui
ne sont plus vues passent indisponibles (elles sortent des recommandations ; la fiche reste).

## Actualisation régulière des prix

Les offres de plus de 7 jours sortent des résultats (« Prix à actualiser »). Relancer au moins une fois par jour :

```bash
npm run refresh:offers
```

- Linux / hébergement avec cron : `0 6 * * * cd /chemin/site && npm run refresh:offers`
- Windows (Planificateur de tâches) : `schtasks /Create /SC DAILY /ST 06:00 /TN cadran-prix /TR "cmd /c cd /d C:\chemin\site && npm run refresh:offers"`

Un relevé en échec (réseau, page modifiée, zéro offre lue) ne modifie aucune offre : le dernier relevé réussi et sa date
sont conservés, l'échec est journalisé et signalé sous les résultats.

## Mise en ligne

Voir **[DEPLOIEMENT.md](DEPLOIEMENT.md)** (Vercel : base construite à chaque déploiement, contrôle qualité, actualisation quotidienne).

## Accès externes et clés privées

Voir **[ACCES.md](ACCES.md)** : ce qui fonctionne sans compte, comment créer les accès gratuits (Open Icecat, Awin)
et où enregistrer les clés (`.env.local`, jamais exposé au navigateur). Automatisation Windows : `scripts/schedule-windows.ps1`.

## Sources marchandes

| Source | Contenu | Frais | Capacité |
|---|---|---|---|
| Apple Store FR | iPhone neufs | « Livraison gratuite » affiché → coût total confirmé | exacte |
| Apple reconditionné FR | iPhone reconditionnés par Apple | idem | exacte |
| Samsung Shop FR (JSON-LD de la page « Tous les smartphones ») | Galaxy neufs et reconditionnés Samsung | « hors participation aux frais de port » (CGV) → à vérifier | exacte (dans l'URL), contrôlée sur la fiche |
| Google Store FR (pages produit) | Pixel neufs | « Livraison standard gratuite » affiché | **prix « à partir de »** : jamais attribué à une capacité, toujours « à vérifier » |
| Xiaomi Store FR (liste JSON-LD + point d'accès de la page d'achat, autorisé par le propriétaire du projet) | Xiaomi, Redmi, POCO neufs | non publiés → à vérifier | exacte, par variante (nom « 4 GO + 128 GO »), avec stock ; repli sur un prix de départ jamais attribué à une capacité |

Accès qui permettraient d'aller plus loin (non configurés) :
- **Flux d'affiliation** (Awin, Effiliation, Kelkoo Group) : flux produits Fnac, Darty, Boulanger, Back Market avec prix, frais de port
  et capacité ; nécessite un compte éditeur validé et l'acceptation de chaque annonceur.
- **Xiaomi Store** : les prix par capacité viennent du point d'accès non documenté qui alimente la page d'achat
  (`ams-go.buy.mi.com/fr/v2/item/productdetail`), utilisé sur autorisation explicite du propriétaire du projet. Non contractuel :
  il peut changer sans préavis ; l'import repasse alors sur les prix de départ sans perdre le dernier relevé.

## Tests

```bash
npm test      # scénarios de livraison (budget, capacités, recherche, offres expirées, cote, suivi logiciel…)
npm run lint
```

Les données de test vivent dans `tests/fixtures.ts` et ne sont jamais écrites dans la base publique.

## Structure

- `scripts/import.ts` — import réexécutable (endoflife.date, liste éditoriale, fiches constructeur, Apple Store FR,
  Apple reconditionné, Samsung Shop FR, offres manuelles, Wikimedia Commons).
- `data/sources/*.json` — données éditoriales sourcées (marques et origines, modèles hors endoflife.date,
  caractéristiques annoncées, engagements de suivi). `offers-manual.json` (facultatif) pour des offres vérifiées à la main.
- `src/lib/engine.ts` — moteur de recommandation pur (contraintes, classement, explications, diagnostic).
- `src/lib/support.ts` — temps de suivi restant recalculé à la date du jour.
- `src/lib/market.ts` — cote d'occasion (médiane, P25–P75, ≥ 5 annonces sur 30 jours).
- Pages : `/`, `/trouver`, `/resultats`, `/catalogue`, `/telephone/[id]`, `/comparer`, `/couverture`.

## Règles clés

- Offre « disponible dans ton budget » : disponible, vérifiée il y a moins de 7 jours, bonne capacité,
  coût total connu (prix + frais obligatoires + livraison) ≤ budget. Une cote d'occasion ne compte jamais.
- Une donnée inconnue ne valide jamais une exigence (eSIM, frais de livraison…).
- Le budget n'est jamais relevé automatiquement.

Voir `/couverture` pour les sources connectées, la couverture par marque/gamme/année et les lacunes.
