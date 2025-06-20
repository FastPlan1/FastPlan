// ✅ Récupérer toutes les demandes d'une entreprise - VERSION CORRIGÉE
router.get("/entreprise/:entrepriseId", async (req, res) => {
  try {
    const { entrepriseId } = req.params;
    
    console.log("🔍 [DEBUG] Recherche réservations pour entrepriseId:", entrepriseId);
    
    if (!entrepriseId || entrepriseId === "undefined") {
      return res.status(400).json({ 
        error: "ID entreprise manquant",
        message: "L'ID de l'entreprise est requis"
      });
    }

    // 🔧 SOLUTION : Rechercher avec TOUS les IDs possibles
    let reservations = [];
    
    if (entrepriseId.startsWith('temp-')) {
      // Pour les IDs temporaires, chercher AUSSI par l'ObjectId de l'entreprise
      const entreprise = await Entreprise.findOne({ tempId: entrepriseId });
      
      if (entreprise) {
        console.log("🏢 [DEBUG] Entreprise trouvée:", {
          _id: entreprise._id,
          tempId: entreprise.tempId,
          nom: entreprise.nom
        });
        
        // Chercher les réservations avec TOUS les IDs possibles
        reservations = await Reservation.find({
          $or: [
            { entrepriseId: entrepriseId }, // ID temporaire
            { entrepriseId: entreprise._id.toString() }, // ObjectId en string
            { entrepriseId: entreprise._id } // ObjectId
          ]
        }).sort({ createdAt: -1 });
      } else {
        // Si pas d'entreprise trouvée, chercher quand même avec l'ID temporaire
        reservations = await Reservation.find({ entrepriseId }).sort({ createdAt: -1 });
      }
    } else {
      // Pour les ObjectIds normaux
      reservations = await Reservation.find({ entrepriseId }).sort({ createdAt: -1 });
    }
    
    console.log(`📦 [DEBUG] ${reservations.length} réservations trouvées pour l'entreprise ${entrepriseId}`);
    
    if (reservations.length > 0) {
      console.log("📋 [DEBUG] Exemples de réservations trouvées:", 
        reservations.slice(0, 2).map(r => ({
          id: r._id,
          client: `${r.nom} ${r.prenom}`,
          entrepriseId: r.entrepriseId,
          statut: r.statut
        }))
      );
    }
    
    res.status(200).json(reservations);
  } catch (err) {
    console.error("❌ Erreur récupération réservations :", err);
    res.status(500).json({ 
      error: "Erreur serveur",
      message: err.message 
    });
  }
});