import { LoginForm } from "./login-form";

export default function LoginPage() {
  /**
   * Los perfiles son visuales. La autorización real no depende de estos nombres:
   * - Google autentica el correo.
   * - src/auth.ts valida ese correo contra users + roles.
   *
   * loginHint solo sugiere a Google qué cuenta mostrar primero.
   * No concede acceso.
   */
  const profiles = [
    {
      key: "daniel",
      label: process.env.LOGIN_PROFILE_DANIEL_NAME ?? "Daniel",
      loginHint: process.env.LOGIN_PROFILE_DANIEL_EMAIL ?? "",
      imageSrc: process.env.LOGIN_PROFILE_DANIEL_IMAGE ?? "",
      initials: "D",
    },
    {
      key: "padre",
      label: process.env.LOGIN_PROFILE_PADRE_NAME ?? "Padre",
      loginHint: process.env.LOGIN_PROFILE_PADRE_EMAIL ?? "",
      imageSrc: process.env.LOGIN_PROFILE_PADRE_IMAGE ?? "",
      initials: "P",
    },
    {
      key: "madre",
      label: process.env.LOGIN_PROFILE_MADRE_NAME ?? "Madre",
      loginHint: process.env.LOGIN_PROFILE_MADRE_EMAIL ?? "",
      imageSrc: process.env.LOGIN_PROFILE_MADRE_IMAGE ?? "",
      initials: "M",
    },
  ];

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,#ede9fe_0%,#faf5ff_38%,#fff7ed_100%)] px-4 py-8">
      <LoginForm profiles={profiles} />
    </main>
  );
}
