# Petit Timer

Un timer simple et mignon pour les enfants : on choisit une durée (ex. 5 min), et quand c'est fini, on arrête les dessins animés.
Le temps est montré en chiffres **et** en image : une barre qui se vide avec un petit compagnon qui rentre à la maison, plus des étoiles qui s'éteignent.

Page web statique, sans dépendance ni build. Pensée pour Safari sur iPad mini 4 (iOS 15).

## Lancer

```sh
python3 -m http.server 8000
```

Puis ouvrir `http://<ip-du-mac>:8000` dans Safari sur l'iPad (même Wi-Fi).
Tout fichier statique convient aussi : n'importe quel hébergement, ou un dossier partagé.

## Installer sur l'iPad

1. Ouvrir la page dans **Safari**.
2. Bouton Partager → **Sur l'écran d'accueil**.
3. Lancer depuis l'icône : la page s'affiche en plein écran, comme une app.

## Réglages importants sur l'iPad

- **Verrouillage auto** : *Réglages → Luminosité et affichage → Verrouillage automatique → Jamais*.
  iOS 15 n'a pas de « Wake Lock », donc sans ça l'écran s'éteint pendant le décompte.
  Le temps reste juste même écran éteint (l'heure de fin est mémorisée), mais l'enfant ne voit plus rien.
- **Son** : le commutateur latéral / le Centre de contrôle ne doit pas être en mode silencieux, sinon la sonnerie de fin ne s'entend pas.
  Le son est débloqué par l'appui sur « Démarrer » : il faut donc toujours lancer le timer depuis l'app.

## Utilisation

- **Réglage** : choisir 1, 2, 5, 10, 15 ou 30 min, ou ajuster avec − / + (1 à 90 min), puis **Démarrer**.
- **Décompte** : chiffres, barre, étoiles. **Pause** met en pause ; **Maintenir pour arrêter** annule (appui long, pour éviter les faux appuis).
  À 1 minute de la fin (pour les timers de 2 min et plus), une petite cloche sonne et les chiffres pulsent.
- **Fin** : écran de fête, message et mélodie douce en boucle jusqu'à **OK**. **Encore** relance la même durée.
- **Réglages parents** : appui long (0,8 s) sur ⚙️ en haut à droite : choix du compagnon 🐻🐰🐱🐢🦊🐼 et du message de fin.

Les réglages (durée, compagnon, message) sont mémorisés sur l'iPad.

## Tester rapidement

Ajouter `?test=10` à l'adresse : chaque timer dure alors 10 secondes.

## Fichiers

- `index.html`, `style.css`, `app.js` : l'application
- `manifest.json`, `icon-180.png` : icône et mode plein écran
