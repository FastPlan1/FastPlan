const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log("✅ Connexion MongoDB réussie !");
    return conn;
  } catch (error) {
    console.error("❌ Erreur connexion MongoDB:", error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
