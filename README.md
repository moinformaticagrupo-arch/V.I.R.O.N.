# V.I.R.O.N. — tutor técnico por voz

V.I.R.O.N. (se pronuncia “Viron”) es una PWA adaptable a celulares y computadoras para conversar con un tutor de matemáticas avanzadas, inglés, química, física y materias técnicas. La interfaz permite configurar el idioma y voz del dispositivo. Los perfiles docentes se guardan localmente después de que cada profesor autorice guardarlos.

Los nombres internos de variables y algunos archivos conservan el prefijo JARVIS_ por compatibilidad con la configuración existente.

## Conectar Gemini gratis en Render

La aplicación ya está preparada para enviar las preguntas desde Render al servidor de este mismo proyecto. La clave permanece en el servidor y no se agrega a `app.js` ni al navegador.

1. Cree una clave de Gemini API en [Google AI Studio](https://aistudio.google.com/).
2. En Render, abra el servicio web de V.I.R.O.N. y vaya a **Environment**.
3. Agregue estas variables:

```text
JARVIS_PROVIDER=gemini
GEMINI_API_KEY=PEGUE_AQUI_LA_CLAVE
JARVIS_MODEL=gemini-2.5-flash-lite
```

4. Guarde los cambios y espere a que Render vuelva a desplegar el servicio.
5. Abra `https://NOMBRE.onrender.com/api/health`. Debe mostrar `"aiConfigured":true`. Después abra la URL principal y pruebe una pregunta.

No publique la clave en GitHub, en el navegador ni en mensajes. Si la clave ya se expuso, revoquela en AI Studio y cree otra.

El nivel gratuito de Gemini tiene límites de uso que dependen del modelo y la cuenta; pueden cambiar. Render también duerme sus servicios gratuitos tras 15 minutos sin actividad, por lo que la primera respuesta después de una pausa puede tardar cerca de un minuto. Consulte los límites actuales en [precios y cuotas de Gemini API](https://ai.google.dev/gemini-api/docs/pricing) y [límites gratuitos de Render](https://render.com/docs/free).

## Probar Gemini en Windows

En PowerShell, desde esta carpeta:

```powershell
$env:JARVIS_PROVIDER="gemini"
$env:GEMINI_API_KEY="su_clave"
$env:JARVIS_MODEL="gemini-2.5-flash-lite"
node server.mjs
```

Abra `http://localhost:3000`. El navegador usa `/api/assistant` del mismo servidor. La clave existe solo en esa sesión de PowerShell.

## Opción local con Ollama

Ollama no cobra por consulta ni tiene cuota de proveedor cuando ejecuta el modelo localmente, pero requiere que la máquina que lo aloja permanezca encendida. En Render gratuito no es una alternativa práctica: el servicio tiene recursos limitados y se suspende cuando queda inactivo.

```powershell
ollama pull qwen3:4b
$env:JARVIS_PROVIDER="ollama"
node server.mjs
```

Para acceder desde otros dispositivos sin publicar el servidor directamente, use una red privada como Tailscale.

## Privacidad de los perfiles

Los perfiles de profesor se guardan en el almacenamiento local del navegador. El profesor debe marcar la autorización antes de guardar. La fecha de nacimiento es opcional; el perfil solo la agrega al contexto cuando se consulta por ella. El nombre, la materia y las preferencias se envían al proveedor configurado para personalizar las respuestas. Se pueden editar o borrar en **Memoria**.

## Voz e idiomas

Se puede escribir un idioma o un código BCP-47 (por ejemplo `en-US`, `fr-FR` o `zh-CN`). La comprensión de texto depende del modelo de IA. El reconocimiento de voz usa el idioma seleccionado y depende de lo que admita el navegador; todavía no detecta automáticamente cualquier idioma hablado.

## Configuración opcional de proveedores

El servidor también admite OpenAI API (`JARVIS_PROVIDER=openai`, `OPENAI_API_KEY`) y Ollama. Una suscripción de ChatGPT no incluye crédito de OpenAI API.






