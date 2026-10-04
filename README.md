# Pathfinder 2e Wiki

V1 du wiki : les données ne sont pas stockées dans ce dépôt.

Le site statique hébergé sur GitHub Pages lit directement le dépôt public Pathfinder-fr / foundryvtt-pathfinder2-fr :

- index des dossiers via l’API GitLab ;
- contenu d’une fiche récupéré à l’ouverture ;
- aucune copie des données Pathfinder dans ce dépôt ;
- aucune base de données ;
- aucun build ;
- les modifications du dépôt source deviennent disponibles au prochain chargement.

## V1

- navigation dynamique des dossiers ;
- lecture des fichiers .htm, .html et .md ;
- affichage du nom français et de la description française quand le format data/*.htm le permet ;
- lecteur plein écran ;
- recherche dans le dossier actuellement chargé ;
- raccourci Ctrl/Cmd + K ;
- interface responsive.

### Limite volontaire de la V1

La recherche ne télécharge pas les ~800 Mo du dépôt. Elle travaille uniquement sur l’index du dossier courant. Une V2 pourra utiliser la recherche GitLab ou un index distant sans stocker les contenus dans le wiki.

## Source

Le dépôt indique que les fichiers data contiennent les entrées traduites et que chaque fichier contient notamment les champs anglais/français. Le wiki consomme ces fichiers à la demande.

Source : https://gitlab.com/pathfinder-fr/foundryvtt-pathfinder2-fr

## Déploiement

Le dépôt GitHub est un site statique GitHub Pages. Aucun contenu source Pathfinder n’est commité dans Jolybob/wiki.
