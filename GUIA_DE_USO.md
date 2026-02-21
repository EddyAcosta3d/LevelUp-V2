# 📖 Guía de Uso - LevelUp V2

## 🎯 Flujo de Trabajo del Profesor

Tu flujo de trabajo es el siguiente:
1. **GitHub + GitHub Pages**: Hosting del proyecto (público)
2. **Solo el profesor edita**: Tú eres el único que puede hacer cambios
3. **Alumnos solo ven**: Ellos acceden para ver su progreso
4. **Guardado automático a GitHub**: Ya no necesitas descargar/subir JSON manualmente

---

## 🚀 Nuevas Funciones Implementadas

### 1️⃣ **Auto-Guardado a GitHub**

Ya no necesitas descargar el JSON y subirlo manualmente. Ahora guardas directamente a GitHub con un click.

#### **Configuración inicial (una sola vez)**

1. **Crear Personal Access Token (PAT) en GitHub:**
   - Ve a: https://github.com/settings/tokens
   - Click en **"Generate new token"** → **"Tokens (classic)"**
   - Dale un nombre: `LevelUp Auto-Save`
   - Selecciona el permiso: **`repo`** (Full control)
   - Click en **"Generate token"**
   - **Copia el token** (empieza con `ghp_`)

2. **Configurar el token en LevelUp:**
   - Abre tu sitio normal (`https://tu-usuario.github.io/LevelUp-V2`) e inicia sesión con la cuenta admin (Eddy).
   - Click en **"💾 Datos"** → **"⚙️ Configurar GitHub"**
   - Pega tu token
   - Click en **"Guardar"**
   - (Opcional) Click en **"Probar Conexión"** para verificar

#### **Uso diario**

Cuando hagas cambios (agregar XP, completar desafíos, etc.):

1. Click en **"💾 Datos"**
2. Click en **"💾 Guardar a GitHub"**
3. Espera el mensaje: **"✅ Guardado en GitHub correctamente"**
4. ¡Listo! Los cambios están en GitHub y se reflejarán en 30-60 segundos

**Ventajas:**
- ✅ Un solo click para guardar
- ✅ Funciona desde iPad, celular o PC
- ✅ Historial automático en GitHub (cada guardado es un commit)
- ✅ Sin riesgo de perder cambios

---

### 2️⃣ **Modo Viewer (Alumnos) vs Admin (Profesor)**

Los alumnos y tú usan la misma app, pero con diferentes permisos:

#### **Link para ALUMNOS (Solo Lectura)**
```
https://tu-usuario.github.io/LevelUp-V2
```

**Qué ven:**
- ✅ Su avatar, nombre, nivel, XP
- ✅ Ranking/Leaderboard
- ✅ Desafíos disponibles
- ✅ Recompensas disponibles
- ❌ NO ven botones de edición
- ❌ NO pueden cambiar nada

**En móvil:**
- Automáticamente se ocultan TODOS los controles de edición
- La interfaz es más limpia y simple
- Ideal para que los alumnos solo vean su progreso

#### **Link para TI (Edición Completa)**
```
https://tu-usuario.github.io/LevelUp-V2 (inicia sesión con Eddy)
```

**Qué ves:**
- ✅ Todo lo que ven los alumnos
- ✅ Botones para agregar XP
- ✅ Botones para completar desafíos
- ✅ Botón "Guardar a GitHub"
- ✅ Todos los controles de edición

**Importante:**
- Guarda este link en tus favoritos en iPad/celular/PC
- NUNCA compartas la cuenta admin (Eddy) con alumnos.

---

### 3️⃣ **Proyección en clase (sin modo especial)**

Usa la app normal en pantalla completa (F11) para proyectar ranking y progreso.

---


## 📱 Uso en Dispositivos

### **iPad / iPhone (Tú)**
- Usa: `https://tu-usuario.github.io/LevelUp-V2 (inicia sesión con Eddy)`
- Guarda en favoritos
- Puedes editar desde cualquier lugar
- Cuando termines de hacer cambios: **"💾 Datos" → "Guardar a GitHub"**

### **Android / iPhone (Alumnos)**
- Usa: `https://tu-usuario.github.io/LevelUp-V2`
- Solo pueden ver, no editar
- Interfaz simplificada en móvil
- Comparte este link vía QR code o por mensaje

### **PC / Mac (Tú)**
- Usa: `https://tu-usuario.github.io/LevelUp-V2 (inicia sesión con Eddy)`
- Ideal para crear desafíos, gestionar materias, etc.
- Pantalla completa aprovecha mejor el espacio

### **Proyector (Clase)**
- Usa: `(El modo proyector por URL fue eliminado)`
- Presiona F11 para pantalla completa
- Auto-actualiza cada 30 segundos

---

## 🎓 Flujo de Trabajo Semanal Recomendado

### **Lunes (Inicio de semana)**
1. Abre la app en pantalla completa (F11) y muestra el ranking
2. Anuncia los nuevos desafíos de la semana
3. Motiva a los alumnos mostrando el Top 3

### **Durante la semana (iPad/celular)**
1. Cuando un alumno complete una tarea/participación:
   - Abre la app e inicia sesión con Eddy
   - Busca al alumno
   - Agrega XP correspondiente
   - Click en **"Guardar a GitHub"**
2. Repite para cada alumno

### **Viernes (Cierre de semana)**
1. Proyecta el ranking final
2. Celebra al Top 3
3. Anuncia recompensas (si aplica)
4. Opcional: Reinicia XP semanal si usas el sistema de XP semanal

---

## 🔧 Solución de Problemas

### **"No puedo guardar a GitHub"**
- Verifica que configuraste el token correctamente
- Prueba la conexión: **"💾 Datos" → "⚙️ Configurar GitHub" → "Probar Conexión"**
- Asegúrate que el token tiene permiso `repo`

### **"Los alumnos ven botones de edición"**
- Verifica que no tengan acceso a la cuenta admin (Eddy)
- En móvil, los botones se ocultan automáticamente

### **"La proyección no se ve bien"**
- Presiona F11 para pantalla completa
- Asegúrate que la resolución del proyector es al menos 1280x720

### **"Los cambios no se reflejan inmediatamente"**
- Después de guardar a GitHub, espera 30-60 segundos
- Los alumnos deben recargar la página (F5) para ver los cambios

---

## 📚 Links Útiles

### **Para compartir con alumnos:**
- **Ver progreso**: `https://tu-usuario.github.io/LevelUp-V2`
- **QR Code**: Genera uno en https://qr.io con el link de arriba

### **Para ti (profesor):**
- **Editar**: `https://tu-usuario.github.io/LevelUp-V2 (inicia sesión con Eddy)`
- **Proyectar**: `(El modo proyector por URL fue eliminado)`
- **GitHub Repo**: `https://github.com/tu-usuario/LevelUp-V2`

### **Ayuda:**
- **Personal Access Token**: https://github.com/settings/tokens
- **GitHub Pages**: https://pages.github.com/

---

## 🎉 ¡Disfruta LevelUp!

Ahora tu flujo de trabajo es:
1. ✅ Haces cambios desde cualquier dispositivo
2. ✅ Guardas a GitHub con un click
3. ✅ Los alumnos ven su progreso en tiempo real
4. ✅ Proyectas el ranking en clase para motivarlos

**¿Tienes dudas?** Revisa esta guía o consulta el repositorio en GitHub.
