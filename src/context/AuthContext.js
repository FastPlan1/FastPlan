import React, { createContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { API_BASE_URL } from "../config";
import { v4 as uuidv4 } from "uuid";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const storedUser = await AsyncStorage.getItem("user");
        if (storedUser) {
          const parsed = JSON.parse(storedUser);
          if (!parsed.id && parsed._id) parsed.id = parsed._id;

          setUser(parsed);
          setIsAuthenticated(true);
        }
      } catch (error) {
        console.error("❌ Erreur chargement utilisateur :", error);
      } finally {
        setLoading(false);
      }
    };
    loadUser();
  }, []);

  const login = async (email, password) => {
    try {
      const res = await axios.post(`${API_BASE_URL}/auth/login`, { email, password });
      const userData = res.data.user;

      let entrepriseId = userData.entrepriseId;

      // ✅ Utilisation d'un UUID comme identifiant temporaire
      if (!entrepriseId && userData.role === "patron") {
        try {
          const entrepriseRes = await axios.get(`${API_BASE_URL}/entreprise/by-user/${userData._id}`);
          entrepriseId = entrepriseRes.data.entrepriseId;
      
          // Met à jour le backend (juste au cas où)
          await axios.patch(`${API_BASE_URL}/auth/users/${userData._id}`, {
            entrepriseId,
          });
        } catch (e) {
          console.warn("⚠️ Impossible de récupérer ou mettre à jour l'entreprise :", e.message);
          entrepriseId = `temp-${uuidv4()}`; // fallback si la requête échoue
        }
      }
      

      const formattedUser = {
        ...userData,
        id: userData._id,
        entrepriseId,
      };

      await AsyncStorage.setItem("user", JSON.stringify(formattedUser));
      setUser(formattedUser);
      setIsAuthenticated(true);
    } catch (error) {
      console.error("❌ Erreur login :", error);
      throw error.response?.data?.message || "❌ Erreur serveur pendant la connexion.";
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem("user");
      setUser(null);
      setIsAuthenticated(false);
    } catch (error) {
      console.error("❌ Erreur déconnexion :", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
