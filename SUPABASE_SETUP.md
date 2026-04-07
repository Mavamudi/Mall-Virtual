# Configuración de Base de Datos (Supabase)

Para habilitar el modelo multi-tienda del "Mall de Emprendimientos", debes ejecutar los siguientes comandos SQL en el editor de consultas (SQL Editor) de tu dashboard de Supabase.

## 1. Crear Tabla de Tiendas (Stores)
Esta tabla almacenará la configuración individual de cada emprendedora.

```sql
CREATE TABLE IF NOT EXISTS stores (
    id UUID PRIMARY KEY DEFAULT auth.uid(),
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    whatsapp TEXT,
    primary_color TEXT DEFAULT '#c9a66b',
    checkout_mode TEXT DEFAULT 'whatsapp', -- 'whatsapp' o 'mercadopago'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;

-- Permitir lectura pública de las tiendas
CREATE POLICY "Permitir lectura pública de tiendas" ON stores
FOR SELECT USING (true);

-- Permitir que cada dueña edite su propia tienda
CREATE POLICY "Duenas pueden editar su propia tienda" ON stores
FOR UPDATE USING (auth.uid() = id);
```

## 2. Modificar Tablas Existentes para Multi-Tenancy

Ejecuta estos comandos para vincular el contenido actual a las tiendas.

```sql
-- Añadir columna store_id a site_content
ALTER TABLE site_content ADD COLUMN IF NOT EXISTS store_id TEXT;

-- Añadir columna store_id a quotations
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS store_id TEXT;

-- Añadir columna store_id a contact_messages
ALTER TABLE contact_messages ADD COLUMN IF NOT EXISTS store_id TEXT;

-- (Opcional) Si deseas usar UUIDs y FKs reales para mayor seguridad:
-- ALTER TABLE site_content ADD COLUMN store_id UUID REFERENCES stores(id);
```

## 3. Poblar Tienda por Defecto (Migración)
Para asegurar que tu tienda actual de "MR Confecciones" siga funcionando:

```sql
INSERT INTO stores (slug, name, whatsapp, primary_color, checkout_mode)
VALUES ('mr_confecciones', 'MR Confecciones', '56998745436', '#b05d3c', 'mercadopago')
ON CONFLICT (slug) DO NOTHING;

-- Vincular contenido existente a la tienda por defecto
UPDATE site_content SET store_id = 'mr_confecciones' WHERE store_id IS NULL;
UPDATE quotations SET store_id = 'mr_confecciones' WHERE store_id IS NULL;
UPDATE contact_messages SET store_id = 'mr_confecciones' WHERE store_id IS NULL;
```

## 4. Políticas de Seguridad (RLS)
Actualiza las políticas de `site_content` para que las emprendedoras solo puedan editar lo suyo.

```sql
ALTER TABLE site_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lectura pública de contenido" ON site_content
FOR SELECT USING (true);

-- Asumiendo que el store_id coincide con el slug y hay una lógica de permisos
-- Para simplificar el MVP, puedes dejar la política de inserción/actualización abierta a admins autenticados
CREATE POLICY "Admins pueden editar contenido" ON site_content
FOR ALL USING (auth.role() = 'authenticated');
```
