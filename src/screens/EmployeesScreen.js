import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  StyleSheet,
  RefreshControl,
  ScrollView,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import axios from "axios";
import { API_BASE_URL } from "../config";

const EmployeesScreen = () => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    setLoading(true);
    const token = await AsyncStorage.getItem("userToken");
    try {
      const response = await axios.get(`${API_BASE_URL}/employees`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setEmployees(response.data);
    } catch (error) {
      Alert.alert("❌ Erreur", "Impossible de récupérer les employés.");
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchEmployees();
    setRefreshing(false);
  };

  const generateInviteLink = async () => {
    try {
      const token = await AsyncStorage.getItem("userToken");
      const response = await axios.post(
        `${API_BASE_URL}/employees/generate-invite`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await Clipboard.setStringAsync(response.data.inviteLink);
      Alert.alert("✅ Lien copié", "Le lien d’invitation a été copié dans le presse-papier !");
    } catch (error) {
      Alert.alert("❌ Erreur", "Impossible de générer le lien.");
    }
  };

  const renderEmployeeItem = ({ item }) => (
    <View style={styles.employeeCard}>
      <Text style={styles.employeeName}>{item.name}</Text>
    </View>
  );

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#007bff" />}
    >
      <Text style={styles.title}>👥 Mes Employés</Text>

      {loading ? (
        <ActivityIndicator size="large" color="#007bff" style={styles.loader} />
      ) : (
        <FlatList
          data={employees}
          keyExtractor={(item) => item._id}
          renderItem={renderEmployeeItem}
          contentContainerStyle={styles.listContainer}
          scrollEnabled={false}
        />
      )}

      <TouchableOpacity style={styles.addButton} onPress={generateInviteLink}>
        <Text style={styles.addButtonText}>➕ Ajouter un chauffeur</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: "#F5F5F5", 
    padding: 20 
  },
  title: { 
    fontSize: 24, 
    fontWeight: "bold", 
    color: "#333", 
    marginBottom: 20, 
    textAlign: "center" 
  },
  loader: {
    marginVertical: 20,
  },
  listContainer: {
    paddingBottom: 100,
  },
  employeeCard: { 
    backgroundColor: "#FFF", 
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
    fontSize: 18, 
    fontWeight: "bold", 
    color: "#333" 
  },
  addButton: { 
    backgroundColor: "#28A745", 
    paddingVertical: 15, 
    borderRadius: 10, 
    alignItems: "center", 
    marginTop: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  addButtonText: { 
    color: "#FFFFFF", 
    fontSize: 18, 
    fontWeight: "bold" 
  },
});

export default EmployeesScreen;
