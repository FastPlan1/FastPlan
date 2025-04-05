import React, { useContext } from "react";
import { View, Text, StyleSheet } from "react-native";
import { AuthContext } from "../context/AuthContext";

const HomeScreen = () => {
  const { user, loading } = useContext(AuthContext);

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🏠 Accueil</Text>
      <Text style={styles.subtitle}>
        Connecté en tant que :{" "}
        <Text style={styles.userName}>
          {user?.name || user?.nom || "Utilisateur"}
        </Text>
      </Text>
      <Text style={styles.welcomeText}>
        Bienvenue dans l'application de gestion de planning !
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAFAFA", // Fond clair et doux
    justifyContent: "center",
    alignItems: "center",
    padding: 30,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 18,
    color: "#666",
  },
  title: {
    fontSize: 36,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 15,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 22,
    color: "#555",
    marginBottom: 25,
    textAlign: "center",
  },
  userName: {
    fontWeight: "bold",
    fontStyle: "italic",
    color: "#007bff",
  },
  welcomeText: {
    fontSize: 20,
    color: "#777",
    textAlign: "center",
    paddingHorizontal: 20,
    lineHeight: 28,
  },
});

export default HomeScreen;
