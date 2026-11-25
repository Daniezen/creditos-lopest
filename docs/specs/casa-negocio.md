# Casa y Negocio

```
ESTADO: aprobado para implementar (diseño ratificado en el lienzo el 25-nov-2026)
CORTE: módulo nuevo; arranque de uso real el 01-dic-2026
EVIDENCIA: lienzo en docs/design-system/lienzo-casa-negocio/ (copia de los artboards .dc.html)
```

Módulo familiar que junta el dinero del negocio de préstamos y el de la casa. Nace del Excel
«Cuentas Casa y Negocio», del que se toma la **lógica de negocio**, no la forma: todo lo que Lopest
ya sabe (desembolsos, cuotas cobradas con capital e interés, cartera, mora) entra solo y no se digita.

## 1. Alcance de esta unidad

- Solo el módulo `/casa-negocio` y sus pestañas. **No se tocan visualmente** Créditos, Clientes, Simulador,
  Transferencias ni Reportes: su rediseño se planea vista por vista después. El **backend** de esos módulos sí
  se ajusta donde la lógica lo pida (p. ej. `cuentaId` opcional en pagos y desembolsos, castigo de préstamos).
- El riel lateral nuevo (oscuro, replegado, `Sidebar.dc.html`) y la ausencia de topbar aplican
  **solo a este módulo** por ahora.
- Lo que en el lienzo toca Créditos (`CreditosDueno`, `PrestamoPerdido`, `RegistrarPago`) queda
  como referencia futura, fuera de alcance.

## 2. Usuarios y permisos

Permisos **por capacidad**, asignables por persona, sin código:

| Capacidad | Qué permite |
|---|---|
| `casa_negocio.ver` | Ver el módulo |
| `casa_negocio.anotar` | Registrar movimientos de casa y negocio, asignar cuenta a cobros, pasar al ahorro |
| `casa_negocio.contar` | Guardar arqueos |
| `casa_negocio.configurar` | Cuentas, gastos, topes, metas, avisos y permisos del módulo |

Inicial: padre y Daniel con las cuatro; madre solo `ver`. Toda autorización se valida en servidor.

## 3. Conceptos y reglas

- **Cuentas**: dónde vive la plata. Pertenecen a `NEGOCIO` o `CASA`; tipo efectivo, banco,
  billetera o ahorro. Con movimientos no se borran: se archivan. Saldo inicial con fecha (el 1-dic).
- **Movimientos manuales del negocio**: gasto del negocio, aporte de capital, retiro a la casa
  (traslado de una cuenta del negocio a una de la casa), traslado entre cuentas.
- **Movimientos automáticos del negocio**: cuotas pagadas y abonos (de `EventoFinanciero`) y desembolsos
  (de `Credito`). Se leen de las tablas existentes; no se duplican.
  Cada uno necesita una cuenta para el arqueo por cuenta: como Créditos no se toca en esta unidad,
  los que llegan **sin cuenta** aparecen en Negocio con un selector «¿Dónde entró?» / «¿De dónde salió?»
  para asignarla ahí. La asignación se guarda aparte (tabla de asignación), sin modificar el evento financiero.
  Lo anterior al 1-dic queda «sin cuenta» y fuera del arqueo por cuenta.
- **Casa**: gastos fijos (monto, periodicidad mensual o anual con mes, día de pago) y variables (tope mensual,
  «sobres»). La clase fijo/variable se cambia desde Configuración sin perder movimientos. Ingresos extra de la casa.
  El ingreso principal de la casa es el retiro real; la asignación mensual es solo una **meta**.
- **Ahorro**: cuenta de tipo ahorro de la casa (Nu). Meta opcional. El cierre propone pasar lo sobrante.
- **Arqueo**: por cuenta, «Lopest dice» contra «contaste»; queda registrado con fecha y diferencia.
- **Préstamo perdido**: fuera de alcance de UI de Créditos; el modelo debe admitirlo (estado y monto castigado
  con fecha, motivo, actor, reversible) para que el Tablero reste pérdidas cuando exista.
