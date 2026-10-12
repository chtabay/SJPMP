# SJPMP

Site vitrine du cabinet de conseil SJPMP : briques d'analyse des processus (méthodes, processus, outils) pour le conseil en entreprise, les nouvelles pratiques numériques, l'analyse des postes face à l'évolution des technologies, les processus gérés en configuration et la canalisation du recours à l'IA.

Site statique, sans dépendance ni étape de compilation.

## Structure

```
index.html              Page unique (toutes les sections)
assets/css/styles.css   Styles, thèmes clair et sombre
assets/js/main.js       Menu mobile, schéma animé, filtre du catalogue, formulaire de contact
assets/img/favicon.svg  Icône du site
```

## Voir le site en local

Ouvrir `index.html` dans un navigateur, ou lancer un petit serveur :

```sh
python3 -m http.server 8000
# puis http://localhost:8000
```

## À personnaliser avant mise en ligne

- **Adresse e-mail** : `contact@sjpmp.fr` est provisoire. Elle apparaît à deux endroits dans `index.html` : le texte `#contact-email` et l'attribut `data-email` du formulaire.
- **Formulaire** : sans serveur, il ouvre la messagerie du visiteur avec le message prérempli. Pour un envoi direct, brancher un service de formulaires (Formspree, Netlify Forms…) sur `#contact-form`.
- **Mentions légales** : obligatoires pour un site professionnel en France (raison sociale, SIREN, siège, directeur de publication, hébergeur). À ajouter dans le pied de page.

## Mise en ligne

Le site peut être publié tel quel sur GitHub Pages, Vercel ou Netlify : il suffit de servir la racine du dépôt.
