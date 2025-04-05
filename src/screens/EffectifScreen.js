import React, { useContext, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Platform,
} from "react-native";
import axios from "axios";
import * as ClipboardAPI from "expo-clipboard";
import { AuthContext } from "../context/AuthContext";
import { API_BASE_URL } from "../config";

const EffectifScreen = () => {
  const { user } = useContext(AuthContext);
  const [employees, setEmployees] = useState([]);
  const [codes, setCodes] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [loadingCodes, setLoadingCodes] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (user?.role === "patron" && user?.id) {
      fetchEmployees();
      fetchCodes();
    }
  }, [user]);

  const fetchEmployees = async () => {
    if (!user?.id) return;
    setLoadingEmployees(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/employees/by-patron/${user.id}`);
      setEmployees(res.data);
    } catch (err) {
      console.error("❌ Erreur chargement employés :", err);
      Alert.alert("Erreur", "Impossible de charger les employés.");
    } finally {
      setLoadingEmployees(false);
    }
  };

  const fetchCodes = async () => {
    if (!user?.id) return;
    setLoadingCodes(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/employees/codes/by-patron/${user.id}`);
      setCodes(res.data);
    } catch (err) {
      console.error("❌ Erreur chargement codes :", err);
      Alert.alert("Erreur", "Impossible de charger les codes.");
    } finally {
      setLoadingCodes(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchEmployees(), fetchCodes()]);
    setRefreshing(false);
  };

  const generateCode = async () => {
    if (!user?.id) {
      Alert.alert("❌ Erreur", "Impossible de générer un code : utilisateur non reconnu.");
      return;
    }
  
    try {
      console.log("📤 Envoi du patronId :", user.id); // Log temporaire
      const res = await axios.post(`${API_BASE_URL}/employees/generate-code`, {
        patronId: user.id,
      });
      Alert.alert("✅ Nouveau code généré", res.data.code);
      fetchCodes();
    } catch (err) {
      console.error("❌ Erreur API generate-code :", err.response?.data || err.message);
      Alert.alert("❌ Erreur", err.response?.data?.message || "Impossible de générer un code.");
    }
  };
  
  const copyReservationLink = async () => {
    if (!user?.entrepriseId) {
      Alert.alert("❌ Erreur", "Votre entrepriseId est manquant.");
      return;
    }

    const reservationLink = `https://chipper-buttercream-f5e4b1.netlify.app/?e=${user.entrepriseId}`;

    try {
      if (Platform.OS === "web") {
        await navigator.clipboard.writeText(reservationLink);
      } else {
        await ClipboardAPI.setStringAsync(reservationLink);
      }
      Alert.alert("📎 Lien copié", "Le lien de réservation a été copié dans le presse-papier.");
    } catch (err) {
      Alert.alert("❌ Erreur", "Impossible de copier le lien.");
    }
  };

  const renderEmployeeItem = ({ item }) => (
    <View style={styles.employeeCard}>
      <Text style={styles.employeeName}>{item.nom}</Text>
      <Text style={styles.employeeEmail}>{item.email}</Text>
    </View>
  );

  const renderCodeItem = ({ item }) => (
    <View style={styles.codeCard}>
      <Text style={styles.codeText}>• {item.code}</Text>
    </View>
  );

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.title}>👥 Mon effectif</Text>

      <Text style={styles.subtitle}>Employés enregistrés :</Text>
      {loadingEmployees ? (
        <ActivityIndicator size="large" color="#007bff" />
      ) : (
        <FlatList
          data={employees}
          keyExtractor={(item) => item._id}
          renderItem={renderEmployeeItem}
          contentContainerStyle={styles.listContainer}
          scrollEnabled={false}
        />
      )}

      <Text style={styles.subtitle}>Derniers codes générés :</Text>
      {loadingCodes ? (
        <ActivityIndicator size="large" color="#007bff" />
      ) : codes.length === 0 ? (
        <Text style={styles.noDataText}>Aucun code généré.</Text>
      ) : (
        <FlatList
          data={codes}
          keyExtractor={(item, index) => index.toString()}
          renderItem={renderCodeItem}
          contentContainerStyle={styles.listContainer}
          scrollEnabled={false}
        />
      )}

      <TouchableOpacity style={styles.generateButton} onPress={generateCode}>
        <Text style={styles.generateButtonText}>➕ Générer un nouveau code</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.copyButton} onPress={copyReservationLink}>
        <Text style={styles.generateButtonText}>📎 Copier le lien de réservation client</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#f7f7f7",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 15,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 18,
    color: "#555",
    marginVertical: 10,
  },
  listContainer: {
    paddingBottom: 20,
  },
  employeeCard: {
    backgroundColor: "#fff",
    padding: 15,
    marginBottom: 10,
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  employeeName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
  },
  employeeEmail: {
    fontSize: 14,
    color: "#666",
    marginTop: 4,
  },
  codeCard: {
    backgroundColor: "#e9ecef",
    padding: 10,
    marginBottom: 8,
    borderRadius: 8,
  },
  codeText: {
    fontSize: 16,
    color: "#333",
  },
  generateButton: {
    backgroundColor: "#28a745",
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },
  copyButton: {
    backgroundColor: "#007bff",
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  generateButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  noDataText: {
    fontStyle: "italic",
    color: "#777",
    marginVertical: 5,
  },
});

export default EffectifScreen;
