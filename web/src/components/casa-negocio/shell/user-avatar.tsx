import { cnShellRecipes } from "@/design-system/recipes/casa-negocio";

export interface ModuleUser {
  nombre: string;
  /** Login photo, when the profile has one. */
  image: string | null;
  /** Role.name values, for presentation only. */
  roleNames: string[];
}

/**
 * Account identity at the foot of the rail and in the mobile header: the
 * login photo or the initial, ringed in violet. Not interactive (product
 * profile: no account menu); its name is read as «Nombre, Rol».
 */
export function UserAvatar({ user, size = "regular" }: { user: ModuleUser; size?: "regular" | "small" }) {
  const label = [user.nombre || "Usuario", user.roleNames[0]].filter(Boolean).join(", ");
  const initial = (user.nombre.trim()[0] ?? "?").toUpperCase();
  return (
    <span role="img" aria-label={label} className={size === "small" ? cnShellRecipes.avatarSm : cnShellRecipes.avatar}>
      {user.image ? (
        // A plain <img>: login photos are small local files and next/image would need remote config.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={user.image} alt="" className={cnShellRecipes.avatarImage} />
      ) : (
        <span aria-hidden="true">{initial}</span>
      )}
    </span>
  );
}
