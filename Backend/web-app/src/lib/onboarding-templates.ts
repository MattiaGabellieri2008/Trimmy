export type ServiceTemplate = {
  name: string;
  category: string;
};

export const ONBOARDING_TEMPLATES: Record<string, ServiceTemplate[]> = {
  "Parrucchiere": [
    { name: "Taglio Uomo", category: "Taglio" },
    { name: "Taglio Donna", category: "Taglio" },
    { name: "Piega", category: "Piega" },
    { name: "Colore Radice", category: "Colore" },
    { name: "Balayage", category: "Schiariture" },
    { name: "Trattamento Ristrutturante", category: "Cura dei capelli" }
  ],
  "Barbiere": [
    { name: "Taglio Classico", category: "Taglio" },
    { name: "Taglio Sfumatura a pelle", category: "Taglio" },
    { name: "Regolazione Barba a macchinetta", category: "Barba" },
    { name: "Rasatura Barba all'italiana", category: "Barba" },
    { name: "Trattamento Viso Relax", category: "Viso" }
  ],
  "Centro Estetico": [
    { name: "Manicure Semipermanente", category: "Unghie" },
    { name: "Pedicure Curativo", category: "Unghie" },
    { name: "Pulizia del Viso", category: "Viso" },
    { name: "Massaggio Relax (60 min)", category: "Corpo" },
    { name: "Epilazione Gamba Intera", category: "Epilazione" },
    { name: "Laminazione Ciglia", category: "Viso" }
  ]
};
