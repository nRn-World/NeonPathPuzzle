import { useLanguageStore, type Language } from "./i18n";

/**
 * Translated names and descriptions for the game's content (achievements,
 * power-ups, chapters, themes). English lives next to the content itself and is
 * the fallback, so adding a language never breaks a missing entry.
 */
type Pair = { name: string; description: string };
type Achievement = Pair & { reward: string };
type Chapter = { name: string; tagline: string };

interface Pack {
  achievements: Record<string, Achievement>;
  powerUps: Record<string, Pair>;
  chapters: Record<number, Chapter>;
  themes: Record<string, Pair>;
  /** UI words used by the content panels. */
  words: { progress: string; levelsRange: string; rarity: Record<string, string> };
}

const sv: Pack = {
  achievements: {
    first_steps: { name: "Första stegen", description: "Klara din första nivå", reward: "Power-up: Ångra-sköld" },
    getting_started: { name: "Igång", description: "Klara 10 nivåer", reward: "Power-up: Vägvisare" },
    dedicated_player: { name: "Hängiven spelare", description: "Klara 50 nivåer", reward: "Lås upp temat Retro Wave" },
    master_puzzler: { name: "Pusselmästare", description: "Klara 100 nivåer", reward: "Lås upp temat Cosmic" },
    perfectionist: { name: "Perfektionist", description: "Klara 10 nivåer utan ledtråd", reward: "Power-up: Ångra-sköld" },
    speed_demon: { name: "Fartdjävul", description: "Klara en nivå på under 30 sekunder", reward: "Power-up: Tidsfrysning" },
    power_collector: { name: "Power-samlare", description: "Samla 10 power-ups", reward: "Power-up: Poängboost" },
    theme_explorer: { name: "Temaupptäckare", description: "Prova alla tillgängliga teman", reward: "Lås upp temat Matrix" },
    legendary_puzzler: { name: "Legendarisk pusslare", description: "Klara 200 nivåer", reward: "Lås upp temat Neon Sunset" },
    omega_architect: { name: "Omega-arkitekt", description: "Klara alla 300 nivåer", reward: "Lås upp temat Aurora" },
    perfect_run: { name: "Perfekt serie", description: "Klara 25 nivåer utan en enda backning", reward: "Titelmärke: Perfekt" },
  },
  powerUps: {
    time_freeze: { name: "Tidsfrysning", description: "Pausa nivåtimern i 30 sekunder" },
    path_hint: { name: "Vägvisare", description: "Visa hela vägen i 5 sekunder" },
    undo_protection: { name: "Ångra-sköld", description: "Din nästa backning kostar ingen stjärna, men räknas som en av de tre backningarna" },
    score_multiplier: { name: "Poängboost", description: "Dubbla poäng i de nästa 3 nivåerna" },
  },
  chapters: {
    1: { name: "Boot Sequence", tagline: "Lär dig linjen" },
    2: { name: "Neon District", tagline: "Hitta ditt flow" },
    3: { name: "Data Stream", tagline: "Läs rutnätet" },
    4: { name: "Ghost Protocol", tagline: "Inget utrymme för gissningar" },
    5: { name: "Overclock", tagline: "Elitnivån börjar" },
    6: { name: "Deep Net", tagline: "Lita på din instinkt" },
    7: { name: "Black Ice", tagline: "En linje, ingen nåd" },
    8: { name: "Singularity", tagline: "Kartans rand" },
    9: { name: "Quantum Core", tagline: "Synk-noder håller takten" },
    10: { name: "Event Horizon", tagline: "Varje steg räknas" },
    11: { name: "Blackout", tagline: "Ljus bara där du står" },
    12: { name: "Omega", tagline: "Den sista kretsen" },
  },
  themes: {
    cyberpunk: { name: "Cyberpunk", description: "Klassiskt neonblått och violett" },
    retro: { name: "Retro Wave", description: "Rosa och cyan från 80-talet" },
    cosmic: { name: "Cosmic", description: "Djupblå rymd med guld" },
    matrix: { name: "Matrix", description: "Grönt digitalt regn" },
    sunset: { name: "Neon Sunset", description: "Varm orange och violett solnedgång" },
    aurora: { name: "Aurora", description: "Polargrönt, violett och korallljus" },
  },
  words: { progress: "Framsteg", levelsRange: "Nivå {from}–{to}", rarity: { bronze: "brons", silver: "silver", gold: "guld", platinum: "platina", diamond: "diamant" } },
};

