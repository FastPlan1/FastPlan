const socketIO = require("socket.io");
const jwt = require("jsonwebtoken");
const User = require("./models/User");

// Stockage des utilisateurs connectés
const connectedUsers = new Map();

// Configuration et gestion de Socket.IO
function setupSocketIO(server) {
  const io = socketIO(server, {
    cors: {
      origin: process.env.NODE_ENV === "production" 
        ? false 
        : ["http://localhost:3000", "http://localhost:8000"],
      methods: ["GET", "POST"],
      credentials: true
    }
  });

  // Middleware d'authentification pour Socket.IO
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.query.token;
    
    if (!token) {
      return next(new Error("Authentification requise"));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select("-password");
      
      if (!user) {
        return next(new Error("Utilisateur non trouvé"));
      }
      
      socket.user = {
        id: user._id.toString(),
        name: user.name,
        role: user.role,
        entrepriseId: user.entrepriseId ? user.entrepriseId.toString() : null
      };
      
      next();
    } catch (err) {
      return next(new Error("Token non valide"));
    }
  });

  io.on("connection", (socket) => {
    console.log(`👤 Utilisateur connecté: ${socket.user.name} (${socket.user.role})`);
    
    // Stocker la connexion de l'utilisateur
    connectedUsers.set(socket.user.id, {
      socketId: socket.id,
      user: socket.user,
      lastActive: new Date()
    });
    
    // Rejoindre les groupes appropriés
    socket.join(`user:${socket.user.id}`);
    
    if (socket.user.entrepriseId) {
      socket.join(`entreprise:${socket.user.entrepriseId}`);
      
      // Les chauffeurs rejoignent un groupe spécifique
      if (socket.user.role === "chauffeur") {
        socket.join(`chauffeurs:${socket.user.entrepriseId}`);
      }
      
      // Les admins et patrons rejoignent un groupe spécifique
      if (socket.user.role === "admin" || socket.user.role === "patron") {
        socket.join(`admins:${socket.user.entrepriseId}`);
      }
    }
    
    // Émettre la liste des utilisateurs en ligne à l'entreprise
    if (socket.user.entrepriseId) {
      const onlineUsers = Array.from(connectedUsers.values())
        .filter(u => u.user.entrepriseId === socket.user.entrepriseId)
        .map(u => ({
          id: u.user.id,
          name: u.user.name,
          role: u.user.role,
          lastActive: u.lastActive
        }));
      
      io.to(`entreprise:${socket.user.entrepriseId}`).emit("online-users", onlineUsers);
    }
    
    // Recevoir les mises à jour de position du chauffeur et les transmettre
    socket.on("position-update", (position) => {
      if (socket.user.role !== "chauffeur" && socket.user.role !== "patron") {
        return;
      }
      
      const { latitude, longitude } = position;
      
      if (typeof latitude !== "number" || typeof longitude !== "number") {
        return;
      }
      
      // Mettre à jour la dernière activité
      if (connectedUsers.has(socket.user.id)) {
        connectedUsers.get(socket.user.id).lastActive = new Date();
      }
      
      // Transmettre aux administrateurs et patrons de l'entreprise
      if (socket.user.entrepriseId) {
        io.to(`admins:${socket.user.entrepriseId}`).emit("chauffeur-position", {
          chauffeurId: socket.user.id,
          name: socket.user.name,
          position: {
            latitude,
            longitude,
            timestamp: new Date()
          }
        });
      }
    });
    
    // Recevoir les mises à jour de statut du trajet
    socket.on("trip-status-update", (data) => {
      const { tripId, status } = data;
      
      if (!tripId || !status) {
        return;
      }
      
      // Diffuser à tous les membres de l'entreprise
      if (socket.user.entrepriseId) {
        io.to(`entreprise:${socket.user.entrepriseId}`).emit("trip-status-changed", {
          tripId,
          status,
          updatedBy: {
            id: socket.user.id,
            name: socket.user.name
          },
          timestamp: new Date()
        });
      }
    });
    
    // Envoyer une notification
    socket.on("send-notification", (data) => {
      const { recipientId, type, message, data: notifData } = data;
      
      if (!recipientId || !type || !message) {
        return;
      }
      
      // Envoyer à un utilisateur spécifique
      io.to(`user:${recipientId}`).emit("notification", {
        type,
        message,
        data: notifData,
        from: {
          id: socket.user.id,
          name: socket.user.name
        },
        timestamp: new Date()
      });
    });
    
    // Garder trace de l'activité
    socket.on("user-activity", () => {
      if (connectedUsers.has(socket.user.id)) {
        connectedUsers.get(socket.user.id).lastActive = new Date();
      }
    });
    
    // Gérer la déconnexion
    socket.on("disconnect", () => {
      console.log(`👋 Utilisateur déconnecté: ${socket.user.name}`);
      
      // Retirer l'utilisateur de la liste des connectés
      connectedUsers.delete(socket.user.id);
      
      // Informer les autres utilisateurs de l'entreprise
      if (socket.user.entrepriseId) {
        const onlineUsers = Array.from(connectedUsers.values())
          .filter(u => u.user.entrepriseId === socket.user.entrepriseId)
          .map(u => ({
            id: u.user.id,
            name: u.user.name,
            role: u.user.role,
            lastActive: u.lastActive
          }));
        
        io.to(`entreprise:${socket.user.entrepriseId}`).emit("online-users", onlineUsers);
      }
    });
  });

  return io;
}

