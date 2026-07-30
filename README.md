# WatchRadar

WatchRadar est un tableau de bord privé pour Jellyfin. Il permet aux utilisateurs
autorisés de voir ce que leurs proches regardent, leurs contenus en cours et leur
historique, dans le respect des préférences de partage de chacun.

## Fonctionnalités

- connexion avec un compte Jellyfin ;
- activité en direct, progression, historique et « À suivre » ;
- favoris et interface responsive ;
- partage `ALL`, `ONLY_WATCHING`, `SELECTED` ou `NONE` ;
- matrice administrateur « qui peut voir qui » ;
- clé API Jellyfin chiffrée côté serveur ;
- sessions persistantes et révocables.

L’accès à une activité nécessite toujours deux autorisations : la matrice de
visibilité de l’administrateur et le choix de partage de la personne observée.

## Architecture

```text
Navigateur ── HTTPS ──> reverse proxy de l’utilisateur
                              │
                              └── HTTP ──> WatchRadar :8080
                                             ├── React
                                             └── /api ──> Express ──> PostgreSQL
                                                                  └── HTTPS ──> Jellyfin
```

WatchRadar ne génère aucun certificat. Le reverse proxy (Caddy, Nginx, Traefik,
Nginx Proxy Manager…) possède le domaine et termine HTTPS, puis transmet le
trafic à l’unique port HTTP de WatchRadar.

Le lien WatchRadar → Jellyfin doit rester en HTTPS : il transporte les
identifiants de connexion et la clé API Jellyfin. Il est indépendant du
certificat public installé sur le reverse proxy.

## Installation

Prérequis :

- Docker avec Docker Compose v2 ;
- un serveur Jellyfin accessible en HTTPS ;
- un domaine HTTPS géré par votre reverse proxy.

Clonez le projet puis lancez l’assistant :

```bash
git clone https://github.com/garnajee/watchradar.git
cd watchradar
./scripts/setup.sh
```

Le script crée l’unique fichier de configuration, `.env` à la racine, génère
les secrets et propose de démarrer les conteneurs. Il peut tout faire sans
interaction :

```bash
./scripts/setup.sh \
  --public-url https://watchradar.example.com \
  --jellyfin-url https://jellyfin.example.com \
  --bind-address 127.0.0.1 \
  --port 8080 \
  --start \
  --non-interactive
```

Les secrets existants sont réutilisés. `ENCRYPTION_KEY` n’est jamais remplacée
automatiquement, car elle protège la clé API Jellyfin déjà enregistrée.

Après le démarrage :

1. ouvrez l’URL publique de WatchRadar ;
2. connectez-vous avec un administrateur Jellyfin ;
3. ouvrez **Administration** et enregistrez une clé API créée dans Jellyfin ;
4. synchronisez puis activez les utilisateurs ;
5. réglez la matrice de visibilité.

La clé API se crée dans Jellyfin via
**Tableau de bord → Avancé → Clés API**. Elle n’est jamais exposée au navigateur.

## Reverse proxy

Votre reverse proxy doit envoyer tout le domaine vers le même upstream. Le
Nginx inclus dans WatchRadar route déjà `/api` vers le backend.

Avec Caddy :

```caddyfile
watchradar.example.com {
    reverse_proxy 127.0.0.1:8080
}
```

Avec Nginx :

```nginx
location / {
    proxy_pass http://127.0.0.1:8080;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_buffering off;
    proxy_read_timeout 3600s;
}
```

`proxy_buffering off` et le délai long sont nécessaires au flux SSE temps réel.
Si le proxy est sur le même hôte, conservez
`WATCHRADAR_BIND_ADDRESS=127.0.0.1`. Pour un proxy conteneurisé ou distant,
utilisez `0.0.0.0` et limitez le port au réseau de confiance avec le pare-feu.

## Sessions

La connexion reste active jusqu’à 180 jours après la dernière utilisation :

- le court jeton d’accès est renouvelé automatiquement, y compris après la
  fermeture puis la réouverture du navigateur ;
- le jeton de session est aléatoire, haché en base et remplacé à chaque
  renouvellement ;
- une déconnexion ou la désactivation du compte révoque la session côté serveur ;
- un utilisateur peut conserver au maximum dix sessions/appareils.

Les cookies sont `httpOnly`, `Secure` et `SameSite=Strict`. L’URL publique doit
donc réellement être en HTTPS.

## Configuration utile

| Variable | Utilité |
|---|---|
| `FRONTEND_ORIGIN` | URL HTTPS publique, sans slash final |
| `JELLYFIN_URL` | URL HTTPS joignable depuis le conteneur backend |
| `WATCHRADAR_BIND_ADDRESS` | Interface du port HTTP (`127.0.0.1` recommandé si possible) |
| `WATCHRADAR_HTTP_PORT` | Port ciblé par le reverse proxy, `8080` par défaut |
| `JELLYFIN_TLS_REJECT_UNAUTHORIZED` | Validation du certificat Jellyfin, `true` recommandé |

Toutes les variables sont documentées dans [.env.example](.env.example).
N’utilisez pas `https://localhost:8096` pour Jellyfin depuis Docker : `localhost`
désignerait le conteneur backend.

## Commandes courantes

```bash
docker compose ps
docker compose logs -f backend frontend
docker compose up -d --build
docker compose down
```

La base est conservée dans le volume `postgres_data`. Les migrations sont
appliquées automatiquement au démarrage du backend.

Sauvegarde :

```bash
docker compose exec -T db pg_dump -U watchradar watchradar > watchradar.sql
```

## Développement

Node.js 24 ou plus récent est requis. Le développement utilise aussi uniquement
le `.env` racine :

```bash
npm install
docker compose up -d db
npm run db:generate
npm run dev
```

React est disponible sur `http://localhost:5173` et Vite transmet `/api` au
backend local.

Validation complète :

```bash
npm run typecheck
npm test
npm run build
docker compose config
```

## Dépannage

- Santé : `https://votre-domaine/api/health`
- Dashboard hors ligne : vérifiez l’URL, la clé API et le certificat Jellyfin.
- SSE instable : désactivez le buffering du reverse proxy et augmentez son délai.
- Erreur CORS : `FRONTEND_ORIGIN` doit correspondre exactement à l’URL publique.

## Licence

Distribué sous licence [MIT](LICENSE).
