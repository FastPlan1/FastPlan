import React, { useState, useEffect, useContext, useRef } from "react";
import {
  View,
  Modal,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  StyleSheet,
  ActivityIndicator,
  Platform, // Import ajouté pour Platform
} from "react-native";
import { Calendar, momentLocalizer } from "react-big-calendar";
import moment from "moment";
import axios from "axios";
import { Picker } from "@react-native-picker/picker";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { API_BASE_URL } from "../config";
import { AuthContext } from "../context/AuthContext";

const localizer = momentLocalizer(moment);

const PlanningPersonnelScreen = () => {
  const { user } = useContext(AuthContext);
  const fileInputRef = useRef(null);

  const [chauffeurs, setChauffeurs] = useState([]);
  const [selectedChauffeur, setSelectedChauffeur] = useState(user?.nom || user?.name);
  const [events, setEvents] = useState([]);
  const [eventOptionsVisible, setEventOptionsVisible] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    if (user?.role === "patron") {
      fetchAllChauffeurs();
    }
  }, [user]);

  useEffect(() => {
    if (selectedChauffeur) {
      fetchPersonalPlanning(selectedChauffeur);
    }
  }, [selectedChauffeur]);

  const fetchAllChauffeurs = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/employees/by-patron/${user.id}`);
      const chauffeurList = res.data.map((c) => c.name || c.nom);
      // Inclure le patron s'il n'est pas déjà présent
      const patron = user?.nom || user?.name;
      if (patron && !chauffeurList.includes(patron)) {
        chauffeurList.push(patron);
      }
      setChauffeurs(chauffeurList);
    } catch (err) {
      console.error("❌ Erreur chargement chauffeurs :", err);
      Alert.alert("Erreur", "Impossible de charger les chauffeurs.");
    }
  };

  const fetchPersonalPlanning = async (chauffeurNom) => {
    setLoadingEvents(true);
    try {
      const response = await axios.get(
        `${API_BASE_URL}/planning/chauffeur/${encodeURIComponent(chauffeurNom)}`
      );
      const filtered = Array.isArray(response.data)
        ? response.data.filter((course) => course.statut !== "Terminée")
        : [];
      setEvents(
        filtered.map((course) => ({
          id: course._id,
          title: `${course.nom} ${course.prenom} - ${course.depart} → ${course.arrive}`,
          start: moment(`${course.date} ${course.heure}`, "YYYY-MM-DD HH:mm").toDate(),
          end: moment(`${course.date} ${course.heure}`, "YYYY-MM-DD HH:mm")
            .add(1, "hours")
            .toDate(),
          depart: course.depart,
          arrive: course.arrive,
          description: course.description,
          pieceJointe: Array.isArray(course.pieceJointe) ? course.pieceJointe : [],
        }))
      );
    } catch (error) {
      console.error("❌ Erreur récupération planning personnel :", error.response?.data || error.message);
      Alert.alert("Erreur", "Impossible de récupérer votre planning.");
      setEvents([]);
    } finally {
      setLoadingEvents(false);
    }
  };

  const handleSelectEvent = (event) => {
    setSelectedEvent(event);
    setAttachedFiles(Array.isArray(event.pieceJointe) ? event.pieceJointe : []);
    setEventOptionsVisible(true);
  };

  const handleUploadFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return Alert.alert("⚠️ Erreur", "Aucun fichier sélectionné.");
    const formData = new FormData();
    formData.append("file", file);
    try {
      await axios.post(`${API_BASE_URL}/planning/upload/${selectedEvent.id}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      Alert.alert("✅ Fichier envoyé !");
      fetchPersonalPlanning(selectedChauffeur);
      setEventOptionsVisible(false);
    } catch (error) {
      console.error("❌ Erreur upload fichier :", error.response?.data || error.message);
      Alert.alert("❌ Erreur", "Impossible d’envoyer le fichier.");
    }
  };

  const handleFinishCourse = async () => {
    try {
      await axios.put(`${API_BASE_URL}/planning/finish/${selectedEvent.id}`);
      Alert.alert("✅ Terminé", "La course a été marquée comme terminée.");
      setEventOptionsVisible(false);
      fetchPersonalPlanning(selectedChauffeur);
    } catch (error) {
      console.error("❌ Erreur fin de course :", error.response?.data || error.message);
      Alert.alert("❌ Erreur", "Impossible de terminer la course.");
    }
  };

  // Handler onNavigate pour permettre la navigation dans le calendrier
  const handleNavigate = (date) => {
    setCurrentDate(date);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>📅 Planning Personnel</Text>

      {user?.role === "patron" && (
        <View style={styles.pickerContainer}>
          <Text style={styles.pickerLabel}>Voir le planning de :</Text>
          <Picker
            selectedValue={selectedChauffeur}
            style={styles.picker}
            onValueChange={(itemValue) => setSelectedChauffeur(itemValue)}
          >
            <Picker.Item label="-- Sélectionner --" value="" />
            {chauffeurs.map((nom, index) => (
              <Picker.Item key={index} label={nom} value={nom} />
            ))}
          </Picker>
        </View>
      )}

      <TouchableOpacity
        style={styles.refreshButton}
        onPress={() => fetchPersonalPlanning(selectedChauffeur)}
      >
        <Text style={styles.refreshButtonText}>🔄 Recharger le planning</Text>
      </TouchableOpacity>

      <View style={styles.calendarContainer}>
        {loadingEvents ? (
          <ActivityIndicator size="large" color="#007bff" style={styles.loader} />
        ) : (
          <Calendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            style={styles.calendar}
            selectable
            date={currentDate}
            onNavigate={handleNavigate}
            onSelectEvent={handleSelectEvent}
          />
        )}
      </View>

      {/* Modal de détails / assignation */}
      <Modal visible={eventOptionsVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <ScrollView contentContainerStyle={styles.modalContent}>
              <Text style={styles.modalTitle}>📄 Détails de la Course</Text>
              <Text style={styles.detailText}>🚖 {selectedEvent?.title}</Text>
              <Text style={styles.detailText}>
                📅 {moment(selectedEvent?.start).format("LL")}
              </Text>
              <Text style={styles.detailText}>
                🕒 {moment(selectedEvent?.start).format("HH:mm")}
              </Text>
              <Text style={styles.detailText}>📍 Départ: {selectedEvent?.depart}</Text>
              <Text style={styles.detailText}>📍 Arrivée: {selectedEvent?.arrive}</Text>
              <Text style={styles.detailText}>📄 Description: {selectedEvent?.description}</Text>

              <View style={styles.uploadContainer}>
                <TouchableOpacity
                  style={styles.uploadButton}
                  onPress={() => {
                    if (
                      Platform.OS === "web" &&
                      fileInputRef.current &&
                      fileInputRef.current.click
                    ) {
                      fileInputRef.current.click();
                    } else {
                      Alert.alert("Erreur", "L'élément d'upload n'est pas accessible.");
                    }
                  }}
                >
                  <Text style={styles.uploadButtonText}>📎 Ajouter un fichier</Text>
                </TouchableOpacity>
                {Platform.OS === "web" && (
                  <input
                    ref={fileInputRef}
                    type="file"
                    style={{ display: "none" }}
                    onChange={handleUploadFile}
                  />
                )}
              </View>

              {Array.isArray(attachedFiles) && attachedFiles.length > 0 && (
                <View style={styles.attachmentsContainer}>
                  <Text style={styles.attachmentsTitle}>📂 Fichiers attachés :</Text>
                  {attachedFiles.map((filePath, index) => (
                    <TouchableOpacity
                      key={index}
                      onPress={() =>
                        window.open(
                          `${API_BASE_URL.replace("/api", "")}${filePath}`,
                          "_blank"
                        )
                      }
                    >
                      <Text style={styles.attachmentLink}>
                        📎 {filePath.split("/").pop()}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalButton} onPress={handleFinishCourse}>
                  <Text style={styles.modalButtonText}>✅ Terminer la course</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setEventOptionsVisible(false)}
                >
                  <Text style={styles.modalButtonText}>🔙 Fermer</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 10, backgroundColor: "#f7f7f7" },
  header: { fontSize: 22, fontWeight: "bold", marginBottom: 10, color: "#333" },
  pickerContainer: { marginBottom: 10 },
  pickerLabel: { fontSize: 16, marginBottom: 5, color: "#333" },
  picker: { height: 50, width: "100%", borderWidth: 1, borderColor: "#ccc" },
  refreshButton: { backgroundColor: "#007bff", padding: 10, borderRadius: 8, alignItems: "center", marginBottom: 10 },
  refreshButtonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  calendarContainer: { height: 600, marginTop: 10 },
  calendar: { height: "100%" },
  loader: { marginVertical: 20 },
  modalOverlay: { flex: 1, justifyContent: "center", backgroundColor: "rgba(0,0,0,0.5)", padding: 20 },
  modalContainer: { backgroundColor: "#fff", padding: 20, borderRadius: 10, maxHeight: "80%" },
  modalContent: { paddingBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: "bold", marginBottom: 15, textAlign: "center", color: "#007bff" },
  detailText: { fontSize: 16, marginVertical: 4, color: "#444" },
  uploadContainer: { marginVertical: 10, alignItems: "center" },
  uploadButton: { backgroundColor: "#007bff", padding: 10, borderRadius: 8 },
  uploadButtonText: { color: "#fff", fontWeight: "bold" },
  attachmentsContainer: { marginVertical: 10 },
  attachmentsTitle: { fontWeight: "bold", marginBottom: 5, fontSize: 16, color: "#333" },
  attachmentLink: { color: "#007bff", textDecorationLine: "underline", marginBottom: 5, fontSize: 15 },
  modalActions: { flexDirection: "row", justifyContent: "space-around", marginTop: 15 },
  modalButton: { backgroundColor: "#007bff", paddingVertical: 10, paddingHorizontal: 15, borderRadius: 8, alignItems: "center" },
  cancelButton: { backgroundColor: "#dc3545" },
  modalButtonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
});

export default PlanningPersonnelScreen;
