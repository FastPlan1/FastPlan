console.log("🚀 Le fichier server.js démarre...");

const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const morgan = require("morgan");
const http = require("http");
const { Server } = require("socket.io");
const connectDB = require("./config/db");
const path = require("path");

dotenv.config();

if (!process.env.JWT_SECRET || !process.env.MONGO_URI) {
  console.error("❌ Variables d'environnement manquantes (JWT_SECRET ou MONGO_URI)");
  process.exit(1);
}

console.log("🔑 Clé JWT utilisée : OK (cachée)");
console.log("🌍 MONGO_URI utilisée : OK (cachée)");

// Connexion à MongoDB
connectDB()
  .then(() => {
    console.log("✅ Connexion MongoDB réussie !");

    const app = express();
    const server = http.createServer(app);

    // Initialise Socket.IO
    const io = new Server(server, {
      cors: {
        origin: [
          "http://localhost:8081",
          "http://172.20.10.2:8081",
          "https://chipper-buttercream-f5e4b1.netlify.app",
        ],
        methods: ["GET","POST","PUT","PATCH","DELETE","OPTIONS"],
        allowedHeaders: ["Content‑Type","Authorization"],
        credentials: true,
      },
    });

    // Gestion des connexions Socket.IO
    io.on("connection", socket => {
      console.log("🟢 Nouveau client connecté :", socket.id);

      // Salle de chat/message
      socket.on("joinRoom", roomId => {
        socket.join(roomId);
        console.log(`👥 ${socket.id} a rejoint la salle ${roomId}`);
      });
      socket.on("sendMessage", data => {
        io.to(data.conversationId).emit("newMessage", data);
      });

      // --- NOUVEAU : géolocalisation temps‑réel ---
      socket.on("updateLocation", payload => {
        // payload = { id, lat, lng, status, name }
        // on rebroadcast à TOUS les clients managers
        io.emit("driverLocationUpdate", payload);
      });

      socket.on("disconnect", () => {
        console.log("🔴 Déconnexion :", socket.id);
      });
    });

    // === Middlewares Express ===
    app.use(cors({
      origin: [
        "http://localhost:8081",
        "http://172.20.10.2:8081",
        "https://chipper-buttercream-f5e4b1.netlify.app",
      ],
      methods: ["GET","POST","PUT","PATCH","DELETE","OPTIONS"],
      allowedHeaders: ["Content‑Type","Authorization"],
      credentials: true,
    }));
    app.use(express.json());
    app.use(morgan("dev"));

    // Fichiers statiques pour les uploads
    app.use("/uploads", express.static(path.join(__dirname, "uploads")));

    console.log("✅ Middlewares activés avec CORS, JSON, logs et upload statique");

    // === Tes routes existantes ===
    app.use("/api/auth", require("./routes/authRoutes"));
    app.use("/api/clients", require("./routes/clientsRoutes"));
    app.use("/api/courses", require("./routes/coursesRoutes"));
    app.use("/api/planning", require("./routes/planningRoutes"));
    app.use("/api/chat", require("./routes/chatRoutes"));
    app.use("/api/employees", require("./routes/employeeRoutes"));
    app.use("/api/invitation", require("./routes/invitationRoutes"));
    app.use("/api/reservations", require("./routes/reservationRoutes"));
    app.use("/api/notifications", require("./routes/notificationsRoutes"));

    // Route de test
    app.get("/", (req, res) =>
      res.send("🚀 Serveur opérationnel et prêt à l'emploi avec Socket.IO !")
    );

    // 404 & erreur
    app.use("*", (req, res) =>
      res.status(404).json({ error: "❌ Route non trouvée" })
    );
    app.use((err, req, res, next) => {
      console.error("❌ Erreur interne :", err.message);
      res.status(500).json({ error: err.message || "Erreur serveur interne" });
    });

    // Démarrage du serveur HTTP + Socket.IO
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () =>
      console.log(`🚀 Serveur démarré sur le port ${PORT} avec Socket.IO activé !`)
    );
  })
  .catch(err => {
    console.error("❌ Échec de connexion MongoDB :", err);
    process.exit(1);
  });
