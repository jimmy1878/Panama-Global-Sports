# Correos de ingreso (SMTP propio)

Las dos plantillas de esta carpeta son el correo que recibe un papá cuando entra a la
app. No se despliegan con el código: se **copian y pegan** en el panel de Supabase.
Viven aquí para que no se pierdan y para que un cambio quede en el historial de git.

| Archivo | Plantilla de Supabase | Cuándo se envía |
|---|---|---|
| `magic-link.html` | *Magic Link* | La cuenta ya existe |
| `confirm-signup.html` | *Confirm signup* | Primera vez: `shouldCreateUser: true` crea la cuenta |

Para el papá no hay diferencia entre las dos: pidió un código y recibe un código.
Hay dos archivos porque Supabase usa dos plantillas distintas, no porque la
experiencia deba cambiar.

## Por qué el código manda y el enlace es secundario

El login es `signInWithOtp` + `verifyOtp` (ver `src/app/ingresar/actions.ts`). El
código de 6 dígitos funciona siempre, también dentro de la PWA instalada. El enlace
usa PKCE: **solo sirve en el mismo navegador que pidió el código**, y en una app
instalada se abre en el navegador y no en la app. Por eso el código va grande y
arriba, y el enlace queda como una línea pequeña al final para quien está en la
computadora.

## Lo que hay que hacer, en orden

### 1. Proveedor de correo y DNS

**Los registros DNS todavía no existen y no se pueden escribir de antemano.** Los
genera el proveedor cuando le dices qué dominio vas a usar: la clave DKIM es única
para este dominio y para esta cuenta. Hasta ese momento, en GoDaddy no hay nada que
ver —hoy el dominio solo tiene los nameservers de GoDaddy (`ns69`/`ns70.domaincontrol.com`)
y la página de parqueo—.

Proveedor elegido: **Resend**. Postmark, Brevo, SendGrid o Amazon SES sirven igual;
Resend tiene el camino más corto con GoDaddy.

1. Crear la cuenta en resend.com y abrir **Domains → Add Domain**.
2. Escribir `panamaglobalsports.com` (el dominio raíz, sin `www`). Resend sugiere un
   subdominio tipo `correo.panamaglobalsports.com`, lo cual protege la reputación del
   dominio raíz si algún día se manda publicidad. Aquí no se manda publicidad —solo
   códigos de ingreso y avisos de la liga— y el remitente se lee mejor como
   `avisos@panamaglobalsports.com` que como `avisos@correo.panamaglobalsports.com`.
   Por eso: el raíz.
3. Elegir la región más cercana (`us-east-1`).
4. **El camino corto**: en la página del dominio, botón **Auto Configure**. Resend se
   conecta a GoDaddy (Domain Connect), pide autorización y escribe los registros solo.
   Es la opción recomendada: no hay nada que copiar a mano y se verifica en minutos.
5. **El camino manual**, si Auto Configure falla o prefieres ver qué se escribe: abrir
   la pestaña **Records** del dominio en Resend y copiar los tres registros a
   **GoDaddy → Mis productos → Dominios → DNS → Agregar registro**.

| Para qué | Tipo | Nombre / Host | Valor | Prioridad |
|---|---|---|---|---|
| SPF (ruta de retorno) | MX | `send` | el que da Resend (`feedback-smtp.us-east-1.amazonses.com`) | 10 |
| SPF | TXT | `send` | el que da Resend (`v=spf1 include:amazonses.com ~all`) | — |
| DKIM (la firma) | TXT | `resend._domainkey` | la clave larga que da Resend (`p=…`) | — |

**La trampa de GoDaddy**: en el campo *Nombre* va **solo la parte de la izquierda**,
sin el dominio. Se escribe `send`, no `send.panamaglobalsports.com`; GoDaddy le pega
el dominio solo. Si pegas el nombre completo queda `send.panamaglobalsports.com.panamaglobalsports.com`
y la verificación nunca pasa. Los valores sí se pegan tal cual, completos.

Como el SPF de Resend va en el subdominio `send` y no en la raíz, **no choca** con un
SPF que el dominio ya tenga para otro servicio.

6. Volver a Resend y tocar **Verify DNS Records**. Suele verificar en menos de 15
   minutos; el máximo documentado son 72 horas. Si pasa ese plazo, **Restart verification**.
7. Después de que verifique, conviene agregar DMARC: TXT en `_dmarc` con valor
   `v=DMARC1; p=none; rua=mailto:dmarc@panamaglobalsports.com;`. No hace falta para
   enviar y se empieza siempre en `p=none`, que solo observa y no rechaza nada.

Sin DKIM y SPF el correo sale, pero cae en spam. Son lo que le dice a Gmail que
tenemos permiso de enviar en nombre del dominio.

> **Ojo con el límite del plan gratuito de Resend: 3.000 correos al mes, pero solo
> 100 por día.** Para el uso diario sobra. El riesgo es el día que se abra la app a
> todas las familias a la vez: si entran más de cien el mismo día, las últimas no
> reciben el código. Se resuelve abriendo por categorías en días distintos, o pagando
> el primer mes y volviendo al plan gratuito después.

