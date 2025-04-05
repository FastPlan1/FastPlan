import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  Linking,
  RefreshControl,
  ScrollView,
} from "react-native";
import axios from "axios";
import moment from "moment";
import { API_BASE_URL } from "../config";

const HistoriqueScreen = () => {
  const [courses, setCourses] = useState([]);
  const [prixModifies, setPrixModifies] = useState({});
  const [refreshing, setRefreshing] = useState(false);
  // Pour la navigation par date
  const [currentDateIndex, setCurrentDateIndex] = useState(0);

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/planning/terminees`);
      setCourses(res.data);
    } catch (error) {
      console.error("❌ Erreur récupération historique :", error.response?.data || error.message);
      Alert.alert("Erreur", "Impossible de récupérer l'historique des courses.");
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchCourses();
    setRefreshing(false);
  };

  // Groupement des courses par date (format local)
  const groupByDate = (data) => {
    const grouped = {};
    data.forEach((item) => {
      const date = new Date(item.date).toLocaleDateString();
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(item);
    });
    return grouped;
  };

  // Groupement des courses par chauffeur
  const groupByChauffeur = (data) => {
    const grouped = {};
    data.forEach((item) => {
      const chauffeur = item.chauffeur || "Inconnu";
      if (!grouped[chauffeur]) grouped[chauffeur] = [];
      grouped[chauffeur].push(item);
    });
    return grouped;
  };

  // Groupement et tri des dates (les plus récentes en premier)
  const groupedCourses = groupByDate(courses);
  const sortedDates = Object.keys(groupedCourses).sort(
    (a, b) => new Date(b) - new Date(a)
  );
  // Ajuster l'index courant si nécessaire
  useEffect(() => {
    if (sortedDates.length > 0 && currentDateIndex >= sortedDates.length) {
      setCurrentDateIndex(0);
    }
  }, [sortedDates]);

  const currentDate = sortedDates[currentDateIndex] || null;
  const currentCourses = currentDate ? groupedCourses[currentDate] : [];
  const chauffeurGroups = groupByChauffeur(currentCourses);
  const sortedChauffeurs = Object.keys(chauffeurGroups).sort();

  const handleChangePrix = (id, value) => {
    setPrixModifies({ ...prixModifies, [id]: value });
  };

  const handleSavePrix = async (id) => {
    const prix = prixModifies[id];
    try {
      await axios.put(`${API_BASE_URL}/planning/price/${id}`, { prix });
      Alert.alert("💰 Prix mis à jour !");
      fetchCourses();
    } catch (error) {
      console.error("❌ Erreur mise à jour prix :", error.response?.data || error.message);
      Alert.alert("Erreur", "Impossible de mettre à jour le prix.");
    }
  };

  const openAttachment = (filePath) => {
    const baseUrl = API_BASE_URL.replace("/api", "");
    const url = `${baseUrl}${filePath}`;
    Linking.openURL(url).catch((err) => {
      console.error("Erreur ouverture lien :", err);
      Alert.alert("Erreur", "Impossible d'ouvrir le fichier.");
    });
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#007bff" />}
    >
      <Text style={styles.title}>🗂 Historique des courses terminées</Text>

      {/* Navigation par jour */}
      {sortedDates.length > 0 && (
        <View style={styles.navContainer}>
          {currentDateIndex < sortedDates.length - 1 && (
            <TouchableOpacity onPress={() => setCurrentDateIndex(currentDateIndex + 1)}>
              <Text style={styles.navButton}>◀️</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.currentDateText}>{currentDate}</Text>
          {currentDateIndex > 0 && (
            <TouchableOpacity onPress={() => setCurrentDateIndex(currentDateIndex - 1)}>
              <Text style={styles.navButton}>▶️</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Affichage groupé par chauffeur */}
      {currentDate ? (
        sortedChauffeurs.map((chauffeur) => (
          <View key={chauffeur} style={styles.chauffeurBlock}>
            <Text style={styles.chauffeurTitle}>👤 {chauffeur}</Text>
            {chauffeurGroups[chauffeur].map((item) => (
              <View key={item._id} style={styles.courseContainer}>
                <Text style={styles.courseTime}>⏰ {item.heure}</Text>
                <Text style={styles.courseRoute}>📍 {item.depart} → {item.arrive}</Text>
                <Text style={styles.courseDescription}>📝 {item.description}</Text>
                <Text style={styles.courseDetail}>🚖 Chauffeur : {item.chauffeur}</Text>

                <Text style={styles.label}>📎 Pièce(s) jointe(s) :</Text>
                {Array.isArray(item.pieceJointe) && item.pieceJointe.length > 0 ? (
                  item.pieceJointe.map((filePath, index) => (
                    <TouchableOpacity key={index} onPress={() => openAttachment(filePath)}>
                      <Text style={styles.link}>📎 {filePath.split("/").pop()}</Text>
                    </TouchableOpacity>
                  ))
                ) : item.pieceJointe && typeof item.pieceJointe === "string" ? (
                  <TouchableOpacity onPress={() => openAttachment(item.pieceJointe)}>
                    <Text style={styles.link}>📎 {item.pieceJointe.split("/").pop()}</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.noAttachment}>Aucune pièce jointe.</Text>
                )}

                <TextInput
                  placeholder="💶 Prix"
                  style={styles.input}
                  keyboardType="numeric"
                  value={prixModifies[item._id] || ""}
                  onChangeText={(text) => handleChangePrix(item._id, text)}
                />
                <TouchableOpacity style={styles.saveButton} onPress={() => handleSavePrix(item._id)}>
                  <Text style={styles.saveButtonText}>💾 Enregistrer le prix</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ))
      ) : (
        <Text style={styles.noData}>Aucune course pour ce jour.</Text>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 15,
    backgroundColor: "#f7f7f7",
    paddingBottom: 30,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
    color: "#333",
  },
  navContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 15,
  },
  navButton: {
    fontSize: 28,
    color: "#007bff",
    marginHorizontal: 20,
  },
  currentDateText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#444",
  },
  chauffeurBlock: {
    marginBottom: 20,
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 10,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  chauffeurTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
    paddingBottom: 5,
    marginBottom: 10,
  },
  courseContainer: {
    backgroundColor: "#f9f9f9",
    padding: 10,
    borderRadius: 5,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#eee",
  },
  courseTime: {
    fontSize: 16,
    fontWeight: "600",
    color: "#555",
  },
  courseRoute: {
    fontSize: 15,
    color: "#777",
    marginVertical: 2,
  },
  courseDescription: {
    fontSize: 15,
    color: "#777",
    marginVertical: 2,
  },
  courseDetail: {
    fontSize: 15,
    color: "#777",
    marginBottom: 5,
  },
  label: {
    fontSize: 16,
    fontWeight: "bold",
    marginTop: 8,
    color: "#333",
  },
  link: {
    color: "#007bff",
    textDecorationLine: "underline",
    marginVertical: 4,
    fontSize: 15,
  },
  noAttachment: {
    fontStyle: "italic",
    color: "#999",
    marginVertical: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 5,
    padding: 10,
    marginTop: 10,
    marginBottom: 5,
    fontSize: 16,
    backgroundColor: "#fff",
    color: "#333",
  },
  saveButton: {
    backgroundColor: "#28a745",
    paddingVertical: 10,
    borderRadius: 5,
    alignItems: "center",
    marginTop: 5,
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  noData: {
    fontStyle: "italic",
    color: "#777",
    textAlign: "center",
    marginTop: 20,
  },
});

export default HistoriqueScreen;
