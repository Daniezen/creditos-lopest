import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,#ede9fe_0%,#faf5ff_38%,#fff7ed_100%)] px-4 py-8">
      <LoginForm />
    </main>
  );
}
