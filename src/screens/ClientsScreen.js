import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
  ScrollView,
  Alert,
  Linking,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { API_BASE_URL } from '../config';

const ClientsScreen = () => {
  const { user } = useContext(AuthContext);
  const [clients, setClients] = useState([]);
  const [filteredClients, setFilteredClients] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [showModal, setShowModal] = useState(false); // pour ajout/modification
  const [selectedClient, setSelectedClient] = useState(null); // pour détails

  // Champs du formulaire (pour ajout ou modification)
  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [adresse, setAdresse] = useState('');
  const [telephone, setTelephone] = useState('');
  const [caisseSociale, setCaisseSociale] = useState(''); // optionnel, 1 phrase
  const [carteVitaleFile, setCarteVitaleFile] = useState(null);
  const [bonsTransportFiles, setBonsTransportFiles] = useState([]);

  // Etat pour savoir si l'on est en mode édition
  const [isEditing, setIsEditing] = useState(false);
  const [editingClientId, setEditingClientId] = useState(null);

  useEffect(() => {
    if (user && user.id) {
      fetchClients();
    } else {
      console.log("⚠️ Utilisateur non défini", user);
    }
  }, [user]);

  useEffect(() => {
    if (searchText.trim() === '') {
      setFilteredClients(clients);
    } else {
      const filtered = clients.filter(client =>
        `${client.nom} ${client.prenom}`.toLowerCase().includes(searchText.toLowerCase())
      );
      setFilteredClients(filtered);
    }
  }, [searchText, clients]);

  const fetchClients = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/clients/${user.id}`);
      setClients(res.data);
    } catch (error) {
      console.error("Erreur récupération clients :", error.response?.data || error.message);
      Alert.alert("Erreur", "Impossible de récupérer la liste des clients.");
    }
  };

  const pickFile = async (setter, multiple = false) => {
    let result = await DocumentPicker.getDocumentAsync({ type: "*/*", multiple });
    if (!result.canceled && result.assets) {
      setter(multiple ? result.assets : result.assets[0]);
    }
  };

  const resetForm = () => {
    setNom('');
    setPrenom('');
    setAdresse('');
    setTelephone('');
    setCaisseSociale('');
    setCarteVitaleFile(null);
    setBonsTransportFiles([]);
  };

  const handleAddOrEditClient = async () => {
    const formData = new FormData();
    formData.append('nom', nom);
    formData.append('prenom', prenom);
    formData.append('adresse', adresse);
    formData.append('telephone', telephone);
    formData.append('entrepriseId', user.id);
    formData.append('caisseSociale', caisseSociale);

    if (carteVitaleFile) {
      formData.append('carteVitale', {
        uri: carteVitaleFile.uri,
        name: carteVitaleFile.name,
        type: carteVitaleFile.mimeType || 'application/pdf',
      });
    }
    bonsTransportFiles.forEach(file => {
      formData.append('bonsTransport', {
        uri: file.uri,
        name: file.name,
        type: file.mimeType || 'application/pdf',
      });
    });

    try {
      if (isEditing) {
        // Mode modification
        await axios.put(`${API_BASE_URL}/clients/${editingClientId}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        Alert.alert("✅ Succès", "Client modifié !");
      } else {
        // Mode ajout
        await axios.post(`${API_BASE_URL}/clients/add`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        Alert.alert("✅ Succès", "Client ajouté !");
      }
      resetForm();
      setShowModal(false);
      setIsEditing(false);
      setEditingClientId(null);
      fetchClients();
    } catch (error) {
      console.error("Erreur lors de l'ajout/modification du client :", error.response?.data || error.message);
      Alert.alert("Erreur", "Impossible d'ajouter/modifier le client.");
    }
  };

  const handleDeleteClient = async (clientId) => {
    Alert.alert("Confirmation", "Voulez-vous vraiment supprimer ce client ?", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          try {
            await axios.delete(`${API_BASE_URL}/clients/${clientId}`);
            Alert.alert("✅ Client supprimé");
            fetchClients();
            setSelectedClient(null);
          } catch (error) {
            console.error("Erreur lors de la suppression du client :", error.response?.data || error.message);
            Alert.alert("Erreur", "Impossible de supprimer le client.");
          }
        },
      },
    ]);
  };

  // Fonction pour ouvrir l'export Excel dans le navigateur
  const handleExportExcel = () => {
    const exportUrl = `${API_BASE_URL}/clients/export/${user.id}`;
    Linking.openURL(exportUrl).catch(() =>
      Alert.alert("Erreur", "Impossible d'ouvrir le lien d'exportation.")
    );
  };

  const renderClientItem = ({ item }) => (
    <TouchableOpacity onPress={() => setSelectedClient(item)} style={styles.clientItem}>
      <Text style={styles.clientName}>{item.nom} {item.prenom}</Text>
      <Text style={styles.clientDetail}>Téléphone: {item.telephone}</Text>
      <Text style={styles.clientDetail}>Adresse: {item.adresse}</Text>
    </TouchableOpacity>
  );

  // Préparer le formulaire pour la modification
  const startEditClient = (client) => {
    setIsEditing(true);
    setEditingClientId(client._id);
    setNom(client.nom);
    setPrenom(client.prenom);
    setAdresse(client.adresse);
    setTelephone(client.telephone);
    setCaisseSociale(client.caisseSociale || '');
    // Pour les fichiers, on peut laisser vide ; l'utilisateur pourra re-sélectionner s'il veut modifier
    setCarteVitaleFile(null);
    setBonsTransportFiles([]);
    setShowModal(true);
    setSelectedClient(null);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.screenTitle}>Clients</Text>
      
      {/* Bouton Export Excel */}
      <TouchableOpacity style={styles.exportButton} onPress={handleExportExcel}>
        <Text style={styles.exportButtonText}>Exporter en Excel</Text>
      </TouchableOpacity>

      {/* Barre de recherche */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher un client..."
          value={searchText}
          onChangeText={setSearchText}
          placeholderTextColor="#777"
        />
      </View>

      {/* Liste des clients */}
      <FlatList
        data={filteredClients}
        keyExtractor={(item) => item._id}
        renderItem={renderClientItem}
        contentContainerStyle={styles.listContainer}
      />

      {/* Bouton d'ajout */}
      <TouchableOpacity style={styles.addButton} onPress={() => { resetForm(); setIsEditing(false); setShowModal(true); }}>
        <Text style={styles.addButtonText}>Ajouter un Client</Text>
      </TouchableOpacity>

      {/* Modal pour ajouter ou modifier un client */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>{isEditing ? "Modifier un Client" : "Ajouter un Client"}</Text>
            <ScrollView contentContainerStyle={styles.modalContent}>
              <TextInput
                style={styles.modalInput}
                placeholder="Nom"
                value={nom}
                onChangeText={setNom}
                placeholderTextColor="#777"
              />
              <TextInput
                style={styles.modalInput}
                placeholder="Prénom"
                value={prenom}
                onChangeText={setPrenom}
                placeholderTextColor="#777"
              />
              <TextInput
                style={styles.modalInput}
                placeholder="Adresse"
                value={adresse}
                onChangeText={setAdresse}
                placeholderTextColor="#777"
              />
              <TextInput
                style={styles.modalInput}
                placeholder="Téléphone"
                value={telephone}
                onChangeText={setTelephone}
                keyboardType="phone-pad"
                placeholderTextColor="#777"
              />
              <TextInput
                style={styles.modalInput}
                placeholder="Caisse sociale (en une phrase)"
                value={caisseSociale}
                onChangeText={setCaisseSociale}
                placeholderTextColor="#777"
              />
              <TouchableOpacity style={styles.modalButton} onPress={() => pickFile(setCarteVitaleFile)}>
                <Text style={styles.modalButtonText}>📎 Ajouter Carte Vitale</Text>
              </TouchableOpacity>
              {carteVitaleFile && (
                <Text style={styles.fileName}>{carteVitaleFile.name}</Text>
              )}
              <TouchableOpacity style={styles.modalButton} onPress={() => pickFile(setBonsTransportFiles, true)}>
                <Text style={styles.modalButtonText}>📎 Ajouter Bons Transport</Text>
              </TouchableOpacity>
              {bonsTransportFiles.length > 0 &&
                bonsTransportFiles.map((file, index) => (
                  <Text key={index} style={styles.fileName}>{file.name}</Text>
                ))}
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.actionButton} onPress={handleAddOrEditClient}>
                  <Text style={styles.actionButtonText}>{isEditing ? "Enregistrer les modifications" : "Enregistrer"}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionButton, styles.cancelButton]} onPress={() => setShowModal(false)}>
                  <Text style={styles.actionButtonText}>Annuler</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal pour afficher les détails du client */}
      <Modal visible={!!selectedClient} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.detailModalContainer}>
            <ScrollView contentContainerStyle={styles.modalContent}>
              {selectedClient && (
                <>
                  <Text style={styles.modalTitle}>Détails du Client</Text>
                  <Text style={styles.detailText}>
                    <Text style={styles.detailLabel}>Nom :</Text> {selectedClient.nom}
                  </Text>
                  <Text style={styles.detailText}>
                    <Text style={styles.detailLabel}>Prénom :</Text> {selectedClient.prenom}
                  </Text>
                  <Text style={styles.detailText}>
                    <Text style={styles.detailLabel}>Adresse :</Text> {selectedClient.adresse}
                  </Text>
                  <Text style={styles.detailText}>
                    <Text style={styles.detailLabel}>Téléphone :</Text> {selectedClient.telephone}
                  </Text>
                  {selectedClient.email && (
                    <Text style={styles.detailText}>
                      <Text style={styles.detailLabel}>Email :</Text> {selectedClient.email}
                    </Text>
                  )}
                  {selectedClient.caisseSociale && (
                    <Text style={styles.detailText}>
                      <Text style={styles.detailLabel}>Caisse sociale :</Text> {selectedClient.caisseSociale}
                    </Text>
                  )}
                  {selectedClient.carteVitale && (
                    <View style={styles.attachmentContainer}>
                      <Text style={styles.detailLabel}>Carte Vitale :</Text>
                      <TouchableOpacity
                        onPress={() =>
                          Linking.openURL(
                            `${API_BASE_URL.replace('/api', '')}/${selectedClient.carteVitale}`
                          ).catch(() =>
                            Alert.alert("Erreur", "Impossible d'ouvrir le fichier.")
                          )
                        }
                      >
                        <Text style={styles.attachmentText}>
                          {selectedClient.carteVitale.split('/').pop()}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  {selectedClient.bonsTransport && selectedClient.bonsTransport.length > 0 && (
                    <View style={styles.attachmentContainer}>
                      <Text style={styles.detailLabel}>Bons Transport :</Text>
                      {selectedClient.bonsTransport.map((bon, index) => (
                        <TouchableOpacity
                          key={index}
                          onPress={() =>
                            Linking.openURL(
                              `${API_BASE_URL.replace('/api', '')}/${bon}`
                            ).catch(() =>
                              Alert.alert("Erreur", "Impossible d'ouvrir le fichier.")
                            )
                          }
                        >
                          <Text style={styles.attachmentText}>{bon.split('/').pop()}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                  <View style={styles.modalActions}>
                    <TouchableOpacity style={[styles.actionButton, styles.editButton]} onPress={() => startEditClient(selectedClient)}>
                      <Text style={styles.actionButtonText}>Modifier</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionButton, styles.cancelButton]} onPress={() => handleDeleteClient(selectedClient._id)}>
                      <Text style={styles.actionButtonText}>Supprimer</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
              <TouchableOpacity
                style={[styles.actionButton, styles.cancelButton, { marginTop: 20 }]}
                onPress={() => setSelectedClient(null)}
              >
                <Text style={styles.actionButtonText}>Fermer</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f7f7f7",
    padding: 20,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 20,
    color: "#333",
    textAlign: "center",
  },
  exportButton: {
    backgroundColor: "#ffc107",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 15,
  },
  exportButtonText: {
    color: "#333",
    fontSize: 16,
    fontWeight: "bold",
  },
  searchContainer: {
    marginBottom: 15,
  },
  searchInput: {
    backgroundColor: "#fff",
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ccc",
    color: "#333",
  },
  listContainer: {
    paddingBottom: 100,
  },
  clientItem: {
    backgroundColor: "#fff",
    padding: 15,
    marginBottom: 10,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  clientName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  clientDetail: {
    fontSize: 14,
    color: "#666",
    marginTop: 4,
  },
  addButton: {
    backgroundColor: "#007bff",
    paddingVertical: 15,
    borderRadius: 8,
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  addButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    width: "90%",
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 20,
    maxHeight: "80%",
  },
  detailModalContainer: {
    width: "90%",
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 20,
    maxHeight: "90%",
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 15,
    color: "#333",
    textAlign: "center",
  },
  modalContent: {
    paddingBottom: 20,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    marginVertical: 8,
    fontSize: 16,
    color: "#333",
  },
  modalButton: {
    backgroundColor: "#007bff",
    padding: 12,
    borderRadius: 8,
    marginVertical: 8,
    alignItems: "center",
  },
  modalButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  fileName: {
    fontStyle: "italic",
    color: "#555",
    marginTop: 5,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
  },
  actionButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginHorizontal: 5,
  },
  editButton: {
    backgroundColor: "#17a2b8",
  },
  cancelButton: {
    backgroundColor: "#dc3545",
  },
  actionButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  detailText: {
    fontSize: 16,
    marginVertical: 4,
    color: "#444",
  },
  detailLabel: {
    fontWeight: "bold",
    color: "#333",
  },
  attachmentContainer: {
    marginTop: 10,
  },
  attachmentText: {
    fontSize: 15,
    color: "#666",
    marginLeft: 10,
    marginTop: 2,
  },
});

export default ClientsScreen;
