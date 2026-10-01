/**
 * DJI Drone Detection from EXIF Metadata
 * Maps EXIF Model codes to human-readable drone names.
 * Source: https://commons.wikimedia.org/wiki/DJI_camera_model_names
 */

const DJI_MODELS: Record<string, string> = {
  // Mavic Pro
  'FC220': 'Mavic Pro',

  // Mavic 2
  'L1D-20c': 'Mavic 2 Pro (Hasselblad)',
  'L1D-20C': 'Mavic 2 Pro (Hasselblad)',
  'FC2220': 'Mavic 2 Zoom',
  'FC2204': 'Mavic 2 Enterprise',
  'FC2403': 'Mavic 2 Enterprise Dual',
  'MAVIC2-ENTERPRISE-ADVANCED': 'Mavic 2 Enterprise Advanced',

  // Mavic 3 Series
  'L2D-20c': 'Mavic 3',
  'L2D-20C': 'Mavic 3',
  'FC4170': 'Mavic 3 (Tele)',
  'FC4382': 'Mavic 3 Pro (Medium Tele)',
  'FC4370': 'Mavic 3 Pro (Tele)',
  'M3E': 'Mavic 3E Enterprise',
  'M3M': 'Mavic 3M Multispectral',
  'M3T': 'Mavic 3T Thermal',

  // Mavic 4 Pro
  'L3D-100c': 'Mavic 4 Pro (Hasselblad)',
  'L3D-100C': 'Mavic 4 Pro (Hasselblad)',
  'FC9284': 'Mavic 4 Pro (Medium Tele)',
  'FC9287': 'Mavic 4 Pro (Tele)',

  // Air Series
  'FC230': 'Mavic Air',
  'FC2103': 'Mavic Air',
  'FC3170': 'Mavic Air 2',
  'FC3411': 'Air 2S',
  'FC8282': 'Air 3 (Wide)',
  'FC8284': 'Air 3 (Medium Tele)',
  'FC9113': 'Air 3S (Wide)',
  'FC9184': 'Air 3S (Medium Tele)',

  // Mini Series
  'FC7203': 'Mavic Mini / Mini SE',
  'FC7303': 'Mini 2',
  'FC7503': 'Mini 2 SE',
  'FC7703': 'Mini 4K',
  'FC3682': 'Mini 3',
  'FC3582': 'Mini 3 Pro',
  'FC8482': 'Mini 4 Pro',
  'FC9313': 'Mini 5 Pro',

  // Phantom Series
  'FC200': 'Phantom 2 Vision',
  'FC300S': 'Phantom 3 Advanced',
  'FC300X': 'Phantom 3 Professional',
  'FC300C': 'Phantom 3 Standard',
  'FC300XW': 'Phantom 3 4K',
  'FC300SE': 'Phantom 3 SE',
  'FC330': 'Phantom 4',
  'FC6310': 'Phantom 4 Pro',
  'FC6310S': 'Phantom 4 Pro V2',
  'FC6310R': 'Phantom 4 RTK',
  'FC6360': 'P4 Multispectral',

  // Inspire Series
  'FC350': 'Inspire 1 (Zenmuse X3)',
  'FC550': 'Inspire 1 (Zenmuse X5)',
  'FC550RAW': 'Inspire 1 (Zenmuse X5R)',
  'FC6510': 'Inspire 2 (Zenmuse X4S)',
  'FC6520': 'Inspire 2 (Zenmuse X5S)',
  'FC6540': 'Inspire 2 (Zenmuse X7)',
  'FC4280': 'Inspire 3 (Zenmuse X9-8K Air)',

  // FPV / Avata / Neo / Flip
  'FC3305': 'FPV',
  'FC8183': 'Avata',
  'FC8485': 'Avata 2',
  'FC8671': 'Neo',
  'FC8582': 'Flip',

  // Spark
  'FC1102': 'Spark',

  // Ryze Tello
  'RZ001': 'Ryze Tello',

  // Osmo / Action Cameras
  'FC350Z': 'Osmo',
  'Osmo Pocket': 'Osmo Pocket',
  'DJI Pocket': 'Pocket 2',
  'PP-101': 'Osmo Pocket 3',
  'Osmo Action': 'Osmo Action',
  'MC211': 'Action 2',
  'AC002': 'Osmo Action 3',
  'AC003': 'Osmo Action 4',
  'AC004': 'Osmo Action 5 Pro',
};

/**
 * Detects the camera/drone model from EXIF metadata.
 * For DJI devices, translates cryptic FC codes to readable names.
 * For other cameras, returns Make + Model as-is.
 * @returns Human-readable camera name or null if no Make/Model found.
 */
export function detectCamera(rawExif?: Record<string, any>): string | null {
  if (!rawExif) return null;

  const make = (rawExif['Make'] || '').toString().trim();
  const model = (rawExif['Model'] || '').toString().trim();

  if (!make && !model) return null;

  // DJI: translate cryptic FC codes to readable drone names
  if (make.toLowerCase().includes('dji')) {
    const knownName = DJI_MODELS[model];
    if (knownName) return `DJI ${knownName}`;
    if (model) return `DJI (${model})`;
    return 'DJI (Unknown Model)';
  }

  // Other cameras: combine Make + Model, avoid duplicates
  // e.g. Canon "Canon EOS R5" → "Canon EOS R5" (not "Canon Canon EOS R5")
  if (model.toLowerCase().startsWith(make.toLowerCase())) {
    return model;
  }

  if (make && model) return `${make} ${model}`;
  return make || model;
}
