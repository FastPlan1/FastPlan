import axios from 'axios';
import { toast } from 'react-toastify';

const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

/**
 * Client API pour les fonctionnalités liées aux prix et devis
 */
const PriceApi = {
  /**
   * Estime le prix d'une course
   * @param {Object} params - Paramètres pour l'estimation
   * @returns {Promise<Object>} - Estimation détaillée
   */
  estimatePrice: async (params) => {
    try {
      const response = await axios.post(`${BASE_URL}/price/estimate`, params, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      return response.data;
    } catch (error) {
      console.error('Erreur lors de l\'estimation du prix:', error);
      toast.error(error.response?.data?.message || 'Erreur lors de l\'estimation du prix');
      throw error;
    }
  },
  
  /**
   * Génère un devis PDF pour une course
   * @param {Object} data - Données pour le devis
   * @returns {Promise<Blob>} - Fichier PDF
   */
  generateQuote: async (data) => {
    try {
      const response = await axios.post(`${BASE_URL}/price/generate-quote`, data, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        responseType: 'blob' // Important pour recevoir un fichier binaire
      });
      
      // Créer une URL pour le fichier reçu
      const fileURL = window.URL.createObjectURL(new Blob([response.data]));
      const fileLink = document.createElement('a');
      
      fileLink.href = fileURL;
      fileLink.setAttribute('download', `devis_${Date.now()}.pdf`);
      document.body.appendChild(fileLink);
      
      fileLink.click();
      fileLink.remove();
      
      toast.success('Devis généré avec succès!');
      return fileURL;
    } catch (error) {
      console.error('Erreur lors de la génération du devis:', error);
      toast.error('Erreur lors de la génération du devis');
      throw error;
    }
  },
  
  /**
   * Récupère les paramètres de tarification
   * @returns {Promise<Object>} - Paramètres de tarification
   */
  getPriceSettings: async () => {
    try {
      const response = await axios.get(`${BASE_URL}/price/settings`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      return response.data;
    } catch (error) {
      console.error('Erreur lors de la récupération des paramètres de tarification:', error);
      toast.error('Erreur lors de la récupération des paramètres de tarification');
      throw error;
    }
  },
  
  /**
   * Met à jour les paramètres de tarification
   * @param {Object} settings - Nouveaux paramètres
   * @returns {Promise<Object>} - Paramètres mis à jour
   */
  updatePriceSettings: async (settings) => {
    try {
      const response = await axios.put(`${BASE_URL}/price/settings`, settings, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      toast.success('Paramètres de tarification mis à jour avec succès!');
      return response.data;
    } catch (error) {
      console.error('Erreur lors de la mise à jour des paramètres de tarification:', error);
      toast.error(error.response?.data?.message || 'Erreur lors de la mise à jour des paramètres');
      throw error;
    }
  },
  
  /**
   * Récupère les codes promo disponibles
   * @returns {Promise<Array>} - Liste des codes promo
   */
  getPromoCodes: async () => {
    try {
      const response = await axios.get(`${BASE_URL}/promocodes`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      return response.data;
    } catch (error) {
      console.error('Erreur lors de la récupération des codes promo:', error);
      toast.error('Erreur lors de la récupération des codes promo');
      throw error;
    }
  },
  
  /**
   * Crée un nouveau code promo
   * @param {Object} promoCode - Données du code promo
   * @returns {Promise<Object>} - Code promo créé
   */
  createPromoCode: async (promoCode) => {
    try {
      const response = await axios.post(`${BASE_URL}/promocodes`, promoCode, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      toast.success('Code promo créé avec succès!');
      return response.data;
    } catch (error) {
      console.error('Erreur lors de la création du code promo:', error);
      toast.error(error.response?.data?.message || 'Erreur lors de la création du code promo');
      throw error;
    }
  },
  
  /**
   * Vérifie la validité d'un code promo
   * @param {Object} data - Données pour la vérification
   * @returns {Promise<Object>} - Résultat de la vérification
   */
  verifyPromoCode: async (data) => {
    try {
      const response = await axios.post(`${BASE_URL}/promocodes/verify`, data, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      return response.data;
    } catch (error) {
      console.error('Erreur lors de la vérification du code promo:', error);
      throw error;
    }
  },
  
  /**
   * Applique un code promo
   * @param {Object} data - Données pour l'application du code
   * @returns {Promise<Object>} - Résultat de l'application
   */
  applyPromoCode: async (data) => {
    try {
      const response = await axios.post(`${BASE_URL}/promocodes/apply`, data, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      toast.success('Code promo appliqué avec succès!');
      return response.data;
    } catch (error) {
      console.error('Erreur lors de l\'application du code promo:', error);
      toast.error(error.response?.data?.message || 'Code promo invalide ou inapplicable');
      throw error;
    }
  }
};

export default PriceApi;