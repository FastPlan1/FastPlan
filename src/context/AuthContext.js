import React, { createContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { API_BASE_URL } from "../config";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser]               = useState(null);
  const [isAuthenticated, setAuth]    = useState(false);
  const [loading, setLoading]         = useState(true);

  // Configure axios si on a un token en cache
  const loadStored = async () => {
    const token = await AsyncStorage.getItem("userToken");
    if (token) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      setAuth(true);
    }
    const storedUser = await AsyncStorage.getItem("user");
    if (storedUser) setUser(JSON.parse(storedUser));
    setLoading(false);
  };

  useEffect(() => {
    loadStored();
  }, []);

  const login = async (email, password) => {
    try {
      const res = await axios.post(`${API_BASE_URL}/auth/login`, { email, password });
      const { token, user: userData } = res.data;

      // on configure Axios et on stocke
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      await AsyncStorage.setItem("userToken", token);

      const formatted = { ...userData, id: userData._id };
      await AsyncStorage.setItem("user", JSON.stringify(formatted));

      setUser(formatted);
      setAuth(true);
    } catch (err) {
      console.error("❌ Erreur login :", err);
      throw err.response?.data?.message || "Erreur serveur pendant la connexion.";
    }
  };

  const logout = async () => {
    delete axios.defaults.headers.common["Authorization"];
    await AsyncStorage.removeItem("userToken");
    await AsyncStorage.removeItem("user");
    setUser(null);
    setAuth(false);
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