const tr: Pack = {
  achievements: {
    first_steps: { name: "İlk Adımlar", description: "İlk seviyeni tamamla", reward: "Güçlendirici: Geri Alma Kalkanı" },
    getting_started: { name: "Isınma", description: "10 seviye tamamla", reward: "Güçlendirici: Yol Gösterici" },
    dedicated_player: { name: "Kararlı Oyuncu", description: "50 seviye tamamla", reward: "Retro Wave temasının kilidini aç" },
    master_puzzler: { name: "Bulmaca Ustası", description: "100 seviye tamamla", reward: "Cosmic temasının kilidini aç" },
    perfectionist: { name: "Mükemmeliyetçi", description: "10 seviyeyi ipucu kullanmadan tamamla", reward: "Güçlendirici: Geri Alma Kalkanı" },
    speed_demon: { name: "Hız Canavarı", description: "Bir seviyeyi 30 saniyenin altında tamamla", reward: "Güçlendirici: Zaman Dondurma" },
    power_collector: { name: "Güç Koleksiyoncusu", description: "10 güçlendirici topla", reward: "Güçlendirici: Puan Artışı" },
    theme_explorer: { name: "Tema Kaşifi", description: "Tüm temaları dene", reward: "Matrix temasının kilidini aç" },
    legendary_puzzler: { name: "Efsanevi Bulmacacı", description: "200 seviye tamamla", reward: "Neon Sunset temasının kilidini aç" },
    omega_architect: { name: "Omega Mimarı", description: "300 seviyenin hepsini tamamla", reward: "Aurora temasının kilidini aç" },
    perfect_run: { name: "Kusursuz Seri", description: "25 seviyeyi tek bir geri alma yapmadan tamamla", reward: "Unvan rozeti: Kusursuz" },
  },
  powerUps: {
    time_freeze: { name: "Zaman Dondurma", description: "Seviye süresini 30 saniye durdur" },
    path_hint: { name: "Yol Gösterici", description: "Tüm yolu 5 saniye göster" },
    undo_protection: { name: "Geri Alma Kalkanı", description: "Bir sonraki geri alman yıldıza mal olmaz ama üç geri alma hakkından birini harcar" },
    score_multiplier: { name: "Puan Artışı", description: "Sonraki 3 seviyede 2 kat puan" },
  },
  chapters: {
    1: { name: "Boot Sequence", tagline: "Çizgiyi öğren" },
    2: { name: "Neon District", tagline: "Akışını bul" },
    3: { name: "Data Stream", tagline: "Izgarayı oku" },
    4: { name: "Ghost Protocol", tagline: "Tahmine yer yok" },
    5: { name: "Overclock", tagline: "Elit seviye başlıyor" },
    6: { name: "Deep Net", tagline: "İç güdülerine güven" },
    7: { name: "Black Ice", tagline: "Tek çizgi, merhamet yok" },
    8: { name: "Singularity", tagline: "Haritanın kenarı" },
    9: { name: "Quantum Core", tagline: "Senkron düğümler ritmi tutar" },
    10: { name: "Event Horizon", tagline: "Her adım sayılır" },
    11: { name: "Blackout", tagline: "Işık sadece durduğun yerde" },
    12: { name: "Omega", tagline: "Son devre" },
  },
  themes: {
    cyberpunk: { name: "Cyberpunk", description: "Klasik neon mavi ve mor" },
    retro: { name: "Retro Wave", description: "80'lerden ilham alan pembe ve camgöbeği" },
    cosmic: { name: "Cosmic", description: "Altın dokunuşlu derin uzay mavisi" },
    matrix: { name: "Matrix", description: "Yeşil dijital yağmur" },
    sunset: { name: "Neon Sunset", description: "Sıcak turuncu ve mor gün batımı" },
    aurora: { name: "Aurora", description: "Kutup yeşili, mor ve mercan ışığı" },
  },
  words: { progress: "İlerleme", levelsRange: "Seviye {from}–{to}", rarity: { bronze: "bronz", silver: "gümüş", gold: "altın", platinum: "platin", diamond: "elmas" } },
};

