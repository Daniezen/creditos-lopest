import { prisma } from "../../src/lib/prisma";

type Row = {
  staff_id: string;
  staff_nombre: string;
  seniors: string | number | bigint;
  gerentes: string | number | bigint;
  socios: string | number | bigint;
  clientes: string | number | bigint;
};

async function main() {
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT
      staff.id::text AS staff_id,
      staff.nombre_completo AS staff_nombre,
      COUNT(DISTINCT equipo.senior_ref_id) AS seniors,
      COUNT(DISTINCT equipo.gerente_ref_id) AS gerentes,
      COUNT(DISTINCT equipo.socio_ref_id) AS socios,
      COUNT(DISTINCT equipo.empresa_ref_id) AS clientes
    FROM core.ref_cliente_equipo_staff equipo_staff
    JOIN core.ref_cliente_equipo equipo
      ON equipo.id = equipo_staff.cliente_equipo_id
    JOIN core.ref_empleado staff
      ON staff.id = equipo_staff.staff_ref_id
    WHERE equipo.activo = TRUE
      AND equipo_staff.activo = TRUE
    GROUP BY staff.id, staff.nombre_completo
    ORDER BY socios DESC, gerentes DESC, seniors DESC, clientes DESC, staff.nombre_completo ASC
  `;

  const summary = {
    totalStaff: rows.length,
    staffConMultiplesSeniors: rows.filter((row) => Number(row.seniors) > 1).length,
    staffConMultiplesGerentes: rows.filter((row) => Number(row.gerentes) > 1).length,
    staffConMultiplesSocios: rows.filter((row) => Number(row.socios) > 1).length,
  };

  console.log("Resumen:");
  console.log(JSON.stringify(summary, null, 2));

  console.log("\nDetalle relevante:");
  for (const row of rows.filter(
    (currentRow) =>
      Number(currentRow.seniors) > 1 ||
      Number(currentRow.gerentes) > 1 ||
      Number(currentRow.socios) > 1,
  )) {
    console.log(
      JSON.stringify(
        {
          staff: row.staff_nombre,
          clientes: Number(row.clientes),
          seniors: Number(row.seniors),
          gerentes: Number(row.gerentes),
          socios: Number(row.socios),
        },
        null,
        2,
      ),
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
