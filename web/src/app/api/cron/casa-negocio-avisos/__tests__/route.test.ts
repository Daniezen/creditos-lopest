/**
 * HTTP contract of the avisos cron: secret check (fails closed), the JSON n8n
 * reads, and that a failure answers 500 without leaking the error.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const servicio = vi.hoisted(() => ({ avisosNuevosDelDia: vi.fn() }));
const log = vi.hoisted(() => ({ logEvent: vi.fn() }));

vi.mock("@/lib/prisma", () => ({ prisma: { marker: "prisma" } }));
vi.mock("@/server/casa-negocio/avisos-envio", () => servicio);
vi.mock("@/server/observability/log", () => log);

import { POST } from "../route";

const SECRETO = "secreto-de-prueba-123";

function peticion(authorization?: string) {
  return new Request("https://lopest.test/api/cron/casa-negocio-avisos", {
    method: "POST",
    headers: authorization ? { authorization } : {},
  });
}

describe("POST /api/cron/casa-negocio-avisos", () => {
  beforeEach(() => {
    vi.stubEnv("CASA_NEGOCIO_CRON_SECRET", SECRETO);
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://lopest.test/");
    servicio.avisosNuevosDelDia.mockReset();
    log.logEvent.mockReset();
  });
  afterEach(() => vi.unstubAllEnvs());

  it.each([
    ["sin cabecera", undefined],
    ["secreto equivocado", "Bearer otro"],
    ["esquema distinto", `Token ${SECRETO}`],
  ])("responde 401 %s y no evalúa nada", async (_caso, cabecera) => {
    const res = await POST(peticion(cabecera));
    expect(res.status).toBe(401);
    expect(servicio.avisosNuevosDelDia).not.toHaveBeenCalled();
  });

  it("queda cerrado si la variable no está configurada", async () => {
    vi.stubEnv("CASA_NEGOCIO_CRON_SECRET", "");
    const res = await POST(peticion("Bearer "));
    expect(res.status).toBe(401);
  });

  it("devuelve los nuevos y el mensaje listo para Telegram", async () => {
    servicio.avisosNuevosDelDia.mockResolvedValue({
      estado: "ok",
      hoy: "2026-12-18",
      nuevos: [{ clave: "k", codigo: "FIJO_VENCIDO_SIN_PAGAR", numero: 1, nivel: "PROBLEMA", texto: "Arriendo sin pagar", mes: "2026-12", elemento: "fijo:a", refs: ["a"] }],
      vigentes: 2,
      resueltos: 1,
      mensaje: "Casa y Negocio · 18 dic\n\n🔴 Arriendo sin pagar",
    });

    const res = await POST(peticion(`Bearer ${SECRETO}`));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      estado: "ok",
      hoy: "2026-12-18",
      nuevos: [{ codigo: "FIJO_VENCIDO_SIN_PAGAR", numero: 1, nivel: "PROBLEMA", texto: "Arriendo sin pagar" }],
      mensaje: "Casa y Negocio · 18 dic\n\n🔴 Arriendo sin pagar",
    });
    // The link points at the module, without a doubled slash.
    expect(servicio.avisosNuevosDelDia).toHaveBeenCalledWith({ marker: "prisma" }, { urlModulo: "https://lopest.test/casa-negocio" });
  });

  it("antes del arranque responde sin-modulo y sin mensaje", async () => {
    servicio.avisosNuevosDelDia.mockResolvedValue({ estado: "sin-modulo", hoy: "2026-11-30", nuevos: [], mensaje: null });
    const body = await (await POST(peticion(`Bearer ${SECRETO}`))).json();
    expect(body).toMatchObject({ ok: true, estado: "sin-modulo", nuevos: [], mensaje: null });
  });

  it("un fallo responde 500 genérico y queda en el log", async () => {
    servicio.avisosNuevosDelDia.mockRejectedValue(new Error("connection refused at 10.0.0.5"));
    const res = await POST(peticion(`Bearer ${SECRETO}`));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("10.0.0.5");
    expect(log.logEvent).toHaveBeenCalledWith("error", "casa_negocio.avisos_fallidos", {}, expect.any(Error));
  });
});
