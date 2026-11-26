# Accès externes — ce qui marche déjà, ce qui manque

Toutes les clés se rangent dans **`site/.env.local`** (créer le fichier s'il n'existe pas). Ce fichier est ignoré par git
(`.env*` dans `.gitignore`) et n'est lu que par le script d'import côté serveur : rien n'est envoyé au navigateur.
Après l'avoir rempli, relancer : `npm run refresh:offers` (prix) ou `npm run import -- --only=official` (fiches).

## Fonctionne sans compte (déjà branché)

| Source | Apporte | Limite mesurée |
|---|---|---|
| Apple Store FR + reconditionné | prix par capacité, livraison gratuite affichée | iPhone uniquement |
| Samsung Shop FR | prix par capacité (URL ou code fabricant résolu via Icecat), fiches officielles | livraison calculée au panier → « à vérifier » |
| Xiaomi Store FR | prix et stock par variante (autorisé par toi) | livraison non publiée → « à vérifier » |
| Google Store FR | prix « à partir de », livraison gratuite affichée | capacité non précisée → « à vérifier » |
| Open Icecat (`openIcecat-live`) | fiche fabricant par code exact, GTIN, visuel, échéance de sécurité | Samsung et marques sponsors ; **Apple refusé** (restriction de marque), **Xiaomi réservé à Full Icecat** |
| Pages constructeurs | Apple, Google, Samsung, Xiaomi | Motorola, HONOR, OPPO, Nothing, realme : prix et fiches chargés par script, rien d'exploitable sans navigateur |

## 1. Open Icecat — compte gratuit (recommandé, 5 minutes)

Le compte public `openIcecat-live` est un compte de démonstration. Un compte gratuit à ton nom évite d'en dépendre.

1. Ouvre https://icecat.biz/fr/registration (page « Inscription gratuite » ; une vérification anti-robot peut s'afficher quelques secondes).
2. Clique **« Inscription en tant que Partenaire de Canal »**, remplis e-mail, nom d'utilisateur, mot de passe, société,
   site web, verticale « Informatique & électronique », puis valide l'e-mail reçu. Le compte gratuit donne l'accès Open Icecat.
3. Ajoute dans `site/.env.local` :
   ```
   ICECAT_USERNAME=ton_identifiant_icecat
   ```
4. `npm run import -- --only=official`

**Full Icecat (payant) : pas nécessaire aujourd'hui.** Mesure : il apporterait Apple et Xiaomi, mais ces deux marques
sont déjà couvertes par leurs pages officielles (apple.com/fr, mi.com/fr). Si un jour tu le prends : `ICECAT_APP_KEY=…`.

## 2. Flux d'affiliation — indispensable pour « frais inclus » sous 400 €

Aucune source gratuite ne publie à la fois le prix **et les frais de livraison** des téléphones abordables
(Samsung et Xiaomi les calculent au panier). Les flux d'affiliation contiennent une colonne `delivery_cost` :
c'est ce qui permettra d'afficher des offres « Dans ton budget, frais inclus » et d'ajouter Fnac, Darty,
Boulanger, Cdiscount, Rakuten, Back Market… selon les annonceurs présents sur le réseau.

### Awin (inscription éditeur gratuite)
1. Ouvre https://ui.awin.com/publisher-signup (formulaire d'inscription éditeur ; pays : France).
   Déclare le site (son adresse publique une fois en ligne) et sa thématique (comparateur de smartphones).
   Awin peut demander une petite somme de vérification à l'inscription : vérifie sur la page avant de valider.
2. Une fois le compte validé : menu **Annonceurs → Rechercher**, cherche les enseignes de téléphonie et clique
   **« Rejoindre le programme »** pour chacune. Attends leur acceptation.
3. Menu **Outils → Create-a-Feed** : coche les annonceurs acceptés, langue **Français**, format **CSV**,
   compression **gzip**, et garde au minimum les colonnes `aw_deep_link, product_name, aw_product_id, merchant_name,
   search_price, delivery_cost, ean, in_stock, condition, brand_name`. Copie **l'URL de téléchargement** générée
   (elle contient ta clé : ne la partage pas).
4. Ajoute dans `site/.env.local` (une seule ligne) :
   ```
   MERCHANT_FEEDS=awin|https://productdata.awin.com/datafeed/download/apikey/…
   ```
5. `npm run refresh:offers` — le journal indique combien de lignes ont été rattachées et pourquoi les autres ont été ignorées.

Le même connecteur accepte d'autres flux CSV (Effiliation, Kelkoo…) : ajoute-les à la suite, séparés par `;`
(`awin|URL1;effiliation|URL2`).

## Occasion — API officielle eBay (gratuite)

Seule source d'occasion à la fois fiable (annonces réelles, vendeurs évalués) et durable (API officielle versionnée).
Le connecteur est prêt (`scripts/ebay.ts`) : il calcule la cote (médiane, fourchette 25e–75e percentile, au moins 5
annonces comparables sur 30 jours) par modèle et capacité, en excluant pour pièces, bloqués, lots, accessoires,
annonces hors de France et vendeurs à moins de 95 % d'avis positifs.

1. Ouvre https://developer.ebay.com et crée un compte **eBay Developers Program** (gratuit).
2. Menu **Application Keysets** → crée un jeu de clés **Production**.
3. eBay demande de traiter les notifications de suppression de compte : choisis **l'exemption**
   (PickJust ne stocke aucune donnée d'utilisateur eBay).
4. Copie **App ID (Client ID)** et **Cert ID (Client Secret)** dans `site/.env.local` (et dans les variables Vercel) :
   ```
   EBAY_CLIENT_ID=…
   EBAY_CLIENT_SECRET=…
   ```
5. `npm run import -- --only=occasion`

Avant d'ouvrir le site au public, lis l'**API License Agreement** d'eBay (lien dans le portail développeur) :
l'usage des annonces pour une cote agrégée doit y être conforme. Leboncoin et Vinted n'ont pas d'API ouverte :
ils ne sont pas utilisés.

## 3. Actualisation automatique

Une fois pour toutes (crée deux tâches planifiées Windows : prix chaque jour à 6 h, fiches chaque lundi) :
```
powershell -ExecutionPolicy Bypass -File scripts\schedule-windows.ps1
```
Un relevé en échec ne supprime rien et ne redate rien ; il est signalé sous les résultats.
