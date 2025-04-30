// Ajout du schéma tarifSettings au modèle Entreprise.js

// À ajouter dans le schema Entreprise existant
const tarifSettingsSchema = {
  basePrice: {
    type: Number,
    default: 2.5,
    min: 0
  },
  pricePerKm: {
    type: Number,
    default: 1.05,
    min: 0
  },
  pricePerMinute: {
    type: Number,
    default: 0.35,
    min: 0
  },
  minimumPrice: {
    type: Number,
    default: 7.0,
    min: 0
  },
  nightSurcharge: {
    type: Number,
    default: 1.5,
    min: 1
  },
  weekendSurcharge: {
    type: Number,
    default: 1.2,
    min: 1
  },
  holidaySurcharge: {
    type: Number,
    default: 1.5,
    min: 1
  },
  luggageSurcharge: {
    type: Number,
    default: 2.0,
    min: 0
  },
  petSurcharge: {
    type: Number,
    default: 5.0,
    min: 0
  },
  airportSurcharge: {
    type: Number,
    default: 5.0,
    min: 0
  },
  premiumVehicleFactor: {
    type: Number,
    default: 1.5,
    min: 1
  },
  waitingPricePerHour: {
    type: Number,
    default: 20,
    min: 0
  },
  customZones: [{
    name: {
      type: String,
      required: true,
      trim: true
    },
    fixedPrice: {
      type: Number,
      required: true,
      min: 0
    },
    fromLatitude: Number,
    fromLongitude: Number,
    toLatitude: Number,
    toLongitude: Number,
    radius: Number
  }]
};

// Dans le modèle Entreprise, ajouter:
// tarifSettings: tarifSettingsSchema,