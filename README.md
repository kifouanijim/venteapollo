# Apollo Sporting Club — site vitrine

## Publication gratuite sur GitHub Pages

Le site est statique : il charge le catalogue depuis `products.json` et ne nécessite ni serveur Node, ni clé Stripe, ni base de données.

1. Ouvrez le dépôt GitHub et allez dans **Settings → Pages**.
2. Dans **Build and deployment**, choisissez **Deploy from a branch**.
3. Sélectionnez la branche `main` et le dossier `/(root)`, puis cliquez sur **Save**.
4. Après le déploiement, le site sera disponible à l'adresse indiquée dans cette page, généralement `https://<nom-utilisateur>.github.io/venteapollo/`.

Gardez `index.html`, `app.js`, `styles.css` et `products.json` à la racine du dépôt. Le catalogue est chargé avec un chemin relatif pour fonctionner sous le sous-chemin GitHub Pages du projet.

## Aperçu local

Avec Node.js 20 ou plus récent, lancez `npm.cmd start` sous Windows puis ouvrez <http://127.0.0.1:3000>. Le serveur est utile pour un aperçu local; GitHub Pages héberge directement les fichiers statiques.

La recherche et les filtres de catégories fonctionnent dans le navigateur. Les prix affichés sont indicatifs et doivent être confirmés auprès du club. Le site ne propose pas de panier, de commande ou de paiement en ligne.

## Modifier le catalogue

Modifiez `products.json` pour changer les articles affichés, puis publiez les changements sur la branche `main`. Les champs utilisés par la vitrine sont `id`, `name`, `category`, `publicPrice`, `art`, `tone` et `badge`; `publicPrice` est exprimé en centimes.

## Vérification

`npm.cmd test` lance les tests du serveur Node conservé dans le dépôt. La vitrine publiée sur GitHub Pages ne dépend pas de ce serveur.
