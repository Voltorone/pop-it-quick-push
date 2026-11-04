# ALE-POP • Quick Push Mobile (Android / iOS)

Réplica para móvil (Android e iOS) de la consola electrónica **Pop-It Quick Push** de ALE-HOP con matriz de **10 burbujas (3-4-3)**, iluminación LED, notas musicales, vibración háptica y gatillo trasero físico en pantalla.

## Características principales

1. **Tres modos de juego seleccionables con el botón `☰ MODO`**:
   - **Modo Memoria (Simón Dice Infinito)**: Las burbujas se iluminan y suenan en una secuencia **100% aleatoria en cada partida y sub-ronda**. Debes pulsarlas en el mismo orden y confirmar con el **Gatillo Trasero**. Cada nivel aumenta la longitud de la secuencia y la velocidad de iluminación sin límite.
   - **Modo Reflejos (Niveles Infinitos / Quick Push)**: Se iluminan combinaciones aleatorias de varias burbujas a la vez. Debes explotarlas todas antes de que se agote la barra de tiempo y pulsar el **Gatillo Trasero** para levantar las burbujas y pasar a la siguiente oleada.
   - **Modo Contrarreloj (60s)**: Tienes 60 segundos para explotar y reiniciar con el gatillo trasero tantas oleadas aleatorias como puedas.
2. **Secuencias siempre diferentes**: Incluso si repites el Nivel 1 Ronda 1, el generador aleatorio crea siempre un patrón nuevo para que nunca se pueda memorizar de una partida a otra.
3. **Gatillo Trasero en pantalla**: Gran botón inferior que simula la palanca trasera de la consola física para empujar las burbujas hundidas hacia arriba y confirmar cada ronda.
4. **Audio sintetizado + Vibración Háptica**: Cada una de las 10 burbujas reproduce su propia nota musical y efecto de silicona ("pop") junto con vibración háptica (`expo-haptics`).

---

## Cómo ejecutar en Android / iOS (React Native + Expo)

1. Instala las dependencias en la carpeta del proyecto:
   ```bash
   npm install
   ```
2. Inicia el servidor de desarrollo de Expo:
   ```bash
   npx expo start
   ```
3. Escanea el código QR con la app **Expo Go** en tu móvil Android o iPhone (o pulsa `a` para abrir en emulador Android / `i` para simulador iOS).

> **Nota sobre versión de Node.js**: Si utilizas una versión reciente de Expo Go desde la Play Store / App Store (SDK 50+), se recomienda tener **Node.js 18 o 20 LTS** instalado en tu equipo.

## Vista previa interactiva instantánea

También puedes abrir directamente el archivo [`mobile-preview.html`](./mobile-preview.html) en cualquier navegador móvil o de escritorio para probar al instante la consola, los 3 modos de juego, el sonido y el gatillo trasero sin necesidad de instalar dependencias.
