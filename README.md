# Horizon Efanou

Boutique de sacs isothermes avec une vitrine React, une API Express, une base PostgreSQL et un espace d'administration.

## 1. Comprendre l'architecture

```mermaid
flowchart LR
  Client[Vitrine React] -->|Produits et commandes| API[API Express]
  Admin[Administration React] -->|JWT et routes protégées| API
  API -->|Requêtes et transactions| DB[(PostgreSQL)]
```

- `src/App.tsx` : vitrine et panier.
- `src/CheckoutForm.tsx` : formulaire qui envoie une commande à l'API.
- `src/admin/` : connexion et tableau de bord administrateur.
- `src/api.ts` : communication du frontend avec l'API.
- `server/routes/` : règles HTTP des produits, commandes et administrateurs.
- `server/migrations/` : structure versionnée de PostgreSQL.
- `server/middleware/auth.ts` : protection JWT de `/api/admin/*`.

Le navigateur ne parle jamais directement à PostgreSQL. Il appelle l'API, qui valide les données avant d'exécuter des requêtes SQL paramétrées.

## 2. Installer les prérequis

Il faut Node.js 20 ou plus récent et PostgreSQL 17 ou plus récent. Docker Desktop peut remplacer une installation PostgreSQL locale.

Sur cette machine, Node.js et PostgreSQL 18 sont installés. Le service PostgreSQL est configuré pour démarrer automatiquement ; Docker n'est pas nécessaire.

### Option A : PostgreSQL sous Windows

1. Télécharger PostgreSQL depuis `https://www.postgresql.org/download/windows/`.
2. Pendant l'installation, conserver le port `5432`.
3. Choisir et conserver le mot de passe de l'utilisateur `postgres`.
4. Ouvrir PowerShell dans ce dossier et créer la base :

```powershell
psql -U postgres -c 'CREATE DATABASE "Boutique_Horizon Efanou";'
```

### Option B : Docker

Après installation de Docker Desktop :

```powershell
docker compose up -d
```

Le fichier `compose.yaml` crée PostgreSQL sur le port `5432`. Le mot de passe `postgres` est réservé au développement local et doit être remplacé en production.

## 3. Configurer les variables

Créer le fichier local à partir de l'exemple :

```powershell
Copy-Item .env.example .env
```

Modifier ensuite `.env` :

```dotenv
NODE_ENV=development
PORT=3001
CLIENT_URL=http://localhost:5173
DATABASE_URL=postgresql://postgres:VOTRE_MOT_DE_PASSE@localhost:5432/Boutique_Horizon%20Efanou
DATABASE_SSL=false
JWT_SECRET=UNE_CLE_ALEATOIRE_D_AU_MOINS_32_CARACTERES
JWT_EXPIRES_IN=8h
```

Le fichier `.env` est ignoré par Git. Ne jamais publier le mot de passe PostgreSQL ni `JWT_SECRET`.

## 4. Créer les tables et le catalogue initial

```powershell
npm install
npm run db:migrate
```

La migration crée :

- `admin_users` pour les comptes administrateur ;
- `categories` et `products` pour le catalogue et le stock ;
- `orders` et `order_items` pour les ventes ;
- `admin_audit_logs` pour tracer les actions sensibles ;
- les six produits actuellement visibles sur la boutique.

Chaque migration n'est exécutée qu'une fois grâce à `schema_migrations`.

## 5. Créer le premier administrateur

Dans PowerShell, saisir vos propres valeurs :

```powershell
$env:ADMIN_NAME="Nom de l'administrateur"
$env:ADMIN_EMAIL="admin@horizon-efanou.com"
$env:ADMIN_PASSWORD="un-mot-de-passe-long-et-unique"
npm run admin:create
Remove-Item Env:ADMIN_PASSWORD
```

Le mot de passe est haché avec bcrypt avant son stockage. Le même script permet de remplacer le mot de passe d'un compte portant le même e-mail.

## 6. Démarrer le projet

```powershell
npm run dev
```

- Boutique : `http://localhost:5173/`
- Administration : `http://localhost:5173/admin`
- API : `http://localhost:3001/api`
- Santé : `http://localhost:3001/api/health`

Vite redirige automatiquement `/api` vers Express pendant le développement.

## 7. Comprendre une commande

1. La vitrine charge `GET /api/products`.
2. Le client ajoute des produits et renseigne son adresse.
3. Le formulaire envoie les identifiants et quantités à `POST /api/orders`.
4. PostgreSQL verrouille les produits concernés pendant la transaction.
5. L'API relit les vrais prix et vérifie le stock.
6. Elle crée la commande et ses lignes, puis diminue le stock.
7. En cas d'erreur, toute la transaction est annulée.
8. La commande apparaît dans `/admin` pour être traitée.

Le total n'est jamais accepté depuis le navigateur. Un client ne peut donc pas modifier le prix avec les outils de développement.

## 8. Routes principales

| Méthode | Route | Accès | Rôle |
| --- | --- | --- | --- |
| `GET` | `/api/health` | Public | Vérifier l'API et PostgreSQL |
| `GET` | `/api/products` | Public | Lire les produits actifs |
| `GET` | `/api/categories` | Public | Lire les catégories |
| `POST` | `/api/orders` | Public | Enregistrer une commande |
| `POST` | `/api/auth/login` | Public, limité | Connexion administrateur |
| `GET` | `/api/auth/me` | JWT | Vérifier la session |
| `GET` | `/api/admin/dashboard` | Admin | Indicateurs et alertes |
| `GET/POST/PUT/DELETE` | `/api/admin/products` | Admin | Gérer le catalogue |
| `GET/PATCH` | `/api/admin/orders` | Admin | Gérer les commandes |

## 9. Vérifier et construire

```powershell
npm run lint
npm run build
```

Le build produit `dist/` pour le frontend et `dist-server/` pour l'API Node.js.

Lancer l'API compilée avec :

```powershell
npm run start:server
```

## 10. Étapes de production restantes

- Remplacer les coordonnées et prix provisoires.
- Héberger les nouvelles images sur un stockage objet et enregistrer leurs URL.
- Connecter un prestataire Mobile Money ou carte avec vérification serveur.
- Activer HTTPS, une sauvegarde PostgreSQL quotidienne et une surveillance des erreurs.
- Déployer le frontend, l'API et PostgreSQL sur des services adaptés.