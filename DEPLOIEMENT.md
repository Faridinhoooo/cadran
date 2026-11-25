# Mise en ligne sur Vercel

## Comment ça marche

Sur Vercel, le disque est en lecture seule et ne persiste pas. La base SQLite est donc **construite à chaque
déploiement** par `npm run vercel-build` :

1. import des fiches et des prix (Apple, Samsung, Xiaomi, Google Store, pages constructeurs, Open Icecat, flux configurés) ;
2. **contrôle qualité** : au moins 50 offres récentes et 200 modèles (`MIN_ACTIVE_OFFERS`, `MIN_MODELS`).
   S'il échoue — par exemple si un vendeur bloque les serveurs de Vercel — le déploiement s'arrête et **la version en ligne est conservée** ;
3. compilation Next.js ; la base est embarquée et lue en lecture seule.

Chaque matin, le workflow GitHub « Actualisation quotidienne des prix » déclenche un nouveau déploiement, donc un nouveau relevé.
Les fonctions tournent à Paris (`cdg1`, voir `vercel.json`). Les photos Wikimedia ne sont pas réimportées au déploiement
(trop long) : les fiches utilisent les visuels Icecat et les illustrations locales.

## Mise en route (une seule fois)

1. **Compte** : https://vercel.com/signup → **Continue with GitHub**.
2. **Projet** : **Add New… → Project**, puis **Import** à côté de `Faridinhoooo/cadran`
   (si le dépôt n'apparaît pas : **Configure GitHub App** et autorise l'accès à `cadran`).
3. **Variables d'environnement** (même écran, section *Environment Variables*, ou plus tard *Settings → Environment Variables*) :

   | Variable | Valeur | Obligatoire |
   |---|---|---|
   | `SITE_URL` | l'adresse du site, ex. `https://cadran.vercel.app` | oui (sitemap, adresses canoniques) |
   | `EDITEUR_NOM`, `EDITEUR_STATUT`, `EDITEUR_ADRESSE`, `EDITEUR_EMAIL`, `EDITEUR_SIREN`, `DIRECTEUR_PUBLICATION` | ton identité d'éditeur | oui avant ouverture au public |
   | `HEBERGEUR_NOM` | `Vercel Inc.` | oui |
   | `HEBERGEUR_ADRESSE` | adresse indiquée dans les mentions légales de Vercel | oui |
   | `HEBERGEUR_TELEPHONE` | idem | oui |
   | `ICECAT_USERNAME` | ton compte Open Icecat | conseillé |
   | `MERCHANT_FEEDS` | URL du flux Awin (voir ACCES.md) | quand disponible |
   | `AFFILIATION_ACTIVE` | `1` dès que des liens affiliés sont en ligne | selon le cas |

   Ces variables restent côté serveur : aucune n'est envoyée au navigateur.
4. **Deploy**. Le premier build dure environ 4 minutes. Le journal affiche « Contrôle qualité validé : … offres récentes ».
5. **Actualisation automatique** : *Settings → Git → Deploy Hooks*, nom `actualisation`, branche `main`, **Create Hook**,
   copie l'URL. Puis sur GitHub : dépôt `cadran` → *Settings → Secrets and variables → Actions* → **New repository secret**,
   nom `VERCEL_DEPLOY_HOOK`, valeur : l'URL copiée.

Une fois le site en ligne, les tâches planifiées Windows ne sont plus nécessaires :
`Unregister-ScheduledTask -TaskName "Cadran - prix","Cadran - fiches" -Confirm:$false`

## Surveillance

- `https://<ton-site>/api/sante` répond 200 si les prix ont moins de 36 h, 503 sinon : à brancher sur UptimeRobot ou Better Stack (gratuit).
- Un build refusé par le contrôle qualité apparaît en rouge dans l'onglet *Deployments* de Vercel (et Vercel envoie un e-mail).

## Offre Vercel

L'offre **Hobby** (gratuite) est réservée à un usage **non commercial**. Dès que le site gagne de l'argent (affiliation,
publicité), il faut l'offre **Pro**. Vérifie les conditions et le tarif à jour sur https://vercel.com/pricing.
