# 📊 Guía de Preguntas por Dificultad de Jefe

Sistema de progresión de dificultad basado en cantidad de preguntas.

---

## 🎯 Reglas Generales

### Obligatorias en TODOS los jefes:
- ✅ **Al menos 1 pregunta de Conocimiento General** (`category: "general"`)
- ✅ **Al menos 1 pregunta de una Materia** (`category: "fisica"`, `"matematicas"`, etc.)
- ✅ **4 opciones de respuesta** (A, B, C, D)
- ✅ **1 respuesta correcta** por pregunta

### Sistema de recompensas:
- 🏆 **Todas correctas** → +3 medallas + 50 XP + título especial
- 🥈 **Más de la mitad** → +1 medalla + 20 XP + badge de victoria
- 💀 **Menos de la mitad** → +5 XP + cooldown de 24h para reintentar

---

## 📈 Distribución de Preguntas por Jefe

| Jefe | Nivel | Preguntas | Conocimiento General | Materias | Descripción |
|------|-------|-----------|---------------------|----------|-------------|
| **Boss 01** | Fácil | **4** | 1-2 | 2-3 | Introductorio |
| **Boss 02** | Fácil | **4** | 1-2 | 2-3 | Refuerzo de básicos |
| **Boss 03** | Medio | **6** | 2 | 4 | Primera escalada |
| **Boss 04** | Medio | **6** | 2 | 4 | Consolidación |
| **Boss 05** | Difícil | **8** | 2-3 | 5-6 | Desafío avanzado |
| **Boss 06** | Difícil | **8** | 2-3 | 5-6 | Pre-final |
| **Boss 07** | Muy Difícil | **10** | 3 | 7 | Boss final 1 |
| **Boss 08** | Épico | **10** | 3 | 7 | Boss final 2 |

---

## 🗂️ Detalle por Jefe

### 🎮 Boss 01 - El Loquito del Centro
**Nivel:** Introductorio
**Preguntas:** 4 totales
- 📚 Conocimiento General: **1 pregunta** (cultura básica, sentido común)
- 🔬 Materias: **3 preguntas** (1 fácil por materia vista)

**Ejemplo de distribución:**
1. General: "¿Cuál es la capital de México?"
2. Física: "¿Qué es la velocidad?"
3. Matemáticas: "¿Cuánto es 5 × 8?"
4. Español: "¿Qué es un sustantivo?"

---

### 🎮 Boss 02 - El Garbanzo Coqueto
**Nivel:** Fácil
**Preguntas:** 4 totales
- 📚 Conocimiento General: **2 preguntas**
- 🔬 Materias: **2 preguntas**

**Ejemplo de distribución:**
1. General: "¿Cuántos continentes hay?"
2. General: "¿Qué deporte usa una red?"
3. Historia: "¿Quién fue Benito Juárez?"
4. Inglés: "How do you say 'perro' in English?"

---

### 🎮 Boss 03 - La Guardia de la Puerta
**Nivel:** Medio
**Preguntas:** 6 totales
- 📚 Conocimiento General: **2 preguntas**
- 🔬 Materias: **4 preguntas**

**Ejemplo de distribución:**
1. General: "¿Qué gas respiramos?"
2. General: "¿Cuántos días tiene un año bisiesto?"
3. Física: "¿Qué es la fuerza?"
4. Matemáticas: "¿Cuál es el área de un cuadrado de lado 5?"
5. Química: "¿Qué es H2O?"
6. Biología: "¿Qué órgano bombea la sangre?"

---

### 🎮 Boss 04 - El Prefecto de Malas
**Nivel:** Medio
**Preguntas:** 6 totales
- 📚 Conocimiento General: **2 preguntas**
- 🔬 Materias: **4 preguntas** (mayor dificultad)

---

### 🎮 Boss 05 - El Compañero Molesto
**Nivel:** Difícil
**Preguntas:** 8 totales
- 📚 Conocimiento General: **2-3 preguntas**
- 🔬 Materias: **5-6 preguntas** (conceptos intermedios)

