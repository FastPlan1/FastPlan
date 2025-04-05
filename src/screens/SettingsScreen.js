import React from "react";
import { View, Text, StyleSheet } from "react-native";

const SettingsScreen = () => {
    return (
        <View style={styles.container}>
            <Text style={styles.title}>⚙️ Paramètres</Text>
            <Text style={styles.text}>Gestion des paramètres utilisateur.</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: "center", alignItems: "center" },
    title: { fontSize: 24, fontWeight: "bold" },
    text: { fontSize: 18, marginTop: 10 },
});

export default SettingsScreen;
