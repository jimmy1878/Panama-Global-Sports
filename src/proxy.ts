import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  // Si la URL de retorno no está permitida en Supabase, el enlace del correo
  // vuelve a la raíz con ?code=. Lo reenviamos al callback para abrir la sesión.
  const { pathname, searchParams } = request.nextUrl;
  if (pathname === "/" && searchParams.has("code")) {
    const callback = request.nextUrl.clone();
    callback.pathname = "/auth/callback";
    return NextResponse.redirect(callback);
  }
  return updateSession(request);
}

export const config = {
  matcher: [
    // Todo menos archivos estáticos, iconos, manifiesto y service worker.
    "/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|icons/|manifest.webmanifest|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
