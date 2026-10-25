# Wrestling Events

## Presentación

Esta integración trae a Gladys el programa de la lucha libre profesional: los shows de **WWE, AEW, NJPW, TNA, AAA, ROH, CMLL, Stardom, AJPW, DDT, Dragon Gate, GCW, RevPro y MLP**, elegidos en una lista. Cada empresa seguida se convierte en un **calendario** para cada usuario que activa la integración, con la hora, el recinto y la cartelera de cada show. Las escenas pueden reaccionar antes de que suene la campana, cuando se anuncia un show o cuando se añaden combates a una cartelera, y dos widgets muestran lo que viene.

El programa procede de [TheSportsDB](https://www.thesportsdb.com), una base de datos deportiva abierta que mantiene al día su comunidad. No hace falta cuenta: la integración usa la clave gratuita de TheSportsDB, o su clave premium si tiene una.

## Requisitos

- Gladys Assistant **5.3.0** o posterior (integraciones de calendario).
- Acceso a internet.
- Opcional: una clave premium de TheSportsDB, para 60 o 90 días por adelantado y una lectura más rápida.

## Configuración

| Campo                               | Descripción                                                                                                    |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Empresas                            | Las empresas a seguir, un calendario cada una. WWE, AEW, NJPW, TNA y AAA por defecto.                          |
| Tipos de shows                      | Programas semanales (RAW, SmackDown, Dynamite…), shows de gira («Day 1»…) y grandes eventos (PLE, especiales). |
| Programa por adelantado             | 2 semanas o 30 días (por defecto); 60 o 90 días requieren una clave premium.                                   |
| Clave de API premium (opcional)     | Déjela vacía para usar la clave gratuita.                                                                      |
| Idioma de los textos de las escenas | El idioma de la frase de la acción de escena «próximo show». Automático: el idioma del panel.                  |

Guarde y después, en **Mis calendarios** en la misma página, pulse **Activar para mí**. Cada usuario que quiera los calendarios activa la integración para sí mismo.

Con la clave gratuita, la integración pide un día de una empresa cada vez, una vez cada 7 segundos, para respetar lo que permite TheSportsDB: la primera lectura de 30 días para 5 empresas tarda unos 20 minutos. El estado de la integración muestra el avance. Seguir menos empresas, o solo 2 semanas, va más rápido.

## Uso

### Calendarios

Cada empresa seguida es un calendario llamado «Lucha libre – WWE», del color de la empresa, con:

- un evento por show, de la hora de inicio a un final estimado (2 horas para un programa, 3 para un show de gira, 4 para un gran evento) cuando se conoce la hora, o un **evento de día entero** cuando TheSportsDB aún no la conoce;
- el recinto, la ciudad y el país como lugar, la cartelera (un combate por línea) y el tipo de show como descripción, y un enlace a la página del show en TheSportsDB;
- los shows desde hace 7 días hasta el horizonte elegido. Un show cancelado desaparece, uno movido lo sigue.

Un calendario nuevo es **privado**. En **Mis calendarios**, active **Compartir con el hogar** para usarlo en las escenas del hogar (y con el disparador nativo «Se acerca un evento del calendario»), o desactive **Sincronizar este calendario** para omitirlo. Una empresa quitada de la configuración elimina su calendario.

### Widgets del panel

![Los dos widgets: los próximos shows de WWE y NJPW, y la cuenta atrás hasta RAW con su cartelera (ilustración generada, no una captura; carteles inventados)](https://raw.githubusercontent.com/William-De71/gladys-wrestling-events/main/docs/assets/widgets.es.png)

- **Próximos shows**: los 3, 5 u 8 próximos shows con su fecha, hora, recinto, una etiqueta por empresa (azul: programa, azul claro: show de gira, rojo: gran evento) y el cartel. Toque un show para leer su cartelera.
- **Próximo show**: la cuenta atrás hasta el próximo show, su hora, el número de combates anunciados, el cartel, el recinto y la cartelera.

Ambos se pueden limitar a algunas empresas o tipos de shows en sus ajustes.

### Escenas

Disparadores (filtros: empresas y tipos de shows):

- **Lucha libre: empieza un show**: al inicio, o 15, 30, 60 o 120 minutos antes (elíjalo en «Cuándo»). Solo para los shows cuya hora se conoce.
- **Lucha libre: nuevo show anunciado**: se añade un show al programa de una empresa seguida.
- **Lucha libre: combates añadidos**: aparecen nuevos combates en la cartelera de un show próximo; `new_matches` los enumera.

Las variables de los shows: `title` («WWE – Crown Jewel»), `name`, `promotion`, `promotion_name`, `kind` (weekly, tour, special), `date`, `time`, `venue`, `city`, `country`, `place`, `card`, `url`.

Acción: **Lucha libre: próximo show** da el próximo show de algunas empresas o tipos: título, fecha, hora, lugar, minutos hasta el inicio, cartelera, enlace y una frase lista `text`.

Ejemplos:

- Cuando **un gran evento de WWE o AEW empiece en 15 minutos** → encender la tele y atenuar el salón.
- Cuando **se anuncie un nuevo show de NJPW** → enviar `{{triggerEvent.data.title}}, {{triggerEvent.data.date}} en {{triggerEvent.data.city}}`.
- Cada lunes a las 9 → **Lucha libre: próximo show**, y después enviar su `text` por Telegram.

### Transporte

Solo nube. Solo las empresas elegidas y los días pedidos van a TheSportsDB, por internet; los carteles de los widgets se descargan de TheSportsDB cuando un panel los muestra. Nada sobre usted ni su casa sale de su red.

## Solución de problemas

- **Los calendarios siguen vacíos**: compruebe que pulsó **Activar para mí** en Mis calendarios y espere a la primera lectura (el estado de la integración muestra su avance).
- **«TheSportsDB pide ir más despacio»**: la clave gratuita la comparten todos; la integración espera 15 minutos y continúa sola.
- **«TheSportsDB rechaza la clave de API»**: revise la clave premium o vacíe el campo para usar la clave gratuita.
- **Un show no tiene hora**: TheSportsDB suele añadir la hora unos días antes; el evento de día entero pasa entonces a tener hora solo. El disparador «empieza un show» solo actúa cuando se conoce la hora.
- **Falta un show**: TheSportsDB lo mantiene su comunidad, y la clave gratuita responde como mucho 3 shows por empresa y día (el CMLL puede tener más). Una clave premium lee temporadas enteras.
- **Un show tiene el tipo equivocado**: el tipo se deduce de su nombre (un número «#1743» significa un programa, «Day 3» un show de gira). Infórmelo con el nombre del show.
- **No se lanza ninguna escena**: los disparadores de la integración no necesitan compartir, pero «empieza un show» necesita la hora del show y «nuevo show anunciado» un día ya leído una vez. El disparador nativo «Se acerca un evento del calendario» solo ve los calendarios compartidos con el hogar.

Para informar de un error, indique las versiones de Gladys y de la integración, las empresas seguidas, clave gratuita o premium, y las líneas de la pestaña Registros de la integración; en modo desarrollador, `DEBUG=gladys-integration-sdk` añade los registros del SDK.
