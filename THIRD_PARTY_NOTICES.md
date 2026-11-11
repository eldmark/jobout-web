# Avisos de terceros

Componentes de interfaz adaptados de bibliotecas publicadas en [21st.dev](https://21st.dev). No se
instalan como paquete: el código se copió al repo y se modificó (colores de la marca, accesibilidad,
«reducir movimiento»). Cada archivo dice al principio qué cambió.

## Background Paths — Kokonut UI

- Archivo: `app/_components/ui/background-paths.tsx`
- Origen: <https://kokonutui.com> · <https://github.com/kokonut-labs/kokonutui> (v2.0.0)
- En 21st.dev: <https://21st.dev/@kokonutd/components/background-paths>
- Licencia: MIT

```
MIT License

Copyright (c) 2025 kokonutUI

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Text Rotate — Fancy Components

- Archivo: `app/_components/ui/text-rotate.tsx`
- Origen: <https://fancycomponents.dev> · <https://github.com/danielpetho/fancy>
- En 21st.dev: <https://21st.dev/@danielpetho/components/text-rotate>
- Licencia: MIT

```
MIT License

Copyright (c) 2024 Daniel Petho

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Container Scroll Animation — Aceternity UI

- Archivo: `app/_components/ui/container-scroll.tsx`
- Origen: <https://ui.aceternity.com/components/container-scroll-animation>
- En 21st.dev: <https://21st.dev/@manuarora700/components/container-scroll-animation>
- Licencia: [Aceternity License](https://ui.aceternity.com/licence). Permite usarlo y modificarlo
  dentro de productos finales, como sitios y aplicaciones web. **Prohíbe redistribuir su código
  fuente** como tal y venderlo en un marketplace.

> **Ojo:** este repo es privado. Si algún día se publica (por ejemplo, para mostrarlo como
> portafolio), hay que reemplazar `container-scroll.tsx` por una implementación propia antes,
> porque publicar el repo sería redistribuir ese archivo.

## three.js

- Uso: dependencia npm (`three`, con `@types/three` solo para tipos) para el entrevistador 3D de
  `app/_components/avatar-scene.ts`. Se carga con `import()` dinámico, fuera del JS inicial.
- Origen: <https://threejs.org>
- Licencia: MIT.

```text
The MIT License

Copyright © 2010-2024 three.js authors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```
