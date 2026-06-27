import NextAuth from "next-auth";

import { authOptions } from "@/auth";

/**
 * Route handler de NextAuth v4 para App Router.
 *
 * NextAuth v4 no devuelve { handlers } desde NextAuth().
 * Por eso creamos un handler y lo exportamos como GET/POST.
 */
const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
