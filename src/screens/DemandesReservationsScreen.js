import React, { useEffect, useState, useContext } from "react";
import { View, Text, ScrollView, Alert, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import axios from "axios";
import { AuthContext } from "../context/AuthContext";
import { API_BASE_URL } from "../config";
import moment from "moment";

const DemandesReservationsScreen = () => {
  const { user } = useContext(AuthContext);
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReservations();
  }, []);

  const fetchReservations = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/reservations/entreprise/${user.entrepriseId}`);
      console.log("📦 Réservations reçues :", res.data); // 👈 debug ici
      setReservations(res.data);
    } catch (error) {
      console.error("❌ Erreur récupération réservations :", error); // 👈 log erreur
      Alert.alert("Erreur", "Impossible de récupérer les réservations.");
    } finally {
      setLoading(false);
    }
  };
  

  const handleAccept = async (id) => {
    try {
      await axios.put(`${API_BASE_URL}/reservations/accepter/${id}`);
      Alert.alert("✅ Réservation acceptée");
      fetchReservations();
    } catch (error) {
      Alert.alert("Erreur", "Impossible d'accepter cette réservation.");
    }
  };

  const handleRefuse = async (id) => {
    try {
      await axios.put(`${API_BASE_URL}/reservations/refuser/${id}`);
      Alert.alert("❌ Réservation refusée");
      fetchReservations();
    } catch (error) {
      Alert.alert("Erreur", "Impossible de refuser cette réservation.");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>📩 Demandes de Réservations</Text>
      {loading ? (
        <ActivityIndicator size="large" color="#007bff" />
      ) : (
        <ScrollView>
          {reservations.length === 0 ? (
            <Text style={styles.noData}>Aucune réservation disponible.</Text>
          ) : (
            reservations.map((reservation) => (
              <View key={reservation._id} style={styles.card}>
                <Text style={styles.text}>
                  🧑 {reservation.nom} {reservation.prenom}
                </Text>
                <Text style={styles.text}>📅 {moment(reservation.date).format("LL")} à {reservation.heure}</Text>
                <Text style={styles.text}>📍 {reservation.depart} → {reservation.arrive}</Text>
                <Text style={styles.text}>📞 {reservation.telephone}</Text>
                <Text style={styles.text}>📧 {reservation.email}</Text>
                {reservation.description ? (
                  <Text style={styles.text}>📝 {reservation.description}</Text>
                ) : null}
                <Text style={styles.status}>Statut : {reservation.statut}</Text>
                {reservation.statut === "En attente" && (
                  <View style={styles.actions}>
                    <TouchableOpacity
                      style={[styles.btn, styles.accept]}
                      onPress={() => handleAccept(reservation._id)}
                    >
                      <Text style={styles.btnText}>✅ Accepter</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.btn, styles.refuse]}
                      onPress={() => handleRefuse(reservation._id)}
                    >
                      <Text style={styles.btnText}>❌ Refuser</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
};

export default DemandesReservationsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
    backgroundColor: "#f5f5f5",
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 10,
  },
  card: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 10,
    marginVertical: 5,
    elevation: 2,
  },
  text: {
    fontSize: 16,
    marginVertical: 2,
  },
  status: {
    fontWeight: "bold",
    marginTop: 5,
  },
  actions: {
    flexDirection: "row",
    marginTop: 10,
  },
  btn: {
    flex: 1,
    padding: 10,
    marginHorizontal: 5,
    borderRadius: 8,
  },
  accept: {
    backgroundColor: "#4caf50",
  },
  refuse: {
    backgroundColor: "#f44336",
  },
  btnText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "bold",
  },
  noData: {
    textAlign: "center",
    marginTop: 20,
    fontSize: 16,
  },
});
