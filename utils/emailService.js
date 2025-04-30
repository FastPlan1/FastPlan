/**
 * Estimateur de prix local sans dépendance aux API externes
 * Utilise des calculs approximatifs basés sur les coordonnées ou une matrice de distance
 */
class LocalPriceEstimator {
    constructor() {
      // Table de tarifs par défaut
      this.defaultRates = {
        basePrice: 2.5,         // Prix de base en euros
        pricePerKm: 1.05,       // Prix par kilomètre en euros
        pricePerMinute: 0.35,   // Prix par minute d'attente en euros
        minimumPrice: 7.0,      // Prix minimum pour une course
        nightSurcharge: 1.5,    // Multiplicateur pour courses de nuit (22h-6h)
        weekendSurcharge: 1.2,  // Multiplicateur pour courses le week-end
        holidaySurcharge: 1.5,  // Multiplicateur pour jours fériés
        luggageSurcharge: 2.0,  // Supplément pour bagages volumineux
        petSurcharge: 5.0,      // Supplément pour animaux
        airportSurcharge: 5.0,  // Supplément pour aéroport
        premiumVehicleFactor: 1.5, // Multiplicateur pour véhicules premium
        waitingPricePerHour: 20 // Prix par heure d'attente
      };
      
      // Jours fériés (à mettre à jour chaque année)
      const currentYear = new Date().getFullYear();
      this.holidays = [
        `${currentYear}-01-01`, // Jour de l'an
        `${currentYear}-04-10`, // Lundi de Pâques (approximatif)
        `${currentYear}-05-01`, // Fête du Travail
        `${currentYear}-05-08`, // Victoire 1945
        `${currentYear}-05-18`, // Ascension (approximatif)
        `${currentYear}-05-29`, // Lundi de Pentecôte (approximatif)
        `${currentYear}-07-14`, // Fête Nationale
        `${currentYear}-08-15`, // Assomption
        `${currentYear}-11-01`, // Toussaint
        `${currentYear}-11-11`, // Armistice
        `${currentYear}-12-25`  // Noël
      ];
      
      // Base de données de lieux connus (à personnaliser selon votre zone d'opération)
      this.knownLocations = {
        // Exemples pour Paris
        "aéroport cdg": { lat: 49.0097, lon: 2.5479, name: "Aéroport Charles de Gaulle" },
        "aéroport orly": { lat: 48.7262, lon: 2.3652, name: "Aéroport d'Orly" },
        "gare du nord": { lat: 48.8809, lon: 2.3553, name: "Gare du Nord" },
        "tour eiffel": { lat: 48.8584, lon: 2.2945, name: "Tour Eiffel" },
        "montmartre": { lat: 48.8867, lon: 2.3431, name: "Montmartre" },
        "champs-élysées": { lat: 48.8698, lon: 2.3075, name: "Champs-Élysées" },
        "arc de triomphe": { lat: 48.8738, lon: 2.2950, name: "Arc de Triomphe" },
        "gare de lyon": { lat: 48.8448, lon: 2.3735, name: "Gare de Lyon" },
        "notre dame": { lat: 48.8530, lon: 2.3499, name: "Notre-Dame" },
        "louvre": { lat: 48.8606, lon: 2.3376, name: "Musée du Louvre" },
        "la défense": { lat: 48.8918, lon: 2.2333, name: "La Défense" }
        // Ajoutez d'autres lieux fréquents de votre zone
      };
      
      // Matrice de distances entre lieux connus (en km)
      // Peut être renseignée manuellement pour améliorer la précision
      this.distanceMatrix = {
        // Format: "lieu1_lieu2": { distance: X, duration: Y }
        "aéroport cdg_gare du nord": { distance: 21.4, duration: 35 },
        "aéroport orly_gare de lyon": { distance: 18.2, duration: 30 },
        "gare du nord_tour eiffel": { distance: 6.8, duration: 25 }
        // Ajoutez d'autres combinaisons fréquentes
      };
      
      // Zone centrale (centre-ville) - définir selon votre ville
      this.cityCenter = { lat: 48.8566, lon: 2.3522 }; // Paris
      this.centralRadius = 5000; // 5km autour du centre
    }
    
