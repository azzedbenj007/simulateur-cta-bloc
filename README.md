# Simulateur CTA — Bloc opératoire

Laboratoire virtuel pédagogique pour comprendre, calculer et diagnostiquer une centrale de traitement d'air (CTA) alimentant un bloc opératoire.
SITB — Hôpital d'Enfants de Rabat · GST-RSK.

**Site :** https://azzedbenj007.github.io/simulateur-cta-bloc/

## Modules
- **CTA 3D** (Three.js) : 40 composants cliquables avec fiches techniques, vue éclatée, visite guidée, flux d'air animés
- **Calculs** : débits, vitesses, gaines, pertes de charge (Darcy-Weisbach), ventilateur, thermique, filtres, conversions
- **Psychrométrie** : diagramme interactif en temps réel
- **Bloc opératoire** : cascade de pression entre locaux, ouverture de portes, comparaison des modes de diffusion
- **GTC** : synoptique, séquences, régulation PI, alarmes, tendances
- **Pannes** : 12 anomalies simulées avec méthode de diagnostic, défi « panne mystère »
- **Dimensionnement**, **Normes**, **QCM et exercices**

## Structure
```
index.html
css/app.css
js/physics.js          bibliothèque de calcul (psychrométrie, aéraulique)
js/data-components.js  fiches composants + illustrations
js/data-ref.js         pannes, normes, QCM
js/sim.js              moteur de simulation dynamique
js/psychro.js          diagramme psychrométrique
js/calc.js             calculateurs A à G
js/bloc.js             cascade de pression
js/cta3d.js            vue 3D
js/gtc.js              GTC et module de pannes
js/app.js              navigation, modes, dimensionnement, QCM
```

## Avertissement
Outil pédagogique. Les valeurs par défaut sont des hypothèses ; les exigences applicables sont celles du référentiel, du programme et des pièces du marché. Il ne remplace ni une étude d'exécution, ni la qualification d'une salle propre.
