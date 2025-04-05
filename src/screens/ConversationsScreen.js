import React, { useEffect, useState, useContext } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Image,
  TextInput,
  StyleSheet,
  SafeAreaView,
} from "react-native";
import axios from "axios";
import moment from "moment";
import { AuthContext } from "../context/AuthContext";
import { API_BASE_URL } from "../config";

// Avatar par défaut (URL placeholder)
const defaultAvatarUrl = "https://via.placeholder.com/50";

export default function ConversationsScreen({ navigation }) {
  const { user } = useContext(AuthContext);
  const [conversations, setConversations] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchConversations = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/chat/user/${user.id}`);
      setConversations(res.data);
    } catch (err) {
      console.error("❌ Erreur chargement conversations :", err.message);
    }
  };

  // Filtrer les conversations par nom ou contact
  const filteredConversations = conversations.filter((conv) => {
    const isGroup = conv.isGroup;
    const contact = conv.members.find((m) => m._id !== user.id);
    const conversationTitle = isGroup
      ? conv.name
      : contact
      ? contact.name
      : "Conversation";

    return conversationTitle
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
  });

  const renderItem = ({ item, index }) => {
    const isGroup = item.isGroup;
    const contact = item.members.find((m) => m._id !== user.id);
    const conversationTitle = isGroup
      ? item.name
      : contact
      ? contact.name
      : "Conversation";

    const lastMessageText = item.lastMessage || "Dernier message...";
    const lastTime = item.lastTime
      ? item.lastTime
      : moment(item.updatedAt || item.createdAt).format("HH:mm");

    return (
      <TouchableOpacity
        style={styles.conversationItem}
        onPress={() =>
          navigation.navigate("Chat", {
            conversationId: item._id,
            conversationName: conversationTitle,
          })
        }
      >
        <Image source={{ uri: defaultAvatarUrl }} style={styles.avatar} />
        <View style={styles.convTextContainer}>
          <View style={styles.rowBetween}>
            <Text style={styles.convName} numberOfLines={1}>
              {conversationTitle}
            </Text>
            <Text style={styles.convTime}>{lastTime}</Text>
          </View>
          <Text style={styles.convLastMsg} numberOfLines={1}>
            {lastMessageText}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* En-tête */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>MessageApp</Text>
        <View style={styles.headerIcons}>
          <Text style={styles.headerIcon}>🔍</Text>
          <Text style={styles.headerIcon}>⋮</Text>
        </View>
      </View>

      {/* Onglet "CHATS" */}
      <View style={styles.tabContainer}>
        <Text style={[styles.tabText, styles.tabActive]}>CHATS</Text>
      </View>

      {/* Barre de recherche */}
      <View style={styles.searchContainer}>
        <TextInput
          placeholder="Rechercher..."
          style={styles.searchInput}
          value={searchTerm}
          onChangeText={setSearchTerm}
          placeholderTextColor="#777"
        />
      </View>

      {/* Liste des conversations */}
      <FlatList
        data={filteredConversations}
        keyExtractor={(item, index) =>
          item._id ? item._id.toString() : index.toString()
        }
        renderItem={renderItem}
        contentContainerStyle={styles.listContainer}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  header: {
    backgroundColor: "#075E54",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 15,
    paddingVertical: 12,
    elevation: 4,
  },
  headerTitle: {
    fontSize: 20,
    color: "#FFFFFF",
    fontWeight: "bold",
  },
  headerIcons: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerIcon: {
    fontSize: 20,
    color: "#FFFFFF",
    marginLeft: 20,
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#075E54",
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  tabText: {
    color: "#FFFFFF",
    marginRight: 20,
    fontSize: 16,
    fontWeight: "bold",
    opacity: 0.6,
  },
  tabActive: {
    opacity: 1,
    textDecorationLine: "underline",
  },
  searchContainer: {
    backgroundColor: "#ECE5DD",
    padding: 8,
  },
  searchInput: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 5,
    color: "#333",
  },
  listContainer: {
    paddingBottom: 20,
  },
  conversationItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#EFEFEF",
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 10,
    backgroundColor: "#CCC",
  },
  convTextContainer: {
    flex: 1,
    justifyContent: "center",
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  convName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#222",
    marginBottom: 4,
  },
  convTime: {
    fontSize: 12,
    color: "#999",
    marginLeft: 5,
  },
  convLastMsg: {
    fontSize: 14,
    color: "#555",
    marginRight: 30,
  },
});