    /**
     * Estime le prix d'une course
     */
    async estimatePrice(params) {
      const {
        entrepriseId,
        origin,
        destination,
        stops = [],
        date = new Date(),
        vehicleType = "standard",
        passengers = 1,
        luggageCount = 0,
        withPet = false,
        isAirport = false,
        waitingTime = 0,
        promoCode = null
      } = params;
      
      try {
        // Récupérer les tarifs spécifiques à l'entreprise si disponibles
        const rates = await this.getEntrepriseRates(entrepriseId);
        
        // Calculer la distance et la durée du trajet
        let routeInfo;
        
        // Vérifier si ce trajet est dans notre matrice de distances
        const matrixKey1 = this.createMatrixKey(origin, destination);
        const matrixKey2 = this.createMatrixKey(destination, origin);
        
        if (this.distanceMatrix[matrixKey1]) {
          routeInfo = {
            distance: this.distanceMatrix[matrixKey1].distance * 1000, // Convertir en mètres
            duration: this.distanceMatrix[matrixKey1].duration * 60,   // Convertir en secondes
            legs: [{ 
              startAddress: origin, 
              endAddress: destination,
              distance: this.distanceMatrix[matrixKey1].distance * 1000,
              duration: this.distanceMatrix[matrixKey1].duration * 60
            }]
          };
        } else if (this.distanceMatrix[matrixKey2]) {
          routeInfo = {
            distance: this.distanceMatrix[matrixKey2].distance * 1000,
            duration: this.distanceMatrix[matrixKey2].duration * 60,
            legs: [{ 
              startAddress: origin, 
              endAddress: destination,
              distance: this.distanceMatrix[matrixKey2].distance * 1000,
              duration: this.distanceMatrix[matrixKey2].duration * 60
            }]
          };
        } else {
          // Sinon, estimer avec notre fonction de calcul locale
          routeInfo = this.estimateRouteLocally(origin, destination, stops);
        }
        
        // Prix de base
        let price = rates.basePrice;
        
        // Ajouter le prix au kilomètre
        price += (routeInfo.distance / 1000) * rates.pricePerKm;
        
        // Ajouter le prix du temps estimé (en minutes)
        price += (routeInfo.duration / 60) * rates.pricePerMinute;
        
        // Appliquer les suppléments
        const { 
          surcharges, 
          surchargeTotal,
          surchargeDetails
        } = this.calculateSurcharges(
          rates, 
          date, 
          vehicleType, 
          luggageCount, 
          withPet, 
          isAirport,
          waitingTime
        );
        
        price += surchargeTotal;
        
        // Appliquer les réductions si un code promo est fourni
        let discount = 0;
        let discountDetails = {};
        
        if (promoCode) {
          const promoResult = await this.applyPromoCode(promoCode, price, entrepriseId);
          discount = promoResult.discount;
          discountDetails = promoResult.details;
        }
        
        price -= discount;
        
        // Appliquer le prix minimum
        if (price < rates.minimumPrice) {
          price = rates.minimumPrice;
        }
        
        // Arrondir le prix à 2 décimales
        price = Math.round(price * 100) / 100;
        
        return {
          totalPrice: price,
          basePrice: rates.basePrice,
          distancePrice: (routeInfo.distance / 1000) * rates.pricePerKm,
          durationPrice: (routeInfo.duration / 60) * rates.pricePerMinute,
          surcharges: surchargeDetails,
          surchargeTotal,
          discount,
          discountDetails,
          route: {
            distance: routeInfo.distance / 1000,  // en km
            duration: routeInfo.duration / 60,    // en minutes
            legs: routeInfo.legs
          }
        };
      } catch (error) {
        console.error("❌ Erreur estimation du prix:", error);
        throw error;
      }
    }
    
    /**
     * Crée une clé pour la matrice de distances
     */
    createMatrixKey(origin, destination) {
      // Nettoyer et normaliser les noms de lieux
      const cleanOrigin = this.cleanLocationName(origin);
      const cleanDestination = this.cleanLocationName(destination);
      return `${cleanOrigin}_${cleanDestination}`;
    }
    