### 2. SMTP en Supabase

En el panel de Supabase, **Authentication → SMTP** (en la barra de la izquierda, no
en Project Settings). El enlace directo es
`https://supabase.com/dashboard/project/_/auth/smtp` — ese `_` lo resuelve Supabase
al proyecto que tengas abierto.

Activar **Enable Custom SMTP** y llenar con lo que da el proveedor:

| Campo | Valor (Resend) |
|---|---|
| Host | `smtp.resend.com` |
| Port | `465` (SSL) o `587` (STARTTLS) |
| Username | `resend` — literal, esa palabra |
| Password | una **API key**, que se crea en Resend → **API Keys** |
| Sender email | `avisos@panamaglobalsports.com` |
| Sender name | `Panama Global Sports` |

#### Crear la API key (la contraseña)

No es la contraseña de la cuenta de Resend. Es una clave aparte, que se crea así:

1. En Resend, menú de la izquierda → **API Keys** (`https://resend.com/api-keys`).
2. Botón **Create API Key**.
3. **Name**: `supabase-auth`. El nombre es solo para vos; sirve para saber de dónde
   viene cada envío cuando haya más de una clave.
4. **Permission**: elegir **Sending access**, no *Full access*. Con *Sending access*
   la clave solo puede mandar correos. Si algún día se filtra, no puede borrar el
   dominio, ni leer los registros, ni crear otras claves.
5. **Domain**: restringirla a `panamaglobalsports.com`. Así esa clave no puede mandar
   correo en nombre de ningún otro dominio.
6. **Add**. La clave aparece una sola vez, empieza con `re_`. **Copiarla en ese
   momento**: Resend no la vuelve a mostrar nunca, ni a vos. Si se pierde, se borra y
   se crea otra.
7. Pegarla en el campo **Password** de Supabase.

La clave no va en el repositorio ni en `.env.local`: la app no la usa, la usa
Supabase. Su único lugar es el campo Password de esa pantalla.

Y en la misma visita hay que tocar otras dos cosas, las dos comprobadas en el
proyecto el 2026-11-16:

- **Authentication → Rate Limits** (`…/auth/rate-limits`), campo
  `rate_limit_email_sent`: es **cuántos correos de ingreso puede mandar el proyecto
  entero en una hora**, sumando a todas las familias. No es por persona.

  Hoy está en **2**. Con el correo por defecto de Supabase ese es el tope que ellos
  imponen: entran dos papás y el tercero ve un error. Al activar SMTP propio, Supabase
  lo sube solo a **30 por hora**, que sigue siendo poco para un sábado. Hay que
  subirlo a mano. **100 por hora** es un buen punto de partida: cubre un sábado normal
  y de todos modos el plan gratuito de Resend no deja pasar de 100 en todo el día, así
  que poner más no compra nada.

  No confundirlo con `smtp_max_frequency`, que está en **60 segundos** y es otra cosa:
  el tiempo mínimo entre dos correos **a la misma dirección**. Ese está bien así
  —evita que alguien pida diez códigos seguidos— y no hay que tocarlo.
- **Authentication → Sign In / Providers → Email** (`…/auth/providers`), campo **Email
  OTP Length**: viene en **8**. Hay que ponerlo en **6**, que es lo que dicen la pantalla de ingreso
  (`src/app/ingresar/actions.ts`) y las dos plantillas de esta carpeta. Si se deja en
  8, el papá lee "seis dígitos" y recibe ocho; entrar funciona igual —la validación
  acepta de 6 a 8— pero parece un error y la gente abandona. La expiración
  (`mailer_otp_exp`) ya está en 3600 s = una hora, que coincide con el texto de los
  correos: esa no se toca.

Esto no se puede hacer con el `SUPABASE_ACCESS_TOKEN` de `.env.local`: ese token es
de solo lectura (se creó para `npm run db:types`) y la API responde 403. Se cambia a
mano en el panel.

### 3. Las plantillas

**Authentication → Emails** (`…/auth/templates`). Para cada una, pegar el HTML de
esta carpeta y poner el asunto:

| Archivo de esta carpeta | Plantilla en el panel | Asunto |
|---|---|---|
| `magic-link.html` | **Magic Link** (el panel la llama *Magic Link or OTP*) | `Tu código para entrar: {{ .Token }}` |
| `confirm-signup.html` | **Confirm signup** | `Bienvenido · tu código es {{ .Token }}` |

El código en el asunto se ve en la notificación del celular sin abrir el correo, que
es la mitad de la comodidad. Si el panel muestra el texto literal `{{ .Token }}` en
lugar del número, dejar un asunto fijo (`Tu código para entrar`).

Variables que usan estas plantillas: `{{ .Token }}` (el código) y
`{{ .ConfirmationURL }}` (el enlace). Las plantillas dicen que el código **vence en
una hora**; si se cambia la expiración del OTP en Supabase, hay que cambiar ese texto
en los dos archivos.

### 4. Las URL (aquí se rompe si se olvida)

**Authentication → URL Configuration** (`…/auth/url-configuration`):

