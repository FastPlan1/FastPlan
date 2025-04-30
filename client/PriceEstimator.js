import React, { useState, useEffect } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import {
  Card,
  CardContent,
  CardHeader,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
  Grid,
  Divider,
  Typography,
  Box,
  CircularProgress,
  Tooltip,
  IconButton,
  Paper
} from '@mui/material';
import {
  LocationOn,
  DirectionsCar,
  EventNote,
  LocalOffer,
  Luggage,
  Pets,
  AirplanemodeActive,
  Timer,
  InfoOutlined,
  PictureAsPdf
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import PriceApi from '../api/priceApi';
import ClientApi from '../api/clientApi'; // Assurez-vous que cela existe
import PlacesAutocomplete from './PlacesAutocomplete'; // Composant pour Google Places

// Schéma de validation Yup
const validationSchema = Yup.object({
  origin: Yup.string().required('Le point de départ est requis'),
  destination: Yup.string().required('La destination est requise'),
  date: Yup.date().required('La date est requise'),
  vehicleType: Yup.string().required('Le type de véhicule est requis'),
  passengers: Yup.number().min(1, 'Minimum 1 passager').max(100, 'Maximum 100 passagers').required('Le nombre de passagers est requis'),
  luggageCount: Yup.number().min(0, 'Minimum 0 bagage').required('Le nombre de bagages est requis'),
});

const PriceEstimator = ({ onGenerateQuote, initialValues, clientId, readOnly = false }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [estimate, setEstimate] = useState(null);
  const [promoCodeValue, setPromoCodeValue] = useState('');
  const [promoCodeApplied, setPromoCodeApplied] = useState(null);
  const [clientInfo, setClientInfo] = useState(null);
  const [stops, setStops] = useState([]);

  // Récupérer les infos client si clientId est fourni
  useEffect(() => {
    if (clientId) {
      const fetchClientInfo = async () => {
        try {
          const client = await ClientApi.getClientById(clientId);
          setClientInfo(client);
        } catch (error) {
          console.error('Erreur lors de la récupération des informations client:', error);
        }
      };
      
      fetchClientInfo();
    }
  }, [clientId]);

  // Initialiser formik avec les valeurs par défaut ou les valeurs fournies
  const formik = useFormik({
    initialValues: initialValues || {
      origin: '',
      destination: '',
      date: new Date().toISOString().split('T')[0],
      time: new Date().toTimeString().slice(0, 5),
      vehicleType: 'standard',
      passengers: 1,
      luggageCount: 0,
      withPet: false,
      isAirport: false,
      waitingTime: 0,
    },
    validationSchema,
    onSubmit: async (values) => {
      try {
        setIsLoading(true);
        
        // Construire l'objet date
        const dateTime = new Date(`${values.date}T${values.time}`);
        
        // Préparer les paramètres
        const params = {
          origin: values.origin,
          destination: values.destination,
          stops: stops,
          date: dateTime.toISOString(),
          vehicleType: values.vehicleType,
          passengers: values.passengers,
          luggageCount: values.luggageCount,
          withPet: values.withPet,
          isAirport: values.isAirport,
          waitingTime: values.waitingTime,
          clientId: clientId || undefined,
          promoCode: promoCodeApplied?.code
        };
        
        // Appeler l'API
        const result = await PriceApi.estimatePrice(params);
        setEstimate(result);
        
        // Notification
        toast.success('Estimation du prix réalisée avec succès!');
      } catch (error) {
        console.error('Erreur lors de l\'estimation:', error);
        toast.error('Erreur lors de l\'estimation du prix');
      } finally {
        setIsLoading(false);
      }
    },
  });

  // Gérer l'ajout d'un arrêt
  const handleAddStop = () => {
    setStops([...stops, '']);
  };

  // Gérer la modification d'un arrêt
  const handleStopChange = (index, value) => {
    const newStops = [...stops];
    newStops[index] = value;
    setStops(newStops);
  };

  // Gérer la suppression d'un arrêt
  const handleRemoveStop = (index) => {
    const newStops = [...stops];
    newStops.splice(index, 1);
    setStops(newStops);
  };

  // Vérifier un code promo
  const handleVerifyPromoCode = async () => {
    if (!promoCodeValue) {
      toast.warn('Veuillez entrer un code promo');
      return;
    }
    
    try {
      setIsLoading(true);
      
      const result = await PriceApi.verifyPromoCode({
        code: promoCodeValue,
        amount: estimate?.totalPrice || 0,
        vehicleType: formik.values.vehicleType,
        clientId: clientId
      });
      
      setPromoCodeApplied(result);
      toast.success(`Code promo valide: ${result.description || result.code}`);
    } catch (error) {
      console.error('Erreur lors de la vérification du code promo:', error);
      toast.error(error.response?.data?.message || 'Code promo invalide');
      setPromoCodeApplied(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Générer un devis PDF
  const handleGenerateQuote = async () => {
    if (!estimate) {
      toast.warn('Veuillez d\'abord estimer le prix');
      return;
    }
    
    try {
      setIsLoading(true);
      
      // Préparer les données pour le devis
      const quoteData = {
        estimation: estimate,
        clientInfo: clientInfo || {
          name: 'Client',
          address: formik.values.origin,
          phone: '',
          email: ''
        },
        title: 'DEVIS DE COURSE',
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // Valable 30 jours
        notes: `Devis généré le ${new Date().toLocaleDateString()} à ${new Date().toLocaleTimeString()}`
      };
      
      // Générer le PDF
      await PriceApi.generateQuote(quoteData);
      
      // Si un callback est fourni, l'appeler avec l'estimation
      if (onGenerateQuote) {
        onGenerateQuote(estimate);
      }
    } catch (error) {
      console.error('Erreur lors de la génération du devis:', error);
      toast.error('Erreur lors de la génération du devis');
    } finally {
      setIsLoading(false);
    }
  };

  // Réinitialiser l'estimation
  const handleReset = () => {
    formik.resetForm();
    setStops([]);
    setEstimate(null);
    setPromoCodeValue('');
    setPromoCodeApplied(null);
  };

  return (
    <Card variant="outlined" sx={{ mb: 3 }}>
      <CardHeader 
        title="Estimateur de prix" 
        subheader="Calculez le prix d'une course"
        action={
          <Tooltip title="L'estimation est basée sur la distance, le temps, et les suppléments applicables">
            <IconButton>
              <InfoOutlined />
            </IconButton>
          </Tooltip>
        }
      />
      
      <Divider />
      
      <CardContent>
        <form onSubmit={formik.handleSubmit}>
          <Grid container spacing={3}>
            {/* Origine */}
            <Grid item xs={12} md={6}>
              <PlacesAutocomplete
                label="Adresse de départ"
                value={formik.values.origin}
                onChange={(value) => formik.setFieldValue('origin', value)}
                error={formik.touched.origin && Boolean(formik.errors.origin)}
                helperText={formik.touched.origin && formik.errors.origin}
                disabled={readOnly}
                startAdornment={<LocationOn color="primary" />}
              />
            </Grid>
            
            {/* Destination */}
            <Grid item xs={12} md={6}>
              <PlacesAutocomplete
                label="Adresse d'arrivée"
                value={formik.values.destination}
                onChange={(value) => formik.setFieldValue('destination', value)}
                error={formik.touched.destination && Boolean(formik.errors.destination)}
                helperText={formik.touched.destination && formik.errors.destination}
                disabled={readOnly}
                startAdornment={<LocationOn color="secondary" />}
              />
            </Grid>
            
            {/* Arrêts */}
            {stops.map((stop, index) => (
              <Grid item xs={12} key={`stop-${index}`}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <PlacesAutocomplete
                    label={`Arrêt ${index + 1}`}
                    value={stop}
                    onChange={(value) => handleStopChange(index, value)}
                    disabled={readOnly}
                    startAdornment={<LocationOn color="info" />}
                    fullWidth
                  />
                  <Button 
                    variant="outlined" 
                    color="error" 
                    onClick={() => handleRemoveStop(index)}
                    disabled={readOnly}
                    sx={{ ml: 1 }}
                  >
                    Supprimer
                  </Button>
                </Box>
              </Grid>
            ))}
            
            {!readOnly && (
              <Grid item xs={12}>
                <Button 
                  variant="outlined" 
                  color="primary" 
                  onClick={handleAddStop}
                  startIcon={<LocationOn />}
                >
                  Ajouter un arrêt
                </Button>
              </Grid>
            )}
            
            {/* Date et heure */}
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                id="date"
                name="date"
                label="Date"
                type="date"
                value={formik.values.date}
                onChange={formik.handleChange}
                error={formik.touched.date && Boolean(formik.errors.date)}
                helperText={formik.touched.date && formik.errors.date}
                InputProps={{
                  startAdornment: <EventNote color="primary" sx={{ mr: 1 }} />,
                }}
                disabled={readOnly}
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                id="time"
                name="time"
                label="Heure"
                type="time"
                value={formik.values.time}
                onChange={formik.handleChange}
                InputProps={{
                  startAdornment: <EventNote color="primary" sx={{ mr: 1 }} />,
                }}
                disabled={readOnly}
              />
            </Grid>
            
            {/* Type de véhicule */}
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel id="vehicleType-label">Type de véhicule</InputLabel>
                <Select
                  labelId="vehicleType-label"
                  id="vehicleType"
                  name="vehicleType"
                  value={formik.values.vehicleType}
                  onChange={formik.handleChange}
                  error={formik.touched.vehicleType && Boolean(formik.errors.vehicleType)}
                  disabled={readOnly}
                  startAdornment={<DirectionsCar color="primary" sx={{ mr: 1 }} />}
                >
                  <MenuItem value="standard">Berline standard</MenuItem>
                  <MenuItem value="premium">Berline premium</MenuItem>
                  <MenuItem value="van">Van (jusqu'à 8 passagers)</MenuItem>
                  <MenuItem value="luxury">Luxe</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            {/* Nombre de passagers */}
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                id="passengers"
                name="passengers"
                label="Nombre de passagers"
                type="number"
                value={formik.values.passengers}
                onChange={formik.handleChange}
                error={formik.touched.passengers && Boolean(formik.errors.passengers)}
                helperText={formik.touched.passengers && formik.errors.passengers}
                disabled={readOnly}
                InputProps={{
                  inputProps: { min: 1, max: 100 }
                }}
              />
            </Grid>
            
            {/* Options supplémentaires */}
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                id="luggageCount"
                name="luggageCount"
                label="Nombre de bagages"
                type="number"
                value={formik.values.luggageCount}
                onChange={formik.handleChange}
                error={formik.touched.luggageCount && Boolean(formik.errors.luggageCount)}
                helperText={formik.touched.luggageCount && formik.errors.luggageCount}
                disabled={readOnly}
                InputProps={{
                  startAdornment: <Luggage color="primary" sx={{ mr: 1 }} />,
                  inputProps: { min: 0 }
                }}
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                id="waitingTime"
                name="waitingTime"
                label="Temps d'attente prévu (minutes)"
                type="number"
                value={formik.values.waitingTime}
                onChange={formik.handleChange}
                disabled={readOnly}
                InputProps={{
                  startAdornment: <Timer color="primary" sx={{ mr: 1 }} />,
                  inputProps: { min: 0 }
                }}
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Checkbox
                    id="withPet"
                    name="withPet"
                    checked={formik.values.withPet}
                    onChange={formik.handleChange}
                    disabled={readOnly}
                    icon={<Pets />}
                    checkedIcon={<Pets color="primary" />}
                  />
                }
                label="Animal de compagnie"
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Checkbox
                    id="isAirport"
                    name="isAirport"
                    checked={formik.values.isAirport}
                    onChange={formik.handleChange}
                    disabled={readOnly}
                    icon={<AirplanemodeActive />}
                    checkedIcon={<AirplanemodeActive color="primary" />}
                  />
                }
                label="Course aéroport"
              />
            </Grid>
            
            {/* Boutons d'action */}
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
                {!readOnly && (
                  <Button
                    variant="contained"
                    color="primary"
                    type="submit"
                    disabled={isLoading}
                    startIcon={isLoading ? <CircularProgress size={20} /> : <LocalOffer />}
                  >
                    Estimer le prix
                  </Button>
                )}
                
                {!readOnly && (
                  <Button
                    variant="outlined"
                    color="secondary"
                    onClick={handleReset}
                    disabled={isLoading}
                  >
                    Réinitialiser
                  </Button>
                )}
              </Box>
            </Grid>
          </Grid>
        </form>
        
        {/* Résultat de l'estimation */}
        {estimate && (
          <Paper elevation={3} sx={{ mt: 4, p: 3, bgcolor: 'background.default' }}>
            <Typography variant="h6" gutterBottom color="primary">
              Résultat de l'estimation
            </Typography>
            
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1">
                  Distance: {estimate.route.distance.toFixed(2)} km
                </Typography>
                <Typography variant="subtitle1">
                  Durée estimée: {Math.round(estimate.route.duration)} minutes
                </Typography>
                <Typography variant="subtitle1">
                  Prix de base: {estimate.basePrice.toFixed(2)} €
                </Typography>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1">
                  Prix distance: {estimate.distancePrice.toFixed(2)} €
                </Typography>
                <Typography variant="subtitle1">
                  Prix durée: {estimate.durationPrice.toFixed(2)} €
                </Typography>
                {estimate.surchargeTotal > 0 && (
                  <Typography variant="subtitle1">
                    Suppléments: {estimate.surchargeTotal.toFixed(2)} €
                  </Typography>
                )}
              </Grid>
              
              {promoCodeApplied && (
                <Grid item xs={12}>
                  <Typography variant="subtitle1" color="secondary">
                    Remise: -{promoCodeApplied.discount.toFixed(2)} € ({promoCodeApplied.description || `Code ${promoCodeApplied.code}`})
                  </Typography>
                </Grid>
              )}
              
              <Grid item xs={12}>
                <Divider sx={{ my: 2 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="h5" color="primary" fontWeight="bold">
                    Prix total: {(promoCodeApplied
                      ? estimate.totalPrice - promoCodeApplied.discount
                      : estimate.totalPrice
                    ).toFixed(2)} €
                  </Typography>
                  
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <TextField
                      label="Code promo"
                      variant="outlined"
                      size="small"
                      value={promoCodeValue}
                      onChange={(e) => setPromoCodeValue(e.target.value)}
                      disabled={readOnly || isLoading || !!promoCodeApplied}
                      sx={{ mr: 1 }}
                    />
                    <Button
                      variant="outlined"
                      onClick={handleVerifyPromoCode}
                      disabled={readOnly || isLoading || !promoCodeValue || !!promoCodeApplied}
                    >
                      Appliquer
                    </Button>
                  </Box>
                </Box>
              </Grid>
              
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                  <Button
                    variant="contained"
                    color="secondary"
                    onClick={handleGenerateQuote}
                    disabled={isLoading}
                    startIcon={<PictureAsPdf />}
                  >
                    Générer un devis
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </Paper>
        )}
      </CardContent>
    </Card>
  );
};

export default PriceEstimator;