    /**
     * Nettoie un nom de lieu pour la recherche
     */
    cleanLocationName(location) {
      return location.toLowerCase()
        .replace(/[^\w\s]/gi, '') // Enlever ponctuation
        .replace(/\s+/g, ' ')     // Réduire espaces multiples
        .trim();
    }
    
    /**
     * Récupère les coordonnées pour un lieu
     */
    getLocationCoordinates(place) {
      // Nettoyer le nom du lieu
      const cleanPlace = this.cleanLocationName(place);
      
      // Chercher des correspondances partielles
      for (const [key, location] of Object.entries(this.knownLocations)) {
        if (cleanPlace.includes(key) || key.includes(cleanPlace)) {
          return location;
        }
      }
      
      // Vérifier s'il s'agit d'un aéroport (même si pas explicitement dans la liste)
      if (cleanPlace.includes('aeroport') || cleanPlace.includes('airport')) {
        return this.knownLocations['aéroport cdg']; // Aéroport par défaut
      }
      
      // Vérifier s'il s'agit d'une gare
      if (cleanPlace.includes('gare') || cleanPlace.includes('station')) {
        return this.knownLocations['gare du nord']; // Gare par défaut
      }
      
      // Si aucune correspondance, générér des coordonnées aléatoires
      // autour du centre-ville (pour la démonstration)
      return {
        lat: this.cityCenter.lat + (Math.random() - 0.5) * 0.05,
        lon: this.cityCenter.lon + (Math.random() - 0.5) * 0.05,
        name: "Lieu inconnu"
      };
    }
    
