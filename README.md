# MDT Board

Outil personnel, local-first, pour lire et éditer une route Mythic+ sur un second écran. Inspiré de Mythic Dungeon Tools et de l'usage Keystone.guru, sans compte et sans combat log.

Fait pour Fabien (Blood DK) : carte énorme, pulls numérotés, % de forces, notes, clavier d'abord.

Pool **Midnight Saison 2 / patch 12.1** :

| Donjon | Index MDT | Forces |
| --- | ---: | ---: |
| Autel des Crocs | 164 | 817 |
| Allée du Meurtre | 160 | 655 |
| Tanière de Nalorakk | 161 | 729 |
| Le Val aveuglant | 162 | 686 |
| Arène de Voidscar | 163 | 738 |
| Repos des rois | 17 | 608 |
| Temple de Sethraliss | 20 | 687 |
| Bassins de l'Essence rubis | 42 | 551 |

Les index, positions de PNJ, `count` et textures viennent de [MythicDungeonTools](https://github.com/Nnoggie/MythicDungeonTools) (fichiers `Midnight/*.lua` + tuiles `Midnight/Textures`). Extraire à nouveau : `npm run extract` (clone sparse de l'addon).

## Lancer en local

```bash
git clone https://github.com/<ton-compte>/mdt-board.git
cd mdt-board
npm install
npm run dev
```

Ouvre **http://127.0.0.1:43173** (pas de Vercel, pas de deploy : tout tourne en localhost).

Pour publier ce dossier en dépôt **public** depuis une machine où `gh` est connecté à ton GitHub :

```bash
gh auth login
gh repo create mdt-board --public --source=. --remote=github --push
```

Le dépôt public GitHub est la source de vérité demandée. Pas de hosting distant requis ensuite.

Tests : `npm test`.

## Importer une chaîne MDT

1. Dans le jeu, ouvre MDT → Export / Share, copie la chaîne (`!…` legacy Ace+LibDeflate, ou `!~MDT2~…` CBOR).
2. Dans l'app : **Coller une chaîne MDT**, colle, importe.
3. Si le décodage échoue, l'erreur s'affiche (rien n'est avalé en silence).
4. Bouton **Exemple Autel des Crocs** : charge `fixtures/altar-of-fangs.mdt`.

JSON local : tu peux aussi coller une sauvegarde `mdt-board-route` exportée par l'app (via le JSON, pas via le champ MDT).

## Second écran (board)

1. Charge une route (import ou construction).
2. Clique **Board** (l'import ouvre déjà le board).
3. Glisse la fenêtre du navigateur sur le moniteur 2.
4. `F` ou le plein écran du navigateur (`F11`) pour cacher le chrome.
5. **Sans souris** : `←` `→` ou `J` `K` pour changer de pull, `1`–`9` pour sauter, `Échap` pour l'éditeur.

Le board affiche le nom du donjon / de la route, le % total, **PULL N**, les packs, la note, le % restant, et le pull suivant.

## Éditeur

- Choisis un donjon du pool live.
- Clique les points PNJ pour les ajouter / retirer du pull actif (un clone déjà dans un autre pull est déplacé).
- Crée, réordonne, supprime des pulls. Note courte par pull.
- Molette : zoom. Glisser : pan. Onglets d'étage si plusieurs sublevels MDT.
- **Sauver** : `localStorage` uniquement.
- **Exporter** : JSON complet + chaîne MDT meilleur effort.

## Limites d'export MDT

L'import lit les vrais presets (donjon, pulls `enemyId → clones`, notes, `uid`).

L'export MDT réécrit donjon + pulls + notes + nom. **Pas** les dessins / objets, assignations de POI, semaine d'affixes, ni le format `!~MDT2~` (on réémet le format legacy `!` AceSerializer + LibDeflate, largement accepté). Pour une copie fidèle, garde le JSON.

## Architecture

- `scripts/extract-mdt.mjs` : parse les tables Lua MDT, assemble les 150 tuiles 128px (grille officielle 10×15, `sizex=840` / `sizey=555`).
- `src/lib/mdt/` : AceSerializer-3.0, LibDeflate `EncodeForPrint`, inflate raw, MDT2 base64+deflate+CBOR.
- `src/data/*.json` + `public/maps/*.jpg` : données saison, pas l'addon entier.

## Licence

Code de l'app : usage personnel. Données et cartes dérivées de Mythic Dungeon Tools (Nnoggie). Respecte la licence de l'addon si tu redistribues les extraits.
