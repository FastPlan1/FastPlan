import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ScrollView,
} from "react-native";
import axios from "axios";
import { API_BASE_URL } from "../config";

const RegisterScreen = ({ navigation }) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");

  const handleRegister = async () => {
    if (!name || !email || !password) {
      Alert.alert("❌ Champs requis", "Veuillez remplir tous les champs.");
      return;
    }
    try {
      const res = await axios.post(`${API_BASE_URL}/auth/register`, {
        name,
        email,
        password,
        code: code.trim() || null,
      });
      Alert.alert("✅ Succès", res.data.message);
      navigation.navigate("Login");
    } catch (error) {
      console.error("❌ Erreur d'inscription :", error.response?.data || error.message);
      Alert.alert("❌ Erreur", error.response?.data?.message || "Erreur d'inscription.");
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Inscription</Text>
      <TextInput
        placeholder="Nom"
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholderTextColor="#666"
      />
      <TextInput
        placeholder="Email"
        style={styles.input}
        keyboardType="email-address"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
        placeholderTextColor="#666"
      />
      <TextInput
        placeholder="Mot de passe"
        style={styles.input}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        placeholderTextColor="#666"
      />
      <TextInput
        placeholder="Code d'invitation (si fourni)"
        style={styles.input}
        value={code}
        onChangeText={setCode}
        placeholderTextColor="#666"
      />
      <TouchableOpacity style={styles.button} onPress={handleRegister}>
        <Text style={styles.buttonText}>S'inscrire</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.navigate("Login")}>
        <Text style={styles.loginText}>✍️ Déjà inscrit ? Connectez-vous</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 30,
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 30,
    textAlign: "center",
    color: "#333",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 15,
    marginBottom: 20,
    fontSize: 16,
    color: "#333",
    backgroundColor: "#f9f9f9",
  },
  button: {
    backgroundColor: "#007bff",
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: "center",
    marginVertical: 20,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 3,
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  loginText: {
    color: "#007bff",
    textAlign: "center",
    fontSize: 16,
    textDecorationLine: "underline",
  },
});

export default RegisterScreen;