    /**
     * Estime localement un itinéraire sans API externe
     */
    estimateRouteLocally(origin, destination, stops = []) {
      // Obtenir les coordonnées
      const originCoords = this.getLocationCoordinates(origin);
      const destCoords = this.getLocationCoordinates(destination);
      
      console.log(`Estimation locale: ${origin} -> ${destination}`);
      console.log(`Coordonnées: ${JSON.stringify(originCoords)} -> ${JSON.stringify(destCoords)}`);
      
      // Calculer la distance à vol d'oiseau
      let totalDistance = this.calculateHaversineDistance(
        originCoords.lat, originCoords.lon,
        destCoords.lat, destCoords.lon
      );
      
      // Ajouter la distance pour les arrêts
      let prevPoint = originCoords;
      const legs = [];
      
      if (stops && stops.length > 0) {
        // Traiter les arrêts intermédiaires
        for (let i = 0; i < stops.length; i++) {
          const stopCoords = this.getLocationCoordinates(stops[i]);
          
          const legDistance = this.calculateHaversineDistance(
            prevPoint.lat, prevPoint.lon,
            stopCoords.lat, stopCoords.lon
          );
          
          totalDistance += legDistance;
          
          // Estimer la durée (à 30 km/h en moyenne)
          const legDuration = (legDistance / 1000) * (60 * 60 / 30);
          
          legs.push({
            startAddress: i === 0 ? origin : `Arrêt ${i}`,
            endAddress: `Arrêt ${i + 1}`,
            distance: legDistance,
            duration: legDuration
          });
          
          prevPoint = stopCoords;
        }
        
        // Ajouter le dernier segment jusqu'à la destination
        const finalLegDistance = this.calculateHaversineDistance(
          prevPoint.lat, prevPoint.lon,
          destCoords.lat, destCoords.lon
        );
        
        totalDistance += finalLegDistance;
        
        // Estimer la durée
        const finalLegDuration = (finalLegDistance / 1000) * (60 * 60 / 30);
        
        legs.push({
          startAddress: `Arrêt ${stops.length}`,
          endAddress: destination,
          distance: finalLegDistance,
          duration: finalLegDuration
        });
      } else {
        // S'il n'y a pas d'arrêts, ajouter simplement le segment direct
        const legDuration = (totalDistance / 1000) * (60 * 60 / 30);
        
        legs.push({
          startAddress: origin,
          endAddress: destination,
          distance: totalDistance,
          duration: legDuration
        });
      }
      
      // Appliquer un facteur de correction pour simuler les détours réels
      // Le facteur est plus élevé pour les longues distances
      let correctionFactor;
      
      if (totalDistance < 3000) { // Moins de 3 km
        correctionFactor = 1.3;   // 30% de plus pour trajets courts (rues non directes)
      } else if (totalDistance < 10000) { // Entre 3 et 10 km
        correctionFactor = 1.2;   // 20% de plus pour trajets moyens
      } else {
        correctionFactor = 1.1;   // 10% de plus pour longs trajets (plus directs)
      }
      
      // Vérifier si l'origine ou la destination est un aéroport
      const isAirportTrip = origin.toLowerCase().includes('aeroport') || 
                           destination.toLowerCase().includes('aeroport') ||
                           origin.toLowerCase().includes('airport') || 
                           destination.toLowerCase().includes('airport');
      
      // Ajuster le facteur de correction pour les trajets d'aéroport
      if (isAirportTrip) {
        correctionFactor = 1.15; // Les trajets d'aéroport sont généralement plus directs
      }
      
      // Appliquer le facteur de correction
      totalDistance = totalDistance * correctionFactor;
      
      // Mettre à jour les distances des segments
      legs.forEach(leg => {
        leg.distance *= correctionFactor;
      });
      
      // Estimer la durée totale (en fonction de la vitesse moyenne selon le moment de la journée)
      // Par défaut: 30 km/h en ville
      let averageSpeed = 30; // km/h
      
      // Ajuster la vitesse selon l'heure (heure de pointe vs heure creuse)
      const hour = new Date().getHours();
      if ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19)) {
        averageSpeed = 20; // Plus lent aux heures de pointe
      } else if (hour >= 22 || hour <= 5) {
        averageSpeed = 40; // Plus rapide la nuit
      }
      
      // Augmenter la vitesse pour les trajets hors zone urbaine
      const isUrbanTrip = this.isInUrbanArea(originCoords) && this.isInUrbanArea(destCoords);
      if (!isUrbanTrip) {
        averageSpeed += 20; // +20 km/h pour les trajets hors zone urbaine
      }
      
      // Calculer la durée en fonction de la distance et de la vitesse moyenne
      const totalDuration = (totalDistance / 1000) * (60 * 60 / averageSpeed);
      
      // Mettre à jour les durées des segments
      let durationSum = 0;
      legs.forEach(leg => {
        leg.duration = (leg.distance / 1000) * (60 * 60 / averageSpeed);
        durationSum += leg.duration;
      });
      
      return {
        distance: totalDistance,
        duration: totalDuration,
        legs: legs
      };
    }
    
    /**
     * Vérifie si un point est dans la zone urbaine
     */
    isInUrbanArea(coords) {
      const distance = this.calculateHaversineDistance(
        this.cityCenter.lat, this.cityCenter.lon,
        coords.lat, coords.lon
      );
      
      return distance <= this.centralRadius;
    }
    
    /**
     * Calcule la distance Haversine entre deux points
     */
    calculateHaversineDistance(lat1, lon1, lat2, lon2) {
      const R = 6371e3; // Rayon de la terre en mètres
      const φ1 = lat1 * Math.PI / 180;
      const φ2 = lat2 * Math.PI / 180;
      const Δφ = (lat2 - lat1) * Math.PI / 180;
      const Δλ = (lon2 - lon1) * Math.PI / 180;
      
      const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ/2) * Math.sin(Δλ/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      
      return R * c; // Distance en mètres
    }
    
    /**
     * Récupère les tarifs spécifiques d'une entreprise (méthode inchangée)
     */
    async getEntrepriseRates(entrepriseId) {
      try {
        // Si vous avez un module Entreprise, utilisez-le
        // Sinon, retournez les tarifs par défaut
        return this.defaultRates;
      } catch (error) {
        console.error("❌ Erreur récupération des tarifs entreprise:", error);
        return this.defaultRates;
      }
    }
    
    /**
     * Calcule les suppléments applicables à une course (méthode inchangée)
     */
    calculateSurcharges(
      rates, 
      date, 
      vehicleType, 
      luggageCount, 
      withPet, 
      isAirport,
      waitingTime
    ) {
      const surcharges = {};
      const surchargeDetails = {};
      
      // Vérifier si c'est la nuit (22h-6h)
      const hour = date.getHours();
      if (hour >= 22 || hour < 6) {
        surcharges.night = rates.nightSurcharge;
        surchargeDetails.night = {
          factor: rates.nightSurcharge,
          label: "Supplément de nuit (22h-6h)"
        };
      }
      
      // Vérifier si c'est le week-end
      const day = date.getDay();
      if (day === 0 || day === 6) {
        surcharges.weekend = rates.weekendSurcharge;
        surchargeDetails.weekend = {
          factor: rates.weekendSurcharge,
          label: "Supplément week-end"
        };
      }
      
      // Vérifier si c'est un jour férié
      const dateString = date.toISOString().split('T')[0];
      if (this.holidays.includes(dateString)) {
        surcharges.holiday = rates.holidaySurcharge;
        surchargeDetails.holiday = {
          factor: rates.holidaySurcharge,
          label: "Supplément jour férié"
        };
      }
      
      // Supplément pour bagages volumineux
      if (luggageCount > 0) {
        const luggageFee = Math.min(luggageCount, 3) * rates.luggageSurcharge;
        surcharges.luggage = luggageFee;
        surchargeDetails.luggage = {
          amount: luggageFee,
          label: `Supplément bagages (${luggageCount})`
        };
      }
      
      // Supplément pour animaux
      if (withPet) {
        surcharges.pet = rates.petSurcharge;
        surchargeDetails.pet = {
          amount: rates.petSurcharge,
          label: "Supplément animal"
        };
      }
      
      // Supplément pour aéroport
      if (isAirport) {
        surcharges.airport = rates.airportSurcharge;
        surchargeDetails.airport = {
          amount: rates.airportSurcharge,
          label: "Supplément aéroport"
        };
      }
      
      // Supplément pour véhicule premium
      if (vehicleType === "premium" || vehicleType === "van" || vehicleType === "luxury") {
        let factor = rates.premiumVehicleFactor;
        if (vehicleType === "luxury") factor = 2.0; // Luxe encore plus cher
        if (vehicleType === "van") factor = 1.3;    // Van un peu moins cher que premium
        
        surcharges.vehicle = factor;
        surchargeDetails.vehicle = {
          factor,
          label: `Supplément véhicule ${vehicleType}`
        };
      }
      
      // Supplément pour temps d'attente prévu
      if (waitingTime > 0) {
        const waitingFee = (waitingTime / 60) * rates.waitingPricePerHour;
        surcharges.waiting = waitingFee;
        surchargeDetails.waiting = {
          amount: waitingFee,
          label: `Temps d'attente (${waitingTime} min)`
        };
      }
      
      // Calculer le total des suppléments
      let surchargeTotal = 0;
      
      // Ajouter les suppléments fixes
      surchargeTotal += (surcharges.luggage || 0);
      surchargeTotal += (surcharges.pet || 0);
      surchargeTotal += (surcharges.airport || 0);
      surchargeTotal += (surcharges.waiting || 0);
      
      return {
        surcharges,
        surchargeTotal,
        surchargeDetails
      };
    }
    
    /**
     * Applique un code promo si valide (méthode inchangée)
     */
    async applyPromoCode(code, price, entrepriseId) {
      try {
        // Implémentez ici la vérification des codes promo
        // Pour le moment, on utilise un code de test 'WELCOME' pour une remise de 10%
        if (code === 'WELCOME') {
          const discount = price * 0.1;
          return {
            discount: Math.round(discount * 100) / 100,
            details: {
              code: 'WELCOME',
              type: 'percentage',
              value: 10,
              label: 'Code de bienvenue (10%)'
            }
          };
        }
        
        return {
          discount: 0,
          details: {}
        };
      } catch (error) {
        console.error("❌ Erreur application code promo:", error);
        return { discount: 0, details: {} };
      }
    }
  }
  
  // Exporter une instance unique de l'estimateur
  module.exports = new LocalPriceEstimator();