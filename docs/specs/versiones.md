# Versiones y Novedades

```
ESTADO:    IMPLEMENTADO EN CÓDIGO (rama claude/changelog-versiones-70a4a8),
           NO DESPLEGADO. Portado de Plataforma Impulsa
           (docs/specs/changelog.md allí), simplificado para Lopest.
EVIDENCIA: pnpm test (parser, lectura por rol, publicación y el archivo real),
           pnpm validate (lint, tsc, next build con el validador delante) y
           ensayo del publicador sobre una copia. Nada visto en navegador ni
           en la imagen Docker de la VPS.
```

## 1. Propósito

Lopest declara su versión y publica qué cambió en cada una, por módulo y en un
lenguaje que entiende quien usa la app. La versión vigente aparece al pie del
menú (barra lateral, menú de tableta y «Más opciones» en el celular) y abre
**Novedades** (`/novedades`).

## 2. Decisiones

| # | Decisión |
|---|---|
| D1 | Numeración **SemVer**. `1.0.0` es el inventario de lo que ya estaba en producción el 2026-09-02 (último commit de `main` antes de este sistema). |
| D2 | **Fuente única: `web/CHANGELOG.md`.** Vive en `web/` porque `web/` es el contexto de build de Docker; en la raíz no llegaría a la imagen. No hay copia en base de datos ni `package.json#version` que sincronizar (a diferencia de Impulsa, que exige igualdad). |
| D3 | Las secciones de cada versión son los **módulos** del menú más `General` (lo transversal) y `Técnico`, en un orden fijo (§3). |
| D4 | `Técnico` y el bloque `[Sin publicar]` solo los lee quien tiene el rol `ADMIN` (`Role.code`). Todos los demás ven todas las versiones publicadas, sin cortes por fecha de acceso (Impulsa los tiene; Lopest tiene pocas personas y todas usan la app desde la `1.0.0`). |
| D5 | El validador **bloquea el build**, también el de Docker (§6). |

## 3. Formato

```markdown
# Changelog

Un párrafo opcional.

## [Sin publicar]
### Créditos
- Añadido el filtro por número de cuotas vencidas.

## [1.1.0] - 2026-12-01
### General
- Corregido …
### Técnico
- Añadido un índice en `credito.estado`.
```

Reglas (un archivo que las incumple **rompe el build**, con número de línea):

0. Abre con `# Changelog` y, como mucho, un párrafo antes de la primera versión.
1. Encabezado: `## [X.Y.Z] - AAAA-MM-DD` (día real) o exactamente `## [Sin publicar]`.
2. `[Sin publicar]` aparece como mucho una vez y siempre primero.
3. Versiones estrictamente descendentes; fechas no crecientes.
4. Secciones solo `General`, `Simulador`, `Clientes`, `Créditos`,
   `Transferencias`, `Reportes`, `Técnico`, en ese orden, sin repetir ni
   vaciar. Una versión tiene al menos una.
5. Dentro de una sección solo viñetas `- `. En línea se interpretan
   `código` y **negrita**; lo demás (enlaces, HTML) se muestra literal y la
   vista nunca inyecta HTML.
6. Cada viñeta **abre con el participio de lo que se hizo**: Añadido,
   Ampliado, Mejorado, Cambiado, Sustituido, Reorganizado, Unificado,
   Separado, Extraído, Movido, Renombrado, Restringido, Corregido, Retirado,
   en sus cuatro concordancias («Añadida la…», «Corregidos los…»).

Ampliar la lista de módulos o de participios es una edición deliberada aquí y
en `web/src/features/versiones/changelog-format.ts` (`AUDIENCES`,
`BULLET_PARTICIPLES`).

**Versión vigente** = la versión publicada más alta. `[Sin publicar]` nunca lo es.

## 4. Lectura en la app

| Pieza | Archivo |
|---|---|
| Parser, reglas §3 y publicación (sin imports; Node lo ejecuta con type stripping) | `web/src/features/versiones/changelog-format.ts` |
| Regla de lectura por rol (pura) | `web/src/features/versiones/version-visibility.ts` |
| Lectura del archivo y rol (servidor) | `web/src/server/versiones/versiones.service.ts` |
| Pie del menú | `web/src/components/versiones/version-footer-link.tsx` |
| Novedades | `web/src/app/(dashboard)/novedades/page.tsx`, `components/versiones/version-timeline.tsx` |
| Recetas visuales | `web/src/design-system/recipes/versions.ts` |
| Pruebas | `web/src/features/versiones/__tests__/changelog-format.test.ts` |

- El servidor lee `CHANGELOG.md` una vez por proceso desde `process.cwd()`. En
  la imagen, el `Dockerfile` lo copia junto a `server.js` (`/app`).
- Si falta, ninguna pantalla falla: el pie no muestra versión, Novedades queda
  vacía y el error va al log del contenedor `web`.
- El filtrado por rol ocurre en servidor: al navegador solo llega lo que el
  lector puede leer.

## 5. Publicar una versión

Publicar no es desplegar, pero en Lopest van juntos: la versión llega a la app
cuando se reconstruye la imagen en la VPS.

1. **Mantener `[Sin publicar]` al día** en el mismo commit de cada cambio con
   efecto visible o técnico. Una viñeta por capacidad, no por commit; si ya hay
   una para lo mismo, se reescribe.
2. **Curar** el bloque: comparar con `git log v<vigente>..HEAD`, fusionar lo
   repetido y redactar cada módulo para quien lo usa.
3. **Publicar** en `web/`: `pnpm version:publicar X.Y.Z [--fecha AAAA-MM-DD]`.
   La fecha por defecto es hoy en Bogotá. Solo cambia la línea
   `## [Sin publicar]` → `## [X.Y.Z] - fecha`. Rechaza una versión no mayor
   que la vigente, una fecha inválida o anterior y la ausencia del bloque.
   - Menor (`1.1.0`): publicación ordinaria. Parche (`1.0.1`): solo
     correcciones urgentes. Mayor: corte de compatibilidad declarado.
4. **Commit propio**: `chore(versiones): publicar la versión X.Y.Z`, y **tag
   anotado** `vX.Y.Z` sobre ese commit.
5. **Desplegar** en la VPS como siempre (`docs/estado/operacion.md`). El build
   vuelve a validar el archivo.

Tras publicar no queda bloque `[Sin publicar]`; el siguiente cambio lo abre
encima de la versión más reciente.

## 6. Por qué el validador bloquea el build de Docker

`pnpm build` corre `scripts/versiones/check-changelog.mjs` antes de `next
build`, y el `Dockerfile` usa `pnpm build`, así que bloquea la imagen. Se
eligió así porque:

- Es el mismo parser que usa la app: si el build lo acepta, la app lo lee. Sin
  el bloqueo, un archivo roto se desplegaría y el pie quedaría sin versión en
  silencio.
- No depende de base de datos, red ni variables: solo lee un archivo de texto,
  así que no puede fallar por causas ajenas al changelog.
- El fallo llega antes, en `pnpm validate` y `pnpm test` (que leen el archivo
  real), así que en la VPS solo falla si se desplegó sin validar.

Para no romper el build vigente: el archivo de este corte pasa todas las reglas
(`pnpm version:check`), `node:24-alpine` ejecuta el `.ts` con type stripping
igual que Node 24 local, y `.dockerignore` no excluye `CHANGELOG.md` ni
`scripts/`. Si un despliegue urgente se encuentra con el changelog roto, se
corrige la línea que el error cita; no se salta el validador.
