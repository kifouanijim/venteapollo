# Boutique Apollo Sporting Club

## Démarrer le site

Le catalogue et le paiement nécessitent le serveur Node : n'ouvrez plus `index.html` directement dans le navigateur.

1. Installez Node.js 20 ou une version plus récente.
2. Dans VS Code, ouvrez le terminal dans le dossier du projet.
3. Copiez `.env.example` vers `.env` (`Copy-Item .env.example .env` dans PowerShell).
4. Lancez `npm.cmd start` sous Windows, puis ouvrez <http://127.0.0.1:3000>. Vous pouvez également lancer `node server.js`.

Le serveur et les tests utilisent uniquement les modules intégrés à Node ; aucune dépendance npm n'est nécessaire. `npm.cmd test` exécute les tests de l'API.

## Configurer Stripe

Dans le tableau de bord Stripe, créez une clé secrète de **test** et configurez le point de terminaison du webhook `https://votre-domaine/api/stripe/webhook`. Abonnez-le au minimum aux événements suivants :

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `checkout.session.expired`

Renseignez la clé `sk_test_...` dans `STRIPE_SECRET_KEY` et la signature `whsec_...` du webhook dans `STRIPE_WEBHOOK_SECRET`. Pour les essais en local, Stripe CLI peut transmettre les webhooks au serveur local. Ne publiez jamais ces valeurs et ne les ajoutez pas au dépôt. Passez aux clés `sk_live_...` seulement après les essais et la configuration de production.

Définissez `APP_BASE_URL` sur l'adresse de la boutique, par exemple `https://boutique.votre-domaine.fr` en production, et `HOST=0.0.0.0` si l'hébergeur doit exposer le serveur. Le mode production refuse les URL de retour en HTTP.

Les articles sont à retrait gratuit au club, conformément au choix fait pour cette maquette. Les coordonnées du club et la procédure de retrait restent à préciser avant mise en ligne.

## Tarifs staff

Définissez `STAFF_ACCESS_TOKEN` dans `.env` sur une valeur aléatoire d'au moins 32 caractères. Dans la boutique, activez « Tarif staff » et entrez cette clé. Elle est conservée uniquement en mémoire dans l'onglet, et les tarifs staff ne sont renvoyés par l'API qu'après vérification. Une connexion nominative est recommandée avant une utilisation publique.

## Commandes et données

Les tarifs de `products.json` sont exprimés en centimes ; le navigateur ne décide jamais du prix envoyé à Stripe. Les commandes et leur statut sont enregistrés dans `data/orders.json`, un fichier local ignoré par Git. Une commande n'est marquée payée qu'après confirmation Stripe. Des sauvegardes et un stockage partagé sont nécessaires pour faire fonctionner plusieurs instances en production.

Avant l'ouverture au public, configurez un serveur HTTPS, une URL publique stable pour les webhooks, des sauvegardes, l'adresse et les modalités de retrait, ainsi que les mentions légales, les conditions de vente et les règles de confidentialité.
