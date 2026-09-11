/**
 * Reference data shared by the dev seed and the production reference script:
 * municipalities with SCB codes and centroids, and districts inside them.
 * Data only, no users, no listings.
 */
export type Muni = [code: string, sv: string, en: string, lat: number, lon: number, county?: [string, string, string]];
export const STOCKHOLM_COUNTY: [string, string, string] = ["01", "Stockholms län", "Stockholm County"];
export const MUNIS: Muni[] = [
  ["0114", "Upplands Väsby", "Upplands Väsby", 59.518, 17.911],
  ["0115", "Vallentuna", "Vallentuna", 59.535, 18.078],
  ["0117", "Österåker", "Österåker", 59.479, 18.3],
  ["0120", "Värmdö", "Värmdö", 59.318, 18.55],
  ["0123", "Järfälla", "Järfälla", 59.423, 17.836],
  ["0125", "Ekerö", "Ekerö", 59.291, 17.809],
  ["0126", "Huddinge", "Huddinge", 59.237, 17.982],
  ["0127", "Botkyrka", "Botkyrka", 59.2, 17.831],
  ["0128", "Salem", "Salem", 59.205, 17.77],
  ["0136", "Haninge", "Haninge", 59.168, 18.145],
  ["0138", "Tyresö", "Tyresö", 59.244, 18.288],
  ["0139", "Upplands-Bro", "Upplands-Bro", 59.52, 17.64],
  ["0140", "Nykvarn", "Nykvarn", 59.18, 17.43],
  ["0160", "Täby", "Täby", 59.444, 18.069],
  ["0162", "Danderyd", "Danderyd", 59.4, 18.04],
  ["0163", "Sollentuna", "Sollentuna", 59.428, 17.951],
  ["0180", "Stockholm", "Stockholm", 59.329, 18.069],
  ["0181", "Södertälje", "Södertälje", 59.195, 17.626],
  ["0182", "Nacka", "Nacka", 59.31, 18.164],
  ["0183", "Sundbyberg", "Sundbyberg", 59.361, 17.971],
  ["0184", "Solna", "Solna", 59.36, 18.0],
  ["0186", "Lidingö", "Lidingö", 59.364, 18.15],
  ["0187", "Vaxholm", "Vaxholm", 59.403, 18.35],
  ["0188", "Norrtälje", "Norrtälje", 59.758, 18.7],
  ["0191", "Sigtuna", "Sigtuna", 59.617, 17.72],
  ["0192", "Nynäshamn", "Nynäshamn", 58.903, 17.948],
  ["1480", "Göteborg", "Gothenburg", 57.709, 11.975, ["14", "Västra Götalands län", "Västra Götaland County"]],
  ["1280", "Malmö", "Malmö", 55.605, 13.003, ["12", "Skåne län", "Skåne County"]],
  ["0380", "Uppsala", "Uppsala", 59.858, 17.639, ["03", "Uppsala län", "Uppsala County"]],
];

export const AREAS: Record<string, Array<[name: string, lat: number, lon: number]>> = {
  Göteborg: [
    ["Majorna", 57.694, 11.929],
    ["Linnéstaden", 57.695, 11.951],
    ["Angered", 57.795, 12.02],
    ["Frölunda", 57.652, 11.914],
  ],
  Malmö: [
    ["Möllevången", 55.591, 13.005],
    ["Västra Hamnen", 55.615, 12.982],
    ["Rosengård", 55.588, 13.041],
    ["Limhamn", 55.578, 12.925],
  ],
  Uppsala: [
    ["Luthagen", 59.863, 17.62],
    ["Flogsta", 59.85, 17.594],
    ["Gränby", 59.878, 17.66],
    ["Sävja", 59.797, 17.688],
  ],
  Solna: [
    ["Arenastaden", 59.371, 18.004],
    ["Hagalund", 59.358, 17.996],
    ["Råsunda", 59.365, 17.99],
    ["Bergshamra", 59.381, 18.04],
    ["Huvudsta", 59.35, 17.98],
    ["Frösunda", 59.376, 18.01],
  ],
  Stockholm: [
    ["Södermalm", 59.315, 18.07],
    ["Norrmalm", 59.335, 18.06],
    ["Kungsholmen", 59.332, 18.03],
    ["Östermalm", 59.338, 18.09],
    ["Vasastan", 59.343, 18.05],
    ["Hammarby sjöstad", 59.303, 18.1],
    ["Bromma", 59.34, 17.94],
    ["Farsta", 59.243, 18.093],
    ["Kista", 59.403, 17.944],
  ],
  Sundbyberg: [
    ["Centrala Sundbyberg", 59.361, 17.971],
    ["Hallonbergen", 59.376, 17.967],
    ["Rissne", 59.377, 17.94],
  ],
  Nacka: [
    ["Sickla", 59.306, 18.12],
    ["Saltsjö-Boo", 59.33, 18.27],
    ["Nacka strand", 59.318, 18.16],
  ],
};
