# Le contenu du Portail — guide pour les non-développeurs

Ce document explique où vivent les questions, les épreuves et la grille de
notation, comment chaque candidat reçoit « son » exemplaire, et comment
ajouter ou modifier une question sans casser quoi que ce soit.

> **Règle d'or.** Tout le contenu est dans le dossier `content/`. Vous n'avez
> jamais besoin de toucher au reste du projet pour changer un texte, une
> question ou un barème.

---

## 1. Où se trouve quoi

| Ce que vous cherchez | Fichier |
| --- | --- |
| Titre, entreprise, texte d'introduction et de fin d'un scénario | `content/retail/index.ts` (bloc `meta`) |
| Questions du quiz (Gemme du Savoir) | `content/retail/quiz.ts` |
| Épreuve SQL (Gemme des Données) : énoncé, tables, solution | `content/retail/sql.ts` |
| Épreuve Python (Gemme du Code) : énoncé, tests, solution | `content/retail/algo.ts` |
| Énigme du cadenas (Gemme de l'Esprit) | `content/retail/logique.ts` |
| Le Portail : code cassé, bugs, journaux, ticket client | `content/retail/portail.ts` |
| Grille de compétences (10 compétences, 4 niveaux) | `content/grille/competences.ts` |
| Poids par profil (Data engineer, BI, IA, Salesforce) | `content/grille/profils.ts` |
| Version lisible de la grille, pour relecture par l'équipe | `content/grille-et-profils.md` |

Seul le scénario **retail** (« L'inventaire de minuit », Maison Lumen) existe
pour l'instant. Les trois autres (ecommerce, education, hotellerie) sont
prévus à l'étape 11 de `docs/ROADMAP.md` et suivront la même structure :
un dossier par scénario, avec les mêmes cinq fichiers.

Les fichiers sont du TypeScript, mais pour du contenu on n'écrit que du
texte entre guillemets : on peut les ouvrir dans n'importe quel éditeur
(VS Code par exemple).

---

## 2. Les cinq épreuves et ce qui est secret

Chaque épreuve a deux moitiés :

- **la partie publique** : ce que le candidat voit (énoncé, exemples,
  données visibles) ;
- **la partie privée** : bonnes réponses, solution, tests cachés, jeu de
  données caché. **Elle n'est jamais envoyée au navigateur.**

| Épreuve | Public (candidat) | Privé (serveur et recruteur seulement) |
| --- | --- | --- |
| Quiz | questions et choix (mélangés) | bonne réponse de chaque question |
| SQL | énoncé, tables et lignes visibles | requête solution, **jeu de données caché** |
| Algo | énoncé, code de départ, 2 exemples | solution de référence, **tests cachés** |
| Logique | énigme et indices | le code secret |
| Portail | énoncé, code cassé, journaux, ticket client | code corrigé, liste des bugs, tests cachés |

Chaque partie privée contient une **chaîne « canari »** (par exemple
`CANARI-retail-quiz-4b1e9c`). Si un canari apparaît un jour dans ce qui part
vers le navigateur, un test automatique échoue : c'est le filet de sécurité
contre les fuites de solutions. Ne supprimez jamais un canari, et ne le
changez pas à la légère (voir § 6).

---

## 3. Comment le tirage par graine fonctionne

Chaque candidat reçoit, à la création de sa session, un **numéro appelé
graine** (seed), enregistré en base. À partir de cette graine, le moteur
fabrique tout son sujet :

1. quelles **5 questions** du quiz (parmi la banque) et dans quel ordre de
   réponses ;
2. quelle **région** et quel **top 3 ou top 5** pour la requête SQL, et les
   données des 40 boutiques (jeu visible **et** jeu caché, différents) ;
3. la valeur de **k** et les **jeux de tests** de l'épreuve Python ;
4. le **code secret** et les indices du cadenas ;
5. les **journaux de 6 h** et les cas de test du Portail.

Ce qu'il faut retenir :

- **Reproductible.** Même graine = exactement le même sujet, à chaque fois,
  sur toutes les machines. C'est ce qui permet au recruteur de revoir un
  replay avec le sujet exact du candidat, et au serveur de retrouver les
  solutions sans les stocker.
- **Différent d'un candidat à l'autre.** Deux candidats n'ont pas le même
  sujet : cela limite le copier-coller entre stagiaires.
- **Chaque épreuve a son propre « flux » de hasard.** Modifier le SQL ne
  change pas les questions du quiz tirées pour une graine donnée.
- **Le sujet est figé au démarrage.** Au clic sur « Commencer », le
  sujet complet du candidat (ce qu'il voit **et** les solutions, tests et jeux
  de données cachés) est copié en base, dans la session. Tout ce qui suit
  — rechargement de la page, correction de ses soumissions, Portail,
  correction du quiz lue par le recruteur — relit cette copie.
- **Donc modifier le contenu ne touche que les sessions futures.** Ajouter
  une question à la banque du quiz, par exemple, change le tirage de toutes
  les graines **à partir de maintenant**, mais pas les sujets déjà figés
  (voir § 6).

---

## 4. Ajouter ou modifier du contenu, pas à pas

### Préparation (une seule fois)

1. Demandez à un développeur d'installer le projet sur votre poste, ou
   travaillez avec lui. Ouvrez le dossier du projet dans VS Code.
2. Créez une branche de travail (ou demandez à votre développeur de le
   faire) : ne modifiez pas directement `main`.

### A. Modifier le texte d'une question du quiz

1. Ouvrez `content/retail/quiz.ts`.
2. Repérez la liste `BANK`. Chaque question a ce format :

   ```ts
   {
     id: "git-revert",
     prompt: "La question posée au candidat…",
     correct: "La bonne réponse",
     wrong: ["Mauvaise 1", "Mauvaise 2", "Mauvaise 3"],
   },
   ```

3. Changez le texte entre guillemets. Gardez les virgules et les crochets.
4. Passez à l'étape « Vérifier » (§ 5).

### B. Ajouter une question au quiz

1. Dans `content/retail/quiz.ts`, copiez une question existante et collez-la
   à la suite dans `BANK`.
2. Donnez-lui un **`id` unique** : lettres minuscules, chiffres et tirets
   seulement (ex. `"cache-http"`). Jamais deux fois le même.
3. Écrivez `prompt` (la question), `correct` (**la** bonne réponse) et
   `wrong` (les mauvaises réponses, au moins une).
   - La bonne réponse va **toujours** dans `correct`, jamais dans `wrong`.
     Le moteur mélange l'ordre à l'affichage, le candidat ne peut pas
     deviner la position.
   - Une seule bonne réponse possible : si deux réponses pourraient être
     défendues, reformulez.
   - Des mauvaises réponses plausibles, de longueur comparable à la bonne
     (sinon la plus longue « sent » la bonne).
4. Chaque session tire **5** questions parmi la banque : plus la banque est
   grande, moins deux candidats ont le même quiz. Visez 15 à 20 questions
   au total (il y en a 8 aujourd'hui).
5. Vérifiez (§ 5).

### C. Supprimer une question

Supprimez le bloc `{ … },` correspondant dans `BANK`. La banque doit garder
**au moins 5 questions**, sinon la génération échoue (et les tests aussi).

### D. Modifier le décor ou les textes d'une épreuve

Les textes narratifs (`story`), l'énoncé (`task`, `statement`, `puzzle`) et
les titres se changent directement dans le fichier de l'épreuve, entre
guillemets. Les textes d'introduction et de fin du scénario sont dans le bloc
`meta` de `content/retail/index.ts`.

> ⚠️ Un texte d'énoncé **décrit** une règle que le code applique : si vous
> changez la règle dans la phrase (« écart strictement inférieur à k », « top 5 »,
> « arrondi à 2 décimales »), il faut aussi changer la solution et les tests.
> C'est du travail **à deux** avec un développeur — ne modifiez pas seul
> la solution d'une épreuve.

### E. Changer les noms, villes ou produits des données SQL

Dans `content/retail/sql.ts`, les listes `REGIONS`, `VILLES`, `CATEGORIES`
et `PRODUITS` en haut du fichier sont de simples listes de mots. Vous pouvez
les modifier, **à condition de respecter les tailles** : 5 régions, 8 villes
par région, 25 produits répartis en 5 catégories de 5 (les catégories
sont attribuées par blocs de 5 produits dans l'ordre).

### F. Ajouter un nouveau scénario (en lien avec un développeur)

1. Copiez le dossier `content/retail/` sous un nouveau nom
   (ex. `content/ecommerce/`).
2. Dans chaque fichier, remplacez l'histoire, les noms et les **canaris**
   (`CANARI-ecommerce-quiz-xxxxxx` : un canari neuf et unique par épreuve).
3. Dans `content/index.ts`, ajoutez le scénario à la liste.
4. Les tests communs (`content/content.test.ts`) le couvrent alors
   automatiquement.

---

## 5. Vérifier avant de publier

Demandez à un développeur de lancer, ou lancez vous-même dans un terminal à
la racine du projet :

```bash
npm test
```

Les tests de contenu vérifient notamment, pour 60 graines différentes :

- chaque sujet généré est valide et complet ;
- même graine = même sujet ; graines différentes = sujets différents ;
- le jeu de données caché diffère du jeu visible ;
- aucune solution ni aucun canari n'apparaît dans la partie publique ;
- chaque question du quiz a **exactement une** bonne réponse existante ;
- le cadenas n'admet **qu'une seule** solution.

Si un test devient rouge, **ne forcez pas** : le message indique en général
l'épreuve fautive. Revenez à votre dernière modification ou demandez de
l'aide.

Avant de mettre en ligne, un développeur doit aussi lancer :

```bash
npm run test:build
```

Il vérifie qu'aucun canari de solution n'atteint les fichiers envoyés au
navigateur (obligatoire avant chaque push).

Pour vérifier le figeage : les tests de `src/server/content/subject.test.ts`
(base de données locale requise : `docker compose up -d db`).

Pour **voir** le résultat : `npm run dev`, puis créer un créneau de test et
parcourir les épreuves (demandez la procédure à l'équipe technique).

---

## 6. À savoir avant de modifier

- **Sessions en cours et replays (conservés 6 mois).** Le sujet est figé en
  base au démarrage de chaque session : un changement de contenu ne modifie
  ni ce que voit un candidat qui recharge sa page, ni la correction de ses
  soumissions, ni ce que le recruteur relit. Vous pouvez donc modifier le
  contenu sans attendre la fin des sessions en cours ; les modifications ne
  s'appliquent qu'aux sessions qui démarrent après la mise en ligne.
  Deux exceptions :
  - **Avant « Commencer »**, rien n'est figé : l'écran d'accueil (nom du
    scénario, texte d'introduction) vient du contenu actuel.
  - **Sessions antérieures à cette fonction** (créées avant la mise en
    ligne du figeage) : leur sujet est figé à la **première lecture** qui
    suit, depuis le contenu de ce moment-là. Pour ces sessions-là, ne
    changez pas le contenu avant la première relecture.
  Pour des changements importants, parlez-en à l'équipe technique.
- **Forme des données.** Le sujet figé est relu avec les mêmes contrôles
  qu'à la génération. Si un développeur change la *forme* d'un sujet
  (champs de `src/engine/content/schemas.ts`), il doit prévoir la lecture
  des anciens sujets (numéro `SUBJECT_VERSION` dans
  `src/server/content/subject.ts`) : un sujet d'une version inconnue est
  refusé avec une erreur claire, jamais régénéré en silence.
- **Équité.** Si vous modifiez la difficulté d'une épreuve en cours de
  campagne, les candidats ne sont plus comparables entre eux. Notez la date
  du changement.
- **Canaris.** Gardez-les tels quels, sauf pour un nouveau scénario.
- **Secrets.** N'écrivez jamais de mot de passe, clé d'API ou donnée
  personnelle réelle dans `content/`. Ce dossier est versionné dans Git.
- **Langue.** Tous les textes affichés sont en français.

---

## 7. La grille de compétences et les profils

La grille est **commune aux 4 scénarios** : elle ne dépend pas du sujet.
Seuls les recruteurs la voient, jamais le candidat.

- **10 compétences**, chacune notée de 1 à 4 (ou « non observé ») :
  `sql`, `algo`, `logique`, `debug`, `collab`, `client`, `culture`, `ia`,
  `temps`, `honnetete`.
- Pour chacune : un nom, **où l'observer** dans le replay, et **4 phrases**
  décrivant les niveaux 1 à 4.
- **Éliminatoire** : « Honnêteté et rigueur » sous 2 exclut le candidat,
  quel que soit son profil.
- **Profils** (Data engineer, BI, IA, Salesforce) : un poids de 1 à 4 par
  compétence.
- **Adéquation** d'un profil = somme(note × poids) ÷ somme(4 × poids), en
  pourcentage. Les compétences « non observées » sont retirées du calcul.

### Modifier le texte d'un niveau

`content/grille/competences.ts` : changez la phrase voulue dans la liste
`niveaux` (4 phrases, dans l'ordre du niveau 1 au niveau 4 — **toujours 4**).
Reportez aussi le changement dans `content/grille-et-profils.md`, qui est la
version lisible relue par l'équipe recrutement.

### Modifier un poids

`content/grille/profils.ts` : changez le nombre (de 1 à 4) à côté du nom de
la compétence, pour le profil voulu. Gardez les 10 compétences pour chaque
profil. Mettez à jour le tableau dans `content/grille-et-profils.md`.

> Les poids sont une version de travail, à **calibrer** : faire passer 4 ou
> 5 juniors d'Olivesoft et vérifier que leur meilleur pourcentage
> correspond à leur métier réel.

### Ajouter un profil ou une compétence

Ajouter un **profil** : copiez un bloc dans `profils.ts` (nouvel `id` sans
espaces, un `nom`, les 10 poids). Ajouter une **compétence** a des
conséquences sur l'écran de notation et le calcul : à faire avec un
développeur. Dans les deux cas, lancez `npm test`.

---

## 8. Mémo : qui fait quoi

| Je veux… | Seul(e) | Avec un développeur |
| --- | --- | --- |
| Corriger une faute, reformuler une question | ✅ | |
| Ajouter / retirer une question de quiz | ✅ | relecture conseillée |
| Changer l'histoire, l'introduction, la fin | ✅ | |
| Changer villes, produits, noms (listes SQL) | ✅ (tailles respectées) | |
| Changer un niveau de la grille ou un poids | ✅ | |
| Changer une règle d'une épreuve (SQL, Python, cadenas, Portail) | | ✅ |
| Ajouter un scénario ou une compétence | | ✅ |
| Mettre en ligne | | ✅ |
