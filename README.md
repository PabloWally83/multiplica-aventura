# Multiplica Aventura Plus 🦊

Aplicación web educativa para aprender y practicar **las tablas del 1 al 10** jugando.

## Qué incluye

- 10 niveles progresivos, uno por tabla.
- 10 preguntas por nivel y aprobación con 8 respuestas correctas.
- Plan visual de tres días:
  - Día 1: tablas 1 a 4.
  - Día 2: tablas 5 a 7.
  - Día 3: tablas 8 a 10.
- Repaso combinado y entrenamiento de las cuentas que más cuestan.
- Estrellas, rachas y progreso guardado en el dispositivo.
- Sonidos musicales sintetizados en el navegador, con botón para silenciarlos.
- Mini fuegos artificiales al acertar y una celebración mayor al superar un nivel.
- Animación amable y mensaje de ayuda cuando la respuesta no es correcta.
- Diseño adaptable a computadora, tablet y celular.
- Preferencia de movimiento reducido respetada automáticamente.

## Abrir y probar

Podés abrir `index.html` directamente en un navegador moderno. Para simular la publicación, también podés servir la carpeta con cualquier servidor web estático.

## Publicar en Vercel con GitHub

1. Reemplazá en el repositorio los archivos `index.html`, `style.css`, `app.js` y `README.md` por estas versiones.
2. Confirmá los cambios en la rama `main`.
3. Vercel detectará el cambio y publicará automáticamente una nueva versión.
4. Cuando el despliegue termine, abrí la URL y hacé una recarga completa (`Ctrl + F5`).

Configuración: framework **Other**, sin comando de compilación y con el directorio raíz `.`. La aplicación no necesita backend, paquetes ni variables de entorno.

El progreso se guarda mediante `localStorage`. El audio se genera localmente con Web Audio API y no descarga archivos.
