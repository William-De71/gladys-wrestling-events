# Wrestling Events

## Présentation

Cette intégration amène le programme du catch dans Gladys : les shows de **WWE, AEW, NJPW, TNA, AAA, ROH, CMLL, Stardom, AJPW, DDT, Dragon Gate, GCW, RevPro et MLP**, choisis dans une liste. Chaque fédération suivie devient un **calendrier** pour chaque utilisateur qui active l'intégration, avec l'heure, la salle et la carte de chaque show. Des scènes peuvent réagir avant le début d'un show, quand un show est annoncé ou quand des matchs sont ajoutés à une carte, et deux widgets montrent ce qui arrive.

Le programme vient de [TheSportsDB](https://www.thesportsdb.com), une base de données sportive ouverte tenue à jour par sa communauté. Aucun compte n'est nécessaire : l'intégration utilise la clé gratuite de TheSportsDB, ou votre clé premium si vous en avez une.

## Prérequis

- Gladys Assistant **5.3.0** ou plus récent (intégrations de type calendrier).
- Un accès à internet.
- Facultatif : une clé premium de TheSportsDB, pour 60 ou 90 jours à l'avance et une lecture plus rapide.

## Configuration

| Champ                           | Description                                                                                                      |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Fédérations                     | Les fédérations à suivre, un calendrier chacune. WWE, AEW, NJPW, TNA et AAA par défaut.                          |
| Types de shows                  | Émissions hebdo (RAW, SmackDown, Dynamite…), shows de tournée (« Day 1 »…) et grands événements (PLE, spéciaux). |
| Programme à l'avance            | 2 semaines ou 30 jours (par défaut) ; 60 ou 90 jours demandent une clé premium.                                  |
| Clé d'API premium (facultative) | Laissez-la vide pour utiliser la clé gratuite.                                                                   |
| Langue des textes des scènes    | La langue de la phrase de l'action de scène « prochain show ». Automatique : la langue du tableau de bord.       |

Enregistrez puis, dans **Mes calendriers** sur la même page, appuyez sur **Activer pour moi**. Chaque utilisateur qui veut les calendriers active l'intégration pour lui-même.

Avec la clé gratuite, l'intégration demande un jour d'une fédération à la fois, une fois toutes les 7 secondes, pour rester dans ce que TheSportsDB autorise : la première lecture de 30 jours pour 5 fédérations prend une vingtaine de minutes. Le statut de l'intégration affiche l'avancement. Suivre moins de fédérations, ou 2 semaines seulement, va plus vite.

## Utilisation

### Calendriers

Chaque fédération suivie est un calendrier nommé « Catch – WWE », à la couleur de la fédération, avec :

- un événement par show, de l'heure du début à une fin estimée (2 heures pour une émission, 3 pour un show de tournée, 4 pour un grand événement) quand l'heure est connue, ou un **événement sur la journée** quand TheSportsDB ne connaît pas encore l'heure ;
- la salle, la ville et le pays comme lieu, la carte (un match par ligne) et le type de show comme description, et un lien vers la page du show sur TheSportsDB ;
- les shows d'il y a 7 jours jusqu'à l'horizon choisi. Un show annulé disparaît, un show déplacé suit.

Un nouveau calendrier est **privé**. Dans **Mes calendriers**, activez **Partager avec le foyer** pour l'utiliser dans les scènes du foyer (et avec le déclencheur natif « Un évènement dans le calendrier arrive »), ou désactivez **Synchroniser ce calendrier** pour l'ignorer. Une fédération retirée de la configuration supprime son calendrier.

### Widgets du tableau de bord

![Les deux widgets : les prochains shows de la WWE et de la NJPW, et le compte à rebours jusqu'à RAW avec sa carte (illustration générée, pas une capture d'écran ; affiches inventées)](https://raw.githubusercontent.com/William-De71/gladys-wrestling-events/main/docs/assets/widgets.fr.png)

- **Prochains shows de catch** : les 3, 5 ou 8 prochains shows avec leur date, leur heure, la salle, un badge par fédération (bleu : émission, bleu clair : show de tournée, rouge : grand événement) et l'affiche. Appuyez sur un show pour lire sa carte.
- **Prochain show de catch** : le compte à rebours jusqu'au prochain show, son heure, le nombre de matchs annoncés, l'affiche, la salle et la carte.

Les deux peuvent se limiter à certaines fédérations ou certains types de shows dans leurs réglages.

### Scènes

Déclencheurs (filtres : fédérations et types de shows) :

- **Catch : un show commence** : au début, ou 15, 30, 60 ou 120 minutes avant (à choisir dans « Quand »). Seulement pour les shows dont l'heure est connue.
- **Catch : nouveau show annoncé** : un show est ajouté au programme d'une fédération suivie.
- **Catch : matchs ajoutés à une carte** : de nouveaux matchs apparaissent sur la carte d'un show à venir ; `new_matches` les liste.

Les variables des shows : `title` (« WWE – Crown Jewel »), `name`, `promotion`, `promotion_name`, `kind` (weekly, tour, special), `date`, `time`, `venue`, `city`, `country`, `place`, `card`, `url`.

Action : **Catch : prochain show** donne le prochain show de certaines fédérations ou de certains types : titre, date, heure, lieu, minutes avant le début, carte, lien, et une phrase toute faite `text`.

Exemples :

- Quand **un grand événement WWE ou AEW commence dans 15 minutes** → allumer la télé et tamiser le salon.
- Quand **un nouveau show NJPW est annoncé** → envoyer `{{triggerEvent.data.title}}, {{triggerEvent.data.date}} à {{triggerEvent.data.city}}`.
- Chaque lundi à 9 h → **Catch : prochain show**, puis envoyer son `text` sur Telegram.

### Transport

Cloud uniquement. Seules les fédérations choisies et les jours demandés partent vers TheSportsDB, par internet ; les affiches des widgets sont téléchargées depuis TheSportsDB quand un tableau de bord les affiche. Rien sur vous ni sur votre maison ne quitte votre réseau.

## Dépannage

- **Les calendriers restent vides** : vérifiez que vous avez appuyé sur **Activer pour moi** dans Mes calendriers, et attendez la première lecture (le statut de l'intégration affiche son avancement).
- **« TheSportsDB demande de ralentir »** : la clé gratuite est partagée par tous ; l'intégration attend 15 minutes et reprend toute seule.
- **« TheSportsDB refuse la clé d'API »** : vérifiez la clé premium, ou videz le champ pour utiliser la clé gratuite.
- **Un show n'a pas d'heure** : TheSportsDB ajoute souvent l'heure quelques jours avant ; l'événement sur la journée devient alors horaire tout seul. Le déclencheur « un show commence » n'agit qu'une fois l'heure connue.
- **Un show manque** : TheSportsDB est tenu à jour par sa communauté, et la clé gratuite répond au plus 3 shows par fédération et par jour (la CMLL peut en avoir plus). Une clé premium lit des saisons entières.
- **Un show a le mauvais type** : le type est deviné d'après son nom (un numéro « #1743 » signifie une émission, « Day 3 » un show de tournée). Signalez-le avec le nom du show.
- **Aucune scène ne se lance** : les déclencheurs de l'intégration n'ont pas besoin de partage, mais « un show commence » demande l'heure du show et « nouveau show annoncé » un jour déjà lu une fois. Le déclencheur natif « Un évènement dans le calendrier arrive » ne voit que les calendriers partagés avec le foyer.

Pour signaler un bug, donnez les versions de Gladys et de l'intégration, les fédérations suivies, clé gratuite ou premium, et les lignes de l'onglet Journaux de l'intégration ; en mode développeur, `DEBUG=gladys-integration-sdk` ajoute les journaux du SDK.
