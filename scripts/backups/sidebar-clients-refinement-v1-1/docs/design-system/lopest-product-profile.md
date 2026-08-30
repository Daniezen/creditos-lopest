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
- Acciones de creación compactas.
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

- Conserva una acción explícita Ver además de la fila navegable.
- Desde 1200 px usa tabla operativa; entre 768 y 1199 px usa filas planas; por debajo de 768 px usa tarjetas compactas.
- En móvil, métricas y acciones se distribuyen en dos columnas para priorizar filtros y listado.
- La búsqueda filtra localmente el conjunto autorizado, sincroniza q con la URL mediante debounce y no requiere botón Buscar.
- El estado documental se aplica inmediatamente y conserva q.
- Limpiar aparece únicamente cuando existe un filtro activo.
- El combobox soporta foco, flechas, Enter, Escape, click y mensaje vacío, sin borrar entrada válida.
- Los valores visuales reutilizables se consumen desde tokens o recetas; solo la composición responsive permanece local.
