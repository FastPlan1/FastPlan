# 🚕 Taxi Backend

Backend pour l'application de gestion de taxi avec géolocalisation, notifications push et gestion des véhicules.

## 🚀 Fonctionnalités

- ✅ **Authentification JWT**
- ✅ **Gestion des utilisateurs** (patrons, chauffeurs)
- ✅ **Planning des courses**
- ✅ **Gestion des clients**
- ✅ **Géolocalisation temps réel**
- ✅ **Notifications push**
- ✅ **Gestion des véhicules**
- ✅ **Contrôle technique et visites périodiques**
- ✅ **Socket.IO pour temps réel**

## 📦 Installation

```bash
# Installer les dépendances
npm install

# Créer le fichier .env
cp .env.example .env

# Démarrer en développement
npm run dev

# Démarrer en production
npm start
```

## 🔧 Variables d'environnement

```env
MONGO_URI=mongodb+srv://user:password@cluster.mongodb.net/taxi-app
JWT_SECRET=votre-secret-jwt-super-securise
PORT=5000
```

## 📡 API Endpoints

### Authentification
- `POST /api/auth/register` - Inscription
- `POST /api/auth/login` - Connexion
- `POST /api/auth/forgot-password` - Mot de passe oublié

### Véhicules
- `GET /api/vehicles` - Liste des véhicules
- `POST /api/vehicles` - Créer un véhicule
- `PUT /api/vehicles/:id` - Modifier un véhicule
- `DELETE /api/vehicles/:id` - Supprimer un véhicule

### Planning
- `GET /api/planning` - Liste du planning
- `POST /api/planning` - Créer une course
- `PUT /api/planning/:id` - Modifier une course

### Géolocalisation
- `PUT /api/vehicles/:id/location` - Mettre à jour la position

## 🛠️ Technologies

- **Node.js** - Runtime JavaScript
- **Express.js** - Framework web
- **MongoDB** - Base de données
- **Mongoose** - ODM MongoDB
- **Socket.IO** - Communication temps réel
- **JWT** - Authentification
- **Firebase Admin** - Notifications push

## 📱 Déploiement

Le backend est déployé sur **Render** et se connecte automatiquement à MongoDB Atlas.

## 🔗 Frontend

Le frontend React Native est disponible dans le dossier `taxi-app/`.

---

**Développé par Nevers73** 🚕✨ 
