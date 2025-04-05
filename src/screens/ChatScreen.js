import React, { useEffect, useState, useContext, useRef } from "react";
import {
  View,
  Modal,
  Text,
  TouchableOpacity,
  Alert,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  Image,
  FlatList,
} from "react-native";
import axios from "axios";
import moment from "moment";
import { AuthContext } from "../context/AuthContext";
import { API_BASE_URL } from "../config";
import { io } from "socket.io-client";

// Initialisation de Socket.io
const socket = io(API_BASE_URL.replace("/api", ""), {
  transports: ["websocket"],
});

export default function ChatScreen({ route, navigation }) {
  const { user } = useContext(AuthContext);
  const { conversationId, conversationName } = route.params || {};
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [menuVisible, setMenuVisible] = useState(false);

  // Référence pour le TextInput pour conserver le focus après envoi
  const inputRef = useRef(null);

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
    fetchMessages();

    // Écoute des nouveaux messages via Socket.io
    socket.on("newMessage", (data) => {
      if (data.conversationId === conversationId) {
        setMessages((prevMessages) => [
          ...prevMessages,
          { ...data, sender: { _id: data.sender } },
        ]);
      }
    });

    // Rejoindre la room correspondant à la conversation
    socket.emit("joinRoom", conversationId);

    return () => {
      socket.off("newMessage");
    };
  }, [conversationId]);

  // Récupération des messages depuis l'API
  const fetchMessages = async () => {
    try {
      const res = await axios.get(
        `${API_BASE_URL}/chat/messages/${conversationId}?userId=${user.id}`
      );
      setMessages(res.data);
    } catch (err) {
      console.error("❌ Erreur chargement messages :", err.message);
      Alert.alert("Erreur", "Impossible de charger les messages.");
    }
  };

  // Envoi d'un nouveau message
  const handleSend = async () => {
    if (!text.trim()) return;
    const newMsg = {
      conversationId,
      sender: user.id,
      text,
    };
    try {
      await axios.post(`${API_BASE_URL}/chat/send`, newMsg);
      socket.emit("sendMessage", newMsg);
      setText("");
      inputRef.current && inputRef.current.focus();
    } catch (err) {
      console.error("❌ Erreur envoi message :", err.message);
      Alert.alert("Erreur", "Impossible d'envoyer le message.");
    }
  };

  // Fonctions placeholders pour le menu (⋮)
  const quitGroup = () => {
    Alert.alert("Quitter le groupe", "Action non implémentée");
    setMenuVisible(false);
  };
  const renameGroup = () => {
    Alert.alert("Renommer le groupe", "Action non implémentée");
    setMenuVisible(false);
  };
  const changePhoto = () => {
    Alert.alert("Ajouter une photo", "Action non implémentée");
    setMenuVisible(false);
  };

  // Rendu d'un message dans la liste
  const renderMessage = ({ item }) => {
    const isMine = item.sender._id === user.id || item.sender === user.id;
    return (
      <View style={[styles.msgContainer, isMine ? styles.msgRight : styles.msgLeft]}>
        <View style={[styles.msgBubble, isMine ? styles.bubbleMine : styles.bubbleOther]}>
          <Text style={[styles.msgText, isMine && { color: "#fff" }]}>
            {item.text}
          </Text>
          <Text style={styles.msgTime}>
            {moment(item.createdAt).format("HH:mm")}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* En-tête */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.headerBack}>←</Text>
        </TouchableOpacity>
        <Image
          source={{ uri: "https://via.placeholder.com/40" }}
          style={styles.headerAvatar}
        />
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {conversationName || "Contact Name"}
          </Text>
          <Text style={styles.headerSubtitle}>En ligne</Text>
        </View>
        <View style={styles.headerIcons}>
          <TouchableOpacity onPress={() => setMenuVisible(true)}>
            <Text style={styles.headerIcon}>⋮</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Liste des messages */}
      <FlatList
        data={messages}
        keyExtractor={(item) => item._id || Math.random().toString()}
        renderItem={renderMessage}
        style={styles.msgList}
        contentContainerStyle={styles.msgListContainer}
      />

      {/* Barre d'envoi */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={90}
      >
        <View style={styles.inputBar}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="Tape ton message..."
            placeholderTextColor="#888"
          />
          <TouchableOpacity style={styles.sendBtn} onPress={handleSend}>
            <Text style={styles.sendText}>📨</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Menu Modal */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          onPress={() => setMenuVisible(false)}
        >
          <View style={styles.menuContainer}>
            <TouchableOpacity onPress={quitGroup} style={styles.menuItem}>
              <Text style={styles.menuItemText}>Quitter le groupe</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={renameGroup} style={styles.menuItem}>
              <Text style={styles.menuItemText}>Renommer le groupe</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={changePhoto} style={styles.menuItem}>
              <Text style={styles.menuItemText}>Ajouter une photo</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F0F0F0",
  },
  header: {
    backgroundColor: "#000",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
    elevation: 4,
  },
  headerBack: {
    color: "#FFF",
    fontSize: 24,
    marginRight: 10,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#CCC",
  },
  headerInfo: {
    marginLeft: 10,
    flex: 1,
  },
  headerTitle: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  headerSubtitle: {
    color: "#FFF",
    fontSize: 12,
    opacity: 0.8,
  },
  headerIcons: {
    flexDirection: "row",
    marginLeft: "auto",
  },
  headerIcon: {
    color: "#FFF",
    fontSize: 20,
    marginHorizontal: 15,
  },
  msgList: {
    flex: 1,
  },
  msgListContainer: {
    padding: 10,
  },
  msgContainer: {
    marginVertical: 5,
    flexDirection: "row",
  },
  msgLeft: {
    justifyContent: "flex-start",
  },
  msgRight: {
    justifyContent: "flex-end",
  },
  msgBubble: {
    maxWidth: "80%",
    padding: 10,
    borderRadius: 8,
    marginHorizontal: 10,
  },
  bubbleMine: {
    backgroundColor: "#111",
  },
  bubbleOther: {
    backgroundColor: "#FFF",
  },
  msgText: {
    fontSize: 15,
    marginBottom: 5,
    color: "#000",
  },
  msgTime: {
    fontSize: 10,
    color: "#666",
    textAlign: "right",
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    padding: 8,
    borderTopWidth: 1,
    borderTopColor: "#ddd",
  },
  input: {
    flex: 1,
    backgroundColor: "#FFF",
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "#CCC",
    marginRight: 10,
    fontSize: 16,
    color: "#333",
  },
  sendBtn: {
    backgroundColor: "#000",
    padding: 10,
    borderRadius: 20,
  },
  sendText: {
    color: "#FFF",
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "flex-start",
    alignItems: "flex-end",
  },
  menuContainer: {
    backgroundColor: "#FFF",
    width: 180,
    marginTop: 60,
    marginRight: 10,
    borderRadius: 8,
    overflow: "hidden",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  menuItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#EEE",
  },
  menuItemText: {
    fontSize: 16,
    color: "#000",
  },
});