- **Cálculos del mes** (siempre recalculados, nunca congelados):
  - Negocio: intereses cobrados − gastos del negocio − perdidos = ganancia; ganancia − retiros a la casa = reinvertido.
  - Casa: entró − fijos − variables = hoy; hoy − fijos sin pagar = al cierre.
  - Ganancia = intereses **cobrados** en el mes (caja), no causados.
  - Dinero de la familia = suma de cuentas; «En la calle» (cartera) se muestra aparte, no se suma.

## 4. Pestañas (orden y agrupación)

Para mirar: **Tablero · Resumen** │ Para anotar: **Casa · Negocio · Ahorro · Arqueo** │ **Configuración**.

Encabezado común (`ModuloTabs.dc.html`): título del mes con navegación, botón **Anotar** que abre un panel rápido
(seis tipos de movimiento), y la **línea del mes**: hechos llenos, por venir huecos, sin pagar con aro rojo,
cierre al final; cada marca abre una ventanita con detalle y acción. Nada se presenta como contrarreloj.

| Pestaña | Artboard | Contenido |
|---|---|---|
| Tablero | `Main.dc.html` | Por dónde pasó la plata (3 pasos) + calendario compacto con ventana de detalle; cuentas del mes como ecuaciones con aviso; dónde está la plata; en la calle; sobres |
| Resumen | `Resumen.dc.html` | Ganancia y retiros (meses en que bajó el capital); cobros: lo que entró y lo que viene (historial + proyección + lo que tocaba cobrar); cómo está pagando la cartera (tramos); mes a mes |
| Casa | `Casa.dc.html` | Franja y ecuación de casa; anotar; libro por día; fijos y sobres del mes |
| Negocio | `Negocio.dc.html` | Franja y ecuación del negocio; cuentas como filtros; anotar; libro con saldo corrido; marca «L» automático / lápiz manual |
| Ahorro | `Ahorro.dc.html` | Anillo de meta; cierre del mes con «Pasar al ahorro»; depósitos por mes |
| Arqueo | `Arqueo.dc.html` | Tarjetas por cuenta agrupadas Negocio / Casa; resultado en vivo; historial |
| Configuración | `Configuracion.dc.html` | Cuentas; gastos fijos/variables; meta para la casa; avisos; quién puede qué |

Celular: `TableroMovil.dc.html`.

## 5. Avisos

Junto a lo que afectan, solo cuando aplican. Dos niveles: atención (ámbar) y problema (rojo). Cada regla se activa
y su umbral se ajusta en Configuración:

1. Un gasto fijo pasa su fecha sin pagar. (problema)
2. Un sobre llega al N % de su tope (90). (atención)
3. Si se gasta lo que queda en los sobres, el mes cerraría en negativo. (atención)
4. Una cuenta lleva más de N días sin contar (7). (atención)
5. Un arqueo no cuadra. (problema)
6. En un mes se lleva a la casa más de lo que ganó el negocio. (problema)
7. Un movimiento dejaría una cuenta sin saldo. (problema)
8. Un crédito lleva más de N días sin pagos (90). (atención)
9. Un gasto anual vence en menos de N días (30). (atención)
10. Pasó el cierre y lo sobrante no está en el ahorro. (atención)

## 6. Lenguaje visual

Tinta ciruela `#24123f` para estructura y lo hecho; violeta `#7c3aed` solo para la acción de ahora;
papel cálido `#fbf8f4` bajo pestañas de carpeta; lienzo `#f4f2f7`; Geist 300 para títulos y cifras grandes.
Identidad: Negocio ciruela, Casa verde azulado `#0f766e`, Ahorro oro `#b8860b`. Estados: verde, ámbar, rojo
solo con condición real. Sin textos explicativos: lo explican la forma y la posición. Gráficas con el componente
`Chart` (ECharts) del design-system.

## Verificación contra código

| Punto | Estado |
|---|---|
| Todo lo anterior | Sin implementar al 25-nov-2026 |
