const newCourse = new Planning({
  nom: reservation.nom,
  prenom: reservation.prenom,
  depart: reservation.depart,
  arrive: reservation.arrive,
  date: reservation.date,
  heure: reservation.heure,
  description: reservation.description,
  statut: "En attente",
  chauffeur: "Patron",
  color: "#1a73e8",
  entrepriseId: reservation.entrepriseId, // 👈 Ajout pour filtrer par entreprise
});