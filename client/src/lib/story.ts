import { useLanguageStore, type Language } from "./i18n";

/**
 * One short terminal-style briefing per chapter. Chapter 13 is the Rift, the
 * bonus sector after Omega. A missing translation falls back to English.
 */
type Story = Record<number, string>;

const en: Story = {
  1: "> SYSTEM ONLINE.\nA dormant grid wakes beneath the city. Trace one line through every node: your first handshake with the network.",
  2: "> ENTERING SECTOR 02.\nThe signs flicker in rhythm with the circuits. Find your flow, and mind the walls.",
  3: "> INCOMING TRAFFIC.\nOne-way currents carry packets across the grid. Read the arrows, or the stream will carry you off course.",
  4: "> TRACE DETECTED.\nSomething watches from the dark. Paired nodes must fall in order. There is no room for guesses.",
  5: "> CLOCKS RISING.\nThe core runs hotter than it should. Wormholes open between distant nodes: use them before they close.",
  6: "> DEPTH: 6,000 NODES.\nBelow the surface the grid grows dense. Trust your instincts; the map will not hold your hand.",
  7: "> ICE WALL AHEAD.\nDefence programs freeze every wrong turn. One line, no mercy.",
  8: "> THE EDGE OF THE MAP.\nEverything bends toward the centre. Hold your line against the pull.",
  9: "> SYNC REQUIRED.\nThe core keeps its own time. Some nodes answer only on their count: arrive early or late and they stay dark.",
  10: "> POINT OF NO RETURN.\nEvery step is counted now. Nothing escapes, and nothing can be wasted.",
  11: "> POWER LOSS.\nThe grid goes dark. Only the nodes near your head still glow, so remember what you saw.",
  12: "> FINAL CIRCUIT.\nEverything you learned meets in one last grid. Close the loop and wake the network.",
  13: "> UNKNOWN SIGNAL.\nBeyond Omega the grid keeps growing. New rules, no map. Welcome to the Rift.",
};

const sv: Story = {
  1: "> SYSTEMET ÄR ONLINE.\nEtt vilande nät vaknar under staden. Dra en linje genom varje nod: din första handskakning med nätverket.",
  2: "> TILLTRÄDE SEKTOR 02.\nSkyltarna flimrar i takt med kretsarna. Hitta ditt flöde och se upp för murarna.",
  3: "> INKOMMANDE TRAFIK.\nEnkelriktade strömmar bär paket över nätet. Läs pilarna, annars för strömmen dig vilse.",
  4: "> SPÅRNING UPPTÄCKT.\nNågot bevakar dig i mörkret. Parade noder måste tas i ordning. Här finns inget utrymme för gissningar.",
  5: "> KLOCKORNA STIGER.\nKärnan går varmare än den borde. Maskhål öppnas mellan avlägsna noder: använd dem innan de stänger.",
  6: "> DJUP: 6 000 NODER.\nUnder ytan blir nätet tätt. Lita på din instinkt; kartan håller dig inte i handen.",
  7: "> ISMUR FRAMFÖR.\nFörsvarsprogram fryser varje felsteg. En linje, ingen nåd.",
  8: "> KARTANS KANT.\nAllt böjer sig mot mitten. Håll din linje mot dragningen.",
  9: "> SYNK KRÄVS.\nKärnan har sin egen tid. Vissa noder svarar bara på sin räkning: kommer du för tidigt eller sent förblir de mörka.",
  10: "> PUNKTEN UTAN RETUR.\nVarje steg räknas nu. Inget slipper undan och inget får slösas bort.",
  11: "> STRÖMAVBROTT.\nNätet slocknar. Bara noderna nära ditt huvud lyser, så minns vad du sett.",
  12: "> SISTA KRETSEN.\nAllt du lärt dig möts i ett sista nät. Sluta slingan och väck nätverket.",
  13: "> OKÄND SIGNAL.\nBortom Omega fortsätter nätet att växa. Nya regler, ingen karta. Välkommen till Rämnan.",
};

