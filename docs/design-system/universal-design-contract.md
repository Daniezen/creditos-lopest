# Contrato universal de diseño y experiencia

## Autoridad

Este documento define reglas transversales. No contiene la identidad cromática de un producto concreto. Los perfiles de producto asignan valores y excepciones justificadas.

## Principios

- La jerarquía se expresa primero mediante estructura, espacio y tipografía.
- El color refuerza significado; no sustituye estructura.
- El peso regular domina. Medium comunica navegación y acciones; semibold comunica títulos. Bold es excepcional. Black queda fuera de la interfaz operativa.
- El responsive recompone la tarea; no comprime una composición de escritorio.
- Un error recuperable no borra valores, selecciones, archivos ni progreso válido.
- Los estados no dependen exclusivamente del color.
- Toda acción irreversible comunica consecuencia y recuperación disponible.

## Tokens semánticos

Las vistas consumen nombres semánticos para canvas, superficies, texto, bordes, acciones, selección, foco y estados. No consumen primitivas cromáticas cuando existe un token semántico.

## Componentes

Los contratos mínimos son: acción, campo, superficie, fila operativa, métrica, badge, estado vacío, carga, error, overlay, drawer y modal.

## Accesibilidad

- Foco visible y consistente.
- Etiquetas accesibles para controles iconográficos.
- Contraste suficiente.
- Teclado, Escape y retorno de foco en overlays.
- Tamaños de interacción adecuados.

## Responsive

- La navegación puede cambiar de patrón según el ancho.
- Las tablas se conservan mientras exista ancho operacional suficiente.
- Las tarjetas por registro se reservan para móvil o contenidos que realmente las necesiten.
- La navegación fija siempre reserva espacio en el contenido.

## Migración por vistas

1. Inspeccionar comportamiento, código y capturas.
2. Resolver ajustes funcionales.
3. Aprobar decisiones visuales.
4. Implementar localmente.
5. Extraer reglas reutilizables.
6. Sustituir literales por tokens o recetas.
7. Validar en 1440x900, 1024x576 y móvil.
8. Comprobar propagación central.
9. Publicar y eliminar artefactos temporales.

Una vista no está migrada si conserva un literal visual que ya cuenta con equivalente semántico.
