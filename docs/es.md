# Belgian Mobility

Siga desde Gladys el transporte público que utiliza, en toda Bélgica: las
próximas salidas de su estación de tren y de sus paradas de metro, tranvía o
autobús, sus retrasos y cancelaciones, y las incidencias de la red ferroviaria
SNCB.

| Operador    | Cubre                                          | Fuente                               |
| ----------- | ---------------------------------------------- | ------------------------------------ |
| SNCB / NMBS | Trenes (vías, retrasos, cancelaciones)         | [iRail](https://docs.irail.be)       |
| STIB / MIVB | Metro, tranvías y autobuses de Bruselas        | [Transitous](https://transitous.org) |
| De Lijn     | Tranvías y autobuses de Flandes                | [Transitous](https://transitous.org) |
| TEC         | Metro (Charleroi), tranvías y buses de Valonia | [Transitous](https://transitous.org) |

Ambas fuentes son gratuitas y abiertas: **sin cuenta ni clave de API**. La
integración necesita conexión a internet (nube).

## 1. Encontrar sus paradas

- **Una estación de tren**: escriba su nombre en cualquier idioma oficial:
  `Namur`, `Bruxelles-Central` o `Brussel-Centraal`, `Liège-Guillemins`.
- **Una parada de metro, tranvía o autobús**: en la configuración, pulse
  **Buscar una parada**, escriba su nombre (`De Brouckère`,
  `Gent Korenmarkt`...) y copie el identificador que aparece tras la flecha,
  p. ej. `be-stib_6`.

## 2. Configurar

- **Paradas a seguir**: separadas por `;`. Añada `| 71, 89` tras una parada
  para conservar solo esas líneas (`IC`, `S`... para trenes). Ejemplo:
  `Namur; be-stib_6 | 1, 5; Bruxelles-Central | IC`.
- **Idioma de los textos**: inglés, francés, alemán o español.
- **Alerta de retraso**: a partir de estos minutos de retraso se activa
  **Salida con retraso** (5 por defecto).
- **Tiempo para salir**: **Salida inminente** se activa cuando falta este número
  de minutos para una salida (10 por defecto, 0 lo desactiva).
- **Red SNCB**: añade el dispositivo **Red SNCB** y el disparador **Nueva
  incidencia SNCB**.
- **Intervalo de actualización**: en segundos (mínimo 60).

Guarde y abra la pestaña **Descubrimiento** de la integración para crear los
dispositivos. **Probar la conexión** comprueba que ambas fuentes responden.

## 3. Dispositivos

Cada parada seguida es un dispositivo con tres funciones: **Próxima salida en**
(minutos), **Retraso de la próxima salida** (minutos, con historial) y
**Próxima salida** (resumen, p. ej. `14:47 S61 4586 → Wavre, Vía 5`).

## 4. Escenas

Disparadores (una vez por viaje): **Salida con retraso**, **Salida cancelada**,
**Salida inminente** (filtros: parada, línea, tren concreto) y **Nueva
incidencia SNCB**. Variables: `line`, `vehicle`, `destination`,
`delay_minutes`, `minutes`, `platform`...

Acciones: **Obtener la próxima salida**, **Planificar un viaje en tren** (entre
dos estaciones, ahora o a una hora dada), **Obtener el estado de la red SNCB**.

## 5. Widgets

**Panel de salidas** (las próximas salidas de una parada) y **Red SNCB**
(incidencias actuales y obras previstas).

## Conviene saber

Los datos en tiempo real dependen del operador: SNCB, De Lijn y TEC los
publican; las paradas de la STIB muestran por ahora el horario (distintivo
**Programado**).
Solo las paradas configuradas se envían a iRail y Transitous.