// Fonction pour envoyer une notification à un utilisateur spécifique
function notifyUser(io, userId, type, message, data = {}) {
  io.to(`user:${userId}`).emit("notification", {
    type,
    message,
    data,
    timestamp: new Date()
  });
}

// Fonction pour envoyer une notification à une entreprise
function notifyEntreprise(io, entrepriseId, type, message, data = {}, excludeUserId = null) {
  // Si un ID d'utilisateur à exclure est fourni, on envoie à tous sauf lui
  if (excludeUserId) {
    const roomSockets = io.sockets.adapter.rooms.get(`entreprise:${entrepriseId}`);
    
    if (roomSockets) {
      for (const socketId of roomSockets) {
        const socket = io.sockets.sockets.get(socketId);
        
        if (socket && socket.user && socket.user.id !== excludeUserId) {
          socket.emit("notification", {
            type,
            message,
            data,
            timestamp: new Date()
          });
        }
      }
    }
  } else {
    // Sinon, on envoie à toute l'entreprise
    io.to(`entreprise:${entrepriseId}`).emit("notification", {
      type,
      message,
      data,
      timestamp: new Date()
    });
  }
}

// Fonction pour envoyer une mise à jour de position à tous les admins/patrons
function broadcastChauffeurPosition(io, entrepriseId, chauffeurId, name, position) {
  io.to(`admins:${entrepriseId}`).emit("chauffeur-position", {
    chauffeurId,
    name,
    position: {
      ...position,
      timestamp: new Date()
    }
  });
}

// Fonction pour envoyer une mise à jour de statut d'un trajet
function broadcastTripStatusUpdate(io, entrepriseId, tripId, status, updatedBy) {
  io.to(`entreprise:${entrepriseId}`).emit("trip-status-changed", {
    tripId,
    status,
    updatedBy,
    timestamp: new Date()
  });
}

// Fonction pour récupérer les utilisateurs en ligne d'une entreprise
function getOnlineUsers(entrepriseId) {
  return Array.from(connectedUsers.values())
    .filter(u => u.user.entrepriseId === entrepriseId)
    .map(u => ({
      id: u.user.id,
      name: u.user.name,
      role: u.user.role,
      lastActive: u.lastActive
    }));
}

module.exports = {
  setupSocketIO,
  notifyUser,
  notifyEntreprise,
  broadcastChauffeurPosition,
  broadcastTripStatusUpdate,
  getOnlineUsers
};