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

**Project Settings → Authentication → SMTP Settings** → activar y llenar con lo que
da el proveedor:

- Host y puerto (465 con SSL, o 587 con STARTTLS)
- Usuario y contraseña, tal como los muestra el panel del proveedor (en Resend están
  en la sección **SMTP**, y la contraseña es una API key que se crea ahí mismo)
- **Sender email**: `avisos@panamaglobalsports.com`
- **Sender name**: `Panama Global Sports`

Revisar también **Authentication → Rate Limits**: Supabase limita los correos por
hora y el valor por defecto es bajo. Con seis equipos entrando el mismo sábado hay
que subirlo.

### 3. Las plantillas

**Authentication → Emails**. Para cada una, pegar el HTML de esta carpeta y poner el
asunto:

| Plantilla | Asunto |
|---|---|
| Magic Link | `Tu código para entrar: {{ .Token }}` |
| Confirm signup | `Bienvenido · tu código es {{ .Token }}` |

El código en el asunto se ve en la notificación del celular sin abrir el correo, que
es la mitad de la comodidad. Si el panel muestra el texto literal `{{ .Token }}` en
lugar del número, dejar un asunto fijo (`Tu código para entrar`).

Variables que usan estas plantillas: `{{ .Token }}` (el código) y
`{{ .ConfirmationURL }}` (el enlace). Las plantillas dicen que el código **vence en
una hora**; si se cambia la expiración del OTP en Supabase, hay que cambiar ese texto
en los dos archivos.

### 4. Las URL (aquí se rompe si se olvida)

**Authentication → URL Configuration**:

- **Site URL**: `https://panamaglobalsports.com`
- **Redirect URLs**: agregar `https://panamaglobalsports.com/auth/callback`, y dejar
  también `http://localhost:3000/auth/callback` para desarrollo.

Si falta, el enlace del correo vuelve a `/auth/callback` y Supabase lo rechaza. El
código de 6 dígitos sigue funcionando, así que el síntoma es confuso: a unos les
entra y a otros no.

### 5. El dominio en Vercel

**Vercel → el proyecto → Settings → Domains** → agregar `panamaglobalsports.com`.
Vercel devuelve un registro A (o un CNAME para `www`) que también va en GoDaddy. No
hay que tocar código: `getOrigin()` lee el host de la petición.

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
