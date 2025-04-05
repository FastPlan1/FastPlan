import React, { useContext } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { AuthContext } from "../context/AuthContext";

const DashboardScreen = ({ navigation }) => {
  const { user, logout } = useContext(AuthContext);

  return (
    <View style={styles.container}>
      <Text style={styles.greeting}>
        🚖 Bonjour, {user?.name || "Utilisateur"} !
      </Text>
      <Text style={styles.welcome}>Bienvenue sur le tableau de bord</Text>

      <View style={styles.buttonsContainer}>
        {user?.role === "patron" ? (
          <>
            <TouchableOpacity
              style={styles.button}
              onPress={() => navigation.navigate("📅 Planning Général")}
            >
              <Text style={styles.buttonText}>📅 Planning Général</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.button}
              onPress={() => navigation.navigate("🚖 Mon Planning")}
            >
              <Text style={styles.buttonText}>🚖 Mon Planning</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={styles.button}
            onPress={() => navigation.navigate("🚖 Mon Planning")}
          >
            <Text style={styles.buttonText}>🚖 Mon Planning</Text>
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity style={[styles.button, styles.logoutButton]} onPress={logout}>
        <Text style={styles.buttonText}>🚪 Se déconnecter</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f2f2f2",
    padding: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  greeting: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 10,
    textAlign: "center",
  },
  welcome: {
    fontSize: 16,
    color: "#666",
    marginBottom: 30,
    textAlign: "center",
  },
  buttonsContainer: {
    width: "100%",
    marginBottom: 30,
  },
  button: {
    backgroundColor: "#007bff",
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 5,
    // Ombre légère pour iOS et Android
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
  },
  logoutButton: {
    backgroundColor: "#dc3545",
    width: "100%",
  },
});

export default DashboardScreen;
