// src/context/AuthContext.js

import React, { createContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { API_BASE_URL } from "../config";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser]               = useState(null);
  const [token, setToken]             = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading]         = useState(true);

  // Au démarrage, on restaure user + token
  useEffect(() => {
    const loadCredentials = async () => {
      try {
        const json = await AsyncStorage.getItem("credentials");
        if (json) {
          const { user: storedUser, token: storedToken } = JSON.parse(json);
          // on peuple axios
          axios.defaults.headers.common["Authorization"] = `Bearer ${storedToken}`;
          setUser(storedUser);
          setToken(storedToken);
          setIsAuthenticated(true);
        }
      } catch (e) {
        console.error("❌ Erreur restauration credentials :", e);
      } finally {
        setLoading(false);
      }
    };
    loadCredentials();
  }, []);

  // Fonction de login
  const login = async (email, password) => {
    try {
      const res = await axios.post(`${API_BASE_URL}/auth/login`, { email, password });
      // Supposons que ton backend renvoie { user, token }
      const { user: userData, token: jwt } = res.data;

      // On configure axios pour tous les appels suivants
      axios.defaults.headers.common["Authorization"] = `Bearer ${jwt}`;
      setToken(jwt);

      // Formattage du user (ajout de id pour simplicité)
      const formattedUser = {
        ...userData,
        id: userData._id,
      };
      setUser(formattedUser);
      setIsAuthenticated(true);

      // On stocke
      await AsyncStorage.setItem(
        "credentials",
        JSON.stringify({ user: formattedUser, token: jwt })
      );
    } catch (err) {
      console.error("❌ Erreur login :", err);
      throw err.response?.data?.message || "Erreur serveur pendant la connexion.";
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem("credentials");
      delete axios.defaults.headers.common["Authorization"];
      setUser(null);
      setToken(null);
      setIsAuthenticated(false);
    } catch (err) {
      console.error("❌ Erreur déconnexion :", err);
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, token, isAuthenticated, login, logout, loading }}
    >
      {children}
    </AuthContext.Provider>
  );
};
