const mongoose = require("mongoose");

const courierAssignmentSchema = new mongoose.Schema({
  chauffeurId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  status: {
    type: String,
    enum: ["pending", "accepted", "declined", "reassigned"],
    default: "pending"
  },
  assignedAt: {
    type: Date,
    default: Date.now
  },
  acceptedAt: {
    type: Date
  },
  declinedAt: {
    type: Date
  },
  declineReason: {
    type: String
  },
  notes: {
    type: String
  }
}, { _id: false });

const planningEntrySchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  tripId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Trip"
  },
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Client"
  },
  externalChauffeur: {
    companyName: {
      type: String,
      trim: true
    },
    chauffeurName: {
      type: String,
      trim: true
    },
    contact: {
      type: String,
      trim: true
    },
    externalId: {
      type: String,
      trim: true
    }
  },
  isExternal: {
    type: Boolean,
    default: false
  },
  startDateTime: {
    type: Date,
    required: true
  },
  endDateTime: {
    type: Date
  },
  estimatedDuration: {
    type: Number,  // en minutes
    min: 0
  },
  pickup: {
    address: {
      type: String,
      required: true,
      trim: true
    },
    latitude: Number,
    longitude: Number,
    details: String
  },
  destination: {
    address: {
      type: String,
      required: true,
      trim: true
    },
    latitude: Number,
    longitude: Number,
    details: String
  },
  stops: [{
    address: {
      type: String,
      required: true,
      trim: true
    },
    latitude: Number,
    longitude: Number,
    details: String
  }],
  price: {
    type: Number,
    min: 0
  },
  isFixedPrice: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ["scheduled", "in_progress", "completed", "cancelled", "no_show"],
    default: "scheduled"
  },
  isRecurring: {
    type: Boolean,
    default: false
  },
  recurrencePattern: {
    frequency: {
      type: String,
      enum: ["daily", "weekly", "monthly", "custom"],
    },
    daysOfWeek: [Number], // 0 = Dimanche, 1 = Lundi, etc.
    interval: {
      type: Number,
      default: 1
    },
    endDate: Date,
    occurrences: Number
  },
  priority: {
    type: String,
    enum: ["low", "normal", "high", "urgent"],
    default: "normal"
  },
  assignedTo: [courierAssignmentSchema],
  notes: {
    public: { // visible par les chauffeurs
      type: String,
      trim: true
    },
    private: { // visible uniquement par les admins/patrons
      type: String,
      trim: true
    }
  },
  clientNotes: { // notes spécifiques au client
    type: String,
    trim: true
  },
  fromReservation: {
    type: Boolean,
    default: false
  },
  reservationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "DemandeReservation"
  },
  color: {
    type: String,
    default: "#3788d8"
  },
  tags: [{
    type: String,
    trim: true
  }],
  attachments: [{
    name: String,
    url: String,
    type: String,
    size: Number,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  notifications: {
    reminderSent: {
      type: Boolean,
      default: false
    },
    confirmationSent: {
      type: Boolean,
      default: false
    },
    clientNotified: {
      type: Boolean,
      default: false
    }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  sharedWith: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    permission: {
      type: String,
      enum: ["read", "write"],
      default: "read"
    }
  }]
}, { timestamps: true });

// Index sur les champs fréquemment interrogés
planningEntrySchema.index({ startDateTime: 1 });
planningEntrySchema.index({ "assignedTo.chauffeurId": 1, startDateTime: 1 });
planningEntrySchema.index({ clientId: 1 });
planningEntrySchema.index({ status: 1 });
planningEntrySchema.index({ fromReservation: 1, reservationId: 1 });
planningEntrySchema.index({ createdBy: 1 });

const planningSchema = new mongoose.Schema({
  entrepriseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Entreprise",
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ["general", "personal", "team"],
    default: "general"
  },
  chauffeurId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  teamIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }],
  entries: [planningEntrySchema],
  visibility: {
    type: String,
    enum: ["public", "private", "team"],
    default: "private"
  },
  color: {
    type: String,
    default: "#3788d8"
  },
  isActive: {
    type: Boolean,
    default: true
  },
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  sharedWith: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    permission: {
      type: String,
      enum: ["read", "write", "admin"],
      default: "read"
    }
  }],
  settings: {
    defaultView: {
      type: String,
      enum: ["day", "week", "month", "agenda"],
      default: "week"
    },
    workingHours: {
      start: {
        type: String,
        default: "08:00"
      },
      end: {
        type: String,
        default: "18:00"
      }
    },
    workingDays: {
      type: [Number],
      default: [1, 2, 3, 4, 5] // Lundi à Vendredi par défaut
    },
    slotDuration: {
      type: String,
      default: "00:30" // 30 minutes par défaut
    },
    allowOverlap: {
      type: Boolean,
      default: false
    },
    showWeekends: {
      type: Boolean,
      default: false
    },
    autoConfirm: {
      type: Boolean,
      default: false
    },
    autoAssignLogic: {
      type: String,
      enum: ["closest", "load_balancing", "manual", "none"],
      default: "none"
    }
  }
}, { timestamps: true });

