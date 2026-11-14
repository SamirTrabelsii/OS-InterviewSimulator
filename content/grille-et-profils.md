# Grille de compétences et profils — Le Portail (Olivesoft)

Version de travail, à relire avec l'équipe recrutement avant l'étape 9.

## Règles de notation

- Chaque compétence est notée de 1 à 4 par le recruteur, après la session,
  à partir du replay et du débrief. « Non observé » est autorisé.
- Chaque recruteur note seul avant toute discussion avec les autres.
- Une note doit pouvoir être justifiée par un moment précis du replay.
- La compétence marquée « éliminatoire » sous 2 exclut le candidat,
  quel que soit son profil.
- Le candidat ne voit jamais ses notes.

## Compétences

### 1. SQL et données (`sql`)
Où l'observer : gemme SQL (requêtes tentées, anomalies repérées).
1. Ne parvient pas à écrire une requête qui s'exécute, même simple.
2. Requêtes simples (SELECT, WHERE) ; bloque sur les jointures ou les agrégats.
3. Jointures et agrégats corrects ; repère au moins un piège des données (NULL, doublons, casse).
4. Requêtes propres et ciblées ; repère et signale les pièges sans indice ; vérifie ses résultats.

### 2. Python et algorithmique (`algo`)
Où l'observer : gemme Algo (versions du code, tests, essais).
1. Code qui ne s'exécute pas ou ne traite pas le cas simple.
2. Traite le cas simple ; oublie les cas limites.
3. Solution correcte avec la plupart des cas limites ; code lisible.
4. Solution correcte, claire et bien structurée ; anticipe les cas limites avant de soumettre.

### 3. Raisonnement logique (`logique`)
Où l'observer : gemme Logique (nombre d'essais, délai, démarche).
1. Essais au hasard, sans méthode visible.
2. Trouve avec beaucoup d'essais ou après un long blocage.
3. Trouve avec une démarche visible et peu d'erreurs.
4. Trouve rapidement et avec méthode ; sait expliquer son raisonnement au débrief.

### 4. Débogage et résolution de problèmes (`debug`)
Où l'observer : Portail (exécutions, corrections successives).
1. Modifie le code au hasard, sans hypothèse.
2. Corrige un bug évident ; tâtonne sur les autres.
3. Formule des hypothèses, les vérifie, corrige la plupart des bugs.
4. Démarche méthodique (lire, reproduire, isoler, corriger, vérifier) ; corrige tous les bugs.

### 5. Communication et collaboration (`collab`)
Où l'observer : Portail en binôme (appel Teams, demandes de main), débrief.
1. Travaille seul, ignore son partenaire ou le monopolise.
2. Communique peu ou de façon confuse.
3. Partage l'information utile, écoute, passe la main quand il le faut.
4. Structure l'échange (« qu'est-ce que tu vois dans les logs ? »), répartit le travail, reformule.

### 6. Vulgarisation et sens client (`client`)
Où l'observer : débrief (« explique au client ce qui s'est passé »).
1. Explication incompréhensible pour un non-technicien.
2. Explication juste mais jargonnante ou trop longue.
3. Explication claire et adaptée au client.
4. Claire, concise, rassurante sans mentir, avec une proposition d'action.

### 7. Culture technique générale (`culture`)
Où l'observer : gemme Quiz.
1. Lacunes sur la plupart des thèmes.
2. Bases correctes sur certains thèmes seulement.
3. Bonne maîtrise de la plupart des thèmes.
4. Très bonne maîtrise, y compris sécurité, Git et IA générative.

### 8. Usage critique de l'IA (`ia`)
Où l'observer : échanges avec Bip si activé, sinon question au débrief.
1. Copie les réponses sans vérifier, ou colle des données sensibles.
2. Utilise l'IA de façon vague, vérifie peu.
3. Questions précises avec contexte ; vérifie les réponses.
4. Utilise l'IA à bon escient, repère ses erreurs, protège les données.

### 9. Gestion du temps et du stress (`temps`)
Où l'observer : ordre des gemmes, réaction aux blocages et au chrono.
1. Reste bloqué sans changer de stratégie ; se désorganise sous la pression.
2. Avance mais gère mal ses priorités.
3. Priorise, sait passer à autre chose et revenir.
4. Calme et organisé ; ses choix d'ordre et de temps sont justifiés.

### 10. Honnêteté et rigueur (`honnetete`) — ÉLIMINATOIRE sous 2
Où l'observer : « Je ne sais pas » au quiz, débrief, signalement des doutes.
1. Bluffe, s'attribue un travail qui n'est pas le sien, ou tente de tricher.
2. Reconnaît ses limites seulement quand on le lui demande.
3. Dit quand il ne sait pas ; signale ses doutes.
4. Transparent en permanence ; distingue clairement ce qu'il a fait, ce qu'il suppose et ce que l'IA a proposé.

## Profils (poids de 1 à 4)

| Compétence | Data engineer | BI | IA | Salesforce |
| --- | --- | --- | --- | --- |
| sql | 4 | 4 | 2 | 3 |
| algo | 4 | 2 | 4 | 2 |
| logique | 3 | 3 | 4 | 3 |
| debug | 4 | 2 | 3 | 3 |
| collab | 3 | 3 | 3 | 3 |
| client | 2 | 4 | 3 | 4 |
| culture | 2 | 2 | 3 | 2 |
| ia | 2 | 2 | 4 | 2 |
| temps | 3 | 3 | 3 | 3 |
| honnetete | 3 | 3 | 3 | 3 |

## Calcul de l'adéquation

Pour chaque profil :
adéquation = somme(note × poids) ÷ somme(4 × poids), en pourcentage.
Les compétences « non observées » sont retirées du calcul (numérateur et
dénominateur). Si « honnêteté » est sous 2, le candidat est marqué
« non retenu », quel que soit le pourcentage.

À calibrer : faire passer 4 ou 5 juniors d'Olivesoft et vérifier que leur
meilleur pourcentage correspond bien à leur métier réel.
