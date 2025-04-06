import React, { useState, useEffect, useContext, useRef } from "react";
import {
  View,
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  StyleSheet,
  Platform,
} from "react-native";
import { Calendar, momentLocalizer, Views } from "react-big-calendar";
import moment from "moment";
import axios from "axios";
import { Picker } from "@react-native-picker/picker";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { AuthContext } from "../context/AuthContext";
import { API_BASE_URL } from "../config";

// Palette de couleurs fluo prédéfinie
const colorPalette = [
  "#FF4081", // Rose fluo
  "#E040FB", // Violet fluo
  "#7C4DFF", // Indigo
  "#448AFF", // Bleu vif
  "#40C4FF", // Bleu clair
  "#18FFFF", // Cyan
  "#64FFDA", // Turquoise
  "#69F0AE", // Vert menthe
  "#EEFF41", // Jaune fluo
  "#FFFF00", // Jaune vif
];

const localizer = momentLocalizer(moment);

// ... imports en haut inchangés ...

const PlanningGeneralScreen = () => {
  const { user } = useContext(AuthContext);

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState(Views.MONTH);
  const [refreshing, setRefreshing] = useState(false);

  const [eventOptionsVisible, setEventOptionsVisible] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedChauffeur, setSelectedChauffeur] = useState("");
  const [selectedColor, setSelectedColor] = useState("#1a73e8");
  const [chauffeurs, setChauffeurs] = useState([]);

  const [creationModalVisible, setCreationModalVisible] = useState(false);
  const [newEvent, setNewEvent] = useState({
    nom: "", prenom: "", depart: "", arrive: "", heure: "", date: moment().format("YYYY-MM-DD"), description: "",
  });

  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchCourses();
    fetchChauffeurs();
  }, []);

  const fetchCourses = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/planning`);
      const formattedEvents = res.data.map((course) => ({
        id: course._id,
        title: `${course.nom} ${course.prenom} - ${course.depart} → ${course.arrive}`,
        start: moment(`${course.date} ${course.heure}`, "YYYY-MM-DD HH:mm").toDate(),
        end: moment(`${course.date} ${course.heure}`, "YYYY-MM-DD HH:mm").add(1, "hours").toDate(),
        description: course.description,
        chauffeur: course.chauffeur || "",
        color: course.color || "#1a73e8",
      }));
      setEvents(formattedEvents);
    } catch (err) {
      Alert.alert("Erreur", "Impossible de récupérer les courses.");
    } finally {
      setLoading(false);
    }
  };

  const fetchChauffeurs = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/employees/chauffeurs`);
      const fullList = [...res.data];
      const patron = user?.nom || user?.name;
      if (patron && !fullList.find((c) => c.nom === patron)) {
        fullList.push({ nom: patron });
      }
      setChauffeurs(fullList.map((c) => c.nom));
    } catch {
      Alert.alert("Erreur", "Impossible de récupérer les chauffeurs.");
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchCourses(), fetchChauffeurs()]);
    setRefreshing(false);
  };

  const handleSelectSlot = ({ start }) => {
    setNewEvent({ nom: "", prenom: "", depart: "", arrive: "", heure: "", date: moment(start).format("YYYY-MM-DD"), description: "" });
    setCreationModalVisible(true);
  };

  const handleSelectEvent = (event) => {
    setSelectedEvent(event);
    setSelectedChauffeur(event.chauffeur || (user?.nom || user?.name) || "");
    setSelectedColor(event.color || "#1a73e8");
    setEventOptionsVisible(true);
  };

  const updateAssignment = async () => {
    if (!selectedEvent || !selectedChauffeur) return Alert.alert("⚠️", "Choisissez un chauffeur");
    try {
      await axios.put(`${API_BASE_URL}/planning/send/${selectedEvent.id}`, {
        chauffeur: selectedChauffeur,
        color: selectedColor,
      });
      Alert.alert("✅ Assigné avec succès");
      fetchCourses();
      setEventOptionsVisible(false);
    } catch {
      Alert.alert("Erreur", "Échec de l'assignation");
    }
  };

  const updateColor = async () => {
    if (!selectedEvent) return;
    try {
      await axios.put(`${API_BASE_URL}/planning/send/${selectedEvent.id}`, {
        chauffeur: selectedEvent.chauffeur,
        color: selectedColor,
      });
      Alert.alert("🎨 Couleur mise à jour !");
      fetchCourses();
      setEventOptionsVisible(false);
    } catch {
      Alert.alert("Erreur", "Échec de la mise à jour de la couleur");
    }
  };

  const handleSubmitNewEvent = async () => {
    const { nom, prenom, depart, arrive, heure, date, description } = newEvent;
    if (!nom || !prenom || !depart || !arrive || !heure || !description || !date) {
      Alert.alert("⚠️ Champs requis", "Veuillez remplir tous les champs.");
      return;
    }
    try {
      await axios.post(`${API_BASE_URL}/planning`, {
        nom, prenom, depart, arrive, heure, date, description, statut: "En attente",
      });
      Alert.alert("✅ Course ajoutée !");
      setCreationModalVisible(false);
      fetchCourses();
    } catch {
      Alert.alert("Erreur", "Impossible d'ajouter la course.");
    }
  };

  const handleDateBackward = () => {
    setCurrentDate(moment(currentDate).subtract(1, "days").toDate());
  };

  const handleDateForward = () => {
    setCurrentDate(moment(currentDate).add(1, "days").toDate());
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>👤 Connecté en tant que : {user?.nom || user?.name}</Text>
      <Text style={styles.title}>📅 Planning Général</Text>

      <View style={styles.dateNavContainer}>
        <TouchableOpacity onPress={handleDateBackward}><Text style={styles.navButton}>◀️</Text></TouchableOpacity>
        <Text style={styles.currentDateText}>{moment(currentDate).format("YYYY-MM-DD")}</Text>
        <TouchableOpacity onPress={handleDateForward}><Text style={styles.navButton}>▶️</Text></TouchableOpacity>
      </View>

      <ScrollView
        style={styles.refreshContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#007bff" />}
      />

      {loading ? (
        <ActivityIndicator size="large" color="#007bff" style={styles.loader} />
      ) : (
        <View style={styles.calendarContainer}>
          <Calendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            defaultView={view}
            style={styles.calendar}
            selectable
            date={currentDate}
            onNavigate={(date) => setCurrentDate(date)}
            onSelectSlot={handleSelectSlot}
            onSelectEvent={handleSelectEvent}
            popup
            eventPropGetter={(event) => ({
              style: {
                backgroundColor: event.color || "#1a73e8",
                borderRadius: "5px",
                opacity: 0.9,
                color: "#fff",
              },
            })}
          />
        </View>
      )}

      {/* Modals */}
      <Modal visible={creationModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <ScrollView contentContainerStyle={styles.modalContent}>
              <Text style={styles.modalTitle}>📝 Ajouter une Course</Text>
              {["nom", "prenom", "depart", "arrive", "heure", "date", "description"].map((field) => (
                <TextInput
                  key={field}
                  placeholder={field.charAt(0).toUpperCase() + field.slice(1)}
                  style={styles.modalInput}
                  value={newEvent[field]}
                  onChangeText={(text) => setNewEvent({ ...newEvent, [field]: text })}
                  placeholderTextColor="#777"
                />
              ))}
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalButton} onPress={handleSubmitNewEvent}><Text style={styles.modalButtonText}>✅ Ajouter</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setCreationModalVisible(false)}><Text style={styles.modalButtonText}>❌ Annuler</Text></TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={eventOptionsVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <ScrollView contentContainerStyle={styles.modalContent}>
              <Text style={styles.modalTitle}>📄 Détails de la Course</Text>
              <Text style={styles.detailText}>🚖 {selectedEvent?.title}</Text>
              <Text style={styles.detailText}>📅 {moment(selectedEvent?.start).format("LL")}</Text>
              <Text style={styles.detailText}>🕒 {moment(selectedEvent?.start).format("HH:mm")}</Text>

              <Text style={styles.modalLabel}>🚖 Réassigner :</Text>
              <Picker selectedValue={selectedChauffeur} style={styles.picker} onValueChange={(val) => setSelectedChauffeur(val)}>
                <Picker.Item label="-- Sélectionner --" value="" />
                {chauffeurs.map((c, idx) => (
                  <Picker.Item key={idx} label={c} value={c} />
                ))}
              </Picker>

              <Text style={styles.modalLabel}>🎨 Couleur :</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {colorPalette.map((color) => (
                  <TouchableOpacity
                    key={color}
                    style={[
                      styles.colorBox,
                      { backgroundColor: color },
                      selectedColor === color && styles.colorBoxSelected,
                    ]}
                    onPress={() => setSelectedColor(color)}
                  />
                ))}
              </ScrollView>

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalButton} onPress={updateAssignment}><Text style={styles.modalButtonText}>🚖 Assigner</Text></TouchableOpacity>
                <TouchableOpacity style={styles.modalButton} onPress={updateColor}><Text style={styles.modalButtonText}>🎨 Sauver Couleur</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setEventOptionsVisible(false)}><Text style={styles.modalButtonText}>❌ Fermer</Text></TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default PlanningGeneralScreen;

// ... styles inchangés

// -----------------------------------------------------------
// STYLES
const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
    backgroundColor: "#f7f7f7",
  },
  header: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#333",
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    marginVertical: 10,
    color: "#333",
  },
  dateNavContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
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
  refreshContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
  loader: {
    marginVertical: 20,
  },
  calendarContainer: {
    height: 600,
    marginBottom: 10,
  },
  calendar: {
    height: "100%",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: 20,
  },
  modalContainer: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 10,
    maxHeight: "80%",
  },
  modalContent: {
    paddingBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 15,
    textAlign: "center",
    color: "#007bff",
  },
  modalInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    fontSize: 16,
    color: "#333",
    backgroundColor: "#fafafa",
  },
  modalLabel: {
    fontWeight: "bold",
    marginTop: 10,
    marginBottom: 5,
    fontSize: 16,
    color: "#202124",
  },
  picker: {
    height: 50,
    width: "100%",
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#ccc",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 10,
  },
  modalButton: {
    backgroundColor: "#007bff",
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    alignItems: "center",
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: "#dc3545",
  },
  modalButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  colorBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginHorizontal: 5,
    borderWidth: 2,
    borderColor: "transparent",
  },
  colorBoxSelected: {
    borderColor: "#000",
  },
});
