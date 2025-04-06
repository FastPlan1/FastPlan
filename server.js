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

connectDB()
  .then(() => {
    console.log("✅ Connexion MongoDB réussie !");

    const app = express();
    const server = http.createServer(app);
    const io = new Server(server, {
      cors: {
        origin: [
          "http://localhost:8081",
          "http://172.20.10.2:8081",
          "https://chipper-buttercream-f5e4b1.netlify.app", // ✅ ton site client Netlify
        ],
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
        credentials: true,
      },
    });

    // ✅ Socket.IO
    io.on("connection", (socket) => {
      console.log("🟢 Nouveau client connecté :", socket.id);

      socket.on("joinRoom", (roomId) => {
        socket.join(roomId);
        console.log(`👥 Socket ${socket.id} rejoint la salle ${roomId}`);
      });

      socket.on("sendMessage", (data) => {
        io.to(data.conversationId).emit("newMessage", data);
      });

      socket.on("disconnect", () => {
        console.log("🔴 Déconnexion :", socket.id);
      });
    });

    // ✅ Middlewares
    app.use(cors({
      origin: [
        "http://localhost:8081",
        "http://172.20.10.2:8081",
        "https://chipper-buttercream-f5e4b1.netlify.app",
      ],
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
      credentials: true,
    }));
    app.use(express.json());
    app.use(morgan("dev"));

    // ✅ Fichiers statiques (uploads)
    app.use("/uploads", express.static(path.join(__dirname, "uploads")));

    console.log("✅ Middlewares activés avec gestion CORS, JSON et logs HTTP !");

    // ✅ Import des routes
    const authRoutes = require("./routes/authRoutes");
    const clientsRoutes = require("./routes/clientsRoutes");
    const coursesRoutes = require("./routes/coursesRoutes");
    const planningRoutes = require("./routes/planningRoutes");
    const chatRoutes = require("./routes/chatRoutes");
    const employeeRoutes = require("./routes/employeeRoutes");
    const invitationRoutes = require("./routes/invitationRoutes");
    const reservationRoutes = require("./routes/reservationRoutes");
    const notificationsRoutes = require("./routes/notificationsRoutes"); // ✅ Notification

    // ✅ Utilisation des routes
    app.use("/api/auth", authRoutes);
    app.use("/api/clients", clientsRoutes);
    app.use("/api/courses", coursesRoutes);
    app.use("/api/planning", planningRoutes);
    app.use("/api/chat", chatRoutes);
    app.use("/api/employees", employeeRoutes);
    app.use("/api/invitation", invitationRoutes);
    app.use("/api/reservations", reservationRoutes);
    app.use("/api/notifications", notificationRoutes); // ✅ Notifications

    // ✅ Route de test
    app.get("/", (req, res) => res.send("🚀 Serveur opérationnel et prêt à l'emploi !"));

    // ✅ Route non trouvée
    app.use("*", (req, res) => {
      res.status(404).json({ error: "❌ Route non trouvée" });
    });

    // ✅ Erreur serveur
    app.use((err, req, res, next) => {
      console.error("❌ Erreur serveur :", err.message);
      res.status(500).json({ error: err.message || "Erreur serveur interne" });
    });

    // ✅ Lancement du serveur
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => {
      console.log(`🚀 Serveur démarré sur le port ${PORT} et prêt à l'emploi avec Socket.IO activé !`);
    });
  })
  .catch((err) => {
    console.error("❌ Échec de connexion MongoDB :", err);
    process.exit(1);
  });