const es: Pack = {
  achievements: {
    first_steps: { name: "Primeros pasos", description: "Supera tu primer nivel", reward: "Potenciador: Escudo de deshacer" },
    getting_started: { name: "Calentando", description: "Supera 10 niveles", reward: "Potenciador: Revelar camino" },
    dedicated_player: { name: "Jugador dedicado", description: "Supera 50 niveles", reward: "Desbloquea el tema Retro Wave" },
    master_puzzler: { name: "Maestro de puzles", description: "Supera 100 niveles", reward: "Desbloquea el tema Cosmic" },
    perfectionist: { name: "Perfeccionista", description: "Supera 10 niveles sin usar pistas", reward: "Potenciador: Escudo de deshacer" },
    speed_demon: { name: "Demonio de la velocidad", description: "Supera un nivel en menos de 30 segundos", reward: "Potenciador: Congelar tiempo" },
    power_collector: { name: "Coleccionista de poder", description: "Reúne 10 potenciadores", reward: "Potenciador: Impulso de puntos" },
    theme_explorer: { name: "Explorador de temas", description: "Prueba todos los temas disponibles", reward: "Desbloquea el tema Matrix" },
    legendary_puzzler: { name: "Puzzlero legendario", description: "Supera 200 niveles", reward: "Desbloquea el tema Neon Sunset" },
    omega_architect: { name: "Arquitecto Omega", description: "Supera los 300 niveles", reward: "Desbloquea el tema Aurora" },
    perfect_run: { name: "Racha perfecta", description: "Supera 25 niveles sin un solo retroceso", reward: "Insignia de título: Perfecto" },
  },
  powerUps: {
    time_freeze: { name: "Congelar tiempo", description: "Pausa el cronómetro del nivel durante 30 segundos" },
    path_hint: { name: "Revelar camino", description: "Muestra el camino completo durante 5 segundos" },
    undo_protection: { name: "Escudo de deshacer", description: "Tu próximo retroceso no cuesta una estrella, pero gasta uno de los tres retrocesos" },
    score_multiplier: { name: "Impulso de puntos", description: "Puntos x2 en los próximos 3 niveles" },
  },
  chapters: {
    1: { name: "Boot Sequence", tagline: "Aprende la línea" },
    2: { name: "Neon District", tagline: "Encuentra tu ritmo" },
    3: { name: "Data Stream", tagline: "Lee la cuadrícula" },
    4: { name: "Ghost Protocol", tagline: "Sin lugar para adivinar" },
    5: { name: "Overclock", tagline: "Empieza la élite" },
    6: { name: "Deep Net", tagline: "Confía en tu instinto" },
    7: { name: "Black Ice", tagline: "Una línea, sin piedad" },
    8: { name: "Singularity", tagline: "El borde del mapa" },
    9: { name: "Quantum Core", tagline: "Los nodos de sincronía marcan el ritmo" },
    10: { name: "Event Horizon", tagline: "Cada paso cuenta" },
    11: { name: "Blackout", tagline: "Luz solo donde estás" },
    12: { name: "Omega", tagline: "El circuito final" },
  },
  themes: {
    cyberpunk: { name: "Cyberpunk", description: "Azul neón y violeta clásicos" },
    retro: { name: "Retro Wave", description: "Rosa y cian al estilo de los 80" },
    cosmic: { name: "Cosmic", description: "Azul espacial profundo con dorado" },
    matrix: { name: "Matrix", description: "Lluvia digital verde" },
    sunset: { name: "Neon Sunset", description: "Atardecer cálido naranja y violeta" },
    aurora: { name: "Aurora", description: "Luz polar verde, violeta y coral" },
  },
  words: { progress: "Progreso", levelsRange: "Niveles {from}–{to}", rarity: { bronze: "bronce", silver: "plata", gold: "oro", platinum: "platino", diamond: "diamante" } },
};

const packs: Partial<Record<Language, Pack>> = { sv, tr, es };

function pack(): Pack | undefined {
  return packs[useLanguageStore.getState().language];
}

/**
 * Call these from components that already re-render on language change (they
 * use useI18n); the pack is read from the store at call time.
 */
export const content = {
  achievement: <T extends { id: string; name: string; description: string; reward: { description: string } }>(item: T) => {
    const text = pack()?.achievements[item.id];
    return {
      name: text?.name ?? item.name,
      description: text?.description ?? item.description,
      reward: text?.reward ?? item.reward.description,
    };
  },
  powerUp: <T extends { id: string; name: string; description: string }>(item: T) => {
    const text = pack()?.powerUps[item.id];
    return { name: text?.name ?? item.name, description: text?.description ?? item.description };
  },
  chapter: <T extends { id: number; name: string; tagline: string }>(item: T) => {
    const text = pack()?.chapters[item.id];
    return { name: text?.name ?? item.name, tagline: text?.tagline ?? item.tagline };
  },
  theme: <T extends { id: string; name: string; description: string }>(item: T) => {
    const text = pack()?.themes[item.id];
    return { name: text?.name ?? item.name, description: text?.description ?? item.description };
  },
  rarity: (rarity: string) => pack()?.words.rarity[rarity] ?? rarity,
  progress: () => pack()?.words.progress ?? "Progress",
  levelsRange: (from: number, to: number) =>
    (pack()?.words.levelsRange ?? "Levels {from}–{to}").replace("{from}", String(from)).replace("{to}", String(to)),
};