const tr: Story = {
  1: "> SİSTEM ÇEVRİMİÇİ.\nŞehrin altında uyuyan bir ağ uyanıyor. Her düğümden geçen tek bir çizgi çiz: ağla ilk el sıkışman.",
  2: "> SEKTÖR 02'YE GİRİŞ.\nTabelalar devrelerin ritmiyle titreşiyor. Akışını bul ve duvarlara dikkat et.",
  3: "> GELEN TRAFİK.\nTek yönlü akımlar paketleri ağ boyunca taşır. Okları oku, yoksa akım seni yoldan çıkarır.",
  4: "> İZ TESPİT EDİLDİ.\nKaranlıkta bir şey seni izliyor. Eşleşen düğümler sırayla alınmalı. Tahmine yer yok.",
  5: "> SAATLER HIZLANIYOR.\nÇekirdek olması gerekenden sıcak çalışıyor. Uzak düğümler arasında solucan delikleri açılıyor: kapanmadan kullan.",
  6: "> DERİNLİK: 6.000 DÜĞÜM.\nYüzeyin altında ağ yoğunlaşıyor. İçgüdülerine güven; harita seni elinden tutmaz.",
  7: "> BUZ DUVARI İLERİDE.\nSavunma programları her yanlış dönüşü dondurur. Tek çizgi, merhamet yok.",
  8: "> HARİTANIN KENARI.\nHer şey merkeze doğru eğiliyor. Çekime karşı çizgini koru.",
  9: "> SENKRON GEREKLİ.\nÇekirdeğin kendi zamanı var. Bazı düğümler yalnızca kendi sırasında yanıt verir: erken ya da geç gelirsen karanlık kalırlar.",
  10: "> DÖNÜŞÜ OLMAYAN NOKTA.\nArtık her adım sayılıyor. Hiçbir şey kaçamaz, hiçbir şey boşa gidemez.",
  11: "> ELEKTRİK KESİNTİSİ.\nAğ karardı. Yalnızca başına yakın düğümler parlıyor, gördüklerini hatırla.",
  12: "> SON DEVRE.\nÖğrendiğin her şey son bir ağda buluşuyor. Döngüyü kapat ve ağı uyandır.",
  13: "> BİLİNMEYEN SİNYAL.\nOmega'nın ötesinde ağ büyümeye devam ediyor. Yeni kurallar, harita yok. Yarığa hoş geldin.",
};

const es: Story = {
  1: "> SISTEMA EN LÍNEA.\nUna red dormida despierta bajo la ciudad. Traza una línea por cada nodo: tu primer apretón de manos con la red.",
  2: "> ENTRANDO AL SECTOR 02.\nLos letreros parpadean al ritmo de los circuitos. Encuentra tu flujo y cuidado con los muros.",
  3: "> TRÁFICO ENTRANTE.\nCorrientes de sentido único llevan paquetes por la red. Lee las flechas o la corriente te desviará.",
  4: "> RASTREO DETECTADO.\nAlgo te vigila desde la oscuridad. Los nodos emparejados deben caer en orden. No hay lugar para adivinar.",
  5: "> LOS RELOJES SUBEN.\nEl núcleo funciona más caliente de lo debido. Se abren agujeros de gusano entre nodos lejanos: úsalos antes de que se cierren.",
  6: "> PROFUNDIDAD: 6.000 NODOS.\nBajo la superficie la red se vuelve densa. Confía en tu instinto; el mapa no te llevará de la mano.",
  7: "> MURO DE HIELO ADELANTE.\nLos programas de defensa congelan cada giro equivocado. Una línea, sin piedad.",
  8: "> EL BORDE DEL MAPA.\nTodo se curva hacia el centro. Mantén tu línea contra la atracción.",
  9: "> SINCRONÍA REQUERIDA.\nEl núcleo lleva su propio tiempo. Algunos nodos solo responden a su cuenta: llega pronto o tarde y seguirán a oscuras.",
  10: "> PUNTO SIN RETORNO.\nAhora cada paso cuenta. Nada escapa y nada puede desperdiciarse.",
  11: "> CORTE DE ENERGÍA.\nLa red se apaga. Solo brillan los nodos cerca de tu cabeza, así que recuerda lo que viste.",
  12: "> CIRCUITO FINAL.\nTodo lo que aprendiste se une en una última red. Cierra el bucle y despierta la red.",
  13: "> SEÑAL DESCONOCIDA.\nMás allá de Omega la red sigue creciendo. Reglas nuevas, sin mapa. Bienvenido a la Grieta.",
};

const stories: Record<Language, Story> = { en, sv, tr, es };

export function getChapterStory(chapterId: number): string {
  const language = useLanguageStore.getState().language;
  return stories[language]?.[chapterId] ?? en[chapterId] ?? "";
}

const SEEN_KEY = "neon_path_chapters_seen";

/** Per-device convenience: losing it only shows a briefing again. */
export function hasSeenChapterIntro(chapterId: number): boolean {
  try {
    return (JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]") as number[]).includes(chapterId);
  } catch {
    return false;
  }
}

export function markChapterIntroSeen(chapterId: number) {
  try {
    const seen = JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]") as number[];
    if (!seen.includes(chapterId)) localStorage.setItem(SEEN_KEY, JSON.stringify([...seen, chapterId]));
  } catch {
    // Storage blocked: the briefing simply shows again next time.
  }
}