**Características:**
- Preguntas de razonamiento
- Conceptos que requieren comprensión profunda
- Mezcla de materias vistas en el semestre

---

### 🎮 Boss 06 - La Maestra Estricta
**Nivel:** Difícil
**Preguntas:** 8 totales
- 📚 Conocimiento General: **3 preguntas**
- 🔬 Materias: **5 preguntas** (avanzadas)

**Características:**
- Preguntas tipo examen
- Requiere dominio de conceptos clave
- Puede incluir resolución de problemas cortos

---

### 🎮 Boss 07 - El Director
**Nivel:** Muy Difícil
**Preguntas:** 10 totales
- 📚 Conocimiento General: **3 preguntas** (cultura general amplia)
- 🔬 Materias: **7 preguntas** (todas las materias)

**Características:**
- Boss final de primer nivel
- Requiere estudio previo
- Preguntas de todo el curso hasta el momento

---

### 🎮 Boss 08 - El Profe Eduardo
**Nivel:** Épico
**Preguntas:** 10 totales
- 📚 Conocimiento General: **3 preguntas** (nivel secundaria completo)
- 🔬 Materias: **7 preguntas** (conceptos más difíciles del año)

**Características:**
- Boss final supremo
- Solo accesible en nivel 18+
- Preguntas de síntesis y aplicación
- Desafío máximo del sistema

---

## 📝 Estructura JSON de Preguntas

### Ejemplo de pregunta en `data.json`:

```json
{
  "id": "boss01",
  "title": "El Loquito del Centro",
  "battleQuestions": [
    {
      "question": "¿Cuál es la capital de México?",
      "options": [
        "Ciudad de México",
        "Guadalajara",
        "Monterrey",
        "Puebla"
      ],
      "correctIndex": 0,
      "category": "general",
      "difficulty": "easy"
    },
    {
      "question": "¿Qué es la velocidad?",
      "options": [
        "Distancia entre tiempo",
        "Fuerza por masa",
        "Aceleración por tiempo",
        "Peso dividido volumen"
      ],
      "correctIndex": 0,
      "category": "fisica",
      "difficulty": "easy"
    }
  ]
}
```

### Categorías válidas:
- `"general"` - Conocimiento general
- `"fisica"` - Física
- `"matematicas"` - Matemáticas
- `"quimica"` - Química
- `"biologia"` - Biología
- `"historia"` - Historia
- `"geografia"` - Geografía
- `"ingles"` - Inglés
- `"espanol"` - Español
- `"civica"` - Formación Cívica
- `"tecnologia"` - Tecnología
- `"artes"` - Artes

### Niveles de dificultad:
- `"easy"` - Fácil (conocimiento básico)
- `"medium"` - Medio (requiere comprensión)
- `"hard"` - Difícil (requiere análisis/aplicación)

---

## ✅ Checklist al crear preguntas

- [ ] Definir cuántas preguntas lleva el jefe según nivel
- [ ] Incluir al menos 1 de conocimiento general
- [ ] Incluir al menos 1 de materia académica
- [ ] Cada pregunta tiene exactamente 4 opciones
- [ ] Marcar `correctIndex` (0-3) correctamente
- [ ] Asignar `category` apropiada
- [ ] Asignar `difficulty` apropiada
- [ ] Probar que las preguntas se lean bien en pantalla
- [ ] Verificar que las respuestas no sean obvias

---

## 🎯 Tips para crear buenas preguntas

1. **Opciones creíbles:** Las respuestas incorrectas deben parecer plausibles
2. **Longitud similar:** Todas las opciones deben tener largo similar
3. **Evitar "todas las anteriores":** Confunde y no funciona bien
4. **Lenguaje claro:** Usar lenguaje de secundaria, evitar tecnicismos innecesarios
5. **Una sola correcta:** Solo una opción debe ser inequívocamente correcta
6. **Variedad:** Mezclar preguntas de definición, cálculo y razonamiento

---

**Última actualización:** 2026-02-17
