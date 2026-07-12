/**
 * ══════════════════════════════════════════════════════════
 *  SIVO — Seed Script: Catálogo CIE-10 Oftalmología
 *  Colección: catalogo_cie10
 *  Desarrollado por TourLat
 * ══════════════════════════════════════════════════════════
 *
 *  USO:
 *  1. Coloca tu serviceAccountKey.json en esta misma carpeta
 *  2. npm install firebase-admin
 *  3. node seed_cie10.js
 *
 *  RESULTADO:
 *  - Colección "catalogo_cie10" con 307 documentos (ID = código)
 *  - Colección "catalogo_cie10_bloques" con 11 documentos (bloques)
 *  - Documento "catalogo_cie10_meta" en colección "configuracion"
 *
 *  SEGURO: si ya existen documentos, se sobrescriben (merge).
 *  Ejecutar múltiples veces es idempotente.
 */

const admin = require('firebase-admin');
const catalogoData = require('./catalogo_cie10.json');

// ─── Configuración ───────────────────────────────────────
const SERVICE_ACCOUNT = './serviceAccountKey.json'; // Tu archivo de credenciales
// ─────────────────────────────────────────────────────────

admin.initializeApp({
  credential: admin.credential.cert(require(SERVICE_ACCOUNT))
});

const db = admin.firestore();

async function seedCIE10() {
  console.log('🔬 SIVO — Seed CIE-10 Oftalmología');
  console.log('═'.repeat(50));

  const batch_size = 450; // Firestore max = 500 por batch, dejamos margen
  let batchCount = 0;
  let docCount = 0;

  // ── 1. Bloques (11 documentos) ──────────────────────────
  console.log('\n📂 Creando bloques...');
  let batch = db.batch();

  for (const bloque of catalogoData.bloques) {
    const ref = db.collection('catalogo_cie10_bloques').doc(bloque.id);
    batch.set(ref, {
      id: bloque.id,
      nombre: bloque.nombre,
      orden: catalogoData.bloques.indexOf(bloque)
    }, { merge: true });
    docCount++;
  }

  await batch.commit();
  batchCount++;
  console.log(`   ✅ ${catalogoData.bloques.length} bloques creados`);

  // ── 2. Códigos (307 documentos en batches) ──────────────
  console.log('\n📋 Creando códigos CIE-10...');
  batch = db.batch();
  let inBatch = 0;

  for (const cod of catalogoData.codigos) {
    // ID del documento = código sin asterisco ni puntos
    // ej: "H52.1" → "H52.1", "H03*" → "H03"
    const docId = cod.codigo.replace('*', '');
    const ref = db.collection('catalogo_cie10').doc(docId);

    // Campos para búsqueda: texto normalizado sin tildes
    const busqueda = normalizar(cod.nombre + ' ' + cod.codigo);

    batch.set(ref, {
      codigo: cod.codigo.replace('*', ''),
      codigoDisplay: cod.codigo, // con asterisco si aplica
      nombre: cod.nombre,
      bloque: cod.bloque,
      nivel: cod.nivel,
      dagaAsterisco: cod.dagaAsterisco,
      busqueda: busqueda, // para queries de texto
      activo: true,
      // Campos de trazabilidad SIVO
      creadoPor: 'seed_script',
      fechaCreacion: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    inBatch++;
    docCount++;

    if (inBatch >= batch_size) {
      await batch.commit();
      batchCount++;
      console.log(`   📦 Batch ${batchCount} — ${docCount} documentos acumulados`);
      batch = db.batch();
      inBatch = 0;
    }
  }

  // Commit del último batch parcial
  if (inBatch > 0) {
    await batch.commit();
    batchCount++;
  }
  console.log(`   ✅ ${catalogoData.codigos.length} códigos CIE-10 creados`);

  // ── 3. Metadata en configuracion ────────────────────────
  console.log('\n⚙️  Registrando metadata...');
  await db.collection('configuracion').doc('catalogo_cie10_meta').set({
    capitulo: catalogoData.meta.capitulo,
    titulo: catalogoData.meta.titulo,
    rango: catalogoData.meta.rango,
    fuente: catalogoData.meta.fuente,
    version: catalogoData.meta.version,
    totalCodigos: catalogoData.meta.totalCodigos,
    nota: catalogoData.meta.nota,
    fechaSeed: admin.firestore.FieldValue.serverTimestamp(),
    totalBloques: catalogoData.bloques.length
  }, { merge: true });
  console.log('   ✅ Metadata registrada en configuracion/catalogo_cie10_meta');

  // ── Resumen ─────────────────────────────────────────────
  console.log('\n' + '═'.repeat(50));
  console.log(`🎉 Seed completado:`);
  console.log(`   • ${catalogoData.bloques.length} bloques en catalogo_cie10_bloques`);
  console.log(`   • ${catalogoData.codigos.length} códigos en catalogo_cie10`);
  console.log(`   • 1 doc metadata en configuracion/catalogo_cie10_meta`);
  console.log(`   • ${batchCount} batches ejecutados`);
  console.log(`   • ${docCount} documentos totales escritos`);
  console.log('═'.repeat(50));
}

/**
 * Normaliza texto para búsqueda:
 * - Minúsculas
 * - Sin tildes
 * - Sin caracteres especiales
 */
function normalizar(texto) {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quita tildes
    .replace(/[^a-z0-9\s.]/g, '')    // solo alfanumérico, espacios y puntos
    .trim();
}

// ── Ejecutar ──────────────────────────────────────────────
seedCIE10()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });
