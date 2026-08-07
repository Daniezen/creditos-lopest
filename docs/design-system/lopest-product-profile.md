# Perfil de diseño de Lopest

## Personalidad

Cercana, clara, austera, financiera y responsable.

## Identidad

- Nombre principal: Lopest.
- Descriptor: Créditos.
- Tipografía: Geist.
- Familia cromática: violeta y magenta del logo, con acentos cálidos controlados.
- Gradientes: solo en elementos identitarios justificados.
- Sombras cromáticas: excluidas de superficies operativas.

## Tipografía

- Contenido: 400.
- Navegación y acciones: 500.
- Títulos y cifras relevantes: 600.
- Enfasis financiero excepcional: 700.
- Peso 900: excluido.

## Shell aprobado

### Sidebar

- Fondo blanco.
- Marca cromática.
- Activo sobre superficie violeta tenue.
- Navegación sin gradiente ni sombra cromática.
- Acciones de creación compactas, visualmente diferenciadas como botones rápidos y respaldadas por recetas semánticas.
- Cerrar sesión al final.

### Topbar

- Superficie cromática tenue.
- Icono contextual violeta/magenta.
- Título breve, contexto secundario y acento corto.
- Volver solo cuando exista un padre inequívoco.
- Foto real del login, nombre y Role.name.
- Identidad de cuenta no interactiva.
- Sin menú de cuenta.
- Sin barra cromática completa.
- Permanece sticky en la parte superior mientras se desplaza el contenido autenticado.

### Responsive

- 1200 px o más: sidebar persistente.
- 768 a 1199 px: drawer superpuesto.
- Menos de 768 px: navegación inferior.
- Drawer con cierre interno, backdrop y Escape.
- Más agrupa acciones secundarias y cierre de sesión en móvil.

## Identidad y autorización

Role.code se usa para autorización. Role.name se usa para presentación. Nunca se muestran códigos internos al usuario final.

## Regla de introducción

La primera migración a tokens debe ser visualmente neutra: el aspecto aprobado se expresa mediante el contrato sin rediseñarlo. Los cambios posteriores se aprueban vista por vista.

## Vista Clientes

- Conserva un ojo explícito dentro de la celda Cliente, además del nombre enlazado y la respuesta visual de la fila; no usa columna Acción.
- Interés pendiente suma el interés programado de cuotas operativas PENDIENTE, ATRASADO o MORA de créditos activos.
- El encabezado de tabla permanece sticky debajo de la topbar; ningún ancestro entre la tabla y el viewport puede declarar overflow distinto de visible.
- Desde 1200 px usa tabla operativa; entre 768 y 1199 px usa filas planas; por debajo de 768 px usa tarjetas compactas.
- En móvil, métricas y acciones se distribuyen en dos columnas para priorizar filtros y listado.
- La búsqueda filtra localmente el conjunto autorizado, sincroniza q con la URL mediante debounce y no requiere botón Buscar.
- El estado documental se aplica inmediatamente y conserva q.
- Limpiar aparece únicamente cuando existe un filtro activo.
- El combobox soporta foco, flechas, Enter, Escape, click y mensaje vacío, sin borrar entrada válida.
- Los valores visuales reutilizables se consumen desde tokens o recetas; solo la composición responsive permanece local.

- El buscador superior filtra exclusivamente por nombre.
- Estado de cartera es el filtro operativo superior; los demás criterios se filtran desde encabezados en escritorio y desde un panel unificado en pantallas compactas.
- Todos los filtros se sincronizan con la URL, muestran contador activo y se pueden limpiar globalmente.
- Cédula, teléfono, cantidades, valores monetarios y badges son valores atómicos y no se dividen entre líneas.

- Los filtros discretos usan búsqueda interna y selección múltiple con checks; capital e interés combinan valores exactos con rango.
- ATRASADO y MORA se presentan operativamente como Con cuotas vencidas hasta que exista una regla empresarial diferenciadora.
- Un resultado vacío conserva la tabla, los encabezados y los controles de recuperación.

- La vista consume roles tipográficos semánticos desde tokens y recetas; no define pesos reutilizables en JSX ni CSS local.
- Datos ordinarios usan el rol de dato, datos destacados el rol de énfasis, filtros los roles de cuerpo/etiqueta/acción y encabezados el rol de título.
- Las métricas de Clientes usan la variante compacta del contrato para conservar jerarquía sin dominar el primer viewport.
- Desde 1200 px, los filtros específicos viven en los encabezados de tabla; entre 768 y 1199 px se abren en un drawer derecho, y por debajo de 768 px en un bottom sheet.
- Los filtros responsive no expanden el flujo de la página, bloquean el scroll de fondo y cierran mediante Escape, backdrop o control explícito.
- Recomendado por consume el campo histórico opcional `Cliente.recomienda`; se presenta como dato descriptivo, usa filtro multiselección y no requiere una relación nueva ni migración.
- La tabla de escritorio prioriza legibilidad mediante anchos operacionales. Cuando desborda, usa desplazamiento horizontal sincronizado y sticky, manteniendo Cliente visible a la izquierda y el encabezado visible verticalmente.
- En filas compactas, Recomendado por se muestra como un dato etiquetado sin forzar la tabla de escritorio en tablet o móvil.