- **Site URL**: `https://www.panamaglobalsports.com` — **con `www`**, porque ese es
  el dominio de producción en Vercel y el raíz redirige hacia él (308). Si acá se pone
  el raíz, Supabase arma el enlace del correo apuntando a una dirección que redirige,
  y el flujo PKCE se rompe en el salto.
- **Redirect URLs**: agregar las dos, `https://www.panamaglobalsports.com/auth/callback`
  y `https://panamaglobalsports.com/auth/callback`, más
  `http://localhost:3000/auth/callback` para desarrollo. Poner las dos no cuesta nada
  y evita quedar colgado si algún día se invierte cuál es el de producción.

Si falta, el enlace del correo vuelve a `/auth/callback` y Supabase lo rechaza. El
código de 6 dígitos sigue funcionando, así que el síntoma es confuso: a unos les
entra y a otros no.

### 5. El dominio en Vercel

**Vercel → el proyecto → Settings → Domains** → agregar `panamaglobalsports.com`.
Vercel devuelve un registro A para la raíz (y un CNAME para `www`) que van en GoDaddy.
No hay que tocar código: `getOrigin()` lee el host de la petición.

Los valores salen de **View DNS configuration** en cada fila de esa pantalla de
Vercel; el CNAME es único por proyecto, no se puede adivinar. Los de este proyecto,
leídos el 2026-11-16:

| Tipo | Nombre | Valor |
|---|---|---|
| A | `@` | `216.198.79.1` |
| CNAME | `www` | `f29411d9a408ca07.vercel-dns-017.com` |

Vercel muestra el CNAME con un punto al final. En GoDaddy se escribe **sin** ese
punto final.

Por defecto Vercel deja `www` como dominio de producción y el raíz redirigiendo hacia
él con un 308. Se puede invertir, pero no hace falta: las dos direcciones funcionan y
la única consecuencia es que el Site URL de Supabase (sección 4) lleva `www`.

**El registro de la raíz se REEMPLAZA, no se agrega.** Hoy la raíz tiene dos
registros A apuntando a la página de parqueo de GoDaddy (`3.33.130.190` y
`15.197.148.33`), y `www` es un CNAME que apunta a la raíz. Si se deja lo viejo y se
agrega el de Vercel, el dominio queda con tres direcciones y el navegador elige una
al azar: a unos les abre la app y a otros la página de parqueo de GoDaddy. Es el peor
tipo de falla, porque en tu celular funciona y jurás que está todo bien.

Entonces: **borrar los dos registros A de la raíz** (o editar uno y borrar el otro) y
dejar solo el de Vercel. Para `www`, apuntar el CNAME a donde diga Vercel.

**Si GoDaddy no deja borrarlos**, y muestra "Hemos bloqueado este registro para
proteger los servicios conectados a tu dominio": es el **reenvío de dominio**, que se
apropia del registro A. La propia ayuda de GoDaddy lo dice —"Eliminar el reenvío de
dominio también desbloqueará tu registro DNS A para que puedas editar ese registro"—.
Se quita así:

1. Entrar a la cartera de dominios y abrir el dominio (**Configuración de dominio**).
2. **DNS** → **Reenvío**.
3. **Eliminar** al lado del dominio, y confirmar.

Si el dominio tiene **Domain Protection**, GoDaddy pide verificación de identidad:
un código por SMS, por la app de autenticación, o por correo. Con el reenvío fuera,
los registros A quedan editables.

**Lo que NO se toca, pase lo que pase**: `send` y `rsend` (los dos CNAME que creó
Resend), `resend._domainkey` (TXT) y `_dmarc` (TXT). Esos son el correo. Borrarlos
por limpiar deja la app sin ingreso. El CNAME `_domainconnect` es de GoDaddy y
tampoco estorba: es por donde Resend escribió los registros solo.

### 5b. Comprobar el DNS sin entrar a ningún panel

```
npm run check:dns
```

Mira de una sola vez las dos cosas que viven en este dominio —la web en Vercel y el
correo en Resend— y dice cuál está mal. Pregunta a un resolutor público, no a la
caché de Windows, así que muestra lo que ve el resto del mundo. Correrlo después de
cada cambio en GoDaddy: es más rápido y más confiable que mirar el panel, que tarda
en refrescar.

Si `check-dns.mjs` dice que falta un registro de correo, **no se hizo nada bien**:
alguien borró de más mientras acomodaba lo de Vercel.

### 6. Probar

Con un correo que **no** sea miembro del proyecto de Supabase —el de un familiar, o
uno nuevo—. Es la única prueba que vale: con el correo por defecto de Supabase tu
propia dirección funciona y la de un papá no, y eso es justo lo que esto arregla.

Revisar: que llegue a la bandeja de entrada y no a spam, que el código se vea grande
en el celular, y que entrar escribiendo el código funcione con la app instalada.

## Lo que no hay que hacer

- No poner las credenciales SMTP en `.env.local` ni en Vercel: no las usa la app, las
  usa Supabase. La app nunca envía un correo de ingreso por su cuenta.
- No mandar nunca datos de un niño en estos correos. Solo el código.
