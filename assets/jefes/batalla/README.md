# 🎮 Guía de Nomenclatura para Imágenes de Batalla de Jefes

Esta carpeta contiene las imágenes para el modo batalla contra jefes.

## 📋 Convención de Nombres

Cada jefe necesita **4 imágenes** con esta convención:

```
boss[##]_[nombre]_[estado].webp
```

### Componentes del nombre:

1. **`boss[##]`** - ID del jefe (boss01, boss02, boss03, etc.)
2. **`[nombre]`** - Nombre corto identificador del jefe (loquito, garbanzo, guardia, etc.)
3. **`[estado]`** - Estado de la imagen:
   - **`bg`** → Fondo/escenario de la batalla
   - **`idle`** → Jefe en reposo/neutral (estado por defecto)
   - **`mock`** → Jefe burlándose (cuando el jugador falla)
   - **`hit`** → Jefe recibiendo daño (cuando el jugador acierta)

---

## 🗂️ Ejemplo: El Loquito del Centro (Boss 01)

Para el primer jefe necesitas estas 4 imágenes:

```
boss01_loquito_bg.webp      ← Fondo (autobús de Huizaches Centro)
boss01_loquito_idle.webp    ← Personaje pensativo/neutral (mano en barbilla)
boss01_loquito_mock.webp    ← Personaje burlándose (gesto de victoria)
boss01_loquito_hit.webp     ← Personaje dañado (mano en la cara, dolor)
```

---

## 📚 Todos los Jefes (Nomenclatura Completa)

### Boss 01 - El Loquito del Centro
- `boss01_loquito_bg.webp`
- `boss01_loquito_idle.webp`
- `boss01_loquito_mock.webp`
- `boss01_loquito_hit.webp`

### Boss 02 - El Garbanzo Coqueto
- `boss02_garbanzo_bg.webp`
- `boss02_garbanzo_idle.webp`
- `boss02_garbanzo_mock.webp`
- `boss02_garbanzo_hit.webp`

### Boss 03 - La Guardia de la Puerta
- `boss03_guardia_bg.webp`
- `boss03_guardia_idle.webp`
- `boss03_guardia_mock.webp`
- `boss03_guardia_hit.webp`

### Boss 04 - El Prefecto de Malas
- `boss04_prefecto_bg.webp`
- `boss04_prefecto_idle.webp`
- `boss04_prefecto_mock.webp`
- `boss04_prefecto_hit.webp`

### Boss 05 - El Compañero Molesto
- `boss05_companero_bg.webp`
- `boss05_companero_idle.webp`
- `boss05_companero_mock.webp`
- `boss05_companero_hit.webp`

### Boss 06 - La Maestra Estricta
- `boss06_maestra_bg.webp`
- `boss06_maestra_idle.webp`
- `boss06_maestra_mock.webp`
- `boss06_maestra_hit.webp`

### Boss 07 - El Director
- `boss07_director_bg.webp`
- `boss07_director_idle.webp`
- `boss07_director_mock.webp`
- `boss07_director_hit.webp`

### Boss 08 - El Profe Eduardo
- `boss08_eduardo_bg.webp`
- `boss08_eduardo_idle.webp`
- `boss08_eduardo_mock.webp`
- `boss08_eduardo_hit.webp`

---

## 🎯 Especificaciones Técnicas

### Tamaño recomendado:
- **Fondo (bg):** 1920x1080px o mayor (16:9)
- **Personaje (idle/mock/hit):** PNG transparente, aprox 800-1200px de alto

### Formato:
- **WebP** para mejor compresión y calidad
- Fondo: JPEG o WebP con calidad 85-90%
- Personaje: PNG transparente o WebP con alpha channel

### Contenido de cada estado:
- **bg:** Escenario completo donde ocurre la batalla (sin personaje)
- **idle:** Pose neutral del jefe (amenazante, pensativo, confiado)
- **mock:** Jefe burlándose o riendo (expresión triunfante)
- **hit:** Jefe recibiendo daño (expresión de dolor, sorpresa o enojo)

---

## ✅ Checklist al agregar un jefe nuevo

- [ ] Crear/conseguir las 4 imágenes del jefe
- [ ] Renombrar siguiendo la convención `boss##_nombre_estado.webp`
- [ ] Colocar en `/assets/jefes/batalla/`
- [ ] Actualizar `data.json` agregando campo `battleSprites`:
  ```json
  {
    "id": "boss##",
    "battleSprites": {
      "bg": "assets/jefes/batalla/boss##_nombre_bg.webp",
      "idle": "assets/jefes/batalla/boss##_nombre_idle.webp",
      "mock": "assets/jefes/batalla/boss##_nombre_mock.webp",
      "hit": "assets/jefes/batalla/boss##_nombre_hit.webp"
    }
  }
  ```
- [ ] Agregar preguntas de batalla (`battleQuestions`) al jefe en `data.json`
- [ ] Probar la batalla en la aplicación

---

**Última actualización:** 2026-02-17
