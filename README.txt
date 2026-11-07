GERTRUDIS V9 - RECONOCIMIENTO DE VOZ DE UNA SOLA ORDEN

Sube los cinco archivos incluidos a la raíz del repositorio GitHub, reemplazando los anteriores:
index.html, app.js, sw.js, manifest.webmanifest y README.txt.

DATOS:
- Se eliminan todas las tareas locales existentes al iniciar esta versión, tal como autorizó el usuario.
- Se conserva intacta la memoria de largo plazo almacenada en gertrudis.v2 (campo rules).
- No borres manualmente los datos del sitio ni el almacenamiento de Chrome.

VOZ:
- Cambia el reconocimiento continuo por una captura de una sola orden.
- interimResults=false: solo procesa el resultado final y una sola vez.
- Sin concatenación de fragmentos ni reinicios automáticos.
- Reconoce sinónimos para crear, borrar, completar y consultar tareas.
- El servicio de reconocimiento depende de Chrome/Android, permisos y conexión.
- Para confirmar un borrado, pulsa el micrófono y di sí o no; también están los botones de respaldo.

FUNCIONES:
- Hoja plana y vista de tarjetas.
- Memoria explícita de largo plazo.
- Respuestas personalizadas acordadas.
- No sincroniza dispositivos ni envía alertas reales a contactos.
