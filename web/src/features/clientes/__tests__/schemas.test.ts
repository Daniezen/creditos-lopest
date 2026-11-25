import { describe, expect, it } from "vitest";

import { actualizarClienteSchema, crearClienteSchema, eliminarClienteSchema } from "../schemas";

const firstMessage = (result: { success: boolean; error?: { issues: Array<{ message: string }> } }) =>
  result.success ? undefined : result.error?.issues[0]?.message;

describe("crearClienteSchema", () => {
  it("trims and turns blank optional fields into null, like normalizeOptional", () => {
    expect(crearClienteSchema.parse({ cedula: " 123 ", nombre: " Ana ", telefono: "  ", empresa: " ACME " })).toEqual({
      cedula: "123",
      nombre: "Ana",
      direccion: null,
      empresa: "ACME",
      telefono: null,
      recomienda: null,
      contacto: null,
      contacto2: null,
    });
  });

  it("keeps the historical required messages", () => {
    expect(firstMessage(crearClienteSchema.safeParse({ cedula: "", nombre: "Ana" }))).toBe("La cédula es obligatoria.");
    expect(firstMessage(crearClienteSchema.safeParse({ cedula: "1", nombre: " " }))).toBe("El nombre del cliente es obligatorio.");
  });
});

describe("actualizarClienteSchema", () => {
  const base = { id: "cl1", cedula: "1", nombre: "Ana", version: "2026-03-01T15:04:05.123Z" };

  it("defaults the document state like the action did", () => {
    expect(actualizarClienteSchema.parse(base).estadoDocumentos).toBe("FALTAN_DOCUMENTOS");
    expect(actualizarClienteSchema.parse({ ...base, estadoDocumentos: "DOCUMENTOS_CARGADOS" }).estadoDocumentos).toBe(
      "DOCUMENTOS_CARGADOS",
    );
    expect(actualizarClienteSchema.safeParse({ ...base, estadoDocumentos: "OTRO" }).success).toBe(false);
  });

  it("only stores web links for the folder", () => {
    expect(actualizarClienteSchema.parse({ ...base, carpetaAdjuntosUrl: "https://drive.google.com/x" }).carpetaAdjuntosUrl).toBe(
      "https://drive.google.com/x",
    );
    expect(actualizarClienteSchema.parse({ ...base, carpetaAdjuntosUrl: "" }).carpetaAdjuntosUrl).toBeNull();
    expect(firstMessage(actualizarClienteSchema.safeParse({ ...base, carpetaAdjuntosUrl: "javascript:alert(1)" }))).toBe(
      "El enlace de la carpeta debe empezar por http:// o https://.",
    );
  });

  it("requires the version the form loaded", () => {
    const { version: _omit, ...sinVersion } = base;
    void _omit;
    expect(firstMessage(actualizarClienteSchema.safeParse(sinVersion))).toBe(
      "Falta la versión del registro. Recarga la página e inténtalo de nuevo.",
    );
  });

  it("rejects a missing id", () => {
    expect(firstMessage(eliminarClienteSchema.safeParse({ id: " " }))).toBe("Cliente inválido.");
  });
});
