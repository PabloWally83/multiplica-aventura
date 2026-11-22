# Multiplica Aventura 🦊

Aplicación web educativa para aprender y practicar las tablas de multiplicar del 1 al 10.

## Funciones principales

- Antes del primer desafío permite elegir entre completar todo en una sesión o repartir las tablas entre 2 y 10 días.
- Distribuye automáticamente las tablas de forma equilibrada entre los días elegidos.
- Niveles progresivos con desbloqueo al alcanzar 8 respuestas correctas de 10.
- Al terminar cada desafío muestra las 10 operaciones, la respuesta dada, la respuesta correcta y si estuvo bien o mal.
- Repaso combinado y entrenamiento de cuentas difíciles.
- Estrellas, rachas, sonidos, animaciones, mini fuegos artificiales y celebración de nivel.
- Progreso y plan guardados en `localStorage`.
- Diseño responsive y sin dependencias externas.

## Probar localmente

Abrí `index.html` en un navegador moderno. Para una prueba más fiel podés iniciar un servidor estático:

```bash
npx serve .
```

## Publicar en Vercel

1. Subí los cinco archivos de esta carpeta a la raíz del repositorio de GitHub.
2. Vercel detectará el cambio en la rama principal y hará un nuevo despliegue automáticamente.
3. No requiere build command, variables de entorno, backend ni base de datos.

La aplicación es HTML, CSS y JavaScript puro.
