import React, { useState, useEffect } from "react";
import { View, Text, FlatList, TextInput, TouchableOpacity, Alert, StyleSheet, ActivityIndicator } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function ManagerDashboardScreen() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const API_URL = "http://172.20.10.2:5000/api/employees"; 

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    const token = await AsyncStorage.getItem("userToken");
    try {
      const response = await fetch(API_URL, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();
      if (response.ok) {
        setEmployees(data);
      } else {
        Alert.alert("Erreur", data.message);
      }
    } catch (error) {
      Alert.alert("Erreur", "Impossible de récupérer les employés.");
    } finally {
      setLoading(false);
    }
  };

  const addEmployee = async () => {
    if (!name || !email || !password) {
      Alert.alert("Erreur", "Tous les champs sont obligatoires.");
      return;
    }

    const token = await AsyncStorage.getItem("userToken");
    try {
      const response = await fetch(`${API_URL}/add`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await response.json();
      if (response.ok) {
        Alert.alert("Succès", "Employé ajouté !");
        fetchEmployees();
        setName("");
        setEmail("");
        setPassword("");
      } else {
        Alert.alert("Erreur", data.message);
      }
    } catch (error) {
      Alert.alert("Erreur", "Impossible d'ajouter l'employé.");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>👥 Gestion des Employés</Text>

      {/* 🔹 Formulaire pour ajouter un employé */}
      <TextInput style={styles.input} placeholder="Nom" value={name} onChangeText={setName} />
      <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
      <TextInput style={styles.input} placeholder="Mot de passe" value={password} onChangeText={setPassword} secureTextEntry />

      <TouchableOpacity style={styles.button} onPress={addEmployee}>
        <Text style={styles.buttonText}>➕ Ajouter un employé</Text>
      </TouchableOpacity>

      {/* 🔹 Liste des employés */}
      {loading ? <ActivityIndicator size="large" color="#007bff" /> : (
        <FlatList
          data={employees}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <View style={styles.employeeCard}>
              <Text style={styles.employeeName}>{item.name} ({item.email})</Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#F5F5F5" },
  title: { fontSize: 22, fontWeight: "bold", marginBottom: 20 },
  input: { width: "100%", padding: 12, borderWidth: 1, borderColor: "#CCC", borderRadius: 8, marginBottom: 10, backgroundColor: "#FFF" },
  button: { backgroundColor: "#007bff", padding: 12, borderRadius: 8, alignItems: "center", marginBottom: 20 },
  buttonText: { color: "#FFF", fontSize: 16, fontWeight: "bold" },
  employeeCard: { backgroundColor: "#FFF", padding: 10, borderRadius: 5, marginBottom: 10 },
  employeeName: { fontSize: 16, fontWeight: "bold" },
});

