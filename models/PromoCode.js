const mongoose = require("mongoose");

const promoCodeSchema = new mongoose.Schema({
  entrepriseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Entreprise",
    required: true,
    index: true
  },
  code: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
    unique: true
  },
  type: {
    type: String,
    enum: ["percentage", "fixed", "free"],
    required: true,
    default: "percentage"
  },
  value: {
    type: Number,
    required: true,
    min: 0
  },
  maxValue: {
    type: Number,
    min: 0
  },
  minOrderAmount: {
    type: Number,
    min: 0,
    default: 0
  },
  description: {
    type: String,
    trim: true
  },
  usageLimit: {
    type: Number,
    min: 1
  },
  usageCount: {
    type: Number,
    default: 0,
    min: 0
  },
  limitPerUser: {
    type: Number,
    min: 1,
    default: 1
  },
  isActive: {
    type: Boolean,
    default: true
  },
  validFrom: {
    type: Date,
    default: Date.now
  },
  validUntil: {
    type: Date
  },
  forNewCustomersOnly: {
    type: Boolean,
    default: false
  },
  applicableVehicleTypes: {
    type: [String],
    default: ['standard', 'premium', 'van', 'luxury']
  },
  excludedDays: {
    type: [Number],
    default: []
  },
  excludedHours: {
    type: [{
      start: Number,
      end: Number
    }],
    default: []
  },
  firstRideOnly: {
    type: Boolean,
    default: false
  },
  usedBy: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    clientId: {
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Client"
    },
    usageCount: {
      type: Number,
      default: 1
    },
    lastUsed: {
      type: Date,
      default: Date.now
    }
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }
}, { timestamps: true });

// Index pour recherche plus rapide
promoCodeSchema.index({ code: 1 });
promoCodeSchema.index({ isActive: 1 });
promoCodeSchema.index({ validUntil: 1 });

/**
 * Vérifie si un code promo est valide et applicable
 */
promoCodeSchema.methods.isValid = function(user, client, orderAmount, vehicleType, orderDate) {
  // Vérifier si le code est actif
  if (!this.isActive) return false;
  
  // Vérifier la période de validité
  const now = orderDate || new Date();
  if (this.validFrom && now < this.validFrom) return false;
  if (this.validUntil && now > this.validUntil) return false;
  
  // Vérifier si la limite d'utilisation globale est atteinte
  if (this.usageLimit && this.usageCount >= this.usageLimit) return false;
  
  // Vérifier le montant minimum de commande
  if (this.minOrderAmount && orderAmount < this.minOrderAmount) return false;
  
  // Vérifier le type de véhicule
  if (vehicleType && this.applicableVehicleTypes.length > 0 && 
      !this.applicableVehicleTypes.includes(vehicleType)) {
    return false;
  }
  
  // Vérifier les jours exclus
  if (this.excludedDays.length > 0 && this.excludedDays.includes(now.getDay())) {
    return false;
  }
  
  // Vérifier les heures exclues
  const currentHour = now.getHours();
  if (this.excludedHours.length > 0) {
    for (const timeSlot of this.excludedHours) {
      if (currentHour >= timeSlot.start && currentHour < timeSlot.end) {
        return false;
      }
    }
  }
  
  // Si le code est pour les nouveaux clients uniquement
  if (this.forNewCustomersOnly) {
    // Logique pour vérifier si c'est un nouveau client
    // Cela dépend de votre implémentation
  }
  
  // Si le code est pour la première course uniquement
  if (this.firstRideOnly) {
    // Logique pour vérifier si c'est la première course du client
    // Cela dépend de votre implémentation
  }
  
  // Vérifier la limite par utilisateur
  if (user || client) {
    const userId = user ? user._id.toString() : null;
    const clientId = client ? client._id.toString() : null;
    
    const userUsage = this.usedBy.find(u => 
      (userId && u.userId && u.userId.toString() === userId) ||
      (clientId && u.clientId && u.clientId.toString() === clientId)
    );
    
    if (userUsage && this.limitPerUser && userUsage.usageCount >= this.limitPerUser) {
      return false;
    }
  }
  
  return true;
};

/**
 * Calcule la remise applicable
 */
promoCodeSchema.methods.calculateDiscount = function(orderAmount) {
  if (this.type === "percentage") {
    let discount = (orderAmount * this.value) / 100;
    
    // Appliquer la valeur max si définie
    if (this.maxValue && discount > this.maxValue) {
      discount = this.maxValue;
    }
    
    return discount;
  } else if (this.type === "fixed") {
    // Pour un montant fixe, retourner la valeur (mais pas plus que le montant de la commande)
    return Math.min(this.value, orderAmount);
  } else if (this.type === "free") {
    // Pour une course gratuite, retourner le montant total
    return orderAmount;
  }
  
  return 0;
};

/**
 * Enregistre l'utilisation du code promo
 */
promoCodeSchema.methods.recordUsage = async function(user, client) {
  const userId = user ? user._id : null;
  const clientId = client ? client._id : null;
  
  // Incrémenter le compteur global
  this.usageCount += 1;
  
  // Rechercher l'utilisateur dans la liste des utilisations
  const userIndex = this.usedBy.findIndex(u => 
    (userId && u.userId && u.userId.toString() === userId.toString()) ||
    (clientId && u.clientId && u.clientId.toString() === clientId.toString())
  );
  
  if (userIndex === -1) {
    // Premier usage pour cet utilisateur
    this.usedBy.push({
      userId,
      clientId,
      usageCount: 1,
      lastUsed: new Date()
    });
  } else {
    // Incrémenter le compteur pour cet utilisateur
    this.usedBy[userIndex].usageCount += 1;
    this.usedBy[userIndex].lastUsed = new Date();
  }
  
  // Enregistrer les modifications
  return this.save();
};

module.exports = mongoose.model("PromoCode", promoCodeSchema);