// Méthode pour vérifier si un créneau est disponible
planningSchema.methods.isSlotAvailable = async function(chauffeurId, startDateTime, endDateTime) {
  const overlappingEntries = this.entries.filter(entry => {
    // Vérifier si le chauffeur est assigné à cette entrée
    const isAssigned = entry.assignedTo.some(
      assignment => assignment.chauffeurId.toString() === chauffeurId.toString() &&
      assignment.status !== "declined"
    );
    
    if (!isAssigned) return false;
    
    // Vérifier si le créneau chevauche cette entrée
    const entryStart = new Date(entry.startDateTime);
    const entryEnd = entry.endDateTime ? new Date(entry.endDateTime) : 
      new Date(entryStart.getTime() + (entry.estimatedDuration || 60) * 60000);
    
    return (
      (startDateTime < entryEnd && endDateTime > entryStart) &&
      entry.status !== "cancelled" && 
      entry.status !== "completed"
    );
  });
  
  return overlappingEntries.length === 0;
};

// Méthode pour trouver le chauffeur disponible le plus proche
planningSchema.statics.findClosestAvailableChauffeur = async function(
  entrepriseId, 
  startDateTime, 
  endDateTime, 
  pickupLocation
) {
  const User = mongoose.model("User");
  
  // Récupérer tous les chauffeurs actifs de l'entreprise
  const chauffeurs = await User.find({
    entrepriseId,
    role: "chauffeur",
    isActive: true
  }).select("_id name latitude longitude lastLocationUpdate");
  
  const availableChauffeurs = [];
  
  // Pour chaque chauffeur, vérifier sa disponibilité
  for (const chauffeur of chauffeurs) {
    const plannings = await this.find({
      $or: [
        { type: "general" },
        { chauffeurId: chauffeur._id }
      ],
      entrepriseId
    });
    
    // Vérifier si le chauffeur est déjà occupé dans ce créneau
    let isAvailable = true;
    for (const planning of plannings) {
      if (!await planning.isSlotAvailable(chauffeur._id, startDateTime, endDateTime)) {
        isAvailable = false;
        break;
      }
    }
    
    if (isAvailable) {
      // Calculer la distance si on a des coordonnées
      let distance = null;
      if (
        chauffeur.latitude && 
        chauffeur.longitude && 
        pickupLocation && 
        pickupLocation.latitude && 
        pickupLocation.longitude
      ) {
        // Formule de Haversine pour calculer la distance
        const R = 6371; // Rayon de la Terre en km
        const dLat = (pickupLocation.latitude - chauffeur.latitude) * Math.PI / 180;
        const dLon = (pickupLocation.longitude - chauffeur.longitude) * Math.PI / 180;
        const a = 
          Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(chauffeur.latitude * Math.PI / 180) * 
          Math.cos(pickupLocation.latitude * Math.PI / 180) * 
          Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        distance = R * c;
      }
      
      availableChauffeurs.push({
        chauffeur,
        distance,
        lastLocationUpdate: chauffeur.lastLocationUpdate
      });
    }
  }
  
  // Trier par distance (si disponible) ou par dernière mise à jour de position
  availableChauffeurs.sort((a, b) => {
    if (a.distance !== null && b.distance !== null) {
      return a.distance - b.distance;
    } else if (a.lastLocationUpdate && b.lastLocationUpdate) {
      return new Date(b.lastLocationUpdate) - new Date(a.lastLocationUpdate);
    } else {
      return 0;
    }
  });
  
  return availableChauffeurs;
};

// Méthode pour créer des entrées récurrentes
planningSchema.methods.createRecurringEntries = async function(baseEntry, recurrencePattern, count = 10) {
  const entries = [];
  
  // Copier les propriétés de l'entrée de base
  const baseCopy = { ...baseEntry.toObject() };
  delete baseCopy._id;
  
  const startDate = new Date(baseEntry.startDateTime);
  
  // Générer les occurrences en fonction du modèle de récurrence
  for (let i = 1; i <= count; i++) {
    const newEntry = { ...baseCopy };
    let newStartDate;
    
    switch (recurrencePattern.frequency) {
      case 'daily':
        newStartDate = new Date(startDate);
        newStartDate.setDate(startDate.getDate() + (i * recurrencePattern.interval));
        break;
        
      case 'weekly':
        newStartDate = new Date(startDate);
        newStartDate.setDate(startDate.getDate() + (i * 7 * recurrencePattern.interval));
        break;
        
      case 'monthly':
        newStartDate = new Date(startDate);
        newStartDate.setMonth(startDate.getMonth() + (i * recurrencePattern.interval));
        break;
        
      case 'custom':
        // Pour les récurrences personnalisées, on devrait implémenter une logique spécifique
        continue;
    }
    
    // Vérifier si la date est dans les jours de la semaine autorisés
    if (recurrencePattern.daysOfWeek && recurrencePattern.daysOfWeek.length > 0) {
      const dayOfWeek = newStartDate.getDay();
      if (!recurrencePattern.daysOfWeek.includes(dayOfWeek)) {
        continue; // Passer cette date si le jour de la semaine n'est pas autorisé
      }
    }
    
    // Vérifier si on a dépassé la date de fin de récurrence
    if (recurrencePattern.endDate && newStartDate > new Date(recurrencePattern.endDate)) {
      break;
    }
    
    // Mise à jour des dates
    newEntry.startDateTime = newStartDate;
    if (newEntry.endDateTime) {
      const duration = new Date(baseEntry.endDateTime) - new Date(baseEntry.startDateTime);
      newEntry.endDateTime = new Date(newStartDate.getTime() + duration);
    }
    
    // Ajouter à la liste des entrées
    entries.push(newEntry);
  }
  
  // Ajouter les entrées au planning
  this.entries.push(...entries);
  
  return entries;
};

module.exports = mongoose.model("Planning", planningSchema);