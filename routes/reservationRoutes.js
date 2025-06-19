import React, { useEffect, useState, useContext } from "react";
import { 
  View, 
  Text, 
  ScrollView, 
  Alert, 
  TouchableOpacity, 
  StyleSheet, 
  ActivityIndicator,
  TextInput,
  Modal,
  Clipboard,
  Share
} from "react-native";
import axios from "axios";
import { AuthContext } from "../context/AuthContext";
import { API_BASE_URL } from "../config";
import moment from "moment";

const DemandesReservationsScreen = () => {
  const { user } = useContext(AuthContext);
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [generatedLink, setGeneratedLink] = useState("");

  useEffect(() => {
    fetchReservations();
  }, []);

  const fetchReservations = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/reservations/entreprise/${user.entrepriseId}`, {
        headers: {
          'Authorization': `Bearer ${user.token}`,
        }
      });
      console.log("📦 Réservations reçues :", res.data);
      setReservations(res.data);
    } catch (error) {
      console.error("❌ Erreur récupération réservations :", error.response?.data || error.message);
      Alert.alert(
        "Erreur", 
        `Impossible de récupérer les réservations: ${error.response?.data?.message || error.message}`
      );
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (id) => {
    Alert.alert(
      "Confirmer l'acceptation",
      "Êtes-vous sûr de vouloir accepter cette réservation ?",
      [
        { text: "Annuler", style: "cancel" },
        { 
          text: "Accepter", 
          onPress: async () => {
            try {
              await axios.put(`${API_BASE_URL}/api/reservations/accepter/${id}`, {}, {
                headers: {
                  'Authorization': `Bearer ${user.token}`,
                }
              });
              Alert.alert("✅ Succès", "Réservation acceptée et ajoutée au planning", [
                {
                  text: "Voir le planning",
                  onPress: () => {
                    fetchReservations();
                  }
                },
                {
                  text: "OK",
                  onPress: () => fetchReservations()
                }
              ]);
            } catch (error) {
              console.error("❌ Erreur acceptation :", error.response?.data || error.message);
              Alert.alert(
                "Erreur", 
                `Impossible d'accepter cette réservation: ${error.response?.data?.message || error.message}`
              );
            }
          }
        }
      ]
    );
  };

  const handleRefuse = async (id) => {
    Alert.alert(
      "Confirmer le refus",
      "Êtes-vous sûr de vouloir refuser cette réservation ?",
      [
        { text: "Annuler", style: "cancel" },
        { 
          text: "Refuser", 
          style: "destructive",
          onPress: async () => {
            try {
              await axios.put(`${API_BASE_URL}/api/reservations/refuser/${id}`, {}, {
                headers: {
                  'Authorization': `Bearer ${user.token}`,
                }
              });
              Alert.alert("❌ Refusée", "Réservation refusée");
              fetchReservations();
            } catch (error) {
              console.error("❌ Erreur refus :", error.response?.data || error.message);
              Alert.alert(
                "Erreur", 
                `Impossible de refuser cette réservation: ${error.response?.data?.message || error.message}`
              );
            }
          }
        }
      ]
    );
  };

  const generateReservationLink = async () => {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/reservations/generer-lien/${user.entrepriseId}`, {}, {
        headers: {
          'Authorization': `Bearer ${user.token}`,
        }
      });

      const linkData = response.data;
      const reservationLink = `${API_BASE_URL}/api/reservations/client/${linkData.lien}`;
      
      setGeneratedLink(reservationLink);
      
      Alert.alert("✅ Lien généré", "Le lien de réservation a été créé avec succès");
      
    } catch (error) {
      console.error("❌ Erreur génération lien :", error.response?.data || error.message);
      Alert.alert(
        "Erreur", 
        `Impossible de générer le lien: ${error.response?.data?.message || error.message}`
      );
    }
  };

  const shareLink = async (link) => {
    try {
      await Share.share({
        message: `Bonjour, voici votre lien de réservation pour ${user.entrepriseName || 'notre service'}: ${link}`,
        title: 'Lien de réservation',
      });
    } catch (error) {
      Clipboard.setString(link);
      Alert.alert("📋 Copié", "Le lien a été copié dans le presse-papier");
    }
  };

  const copyToClipboard = () => {
    Clipboard.setString(generatedLink);
    Alert.alert("📋 Copié", "Lien copié dans le presse-papier");
  };

  const getStatusStyle = (statut) => {
    if (!statut) return styles.statusDefault;
    
    const normalizedStatus = statut.toLowerCase().replace(/[^a-z]/g, '');
    
    switch (normalizedStatus) {
      case 'enattente':
        return styles.statusPending;
      case 'acceptee':
      case 'accepte':
        return styles.statusAccepted;
      case 'refusee':
      case 'refuse':
        return styles.statusRefused;
      default:
        return styles.statusDefault;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>📩 Demandes de Réservations</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setModalVisible(true)}
        >
          <Text style={styles.addButtonText}>+ Nouveau lien</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#007bff" style={styles.loader} />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {reservations.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.noData}>📭 Aucune réservation disponible</Text>
              <Text style={styles.noDataSub}>
                Créez un lien de réservation pour que vos clients puissent faire leurs demandes
              </Text>
            </View>
          ) : (
            reservations.map((reservation) => (
              <View key={reservation._id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.clientName}>
                    🧑 {reservation.nom} {reservation.prenom}
                  </Text>
                  <Text style={[styles.status, getStatusStyle(reservation.statut)]}>
                    {reservation.statut}
                  </Text>
                </View>
                
                <View style={styles.cardContent}>
                  <Text style={styles.text}>
                    📅 {moment(reservation.date).format("dddd DD MMMM YYYY")} à {reservation.heure}
                  </Text>
                  <Text style={styles.text}>📍 {reservation.depart} → {reservation.arrive}</Text>
                  <Text style={styles.text}>📞 {reservation.telephone}</Text>
                  <Text style={styles.text}>📧 {reservation.email}</Text>
                  {reservation.description ? (
                    <Text style={styles.description}>📝 {reservation.description}</Text>
                  ) : null}
                </View>

                {reservation.statut === "En attente" && (
                  <View style={styles.actions}>
                    <TouchableOpacity
                      style={[styles.btn, styles.acceptBtn]}
                      onPress={() => handleAccept(reservation._id)}
                    >
                      <Text style={styles.btnText}>✅ Accepter</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.btn, styles.refuseBtn]}
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

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>🔗 Créer un lien de réservation</Text>
            
            <Text style={styles.inputLabel}>Email du client (optionnel)</Text>
            <TextInput
              style={styles.input}
              placeholder="client@example.com"
              value={clientEmail}
              onChangeText={setClientEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            
            <Text style={styles.inputLabel}>Téléphone du client (optionnel)</Text>
            <TextInput
              style={styles.input}
              placeholder="+33 6 12 34 56 78"
              value={clientPhone}
              onChangeText={setClientPhone}
              keyboardType="phone-pad"
            />

            {generatedLink ? (
              <View style={styles.generatedLinkContainer}>
                <Text style={styles.generatedLinkLabel}>Lien généré :</Text>
                <TouchableOpacity style={styles.linkContainer} onPress={copyToClipboard}>
                  <Text style={styles.generatedLinkText} numberOfLines={2}>
                    {generatedLink}
                  </Text>
                  <Text style={styles.copyHint}>📋 Appuyer pour copier</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.shareButton}
                  onPress={() => shareLink(generatedLink)}
                >
                  <Text style={styles.shareButtonText}>📤 Partager</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.cancelBtn]}
                onPress={() => {
                  setModalVisible(false);
                  setClientEmail("");
                  setClientPhone("");
                  setGeneratedLink("");
                }}
              >
                <Text style={styles.cancelBtnText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.generateBtn]}
                onPress={generateReservationLink}
              >
                <Text style={styles.generateBtnText}>
                  {generatedLink ? "Regénérer" : "Générer lien"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default DemandesReservationsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e9ecef",
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#343a40",
  },
  addButton: {
    backgroundColor: "#007bff",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  loader: {
    marginTop: 50,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    paddingHorizontal: 20,
  },
  noData: {
    textAlign: "center",
    fontSize: 18,
    color: "#6c757d",
    marginBottom: 8,
  },
  noDataSub: {
    textAlign: "center",
    fontSize: 14,
    color: "#9ba5ab",
    lineHeight: 20,
  },
  card: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  clientName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#343a40",
    flex: 1,
  },
  cardContent: {
    marginBottom: 12,
  },
  text: {
    fontSize: 16,
    marginVertical: 3,
    color: "#495057",
  },
  description: {
    fontSize: 16,
    marginVertical: 3,
    color: "#495057",
    fontStyle: "italic",
    backgroundColor: "#f8f9fa",
    padding: 8,
    borderRadius: 6,
    marginTop: 8,
  },
  status: {
    fontSize: 14,
    fontWeight: "bold",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    textAlign: "center",
  },
  statusDefault: {
    backgroundColor: "#e9ecef",
    color: "#495057",
  },
  statusPending: {
    backgroundColor: "#fff3cd",
    color: "#856404",
  },
  statusAccepted: {
    backgroundColor: "#d4edda",
    color: "#155724",
  },
  statusRefused: {
    backgroundColor: "#f8d7da",
    color: "#721c24",
  },
  actions: {
    flexDirection: "row",
    marginTop: 12,
  },
  btn: {
    flex: 1,
    padding: 12,
    marginHorizontal: 4,
    borderRadius: 8,
    alignItems: "center",
  },
  acceptBtn: {
    backgroundColor: "#28a745",
  },
  refuseBtn: {
    backgroundColor: "#dc3545",
  },
  btnText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    width: "90%",
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 20,
    color: "#343a40",
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#495057",
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ced4da",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: "#fff",
  },
  generatedLinkContainer: {
    marginTop: 20,
    padding: 16,
    backgroundColor: "#f8f9fa",
    borderRadius: 8,
  },
  generatedLinkLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#495057",
    marginBottom: 8,
  },
  linkContainer: {
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#dee2e6",
  },
  generatedLinkText: {
    fontSize: 14,
    color: "#007bff",
    marginBottom: 4,
  },
  copyHint: {
    fontSize: 12,
    color: "#6c757d",
    fontStyle: "italic",
  },
  shareButton: {
    backgroundColor: "#17a2b8",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 12,
  },
  shareButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
  modalActions: {
    flexDirection: "row",
    marginTop: 24,
  },
  modalBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
    marginHorizontal: 4,
  },
  cancelBtn: {
    backgroundColor: "#6c757d",
  },
  cancelBtnText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
  generateBtn: {
    backgroundColor: "#007bff",
  },
  generateBtnText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
});