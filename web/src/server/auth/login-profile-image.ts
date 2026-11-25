/**
 * Login photo of a known family profile, resolved by email from the
 * environment (with local defaults in `public/login/`). Shared by every
 * authenticated shell so the account identity looks the same everywhere.
 */
export function resolveLoginProfileImage(
  email: string,
  fallback: string | null,
): string | null {
  const normalizedEmail = email.trim().toLowerCase();
  const profiles = [
    {
      email: process.env.LOGIN_PROFILE_DANIEL_EMAIL,
      image: process.env.LOGIN_PROFILE_DANIEL_IMAGE || "/login/daniel.jpg",
    },
    {
      email: process.env.LOGIN_PROFILE_PADRE_EMAIL,
      image: process.env.LOGIN_PROFILE_PADRE_IMAGE || "/login/padre.jpg",
    },
    {
      email: process.env.LOGIN_PROFILE_MADRE_EMAIL,
      image: process.env.LOGIN_PROFILE_MADRE_IMAGE || "/login/madre.jpg",
    },
  ];

  const profile = profiles.find(
    (item) => item.email?.trim().toLowerCase() === normalizedEmail,
  );

  return profile?.image ?? fallback;
}
