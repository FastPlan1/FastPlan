// check-collections.js
const mongoose = require('mongoose');
require('dotenv').config();

// Remplacez par votre URI MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sample_mflix';

async function checkCollections() {
  try {
    // Connexion
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connecté à MongoDB');
    console.log('📊 Base de données:', mongoose.connection.db.databaseName);
    
    // Lister toutes les collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('\n📁 Collections disponibles:');
    collections.forEach(col => console.log(`  - ${col.name}`));
    
    // Vérifier la collection 'planning' (sans s)
    const Planning = mongoose.connection.collection('planning');
    const countPlanning = await Planning.countDocuments();
    console.log(`\n📋 Collection 'planning': ${countPlanning} documents`);
    
    if (countPlanning > 0) {
      const samplePlanning = await Planning.findOne();
      console.log('Exemple de document:', JSON.stringify(samplePlanning, null, 2));
    }
    
    // Vérifier la collection 'plannings' (avec s)
    const Plannings = mongoose.connection.collection('plannings');
    const countPlannings = await Plannings.countDocuments();
    console.log(`\n📋 Collection 'plannings': ${countPlannings} documents`);
    
    if (countPlannings > 0) {
      const samplePlannings = await Plannings.findOne();
      console.log('Exemple de document:', JSON.stringify(samplePlannings, null, 2));
    }
    
    // Rechercher les courses de Priscilla dans les deux collections
    console.log('\n🔍 Recherche des courses de Priscilla...');
    
    const priscillaPlanning = await Planning.find({ chauffeur: /priscilla/i }).toArray();
    console.log(`Collection 'planning': ${priscillaPlanning.length} courses pour Priscilla`);
    
    const priscillaPlannings = await Plannings.find({ chauffeur: /priscilla/i }).toArray();
    console.log(`Collection 'plannings': ${priscillaPlannings.length} courses pour Priscilla`);
    
    // Afficher les chauffeurs uniques dans chaque collection
    console.log('\n👥 Chauffeurs uniques:');
    
    const chauffeursPlanningRaw = await Planning.distinct('chauffeur');
    const chauffeursPlanning = chauffeursPlanningRaw.filter(c => c && c.trim() !== '');
    console.log(`Collection 'planning': ${chauffeursPlanning}`);
    
    const chauffeursPlanningsRaw = await Plannings.distinct('chauffeur');
    const chauffeursPlannings = chauffeursPlanningsRaw.filter(c => c && c.trim() !== '');
    console.log(`Collection 'plannings': ${chauffeursPlannings}`);
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n👋 Connexion fermée');
  }
}

// Lancer la vérification
checkCollections();